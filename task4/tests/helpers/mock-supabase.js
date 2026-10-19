import { randomUUID } from 'node:crypto';

import express from 'express';

function nowIso() {
  return new Date().toISOString();
}

function bearerToken(req) {
  const header = req.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * A tiny, in-memory stand-in for the Supabase GoTrue endpoints used by the API.
 *
 * This exists so the full HTTP flow can be tested without a hosted Supabase
 * project. It is not a general Supabase emulator; it implements only:
 *   POST /auth/v1/signup
 *   POST /auth/v1/token?grant_type=password
 *   GET  /auth/v1/user
 *   POST /auth/v1/logout
 *
 * Tests use an ephemeral port. `scripts/mock-supabase.js` exposes the same
 * server on port 54321 for a manual curl / Swagger demo.
 */
export async function startMockSupabase({ port = 0 } = {}) {
  const app = express();
  app.use(express.json());

  const usersByEmail = new Map();
  const usersById = new Map();
  const sessions = new Map();

  function createUser({ email, password, app_metadata = {} }) {
    const normalizedEmail = email.trim().toLowerCase();
    if (usersByEmail.has(normalizedEmail)) {
      const error = new Error('User already registered');
      error.code = 'user_already_exists';
      throw error;
    }

    const createdAt = nowIso();
    const id = randomUUID();
    const user = {
      id,
      aud: 'authenticated',
      role: 'authenticated',
      email: normalizedEmail,
      email_confirmed_at: createdAt,
      confirmed_at: createdAt,
      last_sign_in_at: createdAt,
      app_metadata: { provider: 'email', providers: ['email'], ...app_metadata },
      user_metadata: {},
      identities: [
        {
          identity_id: randomUUID(),
          id,
          user_id: id,
          identity_data: { email: normalizedEmail, sub: id },
          provider: 'email',
          last_sign_in_at: createdAt,
          created_at: createdAt,
          updated_at: createdAt,
          email: normalizedEmail,
        },
      ],
      created_at: createdAt,
      updated_at: createdAt,
    };

    usersByEmail.set(normalizedEmail, { user, password });
    usersById.set(user.id, user);
    return user;
  }

  function issueSession(user) {
    const accessToken = `access_${randomUUID()}`;
    const refreshToken = `refresh_${randomUUID()}`;
    const expiresIn = 3600;
    sessions.set(accessToken, { userId: user.id, refreshToken });
    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      refresh_token: refreshToken,
      user,
    };
  }

  function currentUser(req) {
    const token = bearerToken(req);
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    return usersById.get(session.userId) || null;
  }

  app.post('/auth/v1/signup', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email.trim() || !password) {
      return res.status(400).json({
        code: 400,
        error_code: 'validation_failed',
        msg: 'Email and password are required',
      });
    }

    try {
      const user = createUser({ email, password });
      return res.status(200).json(issueSession(user));
    } catch (error) {
      return res.status(400).json({
        code: 400,
        error_code: error.code || 'signup_failed',
        msg: error.message,
      });
    }
  });

  app.post('/auth/v1/token', (req, res) => {
    if (req.query.grant_type !== 'password') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only grant_type=password is implemented by this mock',
      });
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const record = usersByEmail.get(email);

    if (!record || record.password !== password) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
      });
    }

    record.user.last_sign_in_at = nowIso();
    return res.status(200).json(issueSession(record.user));
  });

  app.get('/auth/v1/user', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ code: 401, msg: 'invalid JWT: unable to verify token' });
    }
    return res.status(200).json(user);
  });

  app.post('/auth/v1/logout', (req, res) => {
    const token = bearerToken(req);
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ code: 401, msg: 'invalid JWT: unable to verify token' });
    }
    sessions.delete(token);
    return res.status(204).end();
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', users: usersByEmail.size });
  });

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(port, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });

  return {
    url: `http://127.0.0.1:${server.address().port}`,
    key: 'test-anon-key',
    server,
    addUser: createUser,
    userCount: () => usersByEmail.size,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(resolve);
      }),
  };
}
