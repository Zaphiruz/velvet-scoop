import mongoose, { Schema, Document } from 'mongoose';

export interface ItemDocument extends Document {
  name: string;
  description: string;
  nutritionalFacts: string;
  ingredients: string;
  allergyInformation: string;
  isSeasonal: boolean;
  cost: number;
  deactivated: boolean;
  deactivatedBy?: mongoose.Types.ObjectId;
  deactivatedAt?: Date;
  activated: boolean;
  activatedBy?: mongoose.Types.ObjectId;
  activatedAt?: Date;
  deleted: boolean;
  deletedBy?: mongoose.Types.ObjectId;
  deletedAt?: Date;
  edited: boolean;
  editedBy?: mongoose.Types.ObjectId;
  editedAt?: Date;
}

export const ItemSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  nutritionalFacts: { type: String, default: '' },
  ingredients: { type: String, default: '' },
  allergyInformation: { type: String, default: '' },
  isSeasonal: { type: Boolean, default: false },
  cost: { type: Number, required: true },
  deactivated: { type: Boolean, default: false },
  deactivatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deactivatedAt: { type: Date },
  activated: { type: Boolean, default: false },
  activatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  activatedAt: { type: Date },
  deleted: { type: Boolean, default: false },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date },
  edited: { type: Boolean, default: false },
  editedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  editedAt: { type: Date },
}, {
  timestamps: true
});

export const Item = mongoose.model<ItemDocument>('Item', ItemSchema);
