import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
    user: mongoose.Types.ObjectId;
    request: mongoose.Types.ObjectId;
    rating: number;
    comment: string;
    createdAt: Date;
    updatedAt?: Date;
    approved?: boolean;
    approvedBy?: mongoose.Types.ObjectId;
    approvedAt?: Date;
    deleted: boolean;
    deletedBy?: mongoose.Types.ObjectId;
    deletedAt?: Date;
    edited?: boolean;
    editedAt?: Date;
    editedBy?: mongoose.Types.ObjectId;
}

const ReviewSchema: Schema<IReview> = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    approved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    deleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
    edited: { type: Boolean, default: false },
    editedAt: { type: Date },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

ReviewSchema.index({ user: 1 });
ReviewSchema.index({ request: 1 });
ReviewSchema.index({ user: 1, request: 1 });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
