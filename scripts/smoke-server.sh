#!/usr/bin/env bash
# Start the built app on :3100 against the local smoke database, run the fix batch smoke checks, stop it.
set -u
cd "$(dirname "$0")/.."
export DATABASE_URL="file:./fixbatch.db"
if curl -s -o /dev/null http://localhost:3100/login; then echo "port 3100 already in use, stop that server first" >&2; exit 2; fi
setsid env NODE_USE_ENV_PROXY=1 npx next start -p 3100 > /tmp/px-smoke-server.log 2>&1 &
PID=$!
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:3100/login && break; sleep 1; done
if [ "${BROWSER:-0}" = "1" ]; then
  BASE=http://localhost:3100 node scripts/smoke-browser.mjs "$@"
else
  BASE=http://localhost:3100 npx tsx scripts/smoke-fix-batch.ts "$@"
fi
RC=$?
# kill the whole process group (npx -> next-server)
kill -- -"$PID" 2>/dev/null
for i in 1 2 3 4 5; do curl -s -o /dev/null http://localhost:3100/login || break; sleep 1; done
exit $RC
