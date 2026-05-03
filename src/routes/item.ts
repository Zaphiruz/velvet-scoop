import express from 'express';
import * as itemController from '../controllers/itemController';
import { requireUser, requireAdmin } from '../middleware/requireAuth';
import { generateCSRFToken, checkCSRFTokenDSC } from '../middleware/csrf';

const router = express.Router();



// Admin routes
router.get('/admin', requireUser, requireAdmin, generateCSRFToken, itemController.getAllItems);
router.post('/', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, itemController.createItem);
router.put('/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, itemController.updateItem);
router.put('/:id/disable', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, itemController.disableItem);
router.put('/:id/enable', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, itemController.enableItem);
router.delete('/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, itemController.deleteItem);

// Public route
router.get('/', generateCSRFToken, itemController.getItems);

export default router;
