import { Router } from 'express';

import { AuthError } from '../supabase.js';
import { publicUser } from '../user.js';

const MISSING_CREDENTIALS = 'Email and password are required';

function credentialsFrom(body) {
  if (!body || typeof body !== 'object') return null;

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) return null;
  return { email, password };
}

function isProviderRejection(error) {
  return error instanceof AuthError && error.status >= 400 && error.status < 500;
}

export function createAuthRouter({ auth, requireAuth }) {
  const router = Router();

  router.post('/signup', async (req, res) => {
    const credentials = credentialsFrom(req.body);
    if (!credentials) {
      return res.status(400).json({ error: MISSING_CREDENTIALS });
    }

    try {
      const { user } = await auth.signUp(credentials.email, credentials.password);
      return res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (isProviderRejection(error)) {
        return res.status(400).json({ error: error.message || 'Could not create account' });
      }
      return res.status(502).json({ error: 'Authentication service unavailable' });
    }
  });

  router.post('/login', async (req, res) => {
    const credentials = credentialsFrom(req.body);
    if (!credentials) {
      return res.status(400).json({ error: MISSING_CREDENTIALS });
    }

    try {
      const { user, session } = await auth.signIn(credentials.email, credentials.password);
      return res.status(200).json({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: session.token_type || 'bearer',
        expires_in: session.expires_in,
        user: publicUser(user),
      });
    } catch (error) {
      if (isProviderRejection(error)) {
        // Deliberately generic: do not reveal whether the email exists.
        return res.status(401).json({ error: 'Invalid login credentials' });
      }
      return res.status(502).json({ error: 'Authentication service unavailable' });
    }
  });

  router.post('/logout', requireAuth, async (req, res) => {
    try {
      await auth.signOut(req.accessToken);
      return res.status(204).end();
    } catch (error) {
      if (isProviderRejection(error)) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      return res.status(502).json({ error: 'Authentication service unavailable' });
    }
  });

  return router;
}
