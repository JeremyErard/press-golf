import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma.js';
import { requireAuth, getUser } from '../lib/auth.js';
import { badRequest, notFound, forbidden, sendError, ErrorCodes } from '../lib/errors.js';
import { fetchWebpage, extractCourseData, findScorecardLinks, fetchPdf, extractCourseDataFromPdf } from '../lib/claude.js';
import { geocodeAddress } from '../lib/geocode.js';
import { findAndExtractHeroImage } from '../lib/course-hero.js';

// GolfCourseAPI types
interface GolfCourseAPIHole {
  par: number;
  yardage: number;
  handicap: number;
}

interface GolfCourseAPITee {
  tee_name: string;
  course_rating: number;
  slope_rating: number;
  total_yards: number;
  par_total: number;
  holes: GolfCourseAPIHole[];
}

interface GolfCourseAPILocation {
  address?: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface GolfCourseAPICourse {
  id: number;
  club_name: string;
  course_name: string;
  location: GolfCourseAPILocation;
  tees: {
    male?: GolfCourseAPITee[];
    female?: GolfCourseAPITee[];
  };
}

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
- Location: city, state/region, AND country (important for international courses like Scotland, Ireland, etc.)
- Website URL (often printed on scorecard - look for www. or .com or .co.uk etc.)
- For each of the 18 holes: hole number, par, AND handicap/stroke index (HDCP, S.I., or Handicap row)
- Tee information: tee names (e.g., Blue, White, Red), yardages per hole, total yardage, slope rating, course rating

NOTE: For international courses (Scotland, Ireland, England, etc.), set "state" to the region/county and "country" to the actual country (e.g., "Scotland", "Ireland"). Do NOT default to USA for non-US courses.

IMPORTANT: The handicap/stroke index is CRITICAL - it's usually labeled "HDCP", "HCP", "Handicap", "S.I.", or "Stroke Index" on the scorecard. It's a number 1-18 that indicates hole difficulty (1 = hardest, 18 = easiest). This is different from par. Look carefully for this row.

Return ONLY a JSON object with this exact format:
{
  "found": true,
  "courseName": "Example Golf Club",
  "city": "City Name",
  "state": "ST",
  "country": "USA",
  "website": "https://www.examplegolf.com",
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
        country?: string;
        website?: string;
        holes?: { holeNumber: number; par: number; handicapRank: number; yardages?: { teeName: string; yardage: number }[] }[];
        tees?: { name: string; color?: string; slopeRating?: number; courseRating?: number; totalYardage?: number }[];
        confidence?: string;
      } = {
        name: extracted.courseName,
        city: extracted.city,
        state: extracted.state,
        country: extracted.country,
        website: extracted.website,
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

    // Convert Decimal fields to numbers for JSON serialization
    const coursesWithNumbers = courses.map(course => ({
      ...course,
      latitude: course.latitude ? Number(course.latitude) : null,
      longitude: course.longitude ? Number(course.longitude) : null,
    }));

    return {
      success: true,
      data: coursesWithNumbers,
      meta: {
        total,
        limit,
        offset,
      },
    };
  });

  // =====================
  // GET /api/courses/discover
  // Smart course loading: nearby + home + featured courses
  // Requires auth to get personalized home courses
  // =====================
  interface DiscoverQuery {
    lat?: string;
    lng?: string;
    limit?: string;
  }

  app.get<{ Querystring: DiscoverQuery }>('/discover', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const user = getUser(request);
    const { lat, lng, limit: limitStr = '5' } = request.query;
    const nearbyLimit = Math.min(Math.max(1, parseInt(limitStr, 10) || 5), 10);

    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    // Fetch home courses, featured courses, and all courses with coordinates in parallel
    const [homeCourses, featuredCourses, allCourses] = await Promise.all([
      // User's home courses
      prisma.homeCourse.findMany({
        where: { userId: user.id as string },
        include: {
          course: {
            include: {
              tees: { orderBy: { totalYardage: 'desc' } },
              _count: { select: { rounds: true } },
            },
          },
        },
      }),

      // Featured courses with round counts
      prisma.course.findMany({
        where: { isFeatured: true },
        include: {
          tees: { orderBy: { totalYardage: 'desc' } },
          _count: { select: { rounds: true } },
        },
        orderBy: { name: 'asc' },
        take: 5,
      }),

      // All courses with coordinates (for nearby calculation)
      userLat && userLng ? prisma.course.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
        include: {
          tees: { orderBy: { totalYardage: 'desc' } },
          _count: { select: { rounds: true } },
        },
      }) : Promise.resolve([]),
    ]);

    // Calculate distances and get nearest courses
    let nearbyCourses: typeof allCourses = [];
    if (userLat && userLng && allCourses.length > 0) {
      // Get home course IDs to exclude from nearby
      const homeCourseIds = new Set(homeCourses.map(hc => hc.courseId));

      // Calculate distance for each course using Haversine formula
      const coursesWithDistance = allCourses
        .filter(c => !homeCourseIds.has(c.id)) // Exclude home courses
        .map(course => {
          const courseLat = Number(course.latitude);
          const courseLng = Number(course.longitude);

          // Haversine formula
          const R = 3959; // Earth's radius in miles
          const dLat = (courseLat - userLat) * Math.PI / 180;
          const dLng = (courseLng - userLng) * Math.PI / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(userLat * Math.PI / 180) * Math.cos(courseLat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          return { ...course, distance };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, nearbyLimit);

      nearbyCourses = coursesWithDistance;
    }

    // Helper to convert Decimal fields
    const convertCourse = (course: typeof allCourses[0] & { distance?: number }) => ({
      ...course,
      latitude: course.latitude ? Number(course.latitude) : null,
      longitude: course.longitude ? Number(course.longitude) : null,
      roundCount: course._count?.rounds || 0,
      distance: course.distance,
    });

    return {
      success: true,
      data: {
        nearby: nearbyCourses.map(convertCourse),
        homeCourses: homeCourses.map(hc => convertCourse(hc.course as typeof allCourses[0])),
        featured: featuredCourses.map(convertCourse),
      },
    };
  });

  // =====================
  // POST /api/courses/import-from-api
  // Import courses from GolfCourseAPI (requires auth)
  // =====================
  interface ImportFromAPIBody {
    search: string;
    limit?: number;
    dryRun?: boolean;
  }

  const GOLF_COURSE_API_KEY = process.env.GOLF_COURSE_API_KEY || '';
  const GOLF_COURSE_API_BASE = 'https://api.golfcourseapi.com/v1';

  app.post<{ Body: ImportFromAPIBody }>('/import-from-api', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const { search, limit = 10, dryRun = false } = request.body;

    if (!search || search.trim().length === 0) {
      return badRequest(reply, 'Search query is required');
    }

    if (!GOLF_COURSE_API_KEY) {
      return badRequest(reply, 'GolfCourseAPI key not configured');
    }

    const results: { imported: string[]; skipped: string[]; errors: string[] } = {
      imported: [],
      skipped: [],
      errors: [],
    };

    try {
      // Search for courses
      const searchUrl = `${GOLF_COURSE_API_BASE}/search?search_query=${encodeURIComponent(search.trim())}`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Key ${GOLF_COURSE_API_KEY}`,
          'Accept': 'application/json',
        },
      });

      if (!searchResponse.ok) {
        const error = await searchResponse.text();
        return badRequest(reply, `GolfCourseAPI error: ${error}`);
      }

      const searchData = await searchResponse.json() as { courses: GolfCourseAPICourse[] };
      const courses = (searchData.courses || []).slice(0, Math.min(limit, 20));

      if (courses.length === 0) {
        return { success: true, message: 'No courses found', data: results };
      }

      for (const apiCourse of courses) {
        const courseName = apiCourse.course_name || apiCourse.club_name;
        const city = apiCourse.location.city;
        const state = apiCourse.location.state;

        try {
          // Check for duplicates
          const existing = await prisma.course.findFirst({
            where: {
              name: { equals: courseName, mode: 'insensitive' },
              city: { equals: city, mode: 'insensitive' },
              state: { equals: state, mode: 'insensitive' },
            },
          });

          if (existing) {
            results.skipped.push(`${courseName} (already exists)`);
            continue;
          }

          // Get full details
          const detailsUrl = `${GOLF_COURSE_API_BASE}/courses/${apiCourse.id}`;
          const detailsResponse = await fetch(detailsUrl, {
            headers: {
              'Authorization': `Key ${GOLF_COURSE_API_KEY}`,
              'Accept': 'application/json',
            },
          });

          if (!detailsResponse.ok) {
            results.errors.push(`${courseName}: failed to fetch details`);
            continue;
          }

          const detailsData = await detailsResponse.json() as { course: GolfCourseAPICourse };
          const details = detailsData.course;

          const allTees = [...(details.tees.male || []), ...(details.tees.female || [])];

          if (allTees.length === 0) {
            results.skipped.push(`${courseName} (no tee data)`);
            continue;
          }

          if (dryRun) {
            results.imported.push(`${courseName} (${city}, ${state}) - ${allTees.length} tees`);
            continue;
          }

          // Create the course
          const course = await prisma.course.create({
            data: {
              name: courseName,
              city: city,
              state: state,
              country: details.location.country || 'USA',
              latitude: details.location.latitude,
              longitude: details.location.longitude,
              isVerified: false,
            },
          });

          // Create holes (using data from first tee)
          const firstTee = allTees[0];
          if (firstTee?.holes?.length) {
            await prisma.hole.createMany({
              data: firstTee.holes.map((hole, index) => ({
                courseId: course.id,
                holeNumber: index + 1,
                par: hole.par,
                handicapRank: hole.handicap,
              })),
            });
          }

          // Create tees and hole yardages
          // Track used tee names to avoid duplicates (male/female tees may have same name)
          const usedTeeNames = new Set<string>();

          // Fetch holes ONCE before the loop (instead of once per tee)
          const holes = await prisma.hole.findMany({
            where: { courseId: course.id },
            orderBy: { holeNumber: 'asc' },
          });

          for (const tee of allTees) {
            // Handle duplicate tee names by appending a number
            let teeName = tee.tee_name;
            let counter = 2;
            while (usedTeeNames.has(teeName)) {
              teeName = `${tee.tee_name} ${counter}`;
              counter++;
            }
            usedTeeNames.add(teeName);

            const createdTee = await prisma.tee.create({
              data: {
                courseId: course.id,
                name: teeName,
                slopeRating: tee.slope_rating,
                courseRating: tee.course_rating,
                totalYardage: tee.total_yards,
              },
            });

            // Create hole yardages for this tee
            if (tee.holes?.length) {
              await prisma.holeYardage.createMany({
                data: holes.map((hole, index) => ({
                  holeId: hole.id,
                  teeId: createdTee.id,
                  yardage: tee.holes[index]?.yardage || 0,
                })),
              });
            }
          }

          results.imported.push(`${courseName} (${city}, ${state})`);

          // Trigger hero image finder (async, don't wait)
          findAndExtractHeroImage(
            courseName,
            city,
            state,
            course.id,
            prisma
          ).catch(() => {
            // Ignore hero image errors
          });

          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 300));
        } catch (error: any) {
          results.errors.push(`${courseName}: ${error.message || 'unknown error'}`);
        }
      }

      return {
        success: true,
        message: dryRun ? 'Dry run complete' : 'Import complete',
        data: results,
      };
    } catch (error: any) {
      request.log.error(error, 'Failed to import courses from API');
      return sendError(reply, 500, ErrorCodes.COURSE_CREATION_FAILED, `Import failed: ${error.message}`);
    }
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
    // Create course with tees and holes in a transaction with extended timeout
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

      // Create all tees at once using createMany, then fetch them back
      if (tees.length > 0) {
        await tx.tee.createMany({
          data: tees.map(tee => ({
            courseId: newCourse.id,
            name: tee.name,
            color: tee.color || null,
            slopeRating: tee.slopeRating || null,
            courseRating: tee.courseRating || null,
            totalYardage: tee.totalYardage || null,
          })),
        });
      }

      // Fetch created tees to get their IDs
      const createdTees = await tx.tee.findMany({
        where: { courseId: newCourse.id },
      });
      const teeMap = new Map<string, string>();
      for (const tee of createdTees) {
        teeMap.set(tee.name, tee.id);
      }

      // Create all holes at once using createMany
      if (holes.length > 0) {
        await tx.hole.createMany({
          data: holes.map(hole => ({
            courseId: newCourse.id,
            holeNumber: hole.holeNumber,
            par: hole.par,
            handicapRank: hole.handicapRank,
          })),
        });
      }

      // Fetch created holes to get their IDs
      const createdHoles = await tx.hole.findMany({
        where: { courseId: newCourse.id },
        orderBy: { holeNumber: 'asc' },
      });
      const holeMap = new Map<number, string>();
      for (const hole of createdHoles) {
        holeMap.set(hole.holeNumber, hole.id);
      }

      // Collect all yardages to create at once
      const yardageData: { holeId: string; teeId: string; yardage: number }[] = [];
      for (const hole of holes) {
        if (hole.yardages) {
          const holeId = holeMap.get(hole.holeNumber);
          if (holeId) {
            for (const yardage of hole.yardages) {
              const teeId = teeMap.get(yardage.teeName);
              if (teeId) {
                yardageData.push({
                  holeId,
                  teeId,
                  yardage: yardage.yardage,
                });
              }
            }
          }
        }
      }

      // Create all yardages at once
      if (yardageData.length > 0) {
        await tx.holeYardage.createMany({
          data: yardageData,
        });
      }

      return newCourse;
    }, {
      timeout: 30000, // 30 second timeout for complex courses
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
      prisma,
      website?.trim() || null  // Pass extracted website URL for hero image lookup
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
    } catch (error: any) {
      request.log.error(error, 'Failed to create course');
      const errorMessage = error?.message || 'Unknown error';
      console.error('Course creation error details:', errorMessage);
      return sendError(reply, 500, ErrorCodes.COURSE_CREATION_FAILED, `Failed to create course: ${errorMessage}`);
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

  // =====================
  // POST /api/courses/:id/refresh-hero
  // Re-trigger hero image search for a course (requires auth)
  // =====================
  app.post<{ Params: { id: string } }>('/:id/refresh-hero', {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const { id } = request.params;

    const course = await prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      return notFound(reply, 'Course not found');
    }

    // Trigger hero image search asynchronously
    findAndExtractHeroImage(
      course.name,
      course.city,
      course.state,
      course.id,
      prisma,
      course.website
    ).then((result) => {
      console.log(`[RefreshHero] Result for ${course.name}:`, result);
    }).catch((err) => {
      console.error(`[RefreshHero] Error for ${course.name}:`, err);
    });

    return {
      success: true,
      message: 'Hero image refresh triggered',
    };
  });
};
