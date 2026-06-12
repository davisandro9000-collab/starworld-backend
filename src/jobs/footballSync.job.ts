import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const API_KEY = process.env.FOOTBALL_API_KEY;
const BASE_URL = 'https://api.football-data.org/v4';

const logger = {
  info: (...args: any[]) => console.log('[FootballSync]', ...args),
  error: (...args: any[]) => console.error('[FootballSync]', ...args),
};

async function fetchCompetitionId(competitionCode = 'WC') {
  const url = `${BASE_URL}/competitions/?codes=${competitionCode}`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
  const data = await res.json();
  return data.competitions?.[0]?.id || null;
}

async function fetchTeams(competitionId: number) {
  const url = `${BASE_URL}/competitions/${competitionId}/teams`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
  const data = await res.json();
  return data.teams || [];
}

async function fetchTeamPlayers(teamId: number) {
  const url = `${BASE_URL}/teams/${teamId}`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
  const data = await res.json();
  return data.squad || [];
}

async function fetchMatches(competitionId: number) {
  const url = `${BASE_URL}/competitions/${competitionId}/matches`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
  const data = await res.json();
  return data.matches || [];
}

export async function syncWorldCupData() {
  if (!API_KEY) {
    logger.error('FOOTBALL_API_KEY missing');
    return;
  }

  const competitionId = await fetchCompetitionId('WC');
  if (!competitionId) {
    logger.error('World Cup competition not found');
    return;
  }

  // Sync teams
  const teams = await fetchTeams(competitionId);
  for (const apiTeam of teams) {
    const team = await prisma.footballTeam.upsert({
      where: { externalId: apiTeam.id.toString() },
      update: {
        name: apiTeam.name,
        slug: apiTeam.name.toLowerCase().replace(/\s+/g, '-'),
        flagUrl: apiTeam.crestUrl || null,
        coach: apiTeam.coach?.name || null,
        isPublished: true,
      },
      create: {
        externalId: apiTeam.id.toString(),
        name: apiTeam.name,
        slug: apiTeam.name.toLowerCase().replace(/\s+/g, '-'),
        flagUrl: apiTeam.crestUrl || null,
        coach: apiTeam.coach?.name || null,
        isPublished: true,
      },
    });

    // Sync players for this team
    const players = await fetchTeamPlayers(apiTeam.id);
    for (const apiPlayer of players) {
      await prisma.footballPlayer.upsert({
        where: { externalId: apiPlayer.id.toString() },
        update: {
          name: apiPlayer.name,
          position: apiPlayer.position,
          number: apiPlayer.shirtNumber,
          teamId: team.id,
          isPublished: true,
        },
        create: {
          externalId: apiPlayer.id.toString(),
          name: apiPlayer.name,
          position: apiPlayer.position,
          number: apiPlayer.shirtNumber,
          teamId: team.id,
          isPublished: true,
        },
      });
    }
  }

  // Sync matches
  const matches = await fetchMatches(competitionId);
  const teamExternalToId = new Map();
  const allTeams = await prisma.footballTeam.findMany({ select: { id: true, externalId: true } });
  for (const t of allTeams) {
    if (t.externalId) teamExternalToId.set(t.externalId, t.id);
  }

  for (const apiMatch of matches) {
    const homeTeamId = teamExternalToId.get(apiMatch.homeTeam.id.toString());
    const awayTeamId = teamExternalToId.get(apiMatch.awayTeam.id.toString());
    if (!homeTeamId || !awayTeamId) continue;

    await prisma.footballMatch.upsert({
      where: { externalId: apiMatch.id.toString() },
      update: {
        homeTeamId,
        awayTeamId,
        matchDate: new Date(apiMatch.utcDate),
        status: apiMatch.status === 'SCHEDULED' ? 'upcoming' : apiMatch.status === 'FINISHED' ? 'finished' : 'live',
        homeScore: apiMatch.score?.fullTime?.home ?? null,
        awayScore: apiMatch.score?.fullTime?.away ?? null,
        venue: apiMatch.venue || null,
        ticketUrl: apiMatch.ticketUrl || null,
      },
      create: {
        externalId: apiMatch.id.toString(),
        homeTeamId,
        awayTeamId,
        matchDate: new Date(apiMatch.utcDate),
        tournament: 'World Cup',
        status: apiMatch.status === 'SCHEDULED' ? 'upcoming' : apiMatch.status === 'FINISHED' ? 'finished' : 'live',
        homeScore: apiMatch.score?.fullTime?.home ?? null,
        awayScore: apiMatch.score?.fullTime?.away ?? null,
        venue: apiMatch.venue || null,
        ticketUrl: apiMatch.ticketUrl || null,
      },
    });
  }

  logger.info('World Cup data sync completed');
}