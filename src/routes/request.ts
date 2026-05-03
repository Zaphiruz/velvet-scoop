import { Router } from 'express';
import { requireUser, requireAdmin } from '../middleware/requireAuth';
import {
    getMyOrders,
    cancelMyOrder,
    createMyOrder,
    getAllOrders,
    acceptOrder,
    cancelOrder,
    deleteOrder,
    deleteMyOrder,
    completeOrderController,
} from '../controllers/requestController';
import { generateCSRFToken, checkCSRFTokenDSC } from '../middleware/csrf';

const router = Router();

// Admin routes
router.get('/admin/all', requireUser, requireAdmin, getAllOrders);
router.post('/admin/accept/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, acceptOrder);
router.post('/admin/cancel/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, cancelOrder);
router.post('/admin/complete/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, completeOrderController);
router.delete('/admin/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, deleteOrder);

// User routes
router.get('/my', requireUser, getMyOrders);
router.post('/my/cancel/:id', requireUser, checkCSRFTokenDSC, generateCSRFToken, cancelMyOrder);
router.post('/my/new', requireUser, checkCSRFTokenDSC, generateCSRFToken, createMyOrder);
router.delete('/my/:id', requireUser, checkCSRFTokenDSC, generateCSRFToken, deleteMyOrder);

export default router;
