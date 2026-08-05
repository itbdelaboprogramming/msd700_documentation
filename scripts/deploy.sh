#!/usr/bin/env bash
# Pull latest main, build the VitePress site, and atomically swap it into
# the directory Apache serves via Alias /msd700-docs.
# Triggered by scripts/webhook-listener.mjs on push to main.
set -euo pipefail

# npm/node come from nvm, which isn't on systemd's default PATH.
export PATH="/home/itbdelabo/.nvm/versions/node/v22.16.0/bin:$PATH"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_DIR/scripts/deploy.log"
LOCK_FILE="$REPO_DIR/scripts/deploy.lock"

cd "$REPO_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) deploy already in progress, skipping" >>"$LOG_FILE"
  exit 0
fi

{
  echo "=== $(date -Is) deploy start ==="

  if [ -n "$(git status --porcelain)" ]; then
    echo "ABORT: working tree has local changes, refusing to reset. Investigate manually."
    exit 1
  fi

  git fetch origin main
  BEFORE="$(git rev-parse HEAD)"
  AFTER="$(git rev-parse origin/main)"

  if [ "$BEFORE" = "$AFTER" ]; then
    echo "Already up to date at $BEFORE, nothing to do."
    exit 0
  fi

  echo "Updating $BEFORE -> $AFTER"
  git reset --hard origin/main

  npm ci
  npm run docs:build

  BUILD_DIR="$REPO_DIR/docs/.vitepress/dist"
  LIVE_DIR="$REPO_DIR/docs/.vitepress/dist_live"
  OLD_DIR="$REPO_DIR/docs/.vitepress/dist_old"

  rm -rf "$OLD_DIR"
  if [ -d "$LIVE_DIR" ]; then
    mv "$LIVE_DIR" "$OLD_DIR"
  fi
  mv "$BUILD_DIR" "$LIVE_DIR"
  rm -rf "$OLD_DIR"

  echo "Deployed $AFTER, live at $LIVE_DIR"
  echo "=== $(date -Is) deploy done ==="
} >>"$LOG_FILE" 2>&1
