import { requireUser, requireAdmin } from './requireAuth';
import * as jwtService from '../services/jwt';
import { User } from '../models';


describe('requireAuth middleware', () => {
  beforeAll(() => {
  jest.spyOn(jwtService, 'verifyJwt').mockReturnValue({ userId: 'u1', email: 'test@example.com' });
    jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'u1', admin: false } as any);
  });

  it('should call next if user is present', async () => {
    const req: any = { cookies: { jwt: 'token' }, headers: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await requireUser(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 if user is not admin', () => {
    const req: any = { user: { _id: 'u1', admin: false }, cookies: {}, headers: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
