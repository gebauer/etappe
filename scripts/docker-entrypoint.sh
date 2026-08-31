#!/bin/sh
# Runs as the container's PID 1. Bootstraps the first superuser from env vars
# if both are set (idempotent — upsert creates or updates, safe to run on
# every start), then hands off to the real command (pocketbase serve ...).
set -eu

if [ -n "${PB_ADMIN_EMAIL:-}" ] && [ -n "${PB_ADMIN_PASSWORD:-}" ]; then
  echo "Ensuring superuser ${PB_ADMIN_EMAIL}..."
  pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir=/pb/pb_data
fi

exec "$@"
