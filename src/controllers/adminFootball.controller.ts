import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';

function getParamId(param: string | string[] | undefined): string {
  if (!param) throw new Error('Missing parameter');
  return Array.isArray(param) ? param[0] : param;
}

export const getAllStars = async (req: Request, res: Response) => {
  const stars = await prisma.footballStar.findMany();
  res.json(stars);
};

export const createStar = async (req: Request, res: Response) => {
  const star = await prisma.footballStar.create({ data: req.body });
  res.json(star);
};

export const updateStar = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  const star = await prisma.footballStar.update({
    where: { id },
    data: req.body,
  });
  res.json(star);
};

export const deleteStar = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  await prisma.footballStar.delete({ where: { id } });
  res.json({ success: true });
};

export const getAllMatches = async (req: Request, res: Response) => {
  const matches = await prisma.footballMatch.findMany({ include: { winner: true } });
  res.json(matches);
};

export const updateMatch = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  const match = await prisma.footballMatch.update({
    where: { id },
    data: req.body,
  });
  res.json(match);
};

export const deleteMatch = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  await prisma.footballMatch.delete({ where: { id } });
  res.json({ success: true });
};

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const API_BASE = 'https://api.football-data.org/v4';

export const syncMatchesFromAPI = async (req: Request, res: Response) => {
  if (!FOOTBALL_API_KEY) throw ApiError.internal('Football API key missing');
  const { competition = 'WC' } = req.query;
  const url = `${API_BASE}/competitions/${competition}/matches`;
  const response = await fetch(url, {
    headers: { 'X-Auth-Token': FOOTBALL_API_KEY },
  });
  const data = await response.json();
  if (!response.ok) throw ApiError.internal('Failed to fetch external matches');
  for (const match of data.matches) {
    await prisma.footballMatch.upsert({
      where: { externalId: match.id.toString() },
      update: {
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        matchDate: new Date(match.utcDate),
        status: match.status,
        homeScore: match.score.fullTime.home,
        awayScore: match.score.fullTime.away,
      },
      create: {
        externalId: match.id.toString(),
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        matchDate: new Date(match.utcDate),
        tournament: competition as string,
        status: match.status,
        homeScore: match.score.fullTime.home,
        awayScore: match.score.fullTime.away,
        ticketUrl: match.ticketUrl || null,
      },
    });
  }
  res.json({ success: true, synced: data.matches.length });
};