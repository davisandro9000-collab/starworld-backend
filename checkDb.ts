// checkDb.ts
import { prisma } from './src/lib/prisma.js';

async function check() {
  const games = await prisma.footballPredictionGame.findMany({ include: { match: true } });
  console.log('Prediction games:', JSON.stringify(games, null, 2));
  
  const listings = await prisma.footballTicketListing.findMany({ include: { match: true } });
  console.log('Ticket listings:', JSON.stringify(listings, null, 2));
}

check().catch(console.error);