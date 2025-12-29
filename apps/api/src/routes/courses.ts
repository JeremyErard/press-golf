import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, getUser } from '../lib/auth.js';
import { badRequest, notFound, forbidden } from '../lib/errors.js';
import { fetchWebpage, extractCourseData, findScorecardLinks, fetchPdf, extractCourseDataFromPdf } from '../lib/claude.js';

// Type definitions
interface CreateCourseBody {
  name: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  tees?: {
    name: string;
    color?: string;
    slopeRating?: number;
    courseRating?: number;
    totalYardage?: number;
  }[];
  holes?: {
    holeNumber: number;
    par: number;
    handicapRank: number;
    yardages?: { teeName: string; yardage: number }[];
  }[];
}

interface UpdateCourseBody {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
}

interface SearchQuery {
  q?: string;
  state?: string;
  limit?: string;
  offset?: string;
}

export const courseRoutes: FastifyPluginAsync = async (app) => {
  // =====================
  // GET /api/courses
  // Search/list courses (public)
  // =====================
  app.get<{ Querystring: SearchQuery }>('/', async (request, reply) => {
    const { q, state, limit = '20', offset = '0' } = request.query;

    const where: Record<string, unknown> = {};

    if (q) {
      where.name = { contains: q, mode: 'insensitive' };
    }

    if (state) {
      where.state = state;
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          tees: {
            orderBy: { totalYardage: 'desc' },
          },
          _count: { select: { holes: true } },
        },
        orderBy: { name: 'asc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.course.count({ where }),
    ]);

    return {
      success: true,
      data: courses,
      meta: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    };
  });

  // =====================
  // POST /api/courses/fetch-from-url
  // Extract course data from a website URL using Claude
  // =====================
  app.post<{ Body: { url: string } }>('/fetch-from-url', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const { url } = request.body;

    if (!url || !url.trim()) {
      return badRequest(reply, 'URL is required');
    }

    try {
      // Fetch the webpage
      request.log.info({ url }, 'Fetching course webpage');
      const html = await fetchWebpage(url.trim());

      // Look for scorecard PDF links
      const scorecardLinks = findScorecardLinks(html, url.trim());
      request.log.info({ scorecardLinks }, 'Found scorecard links');

      let courseData;

      // Try to extract from PDF first (usually has better data)
      if (scorecardLinks.length > 0) {
        for (const pdfUrl of scorecardLinks) {
          request.log.info({ pdfUrl }, 'Trying to fetch scorecard PDF');
          const pdf = await fetchPdf(pdfUrl);
          if (pdf) {
            request.log.info('Extracting course data from PDF');
            try {
              courseData = await extractCourseDataFromPdf(pdf.data, url.trim());
              request.log.info({ holes: courseData.holes?.length }, 'Extracted data from PDF');
              break; // Success, stop trying other PDFs
            } catch (pdfError: any) {
              request.log.warn({ error: pdfError.message }, 'PDF extraction failed, falling back to HTML');
            }
          }
        }
      }

      // Fall back to HTML extraction if no PDF data
      if (!courseData) {
        request.log.info('Extracting course data from HTML');
        courseData = await extractCourseData(html, url.trim());
      }

      return {
        success: true,
        data: courseData,
      };
    } catch (error: any) {
      request.log.error({ error: error.message, url }, 'Failed to fetch course data');

      if (error.message.includes('ANTHROPIC_API_KEY')) {
        return badRequest(reply, 'Course extraction service not configured');
      }

      if (error.message.includes('Invalid URL')) {
        return badRequest(reply, 'Invalid URL format. Please enter a valid website URL.');
      }

      if (error.message.includes('Failed to fetch')) {
        return badRequest(reply, 'Could not access the website. Please check the URL and try again.');
      }

      return badRequest(reply, 'Failed to extract course data. Try a different URL or enter details manually.');
    }
  });

  // =====================
  // GET /api/courses/:id
  // Get single course with full details
  // =====================
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        tees: {
          orderBy: { totalYardage: 'desc' },
        },
        holes: {
          orderBy: { holeNumber: 'asc' },
          include: {
            yardages: {
              include: { tee: true },
            },
          },
        },
        createdBy: {
          select: { id: true, displayName: true },
        },
      },
    });

    if (!course) {
      return notFound(reply, 'Course not found');
    }

    return {
      success: true,
      data: course,
    };
  });

  // =====================
  // POST /api/courses
  // Create a new course (requires auth)
  // =====================
  app.post<{ Body: CreateCourseBody }>('/', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { name, city, state, country = 'USA', website, tees = [], holes = [] } = request.body;

    if (!name || name.trim().length === 0) {
      return badRequest(reply, 'Course name is required');
    }

    // Create course with tees and holes in a transaction
    const course = await prisma.$transaction(async (tx) => {
      // Create the course
      const newCourse = await tx.course.create({
        data: {
          name: name.trim(),
          city: city?.trim() || null,
          state: state?.trim() || null,
          country,
          website: website?.trim() || null,
          createdById: user.id as string,
        },
      });

      // Create tees
      const teeMap = new Map<string, string>(); // name -> id
      for (const tee of tees) {
        const createdTee = await tx.tee.create({
          data: {
            courseId: newCourse.id,
            name: tee.name,
            color: tee.color || null,
            slopeRating: tee.slopeRating || null,
            courseRating: tee.courseRating || null,
            totalYardage: tee.totalYardage || null,
          },
        });
        teeMap.set(tee.name, createdTee.id);
      }

      // Create holes and yardages
      for (const hole of holes) {
        const createdHole = await tx.hole.create({
          data: {
            courseId: newCourse.id,
            holeNumber: hole.holeNumber,
            par: hole.par,
            handicapRank: hole.handicapRank,
          },
        });

        // Create yardages for each tee
        if (hole.yardages) {
          for (const yardage of hole.yardages) {
            const teeId = teeMap.get(yardage.teeName);
            if (teeId) {
              await tx.holeYardage.create({
                data: {
                  holeId: createdHole.id,
                  teeId,
                  yardage: yardage.yardage,
                },
              });
            }
          }
        }
      }

      return newCourse;
    });

    // Fetch full course with relations
    const fullCourse = await prisma.course.findUnique({
      where: { id: course.id },
      include: {
        tees: { orderBy: { totalYardage: 'desc' } },
        holes: {
          orderBy: { holeNumber: 'asc' },
          include: { yardages: { include: { tee: true } } },
        },
      },
    });

    return {
      success: true,
      data: fullCourse,
    };
  });

  // =====================
  // PATCH /api/courses/:id
  // Update a course (requires auth, must be creator)
  // =====================
  app.patch<{ Params: { id: string }; Body: UpdateCourseBody }>('/:id', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;
    const { name, city, state, country, website } = request.body;

    // Find course and verify ownership
    const course = await prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      return notFound(reply, 'Course not found');
    }

    if (course.createdById !== (user.id as string)) {
      return forbidden(reply, 'You can only edit courses you created');
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (state !== undefined) updateData.state = state?.trim() || null;
    if (country !== undefined) updateData.country = country;
    if (website !== undefined) updateData.website = website?.trim() || null;

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: updateData,
      include: {
        tees: { orderBy: { totalYardage: 'desc' } },
        holes: { orderBy: { holeNumber: 'asc' } },
      },
    });

    return {
      success: true,
      data: updatedCourse,
    };
  });

  // =====================
  // DELETE /api/courses/:id
  // Delete a course (requires auth, must be creator)
  // =====================
  app.delete<{ Params: { id: string } }>('/:id', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;

    // Find course and verify ownership
    const course = await prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      return notFound(reply, 'Course not found');
    }

    if (course.createdById !== (user.id as string)) {
      return forbidden(reply, 'You can only delete courses you created');
    }

    await prisma.course.delete({
      where: { id },
    });

    return {
      success: true,
      data: { deleted: true },
    };
  });

  // =====================
  // POST /api/courses/:id/tees
  // Add a tee to a course
  // =====================
  app.post<{
    Params: { id: string };
    Body: { name: string; color?: string; slopeRating?: number; courseRating?: number; totalYardage?: number }
  }>('/:id/tees', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params;
    const { name, color, slopeRating, courseRating, totalYardage } = request.body;

    // Verify course exists and user is creator
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return notFound(reply, 'Course not found');
    }
    if (course.createdById !== (user.id as string)) {
      return forbidden(reply, 'You can only edit courses you created');
    }

    if (!name || name.trim().length === 0) {
      return badRequest(reply, 'Tee name is required');
    }

    const tee = await prisma.tee.create({
      data: {
        courseId: id,
        name: name.trim(),
        color: color || null,
        slopeRating: slopeRating || null,
        courseRating: courseRating || null,
        totalYardage: totalYardage || null,
      },
    });

    return {
      success: true,
      data: tee,
    };
  });
};
