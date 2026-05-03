/// <reference path="./types/global.d.ts" />

import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from "helmet";
import rateLimit from 'express-rate-limit';
import mongoStore from 'rate-limit-mongo';
import session from 'express-session';
import connctMongo from 'connect-mongo';
import compression from 'compression';
import connectDB from './services/db';
import userRoutes from './routes/user';
import requestRoutes from './routes/request';
import messageRoutes from './routes/message';
import adminUserRoutes from './routes/adminUser';
import reviewRoutes from './routes/review';
import itemRoutes from './routes/item';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));
console.log('has secret?', !!process.env.COOKIE_SECRET);
app.set('trust proxy', 1)
app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  name: 'sessId',
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    domain: process.env.DOMAIN,
  },
  store: connctMongo.create({ mongoUrl: process.env.MONGO_URI || '' })
}));
app.use(helmet());
app.use(rateLimit({
  windowMs: 1000,
  limit: 25,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  ipv6Subnet: 56,
  store: new mongoStore({
    uri: process.env.MONGO_URI || '',
    collectionName: 'rateLimits',
    expireTimeMs: 2000,
    errorHandler: console.error
  })
}));
app.use(compression({
  filter: (req, res) => {
    if (process.env.NODE_ENV !== 'production') {
      return false;
    }

    if (req.headers['x-no-compression']) {
      return false;
    }

    return compression.filter(req, res);
  }
}));
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/items', itemRoutes);

const MONGO_URI = process.env.MONGO_URI || '';
connectDB(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
  });

export default app;
