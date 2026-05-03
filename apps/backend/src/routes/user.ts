import { register, login, logout } from '../controllers';
import { requireUser } from '../middleware/requireAuth';
import { generateCSRFToken } from '../middleware/csrf';

import { Router } from 'express';

const router = Router();

router.post('/register', register);
router.post('/login', generateCSRFToken, login);
router.post('/logout', requireUser, logout);

export default router;
