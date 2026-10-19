#!/usr/bin/env bash
# Run against a seeded, running instance:
#   npm run seed
#   npm start
#   npm run smoke
set -euo pipefail

cd "$(dirname "$0")/.."
DB_PATH="${DATABASE_PATH:-data/social-studio.db}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

POST_ID=$(node -e "const db=require('better-sqlite3')(process.argv[1]); console.log(db.prepare('select id from posts limit 1').get().id)" "$DB_PATH")
X_ID=$(node -e "const db=require('better-sqlite3')(process.argv[1]); console.log(db.prepare(\"select id from variants where platform='x'\").get().id)" "$DB_PATH")
LI_ID=$(node -e "const db=require('better-sqlite3')(process.argv[1]); console.log(db.prepare(\"select id from variants where platform='linkedin'\").get().id)" "$DB_PATH")

echo "Social Media Studio manual smoke test"
echo "post=$POST_ID x=$X_ID linkedin=$LI_ID"
echo

echo '--- Dashboard and health ---'
curl -sS -o /dev/null -w 'GET / -> %{http_code}\n' "$BASE_URL/"
curl -sS "$BASE_URL/health" | jq -c .
curl -sS "$BASE_URL/api/platforms" | jq -c '.platforms[] | {platform,adapter,configured}'
echo

echo '--- Probe 3: schedule an unapproved variant (expect 409) ---'
curl -sS -w '\nHTTP %{http_code}\n' -X POST "$BASE_URL/api/variants/$X_ID/schedule" \
  -H 'Content-Type: application/json' \
  -d '{"scheduled_for":"2026-10-19T13:00:00.000Z"}'
echo

echo '--- Probe 2: edit to a rule-breaking caption (expect 422) ---'
curl -sS -w '\nHTTP %{http_code}\n' -X PATCH "$BASE_URL/api/variants/$X_ID" \
  -H 'Content-Type: application/json' \
  -d "{\"text\":\"$(printf 'a%.0s' {1..400}) #One #Two\"}"
echo

echo '--- Approve both variants ---'
curl -sS -X POST "$BASE_URL/api/variants/$X_ID/approve" -H 'Content-Type: application/json' -d '{}' | jq -c '{platform,status}'
curl -sS -X POST "$BASE_URL/api/variants/$LI_ID/approve" -H 'Content-Type: application/json' -d '{}' | jq -c '{platform,status}'
echo

echo '--- Schedule both approved variants ---'
curl -sS -X POST "$BASE_URL/api/variants/$X_ID/schedule" \
  -H 'Content-Type: application/json' \
  -d '{"scheduled_for":"2026-10-19T13:00:00.000Z"}' \
  | jq -c '{created, slot: (.slot | {id, status, scheduled_for, idempotency_key})}'
curl -sS -X POST "$BASE_URL/api/variants/$LI_ID/schedule" \
  -H 'Content-Type: application/json' \
  -d '{"scheduled_for":"2026-10-19T13:01:00.000Z"}' \
  | jq -c '{created, slot: (.slot | {id, status, scheduled_for, idempotency_key})}'
echo

echo '--- A second slot for the same active variant is refused (expect 409) ---'
curl -sS -w '\nHTTP %{http_code}\n' -X POST "$BASE_URL/api/variants/$X_ID/schedule" \
  -H 'Content-Type: application/json' \
  -d '{"scheduled_for":"2026-10-19T13:02:00.000Z"}'
echo

echo '--- Advance time and run the scheduler ---'
curl -sS -X POST "$BASE_URL/api/admin/tick" \
  -H 'Content-Type: application/json' \
  -d '{"now":"2026-10-19T13:01:01.000Z"}' \
  | jq -c '{checked_at,claimed,published,failed,retrying,rate_limited,results}'
echo

echo '--- Run the scheduler again (must not duplicate) ---'
curl -sS -X POST "$BASE_URL/api/admin/tick" \
  -H 'Content-Type: application/json' \
  -d '{"now":"2026-10-19T13:05:00.000Z"}' \
  | jq -c .
echo

echo '--- Mock platform preview ---'
curl -sS "$BASE_URL/api/mock-posts" | jq -c '[.posts[] | {platform,idempotency_key,id}]'
echo

echo '--- Publish history ---'
curl -sS "$BASE_URL/api/history" | jq -c '[.attempts[] | {platform,status,attempt_no,adapter,external_id,slot_status}]'
echo

echo '--- Campaign status ---'
curl -sS "$BASE_URL/api/posts/$POST_ID" | jq -c '{title, variants: [.variants[] | {platform,status,published_at}]}'
echo
