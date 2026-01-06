import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const heroImages: Record<string, string> = {
  // Arcadia Bluffs courses
  'arcadia-bluffs': 'https://arcadiabluffs.com/imager/general/1431/bluffs-home_5b091506261da879db7667341b9d392b.png',
  'arcadia-south': 'https://arcadiabluffs.com/imager/general/1431/bluffs-home_5b091506261da879db7667341b9d392b.png',

  // Desert Mountain courses (all use same image)
  'dm-apache': 'https://www.desertmountain.com/wp-content/uploads/2021/06/home-golf-apache-1.jpg',
  'dm-chiricahua': 'https://www.desertmountain.com/wp-content/uploads/2021/06/home-golf-apache-1.jpg',
  'dm-cochise': 'https://www.desertmountain.com/wp-content/uploads/2021/06/home-golf-apache-1.jpg',
  'dm-geronimo': 'https://www.desertmountain.com/wp-content/uploads/2021/06/home-golf-apache-1.jpg',
  'dm-outlaw': 'https://www.desertmountain.com/wp-content/uploads/2021/06/home-golf-apache-1.jpg',
  'dm-renegade': 'https://www.desertmountain.com/wp-content/uploads/2021/06/home-golf-apache-1.jpg',

  // Egypt Valley courses
  'egypt-valley': 'https://www.egyptvalley.com/documents/20124/46722/slider-1.jpg',
  'egypt-ridge': 'https://www.egyptvalley.com/documents/20124/46722/slider-1.jpg',

  // Individual clubs
  'cascade-hills': 'https://www.cascadehillscc.com/Images/Library/course7.jpg',
  'druid-hills': 'https://dhgc.org/documents/20124/50469/Banner1.jpg/acee60a3-2322-55ff-c60d-457a0d67e409?t=1736275591796',
  'high-pointe': 'https://highpointegolf.com/images/leftside.jpg',
  'kingsley-club': 'https://www.kingsleyclub.com/custom/design/banners/navsections/GOLF/kingsley-golf-club-membership-opportunities.jpg',
};

async function main() {
  console.log('Updating course hero images...\n');

  for (const [courseId, heroImageUrl] of Object.entries(heroImages)) {
    try {
      const result = await prisma.course.update({
        where: { id: courseId },
        data: { heroImageUrl },
      });
      console.log(`✓ Updated ${result.name}`);
    } catch (error) {
      console.error(`✗ Failed to update ${courseId}:`, error);
    }
  }

  console.log('\nDone!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
