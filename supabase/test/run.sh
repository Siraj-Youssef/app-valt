#!/usr/bin/env bash
# Testa supabase/schema.sql num Postgres local descartável (precisa de initdb/pg_ctl/psql no PATH).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'pg_ctl -D "$tmp/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
initdb -D "$tmp/data" -U postgres --locale=en_US.UTF-8 >/dev/null 2>&1 || initdb -D "$tmp/data" -U postgres >/dev/null
pg_ctl -D "$tmp/data" -o "-k $tmp -c listen_addresses='' -c wal_level=logical" -l "$tmp/log" -w start >/dev/null
export PGOPTIONS="-c client_min_messages=warning"
psql=(psql -X -q -v ON_ERROR_STOP=1 -h "$tmp" -U postgres -d postgres)
"${psql[@]}" -f "$here/stub-supabase.sql"
"${psql[@]}" -f "$here/../schema.sql"
"${psql[@]}" -f "$here/../schema.sql"   # rodar duas vezes não pode quebrar
"${psql[@]}" -f "$here/sync.test.sql"
