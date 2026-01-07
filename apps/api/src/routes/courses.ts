import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma.js';
import { requireAuth, getUser } from '../lib/auth.js';
import { badRequest, notFound, forbidden, sendError, ErrorCodes } from '../lib/errors.js';
import { fetchWebpage, extractCourseData, findScorecardLinks, fetchPdf, extractCourseDataFromPdf } from '../lib/claude.js';
import { geocodeAddress } from '../lib/geocode.js';
import { findAndExtractHeroImage } from '../lib/course-hero.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
  heroImageUrl?: string;
}

interface SearchQuery {
  q?: string;
  state?: string;
  limit?: string;
  offset?: string;
}

export const courseRoutes: FastifyPluginAsync = async (app) => {
  // Register multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
  });

  // =====================
  // POST /api/courses/extract-from-image
  // Extract course data from scorecard photos using Claude Vision
  // Supports two images: front (hole data) and back (course info)
  // =====================
  app.post('/extract-from-image', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    // Collect files from multipart upload
    let frontImage: { buffer: Buffer; mimetype: string } | null = null;
    let backImage: { buffer: Buffer; mimetype: string } | null = null;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        if (!allowedTypes.includes(part.mimetype)) {
          return badRequest(reply, 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.');
        }

        const buffer = await part.toBuffer();

        if (part.fieldname === 'frontImage') {
          frontImage = { buffer, mimetype: part.mimetype };
        } else if (part.fieldname === 'backImage') {
          backImage = { buffer, mimetype: part.mimetype };
        }
      }
    }

    if (!frontImage) {
      return badRequest(reply, 'No front image provided');
    }

    const frontBase64 = frontImage.buffer.toString('base64');
    const frontMediaType = frontImage.mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    // Build content array with images
    const imageContent: Anthropic.ImageBlockParam[] = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: frontMediaType,
          data: frontBase64,
        },
      },
    ];

    // Add back image if provided
    if (backImage) {
      const backBase64 = backImage.buffer.toString('base64');
      const backMediaType = backImage.mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
      imageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: backMediaType,
          data: backBase64,
        },
      });
    }

    // Build prompt based on number of images
    const promptText = backImage
      ? `You are analyzing TWO images of a golf scorecard (front and back).

IMAGE 1 (FRONT): Contains the scoring grid with hole numbers, pars, yardages, and handicap rankings.
IMAGE 2 (BACK): Contains course information like name, address, website, phone number.

Extract ALL available data from BOTH images. Prioritize:
- Course name, city, state from the BACK image
- Hole data (pars, yardages, handicaps) from the FRONT image
- Tee information (colors, ratings) from the FRONT image`
      : `You are analyzing a golf scorecard image.

Extract all available data including:
- Course name (usually at top of scorecard)
- Location (city, state if visible)
- Hole data (pars, yardages, handicaps)
- Tee information (colors, ratings)`;

    const fullPrompt = `${promptText}

Look for:
- Course name (usually at top of scorecard)
- Location (city, state if visible)
- For each of the 18 holes: hole number, par, AND handicap/stroke index (HDCP, S.I., or Handicap row)
- Tee information: tee names (e.g., Blue, White, Red), yardages per hole, total yardage, slope rating, course rating

IMPORTANT: The handicap/stroke index is CRITICAL - it's usually labeled "HDCP", "HCP", "Handicap", "S.I.", or "Stroke Index" on the scorecard. It's a number 1-18 that indicates hole difficulty (1 = hardest, 18 = easiest). This is different from par. Look carefully for this row.

Return ONLY a JSON object with this exact format:
{
  "found": true,
  "courseName": "Example Golf Club",
  "city": "City Name",
  "state": "ST",
  "holes": [
    { "holeNumber": 1, "par": 4, "handicapRank": 7 },
    { "holeNumber": 2, "par": 5, "handicapRank": 1 },
    ...for all 18 holes (handicapRank is the HDCP/stroke index value, NOT the par)
  ],
  "tees": [
    {
      "name": "Blue",
      "color": "#3B82F6",
      "slopeRating": 130,
      "courseRating": 72.5,
      "totalYardage": 6800,
      "yardages": [425, 510, 185, ...for all 18 holes]
    },
    {
      "name": "White",
      "color": "#FFFFFF",
      "slopeRating": 125,
      "courseRating": 70.0,
      "totalYardage": 6200,
      "yardages": [400, 480, 165, ...for all 18 holes]
    }
  ],
  "confidence": "high"
}

Color codes to use:
- Black tees: "#000000"
- Blue tees: "#3B82F6"
- White tees: "#FFFFFF"
- Gold/Yellow tees: "#EAB308"
- Red tees: "#EF4444"
- Green tees: "#22C55E"

If you cannot extract the scorecard data, return:
{
  "found": false,
  "reason": "explanation of what went wrong"
}

Extract as much data as you can see. If some fields are not visible, omit them but still return what you can find.`;

    try {
      // Use Claude Vision to extract scorecard data
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              ...imageContent,
              {
                type: 'text',
                text: fullPrompt,
              },
            ],
          },
        ],
      });

      // Extract text from response
      const responseText = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return reply.send({
          success: false,
          error: 'Could not parse scorecard data from image',
        });
      }

      let extracted;
      try {
        extracted = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        request.log.error({ parseError, jsonMatch: jsonMatch[0] }, 'Failed to parse JSON from Claude response');
        return reply.send({
          success: false,
          error: 'Failed to parse scorecard data. Please try again or enter details manually.',
        });
      }

      if (!extracted.found) {
        return reply.send({
          success: false,
          error: extracted.reason || 'Could not find scorecard data in image',
        });
      }

      // Transform the data to match our API format
      const courseData: {
        name?: string;
        city?: string;
        state?: string;
        holes?: { holeNumber: number; par: number; handicapRank: number; yardages?: { teeName: string; yardage: number }[] }[];
        tees?: { name: string; color?: string; slopeRating?: number; courseRating?: number; totalYardage?: number }[];
        confidence?: string;
      } = {
        name: extracted.courseName,
        city: extracted.city,
        state: extracted.state,
        confidence: extracted.confidence,
      };

      // Process holes with yardages from each tee
      if (extracted.holes && Array.isArray(extracted.holes)) {
        courseData.holes = extracted.holes.map((hole: { holeNumber: number; par: number; handicapRank: number }) => {
          const holeData: { holeNumber: number; par: number; handicapRank: number; yardages?: { teeName: string; yardage: number }[] } = {
            holeNumber: hole.holeNumber,
            par: hole.par,
            handicapRank: hole.handicapRank,
          };

          // Add yardages from each tee
          if (extracted.tees && Array.isArray(extracted.tees)) {
            const yardages: { teeName: string; yardage: number }[] = [];
            extracted.tees.forEach((tee: { name: string; yardages?: number[] }) => {
              if (tee.yardages && tee.yardages[hole.holeNumber - 1]) {
                yardages.push({
                  teeName: tee.name,
                  yardage: tee.yardages[hole.holeNumber - 1],
                });
              }
            });
            if (yardages.length > 0) {
              holeData.yardages = yardages;
            }
          }

          return holeData;
        });
      }

      // Process tees (without per-hole yardages, those go in holes)
      if (extracted.tees && Array.isArray(extracted.tees)) {
        courseData.tees = extracted.tees.map((tee: { name: string; color?: string; slopeRating?: number; courseRating?: number; totalYardage?: number }) => ({
          name: tee.name,
          color: tee.color,
          slopeRating: tee.slopeRating,
          courseRating: tee.courseRating,
          totalYardage: tee.totalYardage,
        }));
      }

      return reply.send({
        success: true,
        data: courseData,
      });
    } catch (error) {
      request.log.error(error, 'Failed to extract scorecard from image');
      return sendError(reply, 500, ErrorCodes.IMAGE_PROCESSING_FAILED, 'Failed to process image');
    }
  });

  // =====================
  // GET /api/courses
  // Search/list courses (public)
  // =====================
  app.get<{ Querystring: SearchQuery }>('/', async (request, reply) => {
    const { q, state, limit: limitStr = '20', offset: offsetStr = '0' } = request.query;

    // Parse and validate pagination params with max limits
    const requestedLimit = parseInt(limitStr, 10);
    const requestedOffset = parseInt(offsetStr, 10);
    const limit = Math.min(Math.max(1, isNaN(requestedLimit) ? 20 : requestedLimit), 100); // Max 100
    const offset = Math.max(0, isNaN(requestedOffset) ? 0 : requestedOffset);

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
        take: limit,
        skip: offset,
      }),
      prisma.course.count({ where }),
    ]);

    return {
      success: true,
      data: courses,
      meta: {
        total,
        limit,
        offset,
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

    // Validate URL format and length
    const trimmedUrl = url.trim();
    if (trimmedUrl.length > 2000) {
      return badRequest(reply, 'URL is too long (max 2000 characters)');
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      return badRequest(reply, 'Invalid URL format');
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return badRequest(reply, 'Only HTTP and HTTPS URLs are allowed');
    }

    // Block localhost and private IPs for security
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      return badRequest(reply, 'Private/local URLs are not allowed');
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

    // Validate tee ratings if provided
    for (const tee of tees) {
      if (tee.courseRating !== undefined && tee.courseRating !== null) {
        const rating = Number(tee.courseRating);
        if (isNaN(rating) || rating < 55 || rating > 85) {
          return badRequest(reply, `Invalid course rating for ${tee.name}. Must be between 55 and 85.`);
        }
      }
      if (tee.slopeRating !== undefined && tee.slopeRating !== null) {
        const slope = Number(tee.slopeRating);
        if (isNaN(slope) || slope < 55 || slope > 155) {
          return badRequest(reply, `Invalid slope rating for ${tee.name}. Must be between 55 and 155.`);
        }
      }
    }

    try {
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

    // Geocode the course location asynchronously (non-blocking)
    geocodeAddress(city, state, country).then(async (coords) => {
      if (coords) {
        await prisma.course.update({
          where: { id: course.id },
          data: {
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
        });
      }
    }).catch((err) => {
      console.error('Failed to geocode course:', err);
    });

    // Find and extract hero image asynchronously (non-blocking)
    findAndExtractHeroImage(
      name.trim(),
      city?.trim() || null,
      state?.trim() || null,
      course.id,
      prisma
    ).catch((err) => {
      console.error('Failed to find/extract hero image:', err);
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
    } catch (error) {
      request.log.error(error, 'Failed to create course');
      return sendError(reply, 500, ErrorCodes.COURSE_CREATION_FAILED, 'Failed to create course. Please try again.');
    }
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
    const { name, city, state, country, website, heroImageUrl } = request.body;

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
    if (heroImageUrl !== undefined) updateData.heroImageUrl = heroImageUrl?.trim() || null;

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
