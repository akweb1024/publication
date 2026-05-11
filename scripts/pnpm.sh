#!/usr/bin/env bash
set -euo pipefail

export COREPACK_HOME="${COREPACK_HOME:-/tmp/corepack}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/tmp/cache}"

exec corepack pnpm "$@"

