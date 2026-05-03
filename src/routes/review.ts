import { Router } from 'express';
import { requireUser, requireAdmin } from '../middleware/requireAuth';
import { getPendingReviewsAdminController, createReviewController, getMyReviewsController, editReviewController, deleteReviewController, getAllReviewsAdminController, approveReviewAdminController, adminDeleteReviewController } from '../controllers/reviewController';
import { generateCSRFToken, checkCSRFTokenDSC } from '../middleware/csrf';

const router = Router();

// Admin routes
router.get('/admin/all', requireUser, requireAdmin, generateCSRFToken, getAllReviewsAdminController);
router.get('/admin/pending', requireUser, requireAdmin, generateCSRFToken, getPendingReviewsAdminController);
router.post('/admin/approve/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, approveReviewAdminController);
router.delete('/admin/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, adminDeleteReviewController);

// Customer routes
router.get('/my', requireUser, getMyReviewsController);
router.post('/my/new/:requestId', requireUser, checkCSRFTokenDSC, generateCSRFToken, createReviewController);
router.put('/my/edit/:id', requireUser, checkCSRFTokenDSC, generateCSRFToken, editReviewController);
router.delete('/my/:id', requireUser, checkCSRFTokenDSC, generateCSRFToken, deleteReviewController);

export default router;
