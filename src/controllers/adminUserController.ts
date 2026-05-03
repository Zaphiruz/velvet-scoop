import { Request, Response } from 'express';
import { muteUser, unmuteUser, banUser, unbanUser } from '../services/adminUser';
import { toUserResponse } from '../dtos/user.dto';

export const muteUserController = async (req: Request, res: Response) => {
  const admin = req.user;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }
  const user = await muteUser(admin._id.toString(), id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(toUserResponse(user));
};

export const unmuteUserController = async (req: Request, res: Response) => {
  const admin = req.user;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }
  const user = await unmuteUser(admin._id.toString(), id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(toUserResponse(user));
};

export const banUserController = async (req: Request, res: Response) => {
  const admin = req.user;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }
  const user = await banUser(admin._id.toString(), id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(toUserResponse(user));
};

export const unbanUserController = async (req: Request, res: Response) => {
  const admin = req.user;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }
  const user = await unbanUser(admin._id.toString(), id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(toUserResponse(user));
};
