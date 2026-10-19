import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import { FetchError, PoliteClient } from '../src/http.js';

let server;
let baseUrl;
let tempDir;
const requests = new Map();
const flakyHits = new Map();

before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'flyrank-task5-http-'));
  server = createServer((req, res) => {
    requests.set(req.url, (requests.get(req.url) || 0) + 1);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (req.url === '/ok') {
      res.statusCode = 200;
      res.end('<html><body>ok</body></html>');
      return;
    }

    if (req.url === '/flaky') {
      const hits = (flakyHits.get(req.url) || 0) + 1;
      flakyHits.set(req.url, hits);
      if (hits === 1) {
        res.statusCode = 500;
        res.end('temporary failure');
      } else {
        res.statusCode = 200;
        res.end('<html><body>recovered</body></html>');
      }
      return;
    }

    if (req.url === '/always-500') {
      res.statusCode = 503;
      res.end('still down');
      return;
    }

    res.statusCode = 404;
    res.end('missing');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tempDir, { recursive: true, force: true });
});

test('a second request is served from cache without another network call', async () => {
  const client = new PoliteClient({ delayMs: 1 });
  const cachePath = join(tempDir, 'cached.html');

  const first = await client.get(`${baseUrl}/ok`, { cachePath });
  assert.equal(first.fromCache, false);
  assert.equal(first.status, 200);
  assert.equal(first.attempts, 1);

  const cached = await readFile(cachePath, 'utf8');
  assert.match(cached, /ok/);

  const second = await client.get(`${baseUrl}/ok`, { cachePath });
  assert.equal(second.fromCache, true);
  assert.equal(second.attempts, 0);
  assert.equal(requests.get('/ok'), 1);
});

test('404 is reported and is not retried', async () => {
  const client = new PoliteClient({ delayMs: 1 });

  await assert.rejects(
    () => client.get(`${baseUrl}/missing`, { cachePath: join(tempDir, 'missing.html') }),
    (error) => {
      assert.ok(error instanceof FetchError);
      assert.equal(error.status, 404);
      assert.equal(error.retryable, false);
      return true;
    },
  );

  assert.equal(requests.get('/missing'), 1);
});

test('a 5xx response is retried once and can recover', async () => {
  const client = new PoliteClient({ delayMs: 1 });

  const result = await client.get(`${baseUrl}/flaky`, {
    cachePath: join(tempDir, 'flaky.html'),
  });

  assert.equal(result.fromCache, false);
  assert.equal(result.attempts, 2);
  assert.equal(flakyHits.get('/flaky'), 2);
});

test('two 5xx responses are reported after the single retry', async () => {
  const client = new PoliteClient({ delayMs: 1 });

  await assert.rejects(
    () => client.get(`${baseUrl}/always-500`, { cachePath: join(tempDir, 'always.html') }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.retryable, true);
      return true;
    },
  );

  assert.equal(requests.get('/always-500'), 2);
});

test('refresh ignores an existing cache file and fetches again', async () => {
  const client = new PoliteClient({ delayMs: 1 });
  const cachePath = join(tempDir, 'refresh.html');
  const before = requests.get('/ok') || 0;

  await client.get(`${baseUrl}/ok`, { cachePath });
  await client.get(`${baseUrl}/ok`, { cachePath, refresh: true });

  assert.equal(requests.get('/ok'), before + 2);
});
