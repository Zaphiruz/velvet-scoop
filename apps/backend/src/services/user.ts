import { User } from '../models';
import { RegisterRequest, LoginRequest } from '../dtos/user.dto';
import { signJwt } from './jwt';

export async function registerUser(data: RegisterRequest) {
  const { name, email, password } = data;
  // Check for existing user
  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error('Email already in use');
  }
  const user = new User({ name, email, password });
  await user.save();
  return user;
}

export async function loginUser(data: LoginRequest) {
  const { email, password } = data;
  const user = await User.findOne({ email, banned: false, deleted: false });
  if (!user) {
    throw new Error('Invalid email or password');
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }
  // Generate JWT
  const token = signJwt({
    userId: user._id.toString(),
    email: user.email,
  });
  return { user, token };
}


export async function logoutUser(userId: string) {
  
}
