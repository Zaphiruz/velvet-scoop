import { Request, Response } from 'express';
import { LoginRequest, RegisterRequest, toUserResponse } from '../dtos/user.dto';
import { loginUser, logoutUser, registerUser } from '../services/user';
import { removeCSRFToken } from '../middleware/csrf';

export const register = async (req: Request, res: Response) => {
  const { name, email, password }: RegisterRequest = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }
  try {
    const user = await registerUser({ name, email, password });
    return res.status(201).json(toUserResponse(user));
  } catch (err: any) {
    if (err.message === 'Email already in use') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Registration failed', details: err });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password }: LoginRequest = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }
  try {
    const { user, token } = await loginUser({ email, password });
    
    req.session.userAuthenticated = true;

    // Set JWT token as a cookie
    res.cookie('jwt', token, {
      httpOnly: process.env.NODE_ENV !== 'test',
      expires: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      domain: process.env.DOMAIN
    });

    return res.json(toUserResponse(user));
  } catch (err: any) {
    if (err.message === 'Invalid email or password') {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Login failed', details: err });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    await logoutUser(user._id.toString());
    req.session.userAuthenticated = false;
    res.clearCookie('jwt');
    removeCSRFToken(req, res);
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Logout failed', details: err });
  }
};
