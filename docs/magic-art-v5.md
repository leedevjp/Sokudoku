# Mage and mandrake presentation v5

The approved white-haired navy mage is the identity reference for all active character poses. Earlier rabbit and heroine assets are preserved. Audio remains deferred.

## Assets and frame order

- `public/battle/mage-v5.png`: 4 columns x 5 rows, 128-pixel cells, 20 poses. Frames 0-3 idle/blink, 4-7 stationary cast/recover, 8-11 failed cast and seated fall, 12-15 get-up/encourage, 16-19 happy/celebrate/rest. Left-facing source is mirrored only for combat, toward the enemy.
- `public/battle/mandrakes-v5.png`: 6 columns x 4 rows, 96-pixel cells. Rows: radish sprout, maple root, bell-flower bulb, fern root. Each row: idle, blink, cower, hit, knockback, leaf/root dispersal.
- `public/battle/magic-v5.png`: 6 columns x 4 rows, 96-pixel cells. Rows: fire, water, lightning, wind. Each row: gather, projectile, contact, burst, fragments, final sparks.
- Meadow remains `meadow-original-v4.png`.

## Behavior

Question ID determines the cosmetic monster/element pairing through a stable hash; resizing the same question does not reroll artwork. This never changes learning draws, FSRS, scoring or saved answers. All sixteen combinations are possible.

Correct: stationary cast, accelerating projectile, contact at 160 ms, 48 ms contact hold, elemental burst and monster knockback/dispersal. Existing 320 ms correct feedback gives approximately 480 ms total cadence.

Incorrect: spell dissipates before hitting, monster cowers without damage, mage loses balance and sits down, then gets up during correction. Correction opens at 300 ms. Caster position never translates, rotates or scales. Body animation is sprite-only. No camera shake or zoom.

Pause freezes presentation clocks. Reduced motion and timeout use static poses and immediate feedback. Switching reduced motion on mid-cast also completes feedback instead of trapping input. Results, pause and encouragement use the same mage atlas.

## Creation / prompt set

Built-in image generation tool, with the approved white/navy maho palette image as identity/style reference. Final PNGs are packed with uniform character scale and common foot baseline; effect cells retain authored relative sizes. No original generated file was overwritten.

1. Mage: preserve exact face, white wavy hair, triangular ears, navy/gold floppy witch hat, ivory/navy/gold robe and boots. Transparent 4x5 atlas of idle, stationary casting, harmless fall, recovery and emotions. Same character proportions and fine colored pixel contours throughout; no running/charge.
2. Plants: transparent 6x4 atlas of four distinct mandrake species, six reaction poses each. Cute root creatures, matching fine pixel shading. A follow-up cleaned background/contours while preserving designs. Both original generations are archived.
3. Magic: transparent 6x4 atlas, fire/water/lightning/wind, six phases each from gathering to fading shards. Fine pixel clusters and ivory cores, no smooth bloom or camera effects.

Production previews and raw image outputs are archived locally in the existing asset archive's `08-magic-v5` folder. The gallery at `/pets/rabbit-preview.html` displays eight mage clips, four monster clips and four effect clips.

Validation: 65 tests, TypeScript, ESLint, local desktop/mobile combat, reduced motion, pause/resume, timeouts, resize, gallery and results. Production build required before push. No Vercel deployment checks.
