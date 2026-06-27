import { prisma } from '../lib/prisma.js';

async function updateStage() {
  console.log('Updating group stage matches...');
  const result = await prisma.footballMatch.updateMany({
    where: {
      stage: null,
      tournament: { contains: 'Group Stage' },
    },
    data: { stage: 'group' },
  });
  console.log(`✅ Updated ${result.count} matches.`);
}

updateStage()
  .catch(console.error)
  .finally(() => prisma.$disconnect());