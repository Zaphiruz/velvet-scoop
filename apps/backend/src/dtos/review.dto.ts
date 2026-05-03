export interface CreateReviewRequest {
  rating: number;
  comment: string;
}

export interface EditReviewRequest {
  rating?: number;
  comment?: string;
}

export interface ReviewResponse {
  _id: string;
  user: string;
  request: string;
  rating: number;
  comment: string;
  approved: boolean;
  createdAt: Date;
  updatedAt?: Date;
  deleted: boolean;
  deletedBy?: string;
  deletedAt?: Date;
}

export function toReviewResponse(review: any): ReviewResponse {
  return {
    _id: review._id,
    user: review.user?.toString(),
    request: review.request?.toString(),
    rating: review.rating,
    comment: review.comment,
    approved: review.approved,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    deleted: review.deleted,
    deletedBy: review.deletedBy?.toString(),
    deletedAt: review.deletedAt,
  };
}
