# Meadow battle feedback

The training board now places a meadow encounter between the question and choices.
The rabbit faces right (the preserved poses are mirrored at render time).

- Selecting an answer records it immediately through the existing session/planner/FSRS path.
- A 280 ms horizontal charge replaces the choice-card projectile. Correct answers squash/dissolve the slime and show stars/hearts; incorrect answers make the slime dodge before the existing correction card appears.
- Timeouts open correction immediately without a charge. Reduced-motion mode skips travel and animated impact.
- Reading has a stationary background and sprite-only idle animation. The rabbit has no procedural scale, rotation or vertical movement; only the explicitly approved charge changes its horizontal position.
- Pausing freezes presentation. Existing resize/correction recovery remains authoritative and never records a second answer.

## Art

`public/battle/meadow-v1.webp` is the character-free derivative of the approved meadow concept.
`rabbit-cutout-v1.webp` removes the background from the original sixteen rabbit poses; `public/pets/rabbit-v1.png` remains unchanged.
`slime-v1.webp` contains eight coral slime poses in a 4 by 2 grid: idle, anticipation, dodge, airborne dodge, compressed hit, wobble, dissolve, droplets.
Sprite WebP files use lossless encoding; the background uses quality 85. Generated source previews and local verification captures are outside the repository.

## Validation

58 existing tests, TypeScript, ESLint and production build passed. Local Edge checks covered mobile/desktop, correct/incorrect answers, reduced motion, pause/resume during a charge, correction pause/resize and timeout correction. No production learning records were used.
