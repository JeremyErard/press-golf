import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Verified scorecard data from BlueGolf Course Database
const courseData = {
  'dm-apache': {
    name: 'Desert Mountain - Apache',
    holes: [
      // Front 9: hole, par, hdcp, GoldenBear, Blue, Copper, White, Red, Green
      { hole: 1, par: 5, hdcp: 11, yardages: { 'Golden Bear': 563, 'Blue': 525, 'Copper': 515, 'White': 487, 'Red': 420, 'Green': 354 } },
      { hole: 2, par: 4, hdcp: 5, yardages: { 'Golden Bear': 443, 'Blue': 415, 'Copper': 393, 'White': 393, 'Red': 348, 'Green': 277 } },
      { hole: 3, par: 3, hdcp: 17, yardages: { 'Golden Bear': 146, 'Blue': 137, 'Copper': 123, 'White': 117, 'Red': 90, 'Green': 80 } },
      { hole: 4, par: 4, hdcp: 1, yardages: { 'Golden Bear': 475, 'Blue': 464, 'Copper': 409, 'White': 409, 'Red': 392, 'Green': 333 } },
      { hole: 5, par: 4, hdcp: 13, yardages: { 'Golden Bear': 418, 'Blue': 404, 'Copper': 371, 'White': 351, 'Red': 330, 'Green': 304 } },
      { hole: 6, par: 4, hdcp: 3, yardages: { 'Golden Bear': 395, 'Blue': 376, 'Copper': 366, 'White': 366, 'Red': 300, 'Green': 231 } },
      { hole: 7, par: 3, hdcp: 9, yardages: { 'Golden Bear': 196, 'Blue': 185, 'Copper': 176, 'White': 150, 'Red': 133, 'Green': 91 } },
      { hole: 8, par: 4, hdcp: 7, yardages: { 'Golden Bear': 443, 'Blue': 427, 'Copper': 372, 'White': 372, 'Red': 357, 'Green': 300 } },
      { hole: 9, par: 5, hdcp: 15, yardages: { 'Golden Bear': 539, 'Blue': 526, 'Copper': 509, 'White': 490, 'Red': 431, 'Green': 370 } },
      // Back 9
      { hole: 10, par: 4, hdcp: 4, yardages: { 'Golden Bear': 450, 'Blue': 426, 'Copper': 356, 'White': 356, 'Red': 347, 'Green': 260 } },
      { hole: 11, par: 5, hdcp: 18, yardages: { 'Golden Bear': 513, 'Blue': 497, 'Copper': 497, 'White': 482, 'Red': 427, 'Green': 370 } },
      { hole: 12, par: 3, hdcp: 10, yardages: { 'Golden Bear': 208, 'Blue': 190, 'Copper': 190, 'White': 155, 'Red': 142, 'Green': 95 } },
      { hole: 13, par: 4, hdcp: 8, yardages: { 'Golden Bear': 455, 'Blue': 429, 'Copper': 392, 'White': 365, 'Red': 336, 'Green': 290 } },
      { hole: 14, par: 4, hdcp: 2, yardages: { 'Golden Bear': 462, 'Blue': 419, 'Copper': 390, 'White': 390, 'Red': 370, 'Green': 306 } },
      { hole: 15, par: 3, hdcp: 16, yardages: { 'Golden Bear': 182, 'Blue': 173, 'Copper': 163, 'White': 145, 'Red': 121, 'Green': 112 } },
      { hole: 16, par: 5, hdcp: 6, yardages: { 'Golden Bear': 546, 'Blue': 530, 'Copper': 530, 'White': 489, 'Red': 463, 'Green': 415 } },
      { hole: 17, par: 3, hdcp: 14, yardages: { 'Golden Bear': 226, 'Blue': 204, 'Copper': 204, 'White': 184, 'Red': 114, 'Green': 110 } },
      { hole: 18, par: 5, hdcp: 12, yardages: { 'Golden Bear': 551, 'Blue': 533, 'Copper': 478, 'White': 519, 'Red': 475, 'Green': 359 } },
    ],
  },
  'dm-chiricahua': {
    name: 'Desert Mountain - Chiricahua',
    holes: [
      { hole: 1, par: 4, hdcp: 2, yardages: { 'Golden Bear': 477, 'Blue': 429, 'Copper': 393, 'White': 393, 'Red': 364, 'Green': 322 } },
      { hole: 2, par: 4, hdcp: 18, yardages: { 'Golden Bear': 287, 'Blue': 278, 'Copper': 278, 'White': 224, 'Red': 216, 'Green': 172 } },
      { hole: 3, par: 5, hdcp: 12, yardages: { 'Golden Bear': 656, 'Blue': 586, 'Copper': 586, 'White': 563, 'Red': 517, 'Green': 474 } },
      { hole: 4, par: 4, hdcp: 6, yardages: { 'Golden Bear': 436, 'Blue': 387, 'Copper': 369, 'White': 369, 'Red': 347, 'Green': 305 } },
      { hole: 5, par: 3, hdcp: 4, yardages: { 'Golden Bear': 230, 'Blue': 210, 'Copper': 210, 'White': 183, 'Red': 133, 'Green': 111 } },
      { hole: 6, par: 4, hdcp: 14, yardages: { 'Golden Bear': 387, 'Blue': 374, 'Copper': 352, 'White': 352, 'Red': 312, 'Green': 281 } },
      { hole: 7, par: 4, hdcp: 10, yardages: { 'Golden Bear': 461, 'Blue': 416, 'Copper': 389, 'White': 389, 'Red': 370, 'Green': 305 } },
      { hole: 8, par: 3, hdcp: 16, yardages: { 'Golden Bear': 156, 'Blue': 123, 'Copper': 123, 'White': 119, 'Red': 105, 'Green': 105 } },
      { hole: 9, par: 5, hdcp: 8, yardages: { 'Golden Bear': 594, 'Blue': 577, 'Copper': 577, 'White': 542, 'Red': 468, 'Green': 418 } },
      { hole: 10, par: 4, hdcp: 1, yardages: { 'Golden Bear': 482, 'Blue': 462, 'Copper': 419, 'White': 419, 'Red': 363, 'Green': 317 } },
      { hole: 11, par: 4, hdcp: 5, yardages: { 'Golden Bear': 472, 'Blue': 430, 'Copper': 400, 'White': 400, 'Red': 365, 'Green': 338 } },
      { hole: 12, par: 3, hdcp: 15, yardages: { 'Golden Bear': 206, 'Blue': 177, 'Copper': 177, 'White': 162, 'Red': 145, 'Green': 89 } },
      { hole: 13, par: 4, hdcp: 9, yardages: { 'Golden Bear': 416, 'Blue': 399, 'Copper': 340, 'White': 340, 'Red': 289, 'Green': 289 } },
      { hole: 14, par: 3, hdcp: 17, yardages: { 'Golden Bear': 159, 'Blue': 136, 'Copper': 136, 'White': 131, 'Red': 109, 'Green': 96 } },
      { hole: 15, par: 5, hdcp: 3, yardages: { 'Golden Bear': 582, 'Blue': 537, 'Copper': 516, 'White': 516, 'Red': 451, 'Green': 423 } },
      { hole: 16, par: 4, hdcp: 11, yardages: { 'Golden Bear': 406, 'Blue': 390, 'Copper': 330, 'White': 330, 'Red': 307, 'Green': 260 } },
      { hole: 17, par: 5, hdcp: 13, yardages: { 'Golden Bear': 516, 'Blue': 489, 'Copper': 489, 'White': 481, 'Red': 458, 'Green': 398 } },
      { hole: 18, par: 4, hdcp: 7, yardages: { 'Golden Bear': 424, 'Blue': 396, 'Copper': 376, 'White': 376, 'Red': 301, 'Green': 295 } },
    ],
  },
  'dm-cochise': {
    name: 'Desert Mountain - Cochise',
    holes: [
      { hole: 1, par: 4, hdcp: 3, yardages: { 'Golden Bear': 413, 'Blue': 379, 'Copper': 345, 'White': 275, 'Red': 263, 'Green': 225 } },
      { hole: 2, par: 3, hdcp: 17, yardages: { 'Golden Bear': 181, 'Blue': 157, 'Copper': 150, 'White': 141, 'Red': 119, 'Green': 107 } },
      { hole: 3, par: 4, hdcp: 1, yardages: { 'Golden Bear': 475, 'Blue': 457, 'Copper': 426, 'White': 375, 'Red': 318, 'Green': 268 } },
      { hole: 4, par: 5, hdcp: 11, yardages: { 'Golden Bear': 546, 'Blue': 515, 'Copper': 500, 'White': 474, 'Red': 442, 'Green': 361 } },
      { hole: 5, par: 4, hdcp: 7, yardages: { 'Golden Bear': 448, 'Blue': 412, 'Copper': 394, 'White': 378, 'Red': 353, 'Green': 281 } },
      { hole: 6, par: 4, hdcp: 13, yardages: { 'Golden Bear': 341, 'Blue': 326, 'Copper': 295, 'White': 295, 'Red': 259, 'Green': 259 } },
      { hole: 7, par: 3, hdcp: 5, yardages: { 'Golden Bear': 215, 'Blue': 178, 'Copper': 146, 'White': 126, 'Red': 106, 'Green': 95 } },
      { hole: 8, par: 5, hdcp: 15, yardages: { 'Golden Bear': 569, 'Blue': 546, 'Copper': 540, 'White': 517, 'Red': 428, 'Green': 391 } },
      { hole: 9, par: 4, hdcp: 9, yardages: { 'Golden Bear': 433, 'Blue': 418, 'Copper': 375, 'White': 351, 'Red': 300, 'Green': 283 } },
      { hole: 10, par: 4, hdcp: 6, yardages: { 'Golden Bear': 424, 'Blue': 362, 'Copper': 325, 'White': 317, 'Red': 275, 'Green': 217 } },
      { hole: 11, par: 3, hdcp: 14, yardages: { 'Golden Bear': 189, 'Blue': 170, 'Copper': 158, 'White': 154, 'Red': 125, 'Green': 85 } },
      { hole: 12, par: 5, hdcp: 12, yardages: { 'Golden Bear': 523, 'Blue': 508, 'Copper': 479, 'White': 462, 'Red': 405, 'Green': 363 } },
      { hole: 13, par: 3, hdcp: 18, yardages: { 'Golden Bear': 138, 'Blue': 121, 'Copper': 121, 'White': 116, 'Red': 99, 'Green': 99 } },
      { hole: 14, par: 4, hdcp: 2, yardages: { 'Golden Bear': 450, 'Blue': 434, 'Copper': 412, 'White': 380, 'Red': 378, 'Green': 293 } },
      { hole: 15, par: 5, hdcp: 8, yardages: { 'Golden Bear': 548, 'Blue': 534, 'Copper': 515, 'White': 484, 'Red': 458, 'Green': 317 } },
      { hole: 16, par: 4, hdcp: 4, yardages: { 'Golden Bear': 413, 'Blue': 385, 'Copper': 353, 'White': 316, 'Red': 302, 'Green': 258 } },
      { hole: 17, par: 3, hdcp: 10, yardages: { 'Golden Bear': 225, 'Blue': 212, 'Copper': 189, 'White': 173, 'Red': 166, 'Green': 97 } },
      { hole: 18, par: 5, hdcp: 16, yardages: { 'Golden Bear': 511, 'Blue': 472, 'Copper': 444, 'White': 424, 'Red': 380, 'Green': 355 } },
    ],
  },
  'dm-geronimo': {
    name: 'Desert Mountain - Geronimo',
    holes: [
      { hole: 1, par: 5, hdcp: 9, yardages: { 'Golden Bear': 582, 'Blue': 572, 'Copper': 572, 'White': 501, 'Red': 441, 'Green': 341 } },
      { hole: 2, par: 4, hdcp: 3, yardages: { 'Golden Bear': 487, 'Blue': 467, 'Copper': 422, 'White': 410, 'Red': 382, 'Green': 294 } },
      { hole: 3, par: 4, hdcp: 1, yardages: { 'Golden Bear': 419, 'Blue': 414, 'Copper': 403, 'White': 377, 'Red': 363, 'Green': 310 } },
      { hole: 4, par: 3, hdcp: 13, yardages: { 'Golden Bear': 240, 'Blue': 204, 'Copper': 204, 'White': 172, 'Red': 154, 'Green': 154 } },
      { hole: 5, par: 4, hdcp: 7, yardages: { 'Golden Bear': 480, 'Blue': 431, 'Copper': 401, 'White': 368, 'Red': 350, 'Green': 296 } },
      { hole: 6, par: 4, hdcp: 5, yardages: { 'Golden Bear': 445, 'Blue': 428, 'Copper': 383, 'White': 364, 'Red': 275, 'Green': 275 } },
      { hole: 7, par: 3, hdcp: 15, yardages: { 'Golden Bear': 193, 'Blue': 170, 'Copper': 170, 'White': 150, 'Red': 107, 'Green': 107 } },
      { hole: 8, par: 4, hdcp: 11, yardages: { 'Golden Bear': 360, 'Blue': 351, 'Copper': 336, 'White': 336, 'Red': 320, 'Green': 205 } },
      { hole: 9, par: 5, hdcp: 17, yardages: { 'Golden Bear': 534, 'Blue': 516, 'Copper': 516, 'White': 487, 'Red': 474, 'Green': 410 } },
      { hole: 10, par: 4, hdcp: 2, yardages: { 'Golden Bear': 423, 'Blue': 393, 'Copper': 375, 'White': 375, 'Red': 280, 'Green': 230 } },
      { hole: 11, par: 3, hdcp: 10, yardages: { 'Golden Bear': 190, 'Blue': 175, 'Copper': 175, 'White': 128, 'Red': 108, 'Green': 101 } },
      { hole: 12, par: 5, hdcp: 14, yardages: { 'Golden Bear': 562, 'Blue': 539, 'Copper': 539, 'White': 508, 'Red': 447, 'Green': 423 } },
      { hole: 13, par: 4, hdcp: 4, yardages: { 'Golden Bear': 407, 'Blue': 385, 'Copper': 364, 'White': 364, 'Red': 351, 'Green': 243 } },
      { hole: 14, par: 4, hdcp: 16, yardages: { 'Golden Bear': 352, 'Blue': 352, 'Copper': 320, 'White': 320, 'Red': 317, 'Green': 203 } },
      { hole: 15, par: 5, hdcp: 18, yardages: { 'Golden Bear': 500, 'Blue': 484, 'Copper': 484, 'White': 415, 'Red': 386, 'Green': 325 } },
      { hole: 16, par: 4, hdcp: 6, yardages: { 'Golden Bear': 497, 'Blue': 429, 'Copper': 389, 'White': 327, 'Red': 263, 'Green': 238 } },
      { hole: 17, par: 4, hdcp: 12, yardages: { 'Golden Bear': 402, 'Blue': 380, 'Copper': 335, 'White': 319, 'Red': 241, 'Green': 241 } },
      { hole: 18, par: 3, hdcp: 8, yardages: { 'Golden Bear': 197, 'Blue': 172, 'Copper': 157, 'White': 143, 'Red': 115, 'Green': 70 } },
    ],
  },
  'dm-outlaw': {
    name: 'Desert Mountain - Outlaw',
    holes: [
      { hole: 1, par: 4, hdcp: 3, yardages: { 'Golden Bear': 410, 'Blue': 384, 'Copper': 376, 'White': 376, 'Red': 330, 'Green': 213 } },
      { hole: 2, par: 5, hdcp: 9, yardages: { 'Golden Bear': 552, 'Blue': 492, 'Copper': 492, 'White': 482, 'Red': 448, 'Green': 337 } },
      { hole: 3, par: 4, hdcp: 1, yardages: { 'Golden Bear': 512, 'Blue': 480, 'Copper': 474, 'White': 422, 'Red': 346, 'Green': 261 } },
      { hole: 4, par: 3, hdcp: 17, yardages: { 'Golden Bear': 217, 'Blue': 182, 'Copper': 182, 'White': 134, 'Red': 115, 'Green': 90 } },
      { hole: 5, par: 4, hdcp: 11, yardages: { 'Golden Bear': 367, 'Blue': 335, 'Copper': 307, 'White': 307, 'Red': 225, 'Green': 168 } },
      { hole: 6, par: 3, hdcp: 15, yardages: { 'Golden Bear': 197, 'Blue': 180, 'Copper': 180, 'White': 141, 'Red': 132, 'Green': 132 } },
      { hole: 7, par: 4, hdcp: 13, yardages: { 'Golden Bear': 430, 'Blue': 361, 'Copper': 355, 'White': 355, 'Red': 312, 'Green': 212 } },
      { hole: 8, par: 4, hdcp: 5, yardages: { 'Golden Bear': 470, 'Blue': 449, 'Copper': 424, 'White': 424, 'Red': 338, 'Green': 287 } },
      { hole: 9, par: 5, hdcp: 7, yardages: { 'Golden Bear': 538, 'Blue': 515, 'Copper': 515, 'White': 500, 'Red': 426, 'Green': 358 } },
      { hole: 10, par: 4, hdcp: 4, yardages: { 'Golden Bear': 338, 'Blue': 325, 'Copper': 313, 'White': 313, 'Red': 281, 'Green': 210 } },
      { hole: 11, par: 4, hdcp: 12, yardages: { 'Golden Bear': 354, 'Blue': 335, 'Copper': 327, 'White': 327, 'Red': 250, 'Green': 188 } },
      { hole: 12, par: 3, hdcp: 16, yardages: { 'Golden Bear': 203, 'Blue': 175, 'Copper': 175, 'White': 169, 'Red': 147, 'Green': 86 } },
      { hole: 13, par: 5, hdcp: 14, yardages: { 'Golden Bear': 616, 'Blue': 567, 'Copper': 567, 'White': 532, 'Red': 406, 'Green': 315 } },
      { hole: 14, par: 4, hdcp: 18, yardages: { 'Golden Bear': 338, 'Blue': 290, 'Copper': 255, 'White': 255, 'Red': 224, 'Green': 167 } },
      { hole: 15, par: 3, hdcp: 8, yardages: { 'Golden Bear': 187, 'Blue': 165, 'Copper': 165, 'White': 159, 'Red': 132, 'Green': 132 } },
      { hole: 16, par: 5, hdcp: 6, yardages: { 'Golden Bear': 532, 'Blue': 503, 'Copper': 503, 'White': 419, 'Red': 412, 'Green': 339 } },
      { hole: 17, par: 4, hdcp: 10, yardages: { 'Golden Bear': 382, 'Blue': 352, 'Copper': 310, 'White': 310, 'Red': 275, 'Green': 212 } },
      { hole: 18, par: 4, hdcp: 2, yardages: { 'Golden Bear': 464, 'Blue': 419, 'Copper': 392, 'White': 392, 'Red': 332, 'Green': 239 } },
    ],
  },
  'dm-renegade': {
    name: 'Desert Mountain - Renegade',
    // Renegade has Gold and White pins - using "Tee 1 (Gold)" and "Tee 1 (White)" pattern
    // This is a unique course with 2 pin/green placements per hole
    holes: [
      { hole: 1, par: 4, hdcp: 5, yardages: { 'Tee 1 (Gold)': 436, 'Tee 1 (White)': 394 } },
      { hole: 2, par: 4, hdcp: 7, yardages: { 'Tee 1 (Gold)': 468, 'Tee 1 (White)': 448 } },
      { hole: 3, par: 4, hdcp: 1, yardages: { 'Tee 1 (Gold)': 486, 'Tee 1 (White)': 466 } },
      { hole: 4, par: 3, hdcp: 3, yardages: { 'Tee 1 (Gold)': 232, 'Tee 1 (White)': 202 } },
      { hole: 5, par: 5, hdcp: 11, yardages: { 'Tee 1 (Gold)': 634, 'Tee 1 (White)': 544 } },
      { hole: 6, par: 3, hdcp: 15, yardages: { 'Tee 1 (Gold)': 193, 'Tee 1 (White)': 165 } },
      { hole: 7, par: 4, hdcp: 17, yardages: { 'Tee 1 (Gold)': 442, 'Tee 1 (White)': 367 } },
      { hole: 8, par: 4, hdcp: 9, yardages: { 'Tee 1 (Gold)': 502, 'Tee 1 (White)': 465 } },
      { hole: 9, par: 5, hdcp: 13, yardages: { 'Tee 1 (Gold)': 617, 'Tee 1 (White)': 577 } },
      { hole: 10, par: 5, hdcp: 6, yardages: { 'Tee 1 (Gold)': 612, 'Tee 1 (White)': 592 } },
      { hole: 11, par: 4, hdcp: 12, yardages: { 'Tee 1 (Gold)': 423, 'Tee 1 (White)': 338 } },
      { hole: 12, par: 3, hdcp: 16, yardages: { 'Tee 1 (Gold)': 211, 'Tee 1 (White)': 184 } },
      { hole: 13, par: 4, hdcp: 8, yardages: { 'Tee 1 (Gold)': 526, 'Tee 1 (White)': 480 } },
      { hole: 14, par: 3, hdcp: 18, yardages: { 'Tee 1 (Gold)': 234, 'Tee 1 (White)': 214 } },
      { hole: 15, par: 5, hdcp: 2, yardages: { 'Tee 1 (Gold)': 666, 'Tee 1 (White)': 633 } },
      { hole: 16, par: 3, hdcp: 14, yardages: { 'Tee 1 (Gold)': 195, 'Tee 1 (White)': 177 } },
      { hole: 17, par: 5, hdcp: 4, yardages: { 'Tee 1 (Gold)': 631, 'Tee 1 (White)': 561 } },
      { hole: 18, par: 4, hdcp: 10, yardages: { 'Tee 1 (Gold)': 466, 'Tee 1 (White)': 447 } },
    ],
  },
};

async function updateCourse(courseId: string, data: typeof courseData['dm-apache']) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Updating: ${data.name}`);
  console.log(`${'='.repeat(60)}`);

  // Get the course with its tees and holes
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      tees: true,
      holes: true,
    },
  });

  if (!course) {
    console.log(`  ERROR: Course ${courseId} not found!`);
    return;
  }

  // Update each hole's par and handicap
  for (const holeData of data.holes) {
    const existingHole = course.holes.find(h => h.holeNumber === holeData.hole);

    if (existingHole) {
      // Update par and handicap
      await prisma.hole.update({
        where: { id: existingHole.id },
        data: {
          par: holeData.par,
          handicapRank: holeData.hdcp,
        },
      });
      console.log(`  Hole ${holeData.hole}: Par ${holeData.par}, Hdcp ${holeData.hdcp}`);

      // Update yardages for each tee
      for (const [teeName, yardage] of Object.entries(holeData.yardages)) {
        const tee = course.tees.find(t => t.name === teeName);
        if (tee) {
          // Upsert the hole yardage
          const existingYardage = await prisma.holeYardage.findUnique({
            where: {
              holeId_teeId: {
                holeId: existingHole.id,
                teeId: tee.id,
              },
            },
          });

          if (existingYardage) {
            await prisma.holeYardage.update({
              where: { id: existingYardage.id },
              data: { yardage },
            });
          } else {
            await prisma.holeYardage.create({
              data: {
                holeId: existingHole.id,
                teeId: tee.id,
                yardage,
              },
            });
          }
        }
      }
    } else {
      console.log(`  WARNING: Hole ${holeData.hole} not found for course ${courseId}`);
    }
  }

  console.log(`  ✓ Updated ${data.holes.length} holes`);
}

async function main() {
  console.log('\n🏌️ Desert Mountain Course Data Fix');
  console.log('Source: BlueGolf Course Database (https://course.bluegolf.com)');
  console.log('====================================================================\n');

  for (const [courseId, data] of Object.entries(courseData)) {
    await updateCourse(courseId, data);
  }

  console.log('\n====================================================================');
  console.log('✅ All Desert Mountain courses updated successfully!');
  console.log('====================================================================\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
