import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  BASE_URL,
  DELAY_MS,
  EXPECTED_BOOKS,
  MAX_CATALOGUE_PAGES,
  REQUEST_TIMEOUT_MS,
  USER_AGENT,
} from './config.js';

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

export function buildRunReport({
  startedAt,
  finishedAt,
  durationMs,
  cataloguePages,
  discoveredCount,
  pagesAttempted,
  pagesFetched,
  cacheHits,
  books,
  errors,
  invalidRecords,
  failedPages,
}) {
  return {
    target: BASE_URL,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: durationMs,
    catalogue_pages_fetched: cataloguePages.length,
    catalogue_page_limit: MAX_CATALOGUE_PAGES,
    catalogue_pages: cataloguePages,
    unique_book_urls_discovered: discoveredCount,
    pages_attempted: pagesAttempted,
    pages_fetched: pagesFetched,
    cache_hits: cacheHits,
    valid_records: books.length,
    unique_records: new Set(books.map((book) => book.product_url)).size,
    invalid_records: invalidRecords,
    failed_pages: failedPages,
    total_errors: errors.length,
    expected_records: EXPECTED_BOOKS,
    politeness: {
      user_agent: USER_AGENT,
      delay_ms: DELAY_MS,
      request_timeout_ms: REQUEST_TIMEOUT_MS,
      retry_policy: 'Retry once on timeout or HTTP 5xx; never retry 403/404.',
      concurrency: 1,
    },
  };
}

export async function writeOutputs({ outputDir, books, errors, report }) {
  const booksPath = join(outputDir, 'books.json');
  const errorsPath = join(outputDir, 'errors.json');
  const reportPath = join(outputDir, 'run-report.json');

  await writeJson(booksPath, books);
  await writeJson(errorsPath, errors);
  await writeJson(reportPath, report);

  return { booksPath, errorsPath, reportPath };
}
