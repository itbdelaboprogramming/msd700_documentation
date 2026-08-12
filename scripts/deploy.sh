#!/usr/bin/env bash
# Pull latest main, build the VitePress site into a fresh directory, and swap
# it into docs/.vitepress/dist, the path Apache serves at /itbdelabo/docs via
# a plain Alias (see scripts/apache-snippet.conf). Building into dist_new and
# renaming keeps a half-built tree from ever being served.
#
# Nothing needs restarting after a deploy: Apache stats each file per request.
# This used to sit behind a long-lived `vitepress preview` process, which did
# NOT work: sirv in production mode caches the file list and sizes at startup,
# so post-deploy it 404'd every newly hashed asset and truncated index.html.
# Do not reintroduce a persistent preview server here.
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
  LIVE_DIR="$REPO_DIR/docs/.vitepress/dist"

  if [ "$BEFORE" = "$AFTER" ] && [ -d "$LIVE_DIR" ]; then
    echo "Already up to date at $BEFORE and dist/ exists, nothing to do."
    exit 0
  fi

  echo "Updating $BEFORE -> $AFTER"
  git reset --hard origin/main

  npm ci

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

  echo "Deployed $AFTER, live at $LIVE_DIR (served directly by Apache, no restart needed)"
  echo "=== $(date -Is) deploy done ==="
} >>"$LOG_FILE" 2>&1
