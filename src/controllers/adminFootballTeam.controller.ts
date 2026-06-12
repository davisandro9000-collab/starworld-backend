import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';

function getParamId(param: string | string[] | undefined): string {
  if (!param) throw new Error('Missing parameter');
  return Array.isArray(param) ? param[0] : param;
}

// ==================== TEAMS ====================
export const getAllTeams = async (req: Request, res: Response) => {
  const teams = await prisma.footballTeam.findMany({
    include: { players: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, teams });
};

export const createTeam = async (req: Request, res: Response) => {
  const team = await prisma.footballTeam.create({ data: req.body });
  res.status(201).json({ success: true, team });
};

export const updateTeam = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  const team = await prisma.footballTeam.update({ where: { id }, data: req.body });
  res.json({ success: true, team });
};

export const deleteTeam = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  await prisma.footballTeam.delete({ where: { id } });
  res.json({ success: true });
};

// ==================== MATCHES ====================
export const getAllMatches = async (req: Request, res: Response) => {
  const matches = await prisma.footballMatch.findMany({
    include: { homeTeam: true, awayTeam: true, winner: true },
    orderBy: { matchDate: 'asc' },
  });
  res.json({ success: true, matches });
};

export const createMatch = async (req: Request, res: Response) => {
  const { homeTeamId, awayTeamId, matchDate, venue, tournament, ticketUrl } = req.body;
  const match = await prisma.footballMatch.create({
    data: {
      homeTeamId,
      awayTeamId,
      matchDate: new Date(matchDate),
      venue,
      tournament,
      ticketUrl,
      status: 'upcoming',
    },
  });
  res.status(201).json({ success: true, match });
};

export const updateMatch = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  const { homeTeamId, awayTeamId, matchDate, venue, tournament, ticketUrl, status } = req.body;
  const match = await prisma.footballMatch.update({
    where: { id },
    data: {
      homeTeamId,
      awayTeamId,
      matchDate: matchDate ? new Date(matchDate) : undefined,
      venue,
      tournament,
      ticketUrl,
      status,
    },
  });
  res.json({ success: true, match });
};

export const deleteMatch = async (req: Request, res: Response) => {
  const id = getParamId(req.params.id);
  await prisma.footballMatch.delete({ where: { id } });
  res.json({ success: true });
};

export const syncMatchesFromAPI = async (req: Request, res: Response) => {
  // Optional external sync
  res.json({ success: true, message: 'Sync endpoint – implement as needed' });
};