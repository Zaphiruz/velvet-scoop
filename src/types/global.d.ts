import type { IUser } from '../models/User';
import type { Session } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    userAuthenticated?: boolean;
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user: IUser;
      session: Session;
    }
  }
}
