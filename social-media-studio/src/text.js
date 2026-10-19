export function cleanText(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stripMarkdown(markdown) {
  return cleanText(
    String(markdown ?? '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/[*_~`]/g, '')
      .replace(/\|/g, ' '),
  );
}

export function extractTitle(markdown, fallback = 'Untitled post') {
  const match = /^#\s+(.+)$/m.exec(String(markdown ?? ''));
  return cleanText(match?.[1] || fallback).slice(0, 200);
}

export function truncate(value, maxLength, ellipsis = '…') {
  const characters = Array.from(String(value ?? ''));
  if (characters.length <= maxLength) return characters.join('');
  const limit = Math.max(0, maxLength - Array.from(ellipsis).length);
  return `${characters.slice(0, limit).join('')}${ellipsis}`;
}

export function extractHashtags(text) {
  return [...String(text ?? '').matchAll(/#[\p{L}\p{N}_]+/gu)].map((match) => match[0]);
}

export function countExclamations(text) {
  return (String(text ?? '').match(/!/g) || []).length;
}
