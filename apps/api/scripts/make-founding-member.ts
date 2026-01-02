#!/usr/bin/env npx tsx

/**
 * Mark a user as a founding member
 * Usage: npx tsx scripts/make-founding-member.ts <email>
 *
 * Example: npx tsx scripts/make-founding-member.ts mike@example.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.log('Usage: npx tsx scripts/make-founding-member.ts <email>');
    console.log('\nCurrent users:');

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        isFoundingMember: true,
      },
    });

    if (users.length === 0) {
      console.log('  No users found');
    } else {
      users.forEach((u) => {
        const name = u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'No name';
        const status = u.isFoundingMember ? '⭐ Founding Member' : '  Regular';
        console.log(`  ${status} | ${u.email} | ${name}`);
      });
    }
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    console.log('\nNote: User must sign up through the app first.');
    process.exit(1);
  }

  if (user.isFoundingMember) {
    console.log(`${email} is already a founding member!`);
    process.exit(0);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isFoundingMember: true },
  });

  console.log(`✅ ${email} is now a founding member!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
