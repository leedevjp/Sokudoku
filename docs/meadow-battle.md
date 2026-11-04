# Meadow battle feedback

The training board now places a meadow encounter between the question and choices.
The rabbit faces right (the preserved poses are mirrored at render time).

- Selecting an answer records it immediately through the existing session/planner/FSRS path.
- A 160 ms accelerating charge (20 ms anticipation, cubic acceleration) replaces the choice-card projectile. Contact holds both poses for 48 ms, then knocks the slime away with a sharp gold/white impact flash, radial strokes and dust. No combat hearts. The existing 320 ms feedback window puts the next correct-answer question at approximately 480 ms after selection. Incorrect answers make the slime dodge before correction.
- Timeouts open correction immediately without a charge. Reduced-motion mode skips travel and animated impact.
- Reading has a stationary background and sprite-only running/fleeing loops. The rabbit has no procedural scale, rotation or vertical movement; only the explicitly approved charge changes its horizontal position. There is no return trip delay; the next encounter resets the position.
- Pausing freezes presentation. Existing resize/correction recovery remains authoritative and never records a second answer.

## Art

`public/battle/meadow-v1.webp` is the character-free derivative of the approved meadow concept.
`rabbit-cutout-v1.webp` removes the background from the original sixteen rabbit poses; `public/pets/rabbit-v1.png` remains unchanged.
`slime-v1.webp` contains eight coral slime poses in a 4 by 2 grid: idle, anticipation, dodge, airborne dodge, compressed hit, wobble, dissolve, droplets.
Sprite WebP files use lossless encoding; the background uses quality 85. Generated source previews and local verification captures are outside the repository.

## Validation

60 tests (including acceleration, bounded cadence and hit-stop/knockback regression coverage), TypeScript, ESLint and production build passed. Local Edge checks covered mobile/desktop, correct/incorrect answers, reduced motion, pause/resume during a charge, correction pause/resize and timeout correction. No production learning records were used.
