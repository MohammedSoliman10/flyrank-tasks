import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

export const BASE_URL = 'https://books.toscrape.com';
export const START_URL = `${BASE_URL}/catalogue/page-1.html`;
export const MAX_CATALOGUE_PAGES = 3;

export const USER_AGENT =
  'FlyRankInternshipA9/1.0 (+https://github.com/MohammedSoliman10/flyrank-tasks/tree/main/task5)';

export const REQUEST_TIMEOUT_MS = 15_000;
export const DELAY_MS = 500;

export const CACHE_DIR = `${PROJECT_ROOT}/cache`;
export const OUTPUT_DIR = `${PROJECT_ROOT}/output`;

// Deliberately broken URL, used only with --broken to prove per-page isolation.
export const BROKEN_URL =
  `${BASE_URL}/catalogue/this-book-does-not-exist_9999/index.html`;

export const EXPECTED_BOOKS = 60;
