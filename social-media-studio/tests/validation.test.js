import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateVariants } from '../src/captions.js';
import { PROFILES } from '../src/platforms.js';
import { validateVariant } from '../src/validation.js';

const post = {
  title: 'Reliable publishing is a product feature',
  content: `# Reliable publishing is a product feature

A retry should never become a duplicate post. Durable scheduling, review, and
idempotency are the product promise.`,
  source_url: 'https://example.com/blog/reliable-publishing',
};

test('generated captions are distinct and satisfy every active constraint', () => {
  const variants = generateVariants(post, ['x', 'linkedin', 'telegram']);
  assert.equal(variants.length, 3);
  assert.equal(new Set(variants.map((variant) => variant.text)).size, 3);

  for (const variant of variants) {
    const result = validateVariant(variant.text, PROFILES[variant.platform]);
    assert.equal(result.ok, true, `${variant.platform}: ${JSON.stringify(result.errors)}`);
  }
});

test('max_length and max_hashtags are enforced with named rules', () => {
  const tooLong = validateVariant(`${'a'.repeat(300)} #One`, PROFILES.x);
  assert.equal(tooLong.ok, false);
  assert.ok(tooLong.errors.some((error) => error.rule === 'max_length'));

  const tooManyTags = validateVariant('Short #One #Two #Three', PROFILES.x);
  assert.equal(tooManyTags.ok, false);
  assert.ok(tooManyTags.errors.some((error) => error.rule === 'max_hashtags'));
});

test('min_hashtags, exclamation limits, and banned phrases are enforced', () => {
  const noTags = validateVariant('No tags here', PROFILES.x);
  assert.ok(noTags.errors.some((error) => error.rule === 'min_hashtags'));

  const tooManyExclamations = validateVariant('Wow!!! #One', PROFILES.x);
  assert.ok(tooManyExclamations.errors.some((error) => error.rule === 'max_exclamations'));

  const banned = validateVariant('This is lol #One #Two', PROFILES.linkedin);
  assert.ok(banned.errors.some((error) => error.rule === 'banned_phrase'));
});

test('a valid caption reports no errors', () => {
  const result = validateVariant('A clean update with one tag. #FlyRank', PROFILES.x);
  assert.deepEqual(result, { ok: true, errors: [] });
});
