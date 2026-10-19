import { countExclamations, extractHashtags } from './text.js';

export class ConstraintError extends Error {
  constructor(platform, details) {
    super(`Caption does not satisfy the ${platform} constraint profile`);
    this.name = 'ConstraintError';
    this.platform = platform;
    this.details = details;
  }
}

/**
 * Enforce a platform profile. Every error names the rule that failed so a
 * reviewer (and the API caller) can see exactly why a variant was blocked.
 */
export function validateVariant(text, profile) {
  const value = String(text ?? '');
  const errors = [];
  const length = Array.from(value).length;
  const hashtags = extractHashtags(value);
  const exclamations = countExclamations(value);

  if (length === 0) {
    errors.push({ rule: 'non_empty', message: 'Caption must not be empty' });
  }
  if (length > profile.maxLength) {
    errors.push({
      rule: 'max_length',
      message: `${profile.label} allows at most ${profile.maxLength} characters; got ${length}`,
    });
  }
  if (hashtags.length < profile.minHashtags) {
    errors.push({
      rule: 'min_hashtags',
      message: `${profile.label} requires at least ${profile.minHashtags} hashtag(s); got ${hashtags.length}`,
    });
  }
  if (hashtags.length > profile.maxHashtags) {
    errors.push({
      rule: 'max_hashtags',
      message: `${profile.label} allows at most ${profile.maxHashtags} hashtag(s); got ${hashtags.length}`,
    });
  }
  if (exclamations > profile.maxExclamations) {
    errors.push({
      rule: 'max_exclamations',
      message: `${profile.label} allows at most ${profile.maxExclamations} exclamation mark(s); got ${exclamations}`,
    });
  }

  const lower = value.toLowerCase();
  for (const phrase of profile.bannedPhrases) {
    if (lower.includes(phrase.toLowerCase())) {
      errors.push({
        rule: 'banned_phrase',
        message: `${profile.label} does not allow the phrase "${phrase}"`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertVariant(text, profile) {
  const result = validateVariant(text, profile);
  if (!result.ok) throw new ConstraintError(profile.key, result.errors);
  return result;
}
