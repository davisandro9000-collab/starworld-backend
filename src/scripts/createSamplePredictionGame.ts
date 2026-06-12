import { prisma } from '../lib/prisma.js';

async function createSampleGame() {
  // Find an upcoming match and include the team details
  const match = await prisma.footballMatch.findFirst({
    where: { status: 'upcoming' },
    orderBy: { matchDate: 'asc' },
    include: { homeTeam: true, awayTeam: true },  // <-- add this
  });

  if (!match) {
    console.log('No upcoming match found. Try using any match.');
    return;
  }

  // Check if a prediction game already exists for this match
  const existing = await prisma.footballPredictionGame.findFirst({
    where: { matchId: match.id },
  });

  if (existing) {
    console.log(`Prediction game already exists for match ${match.id}`);
    return;
  }

  const game = await prisma.footballPredictionGame.create({
    data: {
      name: `Winner of ${match.homeTeam.name} vs ${match.awayTeam.name}`,
      description: 'Predict the winner of this match',
      predictionType: 'WINNER',
      matchId: match.id,
      points: 10,
      coinReward: 5,
      startsAt: new Date(),
      endsAt: match.matchDate,
      isActive: true,
    },
  });

  console.log(`✅ Created prediction game: ${game.name} (ID: ${game.id})`);
}

createSampleGame()
  .catch(console.error)
  .finally(() => prisma.$disconnect());