import express from 'express';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { describePlatforms } from './adapters/registry.js';
import { ConstraintError } from './validation.js';
import { IngestionError } from './ingestion.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

const postSchema = z
  .object({
    title: z.string().max(200).optional(),
    content: z.string().max(50_000).optional(),
    url: z.string().url().max(2048).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.content?.trim() || value.url), {
    message: 'Provide pasted content or a URL',
    path: ['content'],
  });

const editSchema = z.object({ text: z.string().max(10_000) }).strict();
const rejectSchema = z.object({ reason: z.string().max(500).optional() }).strict();
const scheduleSchema = z.object({ scheduled_for: z.string().min(1) }).strict();
const tickSchema = z.object({ now: z.string().datetime().optional() }).strict();

function parse(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const error = new Error('Request validation failed');
    error.name = 'ZodError';
    error.issues = result.error.issues;
    throw error;
  }
  return result.data;
}

export function createApp({ campaigns, publisher, config, fetchImpl = globalThis.fetch }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(PUBLIC_DIR));

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      platforms: config.activePlatforms,
      worker: config.workerEnabled,
    });
  });

  app.get('/api/platforms', (req, res) => {
    res.status(200).json({ platforms: describePlatforms({ config }) });
  });

  app.post('/api/posts', async (req, res) => {
    const input = parse(postSchema, req.body);
    const post = await campaigns.ingest(input, { fetchImpl });
    res.status(201).json(post);
  });

  app.get('/api/posts', (req, res) => {
    res.status(200).json({ posts: campaigns.listPosts() });
  });

  app.get('/api/posts/:id', (req, res) => {
    res.status(200).json(campaigns.getPost(req.params.id));
  });

  app.get('/api/variants/:id', (req, res) => {
    res.status(200).json(campaigns.getVariant(req.params.id));
  });

  app.patch('/api/variants/:id', (req, res) => {
    const { text } = parse(editSchema, req.body);
    res.status(200).json(campaigns.updateVariantText(req.params.id, text));
  });

  app.post('/api/variants/:id/approve', (req, res) => {
    res.status(200).json(campaigns.approveVariant(req.params.id));
  });

  app.post('/api/variants/:id/reject', (req, res) => {
    const { reason } = parse(rejectSchema, req.body);
    res.status(200).json(campaigns.rejectVariant(req.params.id, reason ?? null));
  });

  app.post('/api/variants/:id/schedule', (req, res) => {
    const { scheduled_for: scheduledFor } = parse(scheduleSchema, req.body);
    const result = campaigns.scheduleVariant(req.params.id, scheduledFor);
    res.status(result.created ? 201 : 200).json(result);
  });

  app.get('/api/slots', (req, res) => {
    res.status(200).json({ slots: campaigns.listSlots() });
  });

  app.get('/api/history', (req, res) => {
    res.status(200).json({ attempts: campaigns.listHistory() });
  });

  app.get('/api/mock-posts', (req, res) => {
    res.status(200).json({ posts: campaigns.listMockPosts() });
  });

  // Local demo/testing hook: run one scheduler pass, optionally with a chosen
  // "now" so time-advance can be demonstrated without waiting. Protect this in
  // any real deployment.
  app.post('/api/admin/tick', async (req, res) => {
    const { now } = parse(tickSchema, req.body);
    const result = await publisher.runDue({ now: now ? new Date(now) : new Date() });
    res.status(200).json(result);
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((error, req, res, next) => {
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body' });
    }

    if (error?.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: (error.issues || []).map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    if (error instanceof ConstraintError) {
      return res.status(422).json({
        error: 'Constraint validation failed',
        platform: error.platform,
        details: error.details,
      });
    }

    if (error instanceof IngestionError) {
      return res.status(error.status || 400).json({ error: error.message });
    }

    if (error?.status && error.status < 500) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Unhandled request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
