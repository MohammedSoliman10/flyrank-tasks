import { Router } from 'express';

export function createPublicRouter() {
  const router = Router();

  router.get('/info', (req, res) => {
    res.status(200).json({
      message: 'Welcome stranger! This info is public.',
      authenticated: false,
    });
  });

  return router;
}
