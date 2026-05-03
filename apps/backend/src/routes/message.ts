import { Router } from 'express';
import { requireUser, requireAdmin } from '../middleware/requireAuth';
import { sendUserMessage, getMyMessages, getAllMessagesAdmin, deleteMessageAdmin, sendAdminMessageController } from '../controllers/messageController';
import { generateCSRFToken, checkCSRFTokenDSC } from '../middleware/csrf';

const router = Router();

// Admin routes
router.get('/admin/all', requireUser, requireAdmin, generateCSRFToken, getAllMessagesAdmin);
router.delete('/admin/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, deleteMessageAdmin);
router.post('/admin/send/:recipientId', requireUser, checkCSRFTokenDSC, generateCSRFToken, requireAdmin, sendAdminMessageController);

// User routes
router.post('/my/send', requireUser, checkCSRFTokenDSC, generateCSRFToken, sendUserMessage);
router.get('/my', requireUser, generateCSRFToken, getMyMessages);

export default router;
