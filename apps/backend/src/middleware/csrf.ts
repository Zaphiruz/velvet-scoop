import { Request, Response, NextFunction } from 'express';
import { randomBytes, createHmac } from 'node:crypto';

export async function generateCSRFToken(req: Request, res: Response, next: NextFunction) {
    try {
        const random = randomBytes(64).toString('base64'); // Generates pseudorandom data. The size argument is a number indicating the number of bytes to generate.
        const hmac = createHmac('sha256', process.env.CSRF_SECRET ?? '')

        hmac.update(`${req.session.id.length}!${req.session.id}!${random.length}!${random}`);
        const hash = hmac.digest('base64');
        const token = `${hash}.${random}`;

        res.cookie('CSRF_TOKEN', token, {
            expires: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            domain: process.env.DOMAIN,
            signed: true
        });

        req.session.csrfToken = token;
        next();
    } catch (e) {
        const errorMessage = (e instanceof Error) ? e.message : String(e);
        res.status(500).json({ result: false, message: errorMessage });
        return;
    }
}

export async function checkCSRFTokenDSC(req: Request, res: Response, next: NextFunction) {
    try {
        const sessionUserAuth = req.session.userAuthenticated;
        const cookieCsrfToken = req.signedCookies.CSRF_TOKEN;
        const requestCsrfToken = req.get('CSRF-Token'); // The token sent within the request header.

        if (!sessionUserAuth || !requestCsrfToken || !cookieCsrfToken) {
            res.status(401)
                .json({
                    result: false, message: 'Token has not been provided.'
                });
            return;
        }

        const [hamcFromRequest, random] = decodeURIComponent(requestCsrfToken ?? '').split('.');

        const hmac = createHmac('sha256', process.env.CSRF_SECRET ?? '')

        hmac.update(`${req.session.id.length}!${req.session.id}!${random.length}!${random}`);
        const expectedHmac = hmac.digest('base64');

        if (expectedHmac !== hamcFromRequest) {
            res.status(401)
                .json({
                    result: false, message: 'Invalid token.'
                });
        }
        next();
    } catch (e) {
        const errorMessage = (e instanceof Error) ? e.message : String(e);
        res.status(500).json({ result: false, message: errorMessage });
        return;
    }
}

export function removeCSRFToken(req: Request, res: Response) {
    res.clearCookie('CSRF-Token');
    req.session.csrfToken = undefined;
} 