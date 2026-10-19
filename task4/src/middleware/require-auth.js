/**
 * Build the bearer-token middleware.
 *
 * The middleware intentionally distinguishes two cases:
 *   - a missing or malformed Authorization header -> "Access token required"
 *   - a token that Supabase rejects or that has expired -> "Invalid or expired token"
 *
 * It stores the verified Supabase user and the raw token on the request. The
 * token is used by POST /auth/logout to revoke the caller's own session.
 */
export function createRequireAuth(auth) {
  return async function requireAuth(req, res, next) {
    const header = req.get('authorization');

    if (!header) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    if (!match) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      const user = await auth.getUser(match[1]);
      req.user = user;
      req.accessToken = match[1];
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
