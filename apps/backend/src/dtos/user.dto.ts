// User DTOs and types

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserResponse {
  _id: string;
  name: string;
  email: string;
  createdAt: Date;
  admin: boolean;
  muted: boolean;
  mutedDate?: Date;
  mutedBy?: string;
  banned: boolean;
  bannedDate?: Date;
  bannedBy?: string;
  deleted: boolean;
  deletedDate?: Date;
  deletedBy?: string;
}

export function toUserResponse(user: any): UserResponse {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    admin: user.admin,
    muted: user.muted,
    mutedDate: user.mutedDate,
    mutedBy: user.mutedBy,
    banned: user.banned,
    bannedDate: user.bannedDate,
    bannedBy: user.bannedBy,
    deleted: user.deleted,
    deletedDate: user.deletedDate,
    deletedBy: user.deletedBy,
  };
}
