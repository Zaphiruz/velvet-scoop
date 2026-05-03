import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import express from 'express';
import cookieParser from 'cookie-parser';
import userRoutes from '../../routes/user';
import requestRoutes from '../../routes/request';


const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/users', userRoutes);
app.use('/api/request', requestRoutes);

describe('Request endpoints', () => {
let agent: TestAgent;

    beforeEach(() => {
        agent = request.agent(app);
    });

  it('should create a new order', async () => {
    // Register and login user first
    await agent
      .post('/api/users/register')
      .send({ name: 'Test', email: 'test@example.com', password: 'testpass' });
    await agent
      .post('/api/users/login')
      .send({ email: 'test@example.com', password: 'testpass' });

    const res = await agent
      .post('/api/request/my/new')
      .send({ flavor: 'vanilla', date: new Date(), contact: { name: 'Test', email: 'test@example.com' } });
    expect(res.status).toBe(201);
  });

  // Add more e2e tests for all endpoints
});
