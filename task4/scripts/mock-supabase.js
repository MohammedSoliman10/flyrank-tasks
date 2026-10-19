import { startMockSupabase } from '../tests/helpers/mock-supabase.js';

const port = Number(process.env.MOCK_SUPABASE_PORT) || 54321;
const mock = await startMockSupabase({ port });

console.log(`Mock Supabase listening on ${mock.url}`);
console.log('This is a local stand-in for Supabase Auth, not the hosted service.');
console.log('Use SUPABASE_URL=' + mock.url + ' and SUPABASE_KEY=' + mock.key + ' in .env.');
console.log('Press Ctrl+C to stop.');

async function shutdown() {
  await mock.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
