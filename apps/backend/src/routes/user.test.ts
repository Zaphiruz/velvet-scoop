import request from 'supertest';
import express from 'express';
import { User } from '../models';
import userRoutes from './user';

const app = express();
app.use(express.json());
app.use('/api/user', userRoutes);

// DB setup handled globally in setup.ts

describe('User Routes', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/user/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'mySecret123',
        admin: true
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test User');
    expect(res.body.email).toBe('test@example.com');
  expect(res.body.admin).toBe(false);
  expect(res.body.password).toBeUndefined();
  });

  it('should login with correct credentials', async () => {
    await request(app)
      .post('/api/user/register')
      .send({
        name: 'Login User',
        email: 'login@example.com',
        password: 'loginPass'
      });
    const res = await request(app)
      .post('/api/user/login')
      .send({
        email: 'login@example.com',
        password: 'loginPass'
      });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Login User');
    expect(res.body.email).toBe('login@example.com');
  expect(res.body.password).toBeUndefined();
  });

  it('should not login with incorrect password', async () => {
    await request(app)
      .post('/api/user/register')
      .send({
        name: 'Bad Login',
        email: 'badlogin@example.com',
        password: 'rightPass'
      });
    const res = await request(app)
      .post('/api/user/login')
      .send({
        email: 'badlogin@example.com',
        password: 'wrongPass'
      });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });
});
