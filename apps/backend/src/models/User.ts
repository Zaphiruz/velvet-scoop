import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  comparePassword(candidate: string): Promise<boolean>;
  password: string;
  name: string;
  email: string;
  createdAt: Date;
  admin: boolean;
  muted: boolean;
  mutedDate?: Date;
  mutedBy?: mongoose.Types.ObjectId;
  banned: boolean;
  bannedDate?: Date;
  bannedBy?: mongoose.Types.ObjectId;
  deleted: boolean;
  deletedDate?: Date;
  deletedBy?: mongoose.Types.ObjectId;
}

export const UserSchema: Schema<IUser> = new Schema({
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  admin: { type: Boolean, default: false },
  muted: { type: Boolean, default: false },
  mutedDate: { type: Date },
  mutedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  banned: { type: Boolean, default: false },
  bannedDate: { type: Date },
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deleted: { type: Boolean, default: false },
  deletedDate: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

// Add index for email
UserSchema.index({ email: 1 }, { unique: true });

// Hash password before saving
UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};
import bcrypt from 'bcryptjs';
UserSchema.pre('save', async function (next) {
  const user = this as IUser;
  if (!user.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (err) {
    next(err as Error);
  }
});

export const User = mongoose.model<IUser>('User', UserSchema);
