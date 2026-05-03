import { register, login } from './userController';
import { Request, Response } from 'express';

describe('userController', () => {
  const mockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('should register and return 400 if missing fields', async () => {
    const req: any = { body: {} };
    const res = mockRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // Add similar tests for login
});
