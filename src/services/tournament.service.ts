// src/services/tournament.service.ts
import { prisma } from '../lib/prisma.js';

type TeamStanding = {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

const VENUES = [
  'MetLife Stadium', 'AT&T Stadium', 'SoFi Stadium', 'Arrowhead Stadium',
  'Mercedes-Benz Stadium', 'Hard Rock Stadium', 'NRG Stadium',
  'Lincoln Financial Field', "Levi's Stadium", 'Lumen Field',
  'Gillette Stadium', 'BMO Field', 'Estadio Azteca', 'Estadio BBVA',
  'Estadio Akron', 'BC Place'
];

export class TournamentService {

  // ---- 1. Compute group standings ----
  async computeGroupStandings(groupLetter: string): Promise<TeamStanding[]> {
    const teams = await prisma.footballTeam.findMany({
      where: { group: `Group ${groupLetter}` },
    });
    const matches = await prisma.footballMatch.findMany({
      where: {
        stage: 'group',
        OR: [
          { homeTeam: { group: `Group ${groupLetter}` } },
          { awayTeam: { group: `Group ${groupLetter}` } },
        ],
        status: 'finished',
        homeScore: { not: null },
        awayScore: { not: null },
      },
      include: { homeTeam: true, awayTeam: true },
    });

    const standings: Record<string, TeamStanding> = {};
    for (const team of teams) {
      standings[team.id] = {
        teamId: team.id,
        teamName: team.name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      };
    }

    for (const match of matches) {
      const homeId = match.homeTeamId;
      const awayId = match.awayTeamId;
      const homeScore = match.homeScore!;
      const awayScore = match.awayScore!;

      standings[homeId].goalsFor += homeScore;
      standings[homeId].goalsAgainst += awayScore;
      standings[awayId].goalsFor += awayScore;
      standings[awayId].goalsAgainst += homeScore;

      standings[homeId].played++;
      standings[awayId].played++;
      if (homeScore > awayScore) {
        standings[homeId].wins++;
        standings[homeId].points += 3;
        standings[awayId].losses++;
      } else if (awayScore > homeScore) {
        standings[awayId].wins++;
        standings[awayId].points += 3;
        standings[homeId].losses++;
      } else {
        standings[homeId].draws++;
        standings[awayId].draws++;
        standings[homeId].points += 1;
        standings[awayId].points += 1;
      }
    }

    for (const id in standings) {
      standings[id].goalDiff = standings[id].goalsFor - standings[id].goalsAgainst;
    }

    // Sort: points > GD > GF (head‑to‑head omitted for simplicity)
    return Object.values(standings).sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.goalDiff !== b.goalDiff) return b.goalDiff - a.goalDiff;
      return b.goalsFor - a.goalsFor;
    });
  }

  // ---- 2. Get best 8 third‑placed teams ----
  async getBestThirdPlacedTeams(): Promise<string[]> {
    const groupLetters = 'ABCDEFGHIJKL'.split('');
    const thirdPlaced: { teamId: string; points: number; gd: number; gf: number }[] = [];

    for (const letter of groupLetters) {
      const standings = await this.computeGroupStandings(letter);
      if (standings.length >= 3) {
        const third = standings[2];
        thirdPlaced.push({
          teamId: third.teamId,
          points: third.points,
          gd: third.goalDiff,
          gf: third.goalsFor,
        });
      }
    }

    thirdPlaced.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.gd !== b.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });

    return thirdPlaced.slice(0, 8).map(t => t.teamId);
  }

  // ---- 3. Get all qualified teams ----
  async getQualifiedTeams(): Promise<{ winners: string[]; runners: string[]; third: string[] }> {
    const groupLetters = 'ABCDEFGHIJKL'.split('');
    const winners: string[] = [];
    const runners: string[] = [];
    for (const letter of groupLetters) {
      const standings = await this.computeGroupStandings(letter);
      if (standings.length >= 2) {
        winners.push(standings[0].teamId);
        runners.push(standings[1].teamId);
      }
    }
    const third = await this.getBestThirdPlacedTeams();
    return { winners, runners, third };
  }

  // ---- 4. Generate knockout matches ----
  async generateKnockoutMatches(stage: string, round: number, matchCount: number, baseDate: Date) {
    // Get current stage matches that are finished
    const finished = await prisma.footballMatch.findMany({
      where: {
        stage: this.getPreviousStage(stage),
        status: 'finished',
        winnerId: { not: null },
      },
      include: { homeTeam: true, awayTeam: true, winner: true },
    });

    // Determine winners (team IDs) in order of matches
    const winners = finished.map(m => m.winnerId!).filter(Boolean);

    // If not enough winners, abort
    if (winners.length < matchCount * 2) {
      console.log(`Not enough winners to generate ${stage}. Need ${matchCount*2}, have ${winners.length}`);
      return;
    }

    // Shuffle to create pairings (or use deterministic order)
    // For real tournament, we'd use a fixed bracket. We'll use a simple order.
    const shuffled = winners.sort(() => Math.random() - 0.5);
    const pairs = [];
    for (let i = 0; i < matchCount; i++) {
      pairs.push([shuffled[i], shuffled[i + matchCount]]);
    }

    // Generate matches
    for (let i = 0; i < pairs.length; i++) {
      const [homeId, awayId] = pairs[i];
      await prisma.footballMatch.create({
        data: {
          homeTeamId: homeId,
          awayTeamId: awayId,
          matchDate: new Date(baseDate.getTime() + i * 3 * 60 * 60 * 1000),
          venue: VENUES[i % VENUES.length],
          tournament: 'World Cup 2026 Knockout',
          status: 'upcoming',
          stage: stage,
          round: round,
          isPublished: true,
        },
      });
    }
    console.log(`✅ Generated ${pairs.length} ${stage} matches.`);
  }

  getPreviousStage(stage: string): string {
    const order = ['group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place'];
    const idx = order.indexOf(stage);
    return order[idx - 1];
  }

  // ---- 5. Specific round generators ----
  async generateRoundOf32() {
    const existing = await prisma.footballMatch.findFirst({ where: { stage: 'round_of_32' } });
    if (existing) { console.log('Round of 32 already exists.'); return; }

    const { winners, runners, third } = await this.getQualifiedTeams();
    const allQualified = [...winners, ...runners, ...third];
    if (allQualified.length < 32) {
      console.log(`Only ${allQualified.length} teams qualified. Need 32.`);
      return;
    }

    // Simple pairing: winners vs third (8), runners vs runners (8)
    const shuffledWinners = winners.sort(() => Math.random() - 0.5);
    const shuffledRunners = runners.sort(() => Math.random() - 0.5);
    const shuffledThird = third.sort(() => Math.random() - 0.5);

    const matches = [];
    // Pair winners with third (up to 8)
    for (let i = 0; i < Math.min(shuffledWinners.length, shuffledThird.length); i++) {
      matches.push([shuffledWinners[i], shuffledThird[i]]);
    }
    // Pair remaining winners with runners, or runners with runners
    const remainingWinners = shuffledWinners.slice(shuffledThird.length);
    const remainingRunners = shuffledRunners.slice(0, matches.length - shuffledThird.length);
    // Ensure we have 16 matches total
    while (matches.length < 16) {
      if (remainingWinners.length > 0 && remainingRunners.length > 0) {
        matches.push([remainingWinners.pop()!, remainingRunners.pop()!]);
      } else {
        break;
      }
    }
    // If still less, add random pairings from all qualified
    const remaining = allQualified.filter(id => !matches.flat().includes(id));
    while (matches.length < 16 && remaining.length >= 2) {
      const a = remaining.pop()!;
      const b = remaining.pop()!;
      matches.push([a, b]);
    }

    // Create matches
    const baseDate = new Date('2026-07-01T20:00:00Z');
    for (let i = 0; i < matches.length; i++) {
      const [home, away] = matches[i];
      await prisma.footballMatch.create({
        data: {
          homeTeamId: home,
          awayTeamId: away,
          matchDate: new Date(baseDate.getTime() + i * 3 * 60 * 60 * 1000),
          venue: VENUES[i % VENUES.length],
          tournament: 'World Cup 2026 Knockout',
          status: 'upcoming',
          stage: 'round_of_32',
          round: 1,
          isPublished: true,
        },
      });
    }
    console.log(`✅ Generated ${matches.length} Round of 32 matches.`);
  }

  async generateRoundOf16() {
    await this.generateKnockoutMatches('round_of_16', 2, 8, new Date('2026-07-06T20:00:00Z'));
  }

  async generateQuarterFinals() {
    await this.generateKnockoutMatches('quarter_final', 3, 4, new Date('2026-07-10T20:00:00Z'));
  }

  async generateSemiFinals() {
    await this.generateKnockoutMatches('semi_final', 4, 2, new Date('2026-07-14T20:00:00Z'));
  }

  async generateFinalAndThirdPlace() {
    // Final
    await this.generateKnockoutMatches('final', 5, 1, new Date('2026-07-19T18:00:00Z'));
    // Third place
    await this.generateKnockoutMatches('third_place', 5, 1, new Date('2026-07-18T18:00:00Z'));
  }

  // ---- 6. Main advancement ----
  async advanceToNextRound() {
    const currentStage = await this.getCurrentStage();
    switch (currentStage) {
      case 'group':
        await this.generateRoundOf32();
        break;
      case 'round_of_32':
        await this.generateRoundOf16();
        break;
      case 'round_of_16':
        await this.generateQuarterFinals();
        break;
      case 'quarter_final':
        await this.generateSemiFinals();
        break;
      case 'semi_final':
        await this.generateFinalAndThirdPlace();
        break;
      default:
        console.log('Tournament already finished or no matches to advance.');
    }
  }

  async getCurrentStage(): Promise<string> {
    const stages = ['group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place'];
    const existing = await prisma.footballMatch.findMany({
      where: { stage: { in: stages } },
      orderBy: { stage: 'desc' },
      take: 1,
    });
    if (existing.length === 0) return 'group';
    return existing[0].stage;
  }
}