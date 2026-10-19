import { profileFor } from './platforms.js';
import { cleanText, stripMarkdown, truncate } from './text.js';

const TAGS = {
  x: ['#FlyRank', '#BuildInPublic'],
  linkedin: ['#Engineering', '#Backend', '#BuildInPublic'],
  telegram: ['#FlyRank', '#Engineering'],
  discord: ['#FlyRank'],
  mastodon: ['#FlyRank', '#Engineering'],
};

const OPENERS = {
  x: 'New on the blog:',
  linkedin: 'A new post from the studio:',
  telegram: 'Fresh from the blog',
  discord: 'New post landed:',
  mastodon: 'New post:',
};

function lengthOf(value) {
  return Array.from(value).length;
}

function composeBody(platform, post) {
  const profile = profileFor(platform);
  const plain = stripMarkdown(post.content);
  const cleanTitle = cleanText(post.title);
  const withoutTitle = plain.startsWith(cleanTitle)
    ? cleanText(plain.slice(cleanTitle.length))
    : plain;
  const summary = withoutTitle || cleanTitle;
  const tags = TAGS[platform].join(' ');
  const link = post.source_url ? `\n\nRead it here: ${post.source_url}` : '';
  const suffix = `${link}\n\n${tags}`;
  const title = truncate(cleanTitle, platform === 'x' ? 70 : 140);

  let opener;
  let closing = '';

  if (platform === 'x') {
    opener = `New on the blog: ${title}\n\n`;
  } else if (platform === 'linkedin') {
    opener = `${title}\n\n`;
    closing = '\n\nWhat would you add to the conversation?';
  } else if (platform === 'telegram') {
    opener = `Fresh from the blog 👇\n${title}\n\n`;
  } else if (platform === 'discord') {
    opener = `New post landed: ${title}\n\n`;
  } else {
    opener = `New post: ${title}\n\n`;
  }

  const fixed = `${opener}${closing}${suffix}`;
  const available = Math.max(1, profile.maxLength - lengthOf(fixed));
  const body = truncate(summary, available);

  return `${opener}${body}${closing}${suffix}`.trim();
}

export function composeCaption(platform, post) {
  return composeBody(platform, post);
}

export function generateVariants(post, platforms) {
  return platforms.map((platform) => ({
    platform,
    text: composeCaption(platform, post),
  }));
}
