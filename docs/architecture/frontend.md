# Frontend module boundaries

The App Router owns navigation and layout. Client components render UI, small hooks own UI state, and game/sync services own persistence and worker lifecycle.

| Feature | UI | State / orchestration | Styling |
| --- | --- | --- | --- |
| Home | `components/home/home-screen.tsx` | `use-training-selection.ts` restores the exact existing localStorage keys, mode-specific filters and preloads the first quiz; `use-home-sheen.ts` observes button geometry; `use-folder-outline.ts` shapes the folder | `styles/home/*.css` |
| Notebook | `components/notebook/notebook-screen.tsx` | `use-notebook-state.ts` fetches, selects, paginates and performs add/remove membership requests | `components/notebook/personal-actions.module.css` |
| In-game pause | `lib/game/phaser/pause-overlay.ts` constructs DOM and event handlers | Existing Phaser scene invokes pause actions | `styles/game-pause.css` imported once through `app/globals.css` |
| Game entry | `app/game/game-host.tsx` mounts Phaser | `lib/game/data/home-preloader.ts` hands over the already-prepared runtime; `TrainingRuntime` manages FSRS and answers | `app/game/game-host.module.css` |
| Learning persistence | No UI-level persistence | `AnswerJournal` queues answers; `lib/sync/local-store.ts` atomically reads snapshot + outbox; root worker syncs | N/A |

## Rules for future changes

- Keep browser APIs such as `localStorage`, `ResizeObserver` and network mutations in their feature hooks/services, not large page JSX.
- Keep persisted storage keys and mode-specific behavior compatible when moving files.
- Keep pause CSS in the stylesheet; do not inject a new `<style>` on each pause.
- Never combine learning snapshots and unacknowledged answers from independent asynchronous reads. See `docs/architecture/learning-sync.md`.
- Preserve the game-start preload handoff. Refactors must not add a fresh data load or discard the first prepared question.
- CI runs `pnpm typecheck` and the full `pnpm test` suite on `dev`. `tests/frontend-refactor.test.ts` asserts the important module boundaries.
