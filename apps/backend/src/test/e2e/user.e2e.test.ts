import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import express from 'express';
import cookieParser from 'cookie-parser';
import userRoutes from '../../routes/user';


const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/users', userRoutes);

describe('User E2E', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = request.agent(app);
  });


  it('should register and login a user', async () => {
    // Register
    const registerRes = await agent
      .post('/api/users/register')
      .send({
        name: 'E2E User',
        email: 'e2e@example.com',
        password: 'e2epass',
        admin: true
      });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.name).toBe('E2E User');
    expect(registerRes.body.email).toBe('e2e@example.com');
    expect(registerRes.body.admin).toBe(false);
    expect(registerRes.body.password).toBeUndefined();

    // Login
    const loginRes = await agent
      .post('/api/users/login')
      .send({
        email: 'e2e@example.com',
        password: 'e2epass'
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.name).toBe('E2E User');
    expect(loginRes.body.email).toBe('e2e@example.com');
    expect(loginRes.body.password).toBeUndefined();
  });

  it('should not login with wrong password', async () => {
    await agent
      .post('/api/users/register')
      .send({
        name: 'E2E Wrong',
        email: 'wrong@example.com',
        password: 'rightpass'
      });
    const loginRes = await agent
      .post('/api/users/login')
      .send({
        email: 'wrong@example.com',
        password: 'wrongpass'
      });
    expect(loginRes.status).toBe(401);
    expect(loginRes.body.error).toBe('Invalid email or password');
  });
});
