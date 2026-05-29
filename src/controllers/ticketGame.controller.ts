// src/controllers/ticketGame.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { TicketGameService } from '../services/ticketGame.service.js';

const idempotencyService = new IdempotencyService();
const ticketGameService = new TicketGameService(prisma, idempotencyService);

export const enterMatchmaking = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { offerId } = req.body;
  const idempotencyKey = req.idempotencyKey;
  if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key required' });

  const result = await ticketGameService.enterMatchmaking(offerId, userId, idempotencyKey);
  res.json({ success: true, ...result });
};

export const startGame = async (req: Request, res: Response) => {
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const session = await ticketGameService.startGame(sessionId);
  res.json({ success: true, session });
};

export const recordTap = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const { clientTimestamp } = req.body;
  const idempotencyKey = req.idempotencyKey;
  if (!idempotencyKey) return res.status(400).json({ error: 'Idempotency-Key required' });

  await ticketGameService.recordTap(sessionId, userId, clientTimestamp, idempotencyKey);
  res.json({ success: true });
};

export const getResult = async (req: Request, res: Response) => {
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const result = await ticketGameService.getResult(sessionId);
  res.json({ success: true, session: result });
};