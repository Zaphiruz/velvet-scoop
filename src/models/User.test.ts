import { User } from './User';

describe('User Model', () => {
  it('should create and save a user', async () => {
  const user = new User({ name: 'Test User', email: 'test@example.com', password: 'pwtest' });
    const savedUser = await user.save();
    expect(savedUser._id).toBeDefined();
    expect(savedUser.name).toBe('Test User');
    expect(savedUser.email).toBe('test@example.com');
  });

  it('should not save user without required fields', async () => {
  const user = new User({});
    let err;
    try {
      await user.save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeDefined();
  });
});
