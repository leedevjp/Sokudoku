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

## Training module boundaries

- `learning/planner.ts` owns catalog adoption, asynchronous preparation, the question queue and encounter history. Its public API and `PlannedQuestion` export remain stable.
- `learning/question-selection.ts` owns weighted draws and bounded choice-building retries. It yields preparation requests before constructing each question; callers must preserve that generator order.
- `learning/auto-set.ts` owns auto-mode tickets, kana onboarding, review budgets and fallback selection. The planner retains the fractional review budget across sets and resets it for a new run.
- `phaser/scene.ts` is the Phaser adapter: it forwards create/update/render-density calls and wires resize/shutdown/destroy events.
- `phaser/training-run.ts` composes input/answer/viewport/feedback controllers and owns question preparation, phase progression, completion/retry and persistence callbacks.
- `phaser/training-presentation.ts` owns the view, camera, current preferences, battle/companion/media lifetimes and pause/result screen construction. It renders from shared state and delegates user decisions to the run.
- `phaser/training-state.ts` holds one shared run state: current question, phase, clock offsets and preparation/render generations. Never copy that state across asynchronous work.
- `phaser/training-viewport.ts` owns pause/resume, input grace periods and viewport restoration. It reads the same shared state as the run so late preparation and post-render callbacks still obey the existing generation guards.
- `phaser/training-answers.ts` records each answer once, updates learning and presents impacts/correction. It owns correction state; a board redraw clears its view without discarding the correction or its local pause.
- `phaser/training-feedback.ts` owns speech cancellation/completion and the post-answer advance gate. The run supplies the scene’s Phaser delay so global pause still freezes feedback. Cancelling speech does not itself advance; only the run's feedback phase permits advancement.
- `phaser/result-presentation.ts` draws the existing result overlay, saving spinner and companion. Saving, retry and exit decisions stay in the run.
