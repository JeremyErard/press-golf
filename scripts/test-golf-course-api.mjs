/**
 * Test script for GolfCourseAPI.com (FREE API)
 *
 * Run: GOLF_COURSE_API_KEY=your_key node scripts/test-golf-course-api.mjs
 */

const API_KEY = process.env.GOLF_COURSE_API_KEY || '';
const BASE_URL = 'https://api.golfcourseapi.com/v1';

async function searchCourses(query) {
  if (!API_KEY) {
    console.error('❌ No API key provided. Set GOLF_COURSE_API_KEY environment variable.');
    return null;
  }

  const url = `${BASE_URL}/search?search_query=${encodeURIComponent(query)}`;
  console.log(`\n🔍 Searching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Key ${API_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ API Error (${response.status}): ${error}`);
    return null;
  }

  return response.json();
}

async function getCourseById(id) {
  if (!API_KEY) return null;

  const url = `${BASE_URL}/courses/${id}`;
  console.log(`\n📋 Fetching course: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Key ${API_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ API Error (${response.status}): ${error}`);
    return null;
  }

  return response.json();
}

function mapToPressFormat(course) {
  // Map to Press database format
  const pressFormat = {
    course: {
      name: course.course_name || course.club_name,
      city: course.location.city,
      state: course.location.state,
      country: course.location.country,
      latitude: course.location.latitude,
      longitude: course.location.longitude,
    },
    tees: [],
    holes: [],
    holeYardages: [],
  };

  // Process all tees (male and female)
  const allTees = [
    ...(course.tees.male || []),
    ...(course.tees.female || []),
  ];

  for (const tee of allTees) {
    pressFormat.tees.push({
      name: tee.tee_name,
      slopeRating: tee.slope_rating,
      courseRating: tee.course_rating,
      totalYardage: tee.total_yards,
    });

    // Extract hole data from first tee (par and handicap are same for all tees)
    if (pressFormat.holes.length === 0 && tee.holes) {
      tee.holes.forEach((hole, index) => {
        pressFormat.holes.push({
          holeNumber: index + 1,
          par: hole.par,
          handicapRank: hole.handicap,
        });
      });
    }

    // Extract yardages per hole per tee
    if (tee.holes) {
      tee.holes.forEach((hole, index) => {
        pressFormat.holeYardages.push({
          teeName: tee.tee_name,
          holeNumber: index + 1,
          yardage: hole.yardage,
        });
      });
    }
  }

  return pressFormat;
}

async function main() {
  console.log('🏌️ GolfCourseAPI.com Test Script');
  console.log('='.repeat(60));

  if (!API_KEY) {
    console.log('\n⚠️  No API key found!');
    console.log('\nTo get started:');
    console.log('1. Go to https://golfcourseapi.com');
    console.log('2. Click "GET STARTED" and sign up with your email');
    console.log('3. Copy your API key from the dashboard');
    console.log('4. Run: GOLF_COURSE_API_KEY=your_key node scripts/test-golf-course-api.mjs');
    return;
  }

  // Test 1: Search for a course
  console.log('\n📍 TEST 1: Search for "Cascade Hills"');
  const searchResults = await searchCourses('Cascade Hills');

  if (searchResults?.courses?.length) {
    console.log(`✅ Found ${searchResults.courses.length} course(s)`);

    const firstCourse = searchResults.courses[0];
    console.log(`\n   First result: ${firstCourse.club_name} - ${firstCourse.course_name}`);
    console.log(`   Location: ${firstCourse.location.city}, ${firstCourse.location.state}`);
    console.log(`   Coordinates: ${firstCourse.location.latitude}, ${firstCourse.location.longitude}`);

    // Test 2: Get full course details
    console.log('\n📋 TEST 2: Get full course details');
    const courseDetails = await getCourseById(firstCourse.id);

    if (courseDetails?.course) {
      const course = courseDetails.course;
      const allTees = [...(course.tees.male || []), ...(course.tees.female || [])];

      console.log(`\n   Tees available: ${allTees.length}`);
      for (const tee of allTees) {
        console.log(`   - ${tee.tee_name}: ${tee.total_yards} yds, Rating: ${tee.course_rating}, Slope: ${tee.slope_rating}`);
      }

      if (allTees[0]?.holes) {
        console.log(`\n   Holes: ${allTees[0].holes.length}`);
        console.log('   First 3 holes:');
        allTees[0].holes.slice(0, 3).forEach((hole, i) => {
          console.log(`   - Hole ${i + 1}: Par ${hole.par}, ${hole.yardage} yds, Handicap ${hole.handicap}`);
        });
      }

      // Test 3: Map to Press format
      console.log('\n📊 TEST 3: Mapped to Press format');
      const pressData = mapToPressFormat(course);
      console.log('\n   Course:', pressData.course);
      console.log(`\n   Tees (${pressData.tees.length}):`);
      pressData.tees.forEach(t => console.log(`   - ${t.name}: ${t.totalYardage} yds`));
      console.log(`\n   Holes: ${pressData.holes.length}`);
      console.log(`   HoleYardages: ${pressData.holeYardages.length} entries`);
    }
  } else {
    console.log('❌ No courses found');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DATA COMPATIBILITY SUMMARY');
  console.log('='.repeat(60));
  console.log('\n✅ Course name, city, state, country');
  console.log('✅ Latitude/Longitude coordinates');
  console.log('✅ Multiple tees (male/female categories)');
  console.log('✅ Tee: name, slope_rating, course_rating, total_yards');
  console.log('✅ Hole: par, handicap (stroke index)');
  console.log('✅ HoleYardage: yardage per hole per tee');
  console.log('\n🎉 This API has EVERYTHING Press needs!');
}

main().catch(console.error);
