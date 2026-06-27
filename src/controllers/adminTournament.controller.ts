// src/controllers/adminTournament.controller.ts
import { Request, Response } from 'express';
import { TournamentService } from '../services/tournament.service.js';

const tournamentService = new TournamentService();

export const advanceTournament = async (req: Request, res: Response) => {
  try {
    await tournamentService.advanceToNextRound();
    res.json({ success: true, message: 'Tournament advanced to next stage.' });
  } catch (error) {
    console.error('❌ Failed to advance tournament:', error);
    res.status(500).json({ success: false, message: 'Failed to advance tournament.' });
  }
};