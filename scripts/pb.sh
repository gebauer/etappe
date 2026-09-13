#!/usr/bin/env bash
# Start PocketBase for local dev, loading .env (if present) so hooks can read
# ORS_API_KEY etc. via $os.getenv. .env is gitignored; see .env.example.
set -euo pipefail
cd "$(dirname "$0")/.."

# Anything already exported wins over .env, so a one-off
#   SMTP_HOST=127.0.0.1 SMTP_PORT=2526 npm run pb
# can override the file — which is how the registration gate is tested
# against a local mail sink while .env keeps the gate open for daily dev
# (see .claude/skills/run-etappe/SKILL.md).
preset="$(export -p)"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
eval "$preset"

exec ./bin/pocketbase serve \
  --dir=pb_data \
  --hooksDir=pb_hooks \
  --migrationsDir=pb_migrations \
  "$@"
