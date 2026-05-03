import { Request } from './Request';

describe('Request model', () => {
  it('should create a new request with required fields', async () => {
    const req = new Request({
      user: '507f1f77bcf86cd799439011',
      items: [{ itemId: '507f1f77bcf86cd799439012', quantity: 2 }],
      total: 19.99,
      date: new Date(),
      contact: { name: 'Test', email: 'test@example.com' },
    });
    expect(req.user).toBeDefined();
    expect(req.items[0].itemId).toBe('507f1f77bcf86cd799439012');
  });
});
