// src/types/global.d.ts
export {};

declare global {
  namespace NodeJS {
    interface Global {
      io?: {
        user: {
          emitToUser: (userId: string, event: string, data: any) => void;
          emitToAll: (event: string, data: any) => void;
        };
        admin: {
          emitNewDeposit: (data: any) => void;
        };
        auction: {
          emitAuctionUpdate: (exchangeId: string, data: any) => void;
        };
        game: {
          emitGameStart: (sessionId: string, payload: any) => void;
          emitGameSignal: (sessionId: string) => void;
          emitGameResult: (sessionId: string, payload: any) => void;
          emitGameOffer: (userId: string, offerData: any) => void;
        };
      };
    }
  }

  // For use in Express request (if you have `req.admin`)
  namespace Express {
    interface Request {
      admin?: { id: string; role: string };
      user?: { id: string };
      idempotencyKey?: string;
    }
  }
}