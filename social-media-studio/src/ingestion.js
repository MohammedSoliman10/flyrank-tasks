import { isIP } from 'node:net';

import * as cheerio from 'cheerio';

import { cleanText, extractTitle, truncate } from './text.js';

const MAX_BYTES = 2_000_000;
const MAX_CONTENT_CHARS = 20_000;
const FETCH_TIMEOUT_MS = 10_000;

export class IngestionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'IngestionError';
    this.status = status;
  }
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }
  if (host === '::1' || host === '[::1]' || host === '0.0.0.0') return true;
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;

  if (isIP(host) === 4) {
    const parts = host.split('.').map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }

  return false;
}

export function assertSafeUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new IngestionError('URL is not valid');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new IngestionError('Only http and https URLs are supported');
  }
  if (isPrivateHost(url.hostname)) {
    throw new IngestionError('URL must point to a public host');
  }
  return url;
}

async function safeFetch(url, { fetchImpl, maxRedirects = 3 } = {}) {
  let current = assertSafeUrl(url);

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await fetchImpl(current.href, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'FlyRankSocialStudio/1.0 (capstone bot)',
        Accept: 'text/html,text/plain;q=0.9',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new IngestionError('URL redirect did not include a Location header');
      current = assertSafeUrl(new URL(location, current).href);
      continue;
    }

    return response;
  }

  throw new IngestionError('URL redirected too many times');
}

function htmlToPost(html, sourceUrl) {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer, header, aside, form, svg').remove();

  const title = cleanText($('h1').first().text() || $('title').first().text() || 'Untitled post');
  const container = $('article').length
    ? $('article').first()
    : $('main').length
      ? $('main').first()
      : $('body');

  const blocks = [];
  container.find('h1, h2, h3, p, li, blockquote').each((_, element) => {
    const text = cleanText($(element).text());
    if (text) blocks.push(text);
  });

  const content = blocks.length > 0 ? blocks.join('\n\n') : cleanText(container.text());

  return {
    title: title.slice(0, 200),
    content: truncate(content, MAX_CONTENT_CHARS),
    source_url: sourceUrl,
  };
}

export async function fetchPostFromUrl(value, { fetchImpl = globalThis.fetch } = {}) {
  const url = assertSafeUrl(value);
  let response;

  try {
    response = await safeFetch(url.href, { fetchImpl });
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    throw new IngestionError(`Could not fetch URL: ${error.message}`, 502);
  }

  if (!response.ok) {
    throw new IngestionError(`Could not fetch URL: HTTP ${response.status}`, 502);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_BYTES) {
    throw new IngestionError('URL is too large to ingest');
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new IngestionError(`Unsupported content type: ${contentType}`);
  }

  const body = (await response.text()).slice(0, MAX_BYTES);
  const post = contentType.includes('text/plain')
    ? {
        title: extractTitle(body, 'Untitled post'),
        content: truncate(body, MAX_CONTENT_CHARS),
        source_url: url.href,
      }
    : htmlToPost(body, url.href);

  if (!cleanText(post.content)) {
    throw new IngestionError('The fetched page did not contain readable text');
  }
  return post;
}

export async function buildPostInput(input, { fetchImpl = globalThis.fetch } = {}) {
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  const url = typeof input.url === 'string' ? input.url.trim() : '';

  if (!content && !url) {
    throw new IngestionError('Provide a URL or pasted Markdown content');
  }

  if (!content) {
    return fetchPostFromUrl(url, { fetchImpl });
  }

  return {
    title: cleanText(input.title || extractTitle(content)).slice(0, 200),
    content: truncate(content, MAX_CONTENT_CHARS),
    source_url: url || null,
  };
}
