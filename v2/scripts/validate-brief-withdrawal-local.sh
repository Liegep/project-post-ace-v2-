#!/usr/bin/env bash
# Starts only a new disposable process. Never loads .env or invokes hosting tools.
set -euo pipefail
project_v2="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_v2"
if [[ "$(node -p 'process.versions.node.split(".")[0]')" != "22" ]]; then
  echo 'Use Node 22, conforme package.json. Nenhum banco foi iniciado.' >&2
  exit 1
fi
for dependency in mariadb-install-db mariadbd mariadb-admin; do
  command -v "$dependency" >/dev/null || { echo "Falta dependência local: $dependency" >&2; exit 1; }
done
brief_test_dir="$(mktemp -d /tmp/brief-mariadb-XXXXXX)"
brief_socket="$brief_test_dir/server.sock"
brief_pid=''
cleanup() {
  if [[ -n "$brief_pid" ]]; then
    mariadb-admin --socket="$brief_socket" -u root shutdown >/dev/null 2>&1 || kill "$brief_pid" 2>/dev/null || true
    wait "$brief_pid" 2>/dev/null || true
  fi
  echo "Logs e arquivos exclusivamente sintéticos: $brief_test_dir"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
mariadb-install-db --datadir="$brief_test_dir/data" --auth-root-authentication-method=normal --skip-test-db >"$brief_test_dir/install.log" 2>&1
mariadbd --datadir="$brief_test_dir/data" --socket="$brief_socket" --pid-file="$brief_test_dir/server.pid" --skip-networking --log-error="$brief_test_dir/server.log" &
brief_pid=$!
brief_ready=false
for attempt in {1..100}; do
  if mariadb-admin --socket="$brief_socket" -u root ping >/dev/null 2>&1; then brief_ready=true; break; fi
  sleep 0.2
done
[[ "$brief_ready" == true ]] || { echo 'MariaDB temporário não iniciou; confira server.log.' >&2; exit 1; }
# Dependencies must already have been installed with npm ci --ignore-scripts.
npm run build
export BRIEF_TEST_SOCKET="$brief_socket"
npm --workspace @design-hub-v2/api run test:brief-withdrawal:mysql
npm --workspace @design-hub-v2/api run test:brief-withdrawal:browser
npm run check
npm --workspace @design-hub-v2/api test
