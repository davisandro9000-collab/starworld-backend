import { PrismaClient } from '@prisma/client';

export class FootballStatsService {
  constructor(private prisma: PrismaClient) {}

  async updatePlayerStats(playerId: string, goalsToAdd: number = 0, assistsToAdd: number = 0) {
    return this.prisma.footballPlayer.update({
      where: { id: playerId },
      data: {
        goals: { increment: goalsToAdd },
        assists: { increment: assistsToAdd },
      },
    });
  }

  async updateMatchResult(matchId: string, homeScore: number, awayScore: number, winnerId?: string | null) {
    return this.prisma.footballMatch.update({
      where: { id: matchId },
      data: {
        homeScore,
        awayScore,
        winnerId: winnerId || null,
        status: 'finished',
      },
    });
  }
}