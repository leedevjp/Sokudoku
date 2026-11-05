# Original character art v4

The active presentation uses an original adult female rabbit-eared adventurer and an original mint sprout jelly. Earlier rabbit, slime and meadow assets remain available unchanged.

## Runtime files

- `public/battle/hero-original-v4.png`: 576 x 576, 6 x 6 cells of 96 pixels, 36 frames. Native standing character height is 72 pixels including ears.
- `public/battle/sprout-original-v4.png`: 256 x 256, 4 x 4 cells of 64 pixels, 16 frames.
- `public/battle/meadow-original-v4.png`: 632 x 166.

Hero rows: idle (0-5), running (6-11), charge/punch (12-17), stumble/fall (18-23), recovery/rest (24-29), victory (30-35). Enemy rows: moving (0-3), idle (4-7), dodge (8-11), hit/defeat (12-15).

All frames use a shared scale and foot baseline; packing does not independently enlarge short poses. Texture filtering uses nearest neighbor. Body poses come from sprites, with no camera movement, procedural body rotation or scaling. Existing charge acceleration, 48 ms hit stop and approximately 480 ms correct-answer cadence remain intact. Enemy size and the fist/contact point were aligned for humanoid proportions. Learning and FSRS behavior are unchanged. Audio remains deferred.

## Creation and prompt set

Created with the built-in image generation tool. Supplied game sprites were style references only; no source-game sprite pixels were copied into v4. Original full-resolution outputs, model sheet and packaging tools are retained locally outside the repository.

1. Model sheet: original adult female adventurer, long mid-back azure hair, white rabbit ears and tail, fitted ivory jacket, navy shorts over dark tights, ivory boots and gloves. Feminine waist/hip silhouette. Front, side, back, run, punch and prone key poses; original mint sprout jelly. Fine colored contours and delicate Korean MMO pixel craft; no text.
2. Hero atlas: same exact heroine, transparent 6 x 6 equal-cell atlas, facing right, shared scale/baseline. Six consecutive frames each for idle, run, charge/punch, stumble/fall, get-up/rest and victory. Thin colored outlines, discrete pixel clusters, 3-4 shades per material, no scenery or effects. Source reference: model sheet.
3. Enemy atlas: same original two-leaf mint jelly, transparent 4 x 4 equal-cell atlas. Four frames each for move, idle, dodge and harmless hit/burst/droplets. Match heroine pixel density and contour style. Source references: model sheet and heroine atlas.
4. Meadow: original wide side-view grass clearing, pale blue sky, distant green hills and sparse ivory flowers. Unobstructed center, ground at 85% height, restrained contrast. No characters or text. Match the model sheet palette.

## Validation

TypeScript, ESLint, 62 existing tests, production build, and local browser checks cover mobile/desktop combat, reduced motion, pause/results and the motion gallery. GitHub push is the delivery boundary; no Vercel checks are performed.
