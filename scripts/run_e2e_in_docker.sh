#!/usr/bin/env bash

set -euo pipefail

WORKDIR="/tmp/frontend"
HOST_FRONTEND_DIR="/work/frontend"
PLAYWRIGHT_ARGS=("$@")

copy_artifacts_back() {
  rm -rf "$HOST_FRONTEND_DIR/playwright-report" "$HOST_FRONTEND_DIR/playwright-artifacts"
  cp -R "$WORKDIR/playwright-report" "$HOST_FRONTEND_DIR/playwright-report" 2>/dev/null || true
  cp -R "$WORKDIR/playwright-artifacts" "$HOST_FRONTEND_DIR/playwright-artifacts" 2>/dev/null || true
}

on_exit() {
  local status=$?
  copy_artifacts_back
  exit "$status"
}

trap on_exit EXIT INT TERM

rm -rf "$WORKDIR"
cp -R "$HOST_FRONTEND_DIR" "$WORKDIR"
cd "$WORKDIR"

npm ci
npx playwright test "${PLAYWRIGHT_ARGS[@]}"
