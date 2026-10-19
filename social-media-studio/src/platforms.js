/**
 * Platform constraint profiles. These are the rules the code enforces.
 *
 * `maxExclamations` and `bannedPhrases` are deliberately enforceable tone
 * rules, not vague "write professionally" instructions.
 */
export const PROFILES = {
  x: {
    key: 'x',
    label: 'X',
    adapter: 'mock_x',
    maxLength: 280,
    minHashtags: 1,
    maxHashtags: 2,
    maxExclamations: 1,
    bannedPhrases: [],
    tone: 'Short, direct, one idea per post.',
  },
  linkedin: {
    key: 'linkedin',
    label: 'LinkedIn',
    adapter: 'mock_linkedin',
    maxLength: 1300,
    minHashtags: 2,
    maxHashtags: 4,
    maxExclamations: 0,
    bannedPhrases: ['lol', 'omg', '!!!'],
    tone: 'Professional, reflective, no hype punctuation.',
  },
  telegram: {
    key: 'telegram',
    label: 'Telegram',
    adapter: 'telegram',
    maxLength: 4096,
    minHashtags: 1,
    maxHashtags: 5,
    maxExclamations: 2,
    bannedPhrases: [],
    tone: 'Conversational, friendly, link included when available.',
  },
  discord: {
    key: 'discord',
    label: 'Discord',
    adapter: 'discord',
    maxLength: 2000,
    minHashtags: 0,
    maxHashtags: 3,
    maxExclamations: 2,
    bannedPhrases: [],
    tone: 'Community update, compact and readable.',
  },
  mastodon: {
    key: 'mastodon',
    label: 'Mastodon',
    adapter: 'mastodon',
    maxLength: 500,
    minHashtags: 1,
    maxHashtags: 3,
    maxExclamations: 1,
    bannedPhrases: [],
    tone: 'Federated-friendly, clear and conversational.',
  },
};

export const KNOWN_ADAPTERS = [
  'mock_x',
  'mock_linkedin',
  'telegram',
  'discord',
  'mastodon',
];

export function profileFor(platform) {
  const profile = PROFILES[platform];
  if (!profile) throw new Error(`Unknown platform: ${platform}`);
  return profile;
}
