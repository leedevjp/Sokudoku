<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Word data entry

Before importing or editing vocabulary, read `docs/word-entry-guide.md`.
Keep Korean hanja pronunciation (`hanja_reading`) separate from the actual Korean meaning (`meaning_ko`): 実装 = 실장(구현), 勉強 = 면강(공부), 工夫 = 공부(궁리, 고안).
Display order remains `hanja_reading(meaning_ko)`. Mixed forms such as お金 and お母さん may have a NULL hanja_reading even when has_kanji is true; the user explicitly accepts this.
