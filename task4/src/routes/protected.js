import { Router } from 'express';

import { publicUser } from '../user.js';

export function createProtectedRouter({ requireAuth }) {
  const router = Router();

  router.use(requireAuth);

  router.get('/profile', (req, res) => {
    res.status(200).json(publicUser(req.user));
  });

  router.get('/dashboard', (req, res) => {
    res.status(200).json({
      message: 'Welcome to your private dashboard.',
      user: publicUser(req.user),
    });
  });

  // Small stretch goal: a role check on top of authentication. A valid token
  // for a non-admin user gets 403 rather than 401.
  router.get('/admin', (req, res) => {
    if (req.user?.app_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return res.status(200).json({
      message: 'Admin area: authentication and authorization both succeeded.',
      user: publicUser(req.user),
    });
  });

  return router;
}
