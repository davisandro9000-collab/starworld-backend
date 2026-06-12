// src/controllers/adminFootballPlayer.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';

export const getPlayers = async (req: Request, res: Response) => {
  const players = await prisma.footballPlayer.findMany({
    include: { team: true },
    orderBy: { team: { name: 'asc' } },
  });
  res.json({ success: true, players });
};

export const updatePlayerStats = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { goals, assists } = req.body;
  const player = await prisma.footballPlayer.update({
    where: { id: id as string },
    data: { goals, assists },
  });
  res.json({ success: true, player });
};