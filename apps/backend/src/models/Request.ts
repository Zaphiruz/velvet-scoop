import mongoose, { Document, Schema } from 'mongoose';

export enum DocumentStatusEnum {
    Pending = 'pending',
    Accepted = 'accepted',
    Cancelled = 'cancelled',
    Completed = 'completed'
}

export interface IRequest extends Document {
    user: mongoose.Types.ObjectId;
    items: Array<{ itemId: mongoose.Types.ObjectId; quantity: number }>;
    total: number;
    date: Date;
    contact: {
        name: string;
        email: string;
        notes: string;
    }
    accepted: boolean;
    acceptedBy?: mongoose.Types.ObjectId;
    acceptedAt?: Date;
    completed: boolean;
    completedBy?: mongoose.Types.ObjectId;
    completedAt?: Date;
    cancelled: boolean;
    cancelledBy?: mongoose.Types.ObjectId;
    cancelledAt?: Date;
    deleted: boolean;
    deletedBy?: mongoose.Types.ObjectId;
    deletedAt?: Date;
    status: DocumentStatusEnum;
    createdAt: Date;
}

const RequestSchema: Schema<IRequest> = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
        type: [{
            itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
            quantity: { type: Number, required: true }
        }],
        required: true,
        validate: {
            validator: function(arr: any[]) {
                return Array.isArray(arr) && arr.length > 0;
            },
            message: 'Request must contain at least one item.'
        }
    },
    total: { type: Number, required: true },
    date: { type: Date, required: true },
    contact: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        notes: { type: String, required: false },
    },
    accepted: { type: Boolean, default: false },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: { type: Date },
    completed: { type: Boolean, default: false },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date },
    cancelled: { type: Boolean, default: false },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    deleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
    status: { type: String, enum: Object.values(DocumentStatusEnum), default: DocumentStatusEnum.Pending },
    createdAt: { type: Date, default: Date.now },
});

// Add index for user field
RequestSchema.index({ user: 1 });

export const Request = mongoose.model<IRequest>('Request', RequestSchema);
