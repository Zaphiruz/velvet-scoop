import e from 'express';
import { Request as ReqModel } from '../models';
import { deleteReviewsForOrder } from './review';
import { getCostForItems } from './item';

export async function createUserRequest(userId: string, data: any) {
    // Add validation and required fields as needed
    const items = Array.from(new Set<string>(data.items.map((item: any) => item.itemId.toString())));
    const costMap = await getCostForItems(items);
    const total = data.items.reduce((sum: number, item: any) => sum + costMap[item.itemId] * item.quantity, 0);

    return await ReqModel.create({ ...data, user: userId, total });
}

export async function getUserRequests(userId: string) {
    return ReqModel.find({ user: userId, deleted: { $ne: true } });
}

export async function cancelUserRequest(userId: string, requestId: string) {
    return ReqModel.findOneAndUpdate(
        {
            _id: requestId,
            user: userId,
            deleted: { $ne: true },
        },
        {
            status: 'cancelled',
            cancelled: true,
            cancelledBy: userId,
            cancelledAt: new Date(),
        },
        { new: true }
    );
}

// User can delete their own request
export async function deleteUserRequest(userId: string, requestId: string) {

    return ReqModel.findOneAndUpdate(
        {
            _id: requestId,
            user: userId,
            deleted: { $ne: true },
        },
        {
            deleted: true,
            deletedAt: new Date(),
            deletedBy: userId,
        },
        { new: true }
    ).then(async (res) => {
        await deleteReviewsForOrder(userId, requestId)
        return res;
    });
}

export async function getAllRequests() {
    return ReqModel.find();
}

export async function acceptRequest(userId: string, requestId: string) {
    return ReqModel.findOneAndUpdate(
        {
            _id: requestId,
            deleted: { $ne: true },
            completed: { $ne: true },
            cancelled: { $ne: true },
            accepted: { $ne: true },
        },
        {
            status: 'accepted',
            accepted: true,
            acceptedAt: new Date(),
            acceptedBy: userId,
        },
        { new: true }
    );
}

// Admin can complete an order
export async function completeOrder(adminId: string, requestId: string) {
    return ReqModel.findOneAndUpdate(
        {
            _id: requestId,
            deleted: { $ne: true },
            cancelled: { $ne: true },
            completed: { $ne: true },
            accepted: true,
        },
        {
            status: 'completed',
            completed: true,
            completedAt: new Date(),
            completedBy: adminId,
        },
        { new: true }
    );
}

export async function cancelRequest(userId: string, requestId: string) {
    return ReqModel.findOneAndUpdate(
        {
            _id: requestId,
            deleted: { $ne: true },
            cancelled: { $ne: true },
        },
        {
            status: 'cancelled',
            cancelled: true,
            cancelledAt: new Date(),
            cancelledBy: userId,
        },
        { new: true }
    );
}

export async function deleteRequest(userId: string, requestId: string) {
    return ReqModel.findOneAndUpdate(
        {
            _id: requestId,
            deleted: { $ne: true },
        },
        {
            deleted: true,
            deletedAt: new Date(),
            deletedBy: userId,
        },
        { new: true }
    ).then(async (res) => {
        await deleteReviewsForOrder(userId, requestId)
        return res;
    });
}
