#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-$HOME/coding/kick-giveaway}"
REPO_URL="${REPO_URL:-https://github.com/mikeconnally25/vzqie.git}"
BRANCH="${BRANCH:-cursor/giveaway-fixes-c35a}"

mkdir -p "$(dirname "$TARGET")"

if [ -d "$TARGET/.git" ]; then
  echo "Updating existing repo at $TARGET"
  git -C "$TARGET" fetch origin "$BRANCH"
  git -C "$TARGET" checkout "$BRANCH"
  git -C "$TARGET" pull origin "$BRANCH"
else
  echo "Cloning into $TARGET"
  git clone --branch "$BRANCH" "$REPO_URL" "$TARGET"
fi

cd "$TARGET"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

npm install

echo ""
echo "Done. Project is ready at: $TARGET"
echo "Start the website with: npm run web"
echo "Open: http://localhost:3000"
