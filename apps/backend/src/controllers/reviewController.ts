import { Request, Response } from 'express';
import { Review } from '../models';
import { doesReviewExist, doesRequestExist, createReview, getUserReviews, editReview, deleteReview, getAllReviews, approveReview, adminDeleteReview } from '../services/review';
import { CreateReviewRequest, EditReviewRequest, toReviewResponse } from '../dtos/review.dto';

export const getPendingReviewsAdminController = async (req: Request, res: Response) => {
  const reviews = await Review.find({ approved: false, deleted: { $ne: true } });
  res.json(reviews.map(toReviewResponse));
};

export const createReviewController = async (req: Request, res: Response) => {
  const user = req.user;
  const { requestId } = req.params;
  const data: CreateReviewRequest = req.body;
  if (!requestId || !data.rating || !data.comment) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  const requestExists = await doesRequestExist(user._id.toString(), requestId);
  if (!requestExists) {
    return res.status(404).json({ message: 'Request not found or not completed' });
  }

  const reviewExists = await doesReviewExist(user._id.toString(), requestId);
  if (reviewExists) {
    return res.status(409).json({ message: 'Review already exists for this order' });
  }
  
  const review = await createReview(user._id.toString(), requestId, data.rating, data.comment);
  res.status(201).json(toReviewResponse(review));
};

export const getMyReviewsController = async (req: Request, res: Response) => {
  const user = req.user;
  const reviews = await getUserReviews(user._id.toString());
  res.json(reviews.map(toReviewResponse));
};

export const editReviewController = async (req: Request, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const data: EditReviewRequest = req.body;
  if (!id || (!data.rating && !data.comment)) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }
  const review = await editReview(user._id.toString(), id, data.rating, data.comment);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  res.json(toReviewResponse(review));
};

export const deleteReviewController = async (req: Request, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }
  const review = await deleteReview(user._id.toString(), id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  res.json(toReviewResponse(review));
};

export const getAllReviewsAdminController = async (req: Request, res: Response) => {
  const reviews = await getAllReviews();
  res.json(reviews.map(toReviewResponse));
};

export const approveReviewAdminController = async (req: Request, res: Response) => {
  const admin = req.user;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }
  const review = await approveReview(admin._id.toString(), id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  res.json(toReviewResponse(review));
};

export const adminDeleteReviewController = async (req: Request, res: Response) => {
  const admin = req.user;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }
  const review = await adminDeleteReview(admin._id.toString(), id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  res.json(toReviewResponse(review));
};
