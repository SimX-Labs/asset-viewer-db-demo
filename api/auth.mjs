/**
 * Optional Auth0 JWT validation for write routes.
 * When AUTH0_DOMAIN + AUTH0_AUDIENCE are unset, writes are allowed (local dev).
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * @returns {{ enabled: boolean, requireAuth: import('express').RequestHandler, authorFromReq: (req) => object | undefined }}
 */
export function createAuthMiddleware() {
  const domain = process.env.AUTH0_DOMAIN?.replace(/\/+$/, '');
  const audience = process.env.AUTH0_AUDIENCE;
  const enabled = !!(domain && audience);

  /** @type {ReturnType<typeof createRemoteJWKSet> | null} */
  let jwks = null;
  if (enabled) {
    const issuer = domain.startsWith('http') ? `${domain}/` : `https://${domain}/`;
    jwks = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`));
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async function requireAuth(req, res, next) {
    if (!enabled) {
      return next();
    }
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization required.' });
    }
    const token = header.slice(7);
    try {
      const issuer = domain.startsWith('http')
        ? `${domain}/`
        : `https://${domain}/`;
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience,
      });
      req.auth = payload;
      next();
    } catch (e) {
      return res.status(401).json({
        message: 'Invalid or expired token.',
        detail: e?.message,
      });
    }
  }

  /** @param {import('express').Request} req */
  function authorFromReq(req) {
    const auth = req.auth;
    if (auth && typeof auth === 'object') {
      return {
        sub: String(auth.sub ?? 'unknown'),
        name:
          typeof auth.name === 'string'
            ? auth.name
            : typeof auth.nickname === 'string'
              ? auth.nickname
              : undefined,
        email: typeof auth.email === 'string' ? auth.email : undefined,
      };
    }
    // Local / no Auth0: prefer body.author, else anonymous.
    if (req.body?.author?.sub) {
      return {
        sub: String(req.body.author.sub),
        name: req.body.author.name
          ? String(req.body.author.name)
          : undefined,
        email: req.body.author.email
          ? String(req.body.author.email)
          : undefined,
      };
    }
    return { sub: 'local-dev', name: 'Local Dev' };
  }

  return { enabled, requireAuth, authorFromReq };
}
