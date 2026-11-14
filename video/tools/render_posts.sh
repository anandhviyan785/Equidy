#!/usr/bin/env bash
# Renders the Instagram posts (Post1..Post7) to out/posts/ as PNGs, bundling once.
set -euo pipefail
cd "$(dirname "$0")/.."
npx remotion bundle src/index.ts --out-dir out/bundle >/dev/null
mkdir -p out/posts
for i in 1 2 3 4 5 6 7; do
  npx remotion still out/bundle "Post$i" "out/posts/equidy-post-$i.png" --image-format=png >/dev/null
  echo "out/posts/equidy-post-$i.png"
done
