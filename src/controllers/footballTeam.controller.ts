// src/controllers/footballTeam.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';

export const getAllTeams = async (req: Request, res: Response) => {
  const teams = await prisma.footballTeam.findMany({
    where: { isPublished: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, teams });
};

export const getTeamBySlug = async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const team = await prisma.footballTeam.findUnique({
    where: { slug, isPublished: true },
    include: { players: { where: { isPublished: true }, orderBy: { number: 'asc' } } },
  });
  if (!team) throw ApiError.notFound('Team not found');
  res.json({ success: true, team });
};

export const getTeamPlayers = async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const team = await prisma.footballTeam.findUnique({
    where: { slug, isPublished: true },
    select: { id: true, name: true },
  });
  if (!team) throw ApiError.notFound('Team not found');
  const players = await prisma.footballPlayer.findMany({
    where: { teamId: team.id, isPublished: true },
    orderBy: { number: 'asc' },
  });
  res.json({ success: true, players });
};

// NEW: Get matches for a team
export const getTeamMatches = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const team = await prisma.footballTeam.findUnique({
    where: { slug, isPublished: true },
  });
  if (!team) throw ApiError.notFound('Team not found');
  const matches = await prisma.footballMatch.findMany({
    where: {
      OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
      isPublished: true,
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { matchDate: 'asc' },
  });
  res.json({ success: true, matches });
};