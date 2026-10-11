import type { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: { userId: Types.ObjectId };
      tenant?: {
        startupId: Types.ObjectId;
        role: 'owner' | 'admin' | 'member';
        plan: 'trial' | 'starter' | 'growth' | 'pro';
        status: 'active' | 'trial_expired' | 'suspended';
      };
    }
  }
}
export {};
