import { prisma } from '../lib/prisma.js';
import { FootballNewsService } from '../services/footballNews.service.js';

const newsService = new FootballNewsService(prisma);

export async function syncFootballNews() {
  console.log('[FootballNews] Starting sync...');
  const teams = await prisma.footballTeam.findMany({ where: { isPublished: true } });
  console.log(`[FootballNews] Found ${teams.length} teams`);
  
  for (const team of teams) {
    try {
      const count = await newsService.storeNewsForTeam(team.id, team.name);
      console.log(`[FootballNews] ${team.name}: stored ${count} articles`);
    } catch (err) {
      console.error(`[FootballNews] Error for ${team.name}:`, err);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('[FootballNews] Sync completed');
}

// If run directly via tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  syncFootballNews().catch(console.error);
}