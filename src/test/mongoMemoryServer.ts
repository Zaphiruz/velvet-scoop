import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;

export const startMemoryServer = async (): Promise<string> => {
  mongoServer = await MongoMemoryServer.create();
  return mongoServer.getUri();
};

export const stopMemoryServer = async (): Promise<void> => {
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};
