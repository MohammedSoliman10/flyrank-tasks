import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import { createSupabaseAuth } from '../src/supabase.js';
import { startMockSupabase } from './helpers/mock-supabase.js';

let mock;
let app;

before(async () => {
  mock = await startMockSupabase();
  app = createApp({ auth: createSupabaseAuth({ url: mock.url, key: mock.key }) });
});

after(async () => {
  await mock.close();
});

function signup(email, password = 'correct-horse-battery') {
  return request(app).post('/auth/signup').send({ email, password });
}

function login(email, password = 'correct-horse-battery') {
  return request(app).post('/auth/login').send({ email, password });
}

test('GET /public/info is public and returns 200', async () => {
  const response = await request(app).get('/public/info').expect(200);
  assert.equal(response.body.authenticated, false);
  assert.match(response.body.message, /public/i);
});

test('POST /auth/signup validates missing fields', async () => {
  const noEmail = await request(app).post('/auth/signup').send({ password: 'secret123' });
  assert.equal(noEmail.status, 400);
  assert.equal(noEmail.body.error, 'Email and password are required');

  const noPassword = await request(app).post('/auth/signup').send({ email: 'ada@example.com' });
  assert.equal(noPassword.status, 400);
});

test('POST /auth/signup creates a user and returns 201', async () => {
  const response = await signup('ada@example.com');
  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, 'ada@example.com');
  assert.match(response.body.user.id, /^[0-9a-f-]{36}$/);
  assert.ok(response.body.user.created_at);
  assert.equal(response.body.user.password, undefined);
});

test('POST /auth/signup rejects a duplicate email with 400', async () => {
  await signup('duplicate@example.com');
  const response = await signup('duplicate@example.com');
  assert.equal(response.status, 400);
  assert.match(response.body.error, /already registered/i);
});

test('POST /auth/login rejects a wrong password with 401', async () => {
  await signup('wrong-password@example.com');
  const response = await login('wrong-password@example.com', 'not-the-password');
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Invalid login credentials');
});

test('POST /auth/login rejects an unknown email with 401', async () => {
  const response = await login('nobody@example.com');
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Invalid login credentials');
});

test('POST /auth/login returns tokens and the protected routes accept them', async () => {
  const email = 'grace@example.com';
  const password = 'a-very-good-password';
  await signup(email, password);

  const loggedIn = await login(email, password).expect(200);
  assert.ok(loggedIn.body.access_token);
  assert.ok(loggedIn.body.refresh_token);
  assert.equal(loggedIn.body.token_type, 'bearer');
  assert.equal(loggedIn.body.user.email, email);

  const token = loggedIn.body.access_token;

  const profile = await request(app)
    .get('/protected/profile')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(profile.body.email, email);
  assert.equal(profile.body.id, loggedIn.body.user.id);
  assert.ok(profile.body.created_at);

  const dashboard = await request(app)
    .get('/protected/dashboard')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(dashboard.body.user.email, email);
  assert.match(dashboard.body.message, /dashboard/i);
});

test('protected routes reject missing and malformed Authorization headers with 401', async () => {
  const missing = await request(app).get('/protected/profile').expect(401);
  assert.equal(missing.body.error, 'Access token required');

  const wrongScheme = await request(app)
    .get('/protected/profile')
    .set('Authorization', 'Basic abc123')
    .expect(401);
  assert.equal(wrongScheme.body.error, 'Access token required');

  const noToken = await request(app)
    .get('/protected/profile')
    .set('Authorization', 'Bearer')
    .expect(401);
  assert.equal(noToken.body.error, 'Access token required');
});

test('protected routes reject an invalid token with 401', async () => {
  const response = await request(app)
    .get('/protected/profile')
    .set('Authorization', 'Bearer definitely-not-a-supabase-jwt')
    .expect(401);
  assert.equal(response.body.error, 'Invalid or expired token');
});

test('POST /auth/logout returns 204 and the session cannot be reused', async () => {
  const email = 'logout@example.com';
  await signup(email);
  const loggedIn = await login(email).expect(200);
  const token = loggedIn.body.access_token;

  await request(app).post('/auth/logout').set('Authorization', `Bearer ${token}`).expect(204);

  const afterLogout = await request(app)
    .get('/protected/profile')
    .set('Authorization', `Bearer ${token}`)
    .expect(401);
  assert.equal(afterLogout.body.error, 'Invalid or expired token');
});

test('POST /auth/logout without a token returns 401', async () => {
  const response = await request(app).post('/auth/logout').expect(401);
  assert.equal(response.body.error, 'Access token required');
});

test('a valid non-admin gets 403 from /protected/admin', async () => {
  const email = 'not-admin@example.com';
  await signup(email);
  const loggedIn = await login(email).expect(200);

  const response = await request(app)
    .get('/protected/admin')
    .set('Authorization', `Bearer ${loggedIn.body.access_token}`)
    .expect(403);
  assert.equal(response.body.error, 'Admin access required');
});

test('an admin user reaches /protected/admin', async () => {
  const email = 'admin@example.com';
  const password = 'admin-password';
  mock.addUser({ email, password, app_metadata: { role: 'admin' } });
  const loggedIn = await login(email, password).expect(200);

  const response = await request(app)
    .get('/protected/admin')
    .set('Authorization', `Bearer ${loggedIn.body.access_token}`)
    .expect(200);
  assert.equal(response.body.user.email, email);
  assert.match(response.body.message, /admin/i);
});

test('malformed JSON gets a 400 with a stable error shape', async () => {
  const response = await request(app)
    .post('/auth/login')
    .set('Content-Type', 'application/json')
    .send('{"email":');
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Malformed JSON body');
});

test('Swagger UI and OpenAPI document are served', async () => {
  const document = await request(app).get('/openapi.json').expect(200);
  assert.equal(document.body.components.securitySchemes.bearerAuth.type, 'http');
  assert.equal(document.body.components.securitySchemes.bearerAuth.scheme, 'bearer');
  assert.ok(document.body.paths['/protected/profile'].get.security);

  const docs = await request(app).get('/docs/').expect(200);
  assert.match(docs.text, /swagger-ui-bundle\.js/i);
});

test('unknown routes return 404 JSON', async () => {
  const response = await request(app).get('/does-not-exist').expect(404);
  assert.equal(response.body.error, 'Not found');
});
