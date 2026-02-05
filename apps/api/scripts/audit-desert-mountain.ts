import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all Desert Mountain courses
  const courses = await prisma.course.findMany({
    where: {
      name: {
        contains: 'Desert Mountain',
        mode: 'insensitive',
      },
    },
    include: {
      tees: {
        include: {
          holeYardages: true,
        },
        orderBy: {
          name: 'asc',
        },
      },
      holes: {
        orderBy: {
          holeNumber: 'asc',
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  console.log(`\n=== Found ${courses.length} Desert Mountain courses ===\n`);

  for (const course of courses) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`COURSE: ${course.name}`);
    console.log(`ID: ${course.id}`);
    console.log(`Location: ${course.city}, ${course.state}`);
    console.log(`${'='.repeat(60)}`);

    // Print tees with ratings
    console.log('\nTEES:');
    for (const tee of course.tees) {
      console.log(`  ${tee.name}: Rating ${tee.courseRating} / Slope ${tee.slopeRating} / ${tee.totalYardage} yards`);
    }

    // Print hole-by-hole data
    console.log('\nHOLE DATA:');
    console.log('Hole\tPar\tHdcp\t' + course.tees.map(t => t.name).join('\t'));
    console.log('-'.repeat(60));

    let frontPar = 0;
    let backPar = 0;
    const frontYardages: { [teeName: string]: number } = {};
    const backYardages: { [teeName: string]: number } = {};
    course.tees.forEach(t => {
      frontYardages[t.name] = 0;
      backYardages[t.name] = 0;
    });

    for (const hole of course.holes) {
      const yardages = course.tees.map(tee => {
        const hy = tee.holeYardages.find(y => y.holeId === hole.id);
        const yds = hy?.yardage || 0;
        if (hole.holeNumber <= 9) {
          frontYardages[tee.name] += yds;
        } else {
          backYardages[tee.name] += yds;
        }
        return yds;
      });

      if (hole.holeNumber <= 9) {
        frontPar += hole.par;
      } else {
        backPar += hole.par;
      }

      console.log(`${hole.holeNumber}\t${hole.par}\t${hole.handicapRank}\t${yardages.join('\t')}`);

      if (hole.holeNumber === 9) {
        console.log('-'.repeat(60));
        console.log(`OUT\t${frontPar}\t\t${course.tees.map(t => frontYardages[t.name]).join('\t')}`);
        console.log('-'.repeat(60));
      }
    }

    console.log('-'.repeat(60));
    console.log(`IN\t${backPar}\t\t${course.tees.map(t => backYardages[t.name]).join('\t')}`);
    console.log(`TOT\t${frontPar + backPar}\t\t${course.tees.map(t => frontYardages[t.name] + backYardages[t.name]).join('\t')}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
