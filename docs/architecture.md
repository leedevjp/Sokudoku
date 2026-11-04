# Architecture

## Entry points and UI

- `app/` contains route entry points and HTTP handlers.
- `app/game/game-host.tsx` owns React lifecycle, preferences and the dynamically loaded Phaser game.
- `components/game/game-loading.tsx` renders preparation and error states.
- Feature components stay under `components/{home,dashboard,personal,notebook}/`.

## Training data and learning

- `lib/game/data/training-runtime.ts` coordinates catalog loading, pending-answer recovery, finish and retry. It does not import React or Phaser.
- `bootstrap.ts` loads the selected catalog and canonical learning snapshot, with an offline fallback.
- `answer-journal.ts` and `answer-queue.ts` own durable answer buffering and upload acknowledgements.
- `lib/game/learning/` owns scheduling, exploration, progress and deterministic answer reduction. Browser and server share the learning engine.
- The planner receives the selected catalog. Exploration excludes learned words; review eligibility and FSRS scheduling remain separate.

## Phaser presentation

- `scene.ts` coordinates phases, answer timing, pause/resume, correction and viewport restoration.
- `training-input.ts` owns browser listeners, held keys and listener cleanup.
- `run-persistence.ts` owns pending/success/failure state and duplicate-retry suppression.
- `board-cards.ts` renders the question card; `board-choices.ts` renders selectable answers.
- `answer-feedback.ts` paints immediate answer feedback.
- `pause-overlay.ts` and `result-overlay.ts` render their respective screens.
- Presentation modules use type-only imports when referring back to the view or planner.

## Personal word editor

- `word-editor.tsx` owns form layout.
- `use-word-editor.ts` owns form state, validation, save requests and unsaved-change protection.
- `word-editor-field.tsx` renders text fields and accessible field errors.
- Shared validation and messages remain in `lib/personal/`.

## Styles

Personal and dashboard styles are CSS Modules grouped by responsibility. Each feature exposes one class map through `personal-styles.ts` or `dashboard-styles.ts`.

Keep all classes used together in the same CSS selector in the same module. This preserves local scoping in selectors such as `.empty .primary`. Responsive overrides and animation keyframes live with their owning classes.

## Verification and generated files

- Run `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build`.
- Lifecycle regression tests cover input suppression/cleanup, async persistence and preview restart state.
- Database changes belong in `supabase/migrations/`; this structural refactor changes no database behavior.
- `lib/supabase/database.types.ts` is generated schema output and stays together.
