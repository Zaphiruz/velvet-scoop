import { Router } from 'express';
import { requireUser, requireAdmin } from '../middleware/requireAuth';
import { muteUserController, unmuteUserController, banUserController, unbanUserController } from '../controllers/adminUserController';
import { generateCSRFToken, checkCSRFTokenDSC } from '../middleware/csrf';

const router = Router();

router.post('/mute/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, muteUserController);
router.post('/unmute/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, unmuteUserController);
router.post('/ban/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, banUserController);
router.post('/unban/:id', requireUser, requireAdmin, checkCSRFTokenDSC, generateCSRFToken, unbanUserController);

export default router;
