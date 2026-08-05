#!/usr/bin/env bash
# Pull latest main, build the VitePress site into a fresh directory, and
# atomically swap it into docs/.vitepress/dist — the path the persistent
# `vitepress preview` process (systemd: msd700-docs-preview, port 4700,
# proxied by Apache at /itbdelabo/docs) serves from. The swap is a plain
# `mv` (rename), so the running process picks up new content on the next
# request with no restart and no downtime window.
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

  LIVE_DIR="$REPO_DIR/docs/.vitepress/dist"
  NEW_DIR="$REPO_DIR/docs/.vitepress/dist_new"
  OLD_DIR="$REPO_DIR/docs/.vitepress/dist_old"

  rm -rf "$NEW_DIR"
  npx vitepress build docs --outDir docs/.vitepress/dist_new

  rm -rf "$OLD_DIR"
  if [ -d "$LIVE_DIR" ]; then
    mv "$LIVE_DIR" "$OLD_DIR"
  fi
  mv "$NEW_DIR" "$LIVE_DIR"
  rm -rf "$OLD_DIR"

  echo "Deployed $AFTER, live at $LIVE_DIR (served by msd700-docs-preview, no restart needed)"
  echo "=== $(date -Is) deploy done ==="
} >>"$LOG_FILE" 2>&1
