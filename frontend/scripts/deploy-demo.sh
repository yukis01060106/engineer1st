#!/usr/bin/env bash
# デモ版をビルドして gh-pages ブランチに公開する（GitHub Pages）。
# 使い方: cd frontend && npm run deploy:demo
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE_URL="$(git remote get-url origin)"
OWNER_REPO="$(echo "$REMOTE_URL" | sed -E 's#.*github.com[:/]([^/]+)/([^/.]+)(\.git)?$#\1/\2#')"
OWNER="${OWNER_REPO%%/*}"
REPO="${OWNER_REPO##*/}"

NEXT_PUBLIC_SITE_URL="https://${OWNER}.github.io/${REPO}" NEXT_PUBLIC_BASE_PATH="/${REPO}" NEXT_PUBLIC_DEMO=1 npx next build
touch out/.nojekyll # _next フォルダを Jekyll に無視させない

TMP="$(mktemp -d)"
cp -R out/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" \
  commit -q -m "デモ版を公開 ($(date '+%Y-%m-%d %H:%M'))"
git push -q -f "$REMOTE_URL" gh-pages
echo "公開しました: https://${OWNER}.github.io/${REPO}/"
