import { User } from '../models/User';

export async function muteUser(adminId: string, userId: string) {
  return User.findByIdAndUpdate(userId, {
    muted: true,
    mutedDate: new Date(),
    mutedBy: adminId,
  }, { new: true });
}

export async function unmuteUser(adminId: string, userId: string) {
  return User.findByIdAndUpdate(userId, {
    muted: false,
    $unset: { mutedDate: 1, mutedBy: 1 },
  }, { new: true });
}

export async function banUser(adminId: string, userId: string) {
  return User.findByIdAndUpdate(userId, {
    banned: true,
    bannedDate: new Date(),
    bannedBy: adminId,
  }, { new: true });
}

export async function unbanUser(adminId: string, userId: string) {
  return User.findByIdAndUpdate(userId, {
    banned: false,
    $unset: { bannedDate: 1, bannedBy: 1 },
  }, { new: true });
}
