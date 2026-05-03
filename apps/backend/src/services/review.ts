import { Review, Request } from '../models';

export async function doesReviewExist(userId: string, requestId: string): Promise<boolean> {
    const existing = await Review.findOne({ user: userId, request: requestId, deleted: { $ne: true } });
    return !!existing;
}
export async function doesRequestExist(userId: string, requestId: string): Promise<boolean> {
    const request = await Request.findOne({ _id: requestId, user: userId, status: 'completed', deleted: { $ne: true } });
    return !!request;
}
export async function createReview(userId: string, requestId: string, rating: number, comment: string) {
    return Review.create({ user: userId, request: requestId, rating, comment, approved: false });
}

export async function getUserReviews(userId: string) {
    return Review.find({ user: userId, deleted: { $ne: true } });
}

export async function editReview(userId: string, reviewId: string, rating?: number, comment?: string) {
    return Review.findOneAndUpdate(
        { _id: reviewId, user: userId, deleted: { $ne: true } },
        { rating, comment, updatedAt: new Date(), edited: true, editedAt: new Date(), editedBy: userId },
        { new: true }
    );
}

export async function deleteReview(userId: string, reviewId: string) {
    return Review.findOneAndUpdate(
        { _id: reviewId, user: userId, deleted: { $ne: true } },
        { deleted: true, deletedAt: new Date(), deletedBy: userId },
        { new: true }
    );
}

export async function getAllReviews() {
    return Review.find();
}

export async function approveReview(adminId: string, reviewId: string) {
    return Review.findOneAndUpdate({
        _id: reviewId,
        deleted: { $ne: true },
        approved: { $ne: true },
    }, {
        approved: true, approvedAt: new Date(), approvedBy: adminId
    }, {
        new: true
    });
}

export async function adminDeleteReview(adminId: string, reviewId: string) {
    return Review.findOneAndUpdate({
        _id: reviewId, deleted: { $ne: true },
    }, {
        deleted: true, deletedAt: new Date(), deletedBy: adminId
    }, {
        new: true
    });
}

export async function deleteReviewsForOrder(userId: string, requestId: string) {
    return Review.updateMany({ request: requestId }, { deleted: true, deletedAt: new Date(), deletedBy: userId});
}
