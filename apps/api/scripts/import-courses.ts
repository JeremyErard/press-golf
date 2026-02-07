/**
 * Batch Import Courses from GolfCourseAPI
 *
 * Usage:
 *   cd apps/api
 *   GOLF_COURSE_API_KEY=your_key npx tsx scripts/import-courses.ts
 *
 * Options:
 *   --search "query"     Search for courses by name/location
 *   --city "Atlanta"     Search by city
 *   --state "GA"         Search by state
 *   --limit 10           Max courses to import (default: 10)
 *   --dry-run            Show what would be imported without importing
 */

import { PrismaClient } from '@prisma/client';
import { findAndExtractHeroImage } from '../src/lib/course-hero.js';

const prisma = new PrismaClient();

const API_KEY = process.env.GOLF_COURSE_API_KEY || '';
const BASE_URL = 'https://api.golfcourseapi.com/v1';

// Types matching GolfCourseAPI response
interface HoleData {
  par: number;
  yardage: number;
  handicap: number;
}

interface TeeData {
  tee_name: string;
  course_rating: number;
  slope_rating: number;
  total_yards: number;
  par_total: number;
  holes: HoleData[];
}

interface CourseLocation {
  address?: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface CourseData {
  id: number;
  club_name: string;
  course_name: string;
  location: CourseLocation;
  tees: {
    male?: TeeData[];
    female?: TeeData[];
  };
}

// Parse command line arguments
function parseArgs(): { search?: string; city?: string; state?: string; limit: number; dryRun: boolean } {
  const args = process.argv.slice(2);
  const result: { search?: string; city?: string; state?: string; limit: number; dryRun: boolean } = {
    limit: 10,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--search':
        result.search = args[++i];
        break;
      case '--city':
        result.city = args[++i];
        break;
      case '--state':
        result.state = args[++i];
        break;
      case '--limit':
        result.limit = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
    }
  }

  return result;
}

// Search for courses
async function searchCourses(query: string): Promise<CourseData[]> {
  const url = `${BASE_URL}/search?search_query=${encodeURIComponent(query)}`;
  console.log(`\n🔍 Searching: ${query}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Key ${API_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ API Error (${response.status}): ${error}`);
    return [];
  }

  const data = await response.json() as { courses: CourseData[] };
  return data.courses || [];
}

// Get full course details
async function getCourseDetails(id: number): Promise<CourseData | null> {
  const url = `${BASE_URL}/courses/${id}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Key ${API_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`❌ Failed to fetch course ${id}`);
    return null;
  }

  const data = await response.json() as { course: CourseData };
  return data.course;
}

// Check if course already exists
async function courseExists(name: string, city: string, state: string): Promise<boolean> {
  const existing = await prisma.course.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      city: { equals: city, mode: 'insensitive' },
      state: { equals: state, mode: 'insensitive' },
    },
  });
  return !!existing;
}

// Import a single course
async function importCourse(apiCourse: CourseData, dryRun: boolean): Promise<boolean> {
  const courseName = apiCourse.course_name || apiCourse.club_name;
  const city = apiCourse.location.city;
  const state = apiCourse.location.state;

  // Check for duplicates (skip in dry-run to avoid DB connection)
  if (!dryRun && await courseExists(courseName, city, state)) {
    console.log(`   ⏭️  Skipping (already exists): ${courseName}`);
    return false;
  }

  // Get full details
  const details = await getCourseDetails(apiCourse.id);
  if (!details) {
    console.log(`   ❌ Could not fetch details for: ${courseName}`);
    return false;
  }

  const allTees = [...(details.tees.male || []), ...(details.tees.female || [])];

  // Check if course has useful data
  if (allTees.length === 0) {
    console.log(`   ⏭️  Skipping (no tee data): ${courseName}`);
    return false;
  }

  if (dryRun) {
    console.log(`   📋 Would import: ${courseName} (${city}, ${state})`);
    console.log(`      - ${allTees.length} tees, ${allTees[0]?.holes?.length || 0} holes`);
    return true;
  }

  // Create the course
  console.log(`   📥 Importing: ${courseName} (${city}, ${state})`);

  try {
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

    // Create holes (using data from first tee - par and handicap are same for all tees)
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
    for (const tee of allTees) {
      const createdTee = await prisma.tee.create({
        data: {
          courseId: course.id,
          name: tee.tee_name,
          slopeRating: tee.slope_rating,
          courseRating: tee.course_rating,
          totalYardage: tee.total_yards,
        },
      });

      // Create hole yardages for this tee
      if (tee.holes?.length) {
        const holes = await prisma.hole.findMany({
          where: { courseId: course.id },
          orderBy: { holeNumber: 'asc' },
        });

        await prisma.holeYardage.createMany({
          data: holes.map((hole, index) => ({
            holeId: hole.id,
            teeId: createdTee.id,
            yardage: tee.holes[index]?.yardage || 0,
          })),
        });
      }
    }

    console.log(`      ✅ Created with ${allTees.length} tees`);

    // Trigger hero image finder (async, don't wait)
    findAndExtractHeroImage(
      courseName,
      city,
      state,
      course.id,
      prisma
    ).then((result) => {
      if (result.heroImageUrl) {
        console.log(`      🖼️  Hero image found for ${courseName}`);
      }
    }).catch(() => {
      // Ignore hero image errors
    });

    return true;
  } catch (error) {
    console.error(`   ❌ Failed to import ${courseName}:`, error);
    return false;
  }
}

async function main() {
  console.log('🏌️ Press Course Import Tool');
  console.log('============================\n');

  if (!API_KEY) {
    console.error('❌ No API key. Set GOLF_COURSE_API_KEY environment variable.');
    process.exit(1);
  }

  const args = parseArgs();

  if (!args.search && !args.city && !args.state) {
    console.log('Usage:');
    console.log('  npx tsx scripts/import-courses.ts --search "Pebble Beach"');
    console.log('  npx tsx scripts/import-courses.ts --city "Atlanta" --state "GA"');
    console.log('  npx tsx scripts/import-courses.ts --state "FL" --limit 20');
    console.log('\nOptions:');
    console.log('  --search "query"   Search by name/location');
    console.log('  --city "city"      Filter by city');
    console.log('  --state "ST"       Filter by state');
    console.log('  --limit N          Max courses to import (default: 10)');
    console.log('  --dry-run          Preview without importing');
    process.exit(0);
  }

  // Build search query
  let searchQuery = args.search || '';
  if (args.city) searchQuery += ` ${args.city}`;
  if (args.state) searchQuery += ` ${args.state}`;
  searchQuery = searchQuery.trim();

  if (args.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Search for courses
  const courses = await searchCourses(searchQuery);
  console.log(`Found ${courses.length} courses\n`);

  if (courses.length === 0) {
    console.log('No courses found. Try a different search.');
    process.exit(0);
  }

  // Filter by state if specified
  let filtered = courses;
  if (args.state) {
    filtered = courses.filter(c =>
      c.location.state.toUpperCase() === args.state!.toUpperCase()
    );
    console.log(`Filtered to ${filtered.length} courses in ${args.state}\n`);
  }

  // Limit results
  const toImport = filtered.slice(0, args.limit);
  console.log(`Processing ${toImport.length} courses...\n`);

  let imported = 0;
  let skipped = 0;

  for (const course of toImport) {
    const success = await importCourse(course, args.dryRun);
    if (success) imported++;
    else skipped++;

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n============================');
  console.log(`✅ ${args.dryRun ? 'Would import' : 'Imported'}: ${imported}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  // Wait a bit for hero images to process
  if (!args.dryRun && imported > 0) {
    console.log('\n⏳ Waiting for hero images to process...');
    await new Promise(r => setTimeout(r, 5000));
    await prisma.$disconnect();
  }
}

main().catch(console.error);
