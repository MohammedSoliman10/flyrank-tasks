import { resolve } from 'node:path';

import { parseBookPage } from './book.js';
import { parseCatalogue } from './catalogue.js';
import {
  BROKEN_URL,
  EXPECTED_BOOKS,
  MAX_CATALOGUE_PAGES,
  OUTPUT_DIR,
  START_URL,
} from './config.js';
import { bookCachePath, catalogueCachePath, PoliteClient } from './http.js';
import { buildRunReport, writeOutputs } from './report.js';
import { validateBook } from './schema.js';

const HELP = `Usage: node src/index.js [options]

Scrape the first ${MAX_CATALOGUE_PAGES} catalogue pages of Books to Scrape
(${EXPECTED_BOOKS} book detail pages), validate the records, and write:
  output/books.json
  output/errors.json
  output/run-report.json

Options:
  --refresh             Ignore cached HTML and fetch every page again.
  --broken              Add one deliberately broken product URL to prove that
                        a 404 is reported without losing the other records.
  --output-dir <dir>    Write output to another directory.
  -h, --help            Show this help.

The cache lives in ./cache and is gitignored. A normal second run is served
from the cache and does not touch the remote site.`;

function parseArgs(argv) {
  const options = {
    broken: false,
    refresh: false,
    outputDir: OUTPUT_DIR,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--broken') {
      options.broken = true;
    } else if (argument === '--refresh') {
      options.refresh = true;
    } else if (argument === '--output-dir') {
      const value = argv[index + 1];
      if (!value) throw new Error('--output-dir needs a path');
      options.outputDir = resolve(value);
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }

  const startedAt = new Date();
  const startedMs = Date.now();
  const client = new PoliteClient();

  const cataloguePages = [];
  const discovered = new Map();
  let nextUrl = START_URL;
  let cataloguePage = 0;
  let pagesFetched = 0;
  let cacheHits = 0;

  while (nextUrl && cataloguePage < MAX_CATALOGUE_PAGES) {
    cataloguePage += 1;
    const cachePath = catalogueCachePath(cataloguePage);
    console.log(`[catalogue ${cataloguePage}/${MAX_CATALOGUE_PAGES}] GET ${nextUrl}`);

    const page = await client.get(nextUrl, {
      cachePath,
      refresh: options.refresh,
    });

    if (page.fromCache) cacheHits += 1;
    else pagesFetched += 1;

    const parsed = parseCatalogue(page.html, nextUrl);
    cataloguePages.push({
      url: nextUrl,
      discovered: parsed.books.length,
      from_cache: page.fromCache,
    });

    for (const book of parsed.books) {
      if (!discovered.has(book.product_url)) {
        discovered.set(book.product_url, nextUrl);
      }
    }

    console.log(
      `  ${page.fromCache ? 'cache hit' : `HTTP ${page.status}`} - ${parsed.books.length} product links`,
    );
    nextUrl = parsed.next_url;
  }

  if (discovered.size !== EXPECTED_BOOKS) {
    throw new Error(
      `Expected ${EXPECTED_BOOKS} unique book URLs from ${MAX_CATALOGUE_PAGES} catalogue pages, found ${discovered.size}.`,
    );
  }

  if (options.broken) {
    discovered.set(BROKEN_URL, START_URL);
    console.log(`[broken] injected ${BROKEN_URL}`);
  }

  const urls = [...discovered.keys()];
  const books = [];
  const errors = [];
  let invalidRecords = 0;
  let failedPages = 0;

  for (const [index, url] of urls.entries()) {
    const sourcePage = discovered.get(url);

    try {
      const response = await client.get(url, {
        cachePath: bookCachePath(url),
        refresh: options.refresh,
      });

      if (response.fromCache) cacheHits += 1;
      else pagesFetched += 1;

      const record = parseBookPage(response.html, {
        url,
        sourcePage,
        fetchedAt: response.fetchedAt,
      });
      const checked = validateBook(record);

      if (!checked.ok) {
        invalidRecords += 1;
        errors.push({
          product_url: url,
          reason: `Validation failed: ${checked.reason}`,
        });
        console.log(`[${index + 1}/${urls.length}] INVALID ${url}`);
        continue;
      }

      books.push(checked.data);
      console.log(
        `[${index + 1}/${urls.length}] ${response.fromCache ? 'cache' : 'network'} OK ${checked.data.title}`,
      );
    } catch (error) {
      failedPages += 1;
      errors.push({
        product_url: url,
        reason: error.message,
        status: error.status ?? null,
      });
      console.log(`[${index + 1}/${urls.length}] FAIL ${url} - ${error.message}`);
    }
  }

  const finishedAt = new Date();
  const report = buildRunReport({
    startedAt,
    finishedAt,
    durationMs: Date.now() - startedMs,
    cataloguePages,
    discoveredCount: discovered.size,
    pagesAttempted: cataloguePages.length + urls.length,
    pagesFetched,
    cacheHits,
    books,
    errors,
    invalidRecords,
    failedPages,
  });

  const paths = await writeOutputs({
    outputDir: options.outputDir,
    books,
    errors,
    report,
  });

  console.log('\nRun complete');
  console.log(`  valid records:  ${books.length}`);
  console.log(`  invalid records:${invalidRecords}`);
  console.log(`  failed pages:   ${failedPages}`);
  console.log(`  network fetches:${pagesFetched}`);
  console.log(`  cache hits:     ${cacheHits}`);
  console.log(`  duration:       ${report.duration_ms} ms`);
  console.log(`  books:          ${paths.booksPath}`);
  console.log(`  errors:         ${paths.errorsPath}`);
  console.log(`  report:         ${paths.reportPath}`);

  if (books.length !== EXPECTED_BOOKS) {
    console.error(`\nExpected ${EXPECTED_BOOKS} valid records, got ${books.length}.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Scrape failed: ${error.message}`);
  process.exitCode = 1;
});
