import { startMemoryServer, stopMemoryServer } from './mongoMemoryServer';
import mongoose from 'mongoose';

beforeAll(async () => {
  const uri = await startMemoryServer();
  await mongoose.connect(uri);
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  await mongoose.disconnect();
  await stopMemoryServer();
});
