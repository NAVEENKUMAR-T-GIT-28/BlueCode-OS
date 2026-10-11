import type { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: { userId: Types.ObjectId };
      tenant?: { startupId: Types.ObjectId; role: 'owner' | 'admin' | 'member' };
    }
  }
}
export {};
