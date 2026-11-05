# Pixel art audit — v2

Active art uses three indexed PNG atlases, each capped at 32 palette entries:
- rabbit-pixel-v2.png: 256x384, four columns / six rows, 64x64 cells. Frames 0–15 are companion poses and 16–23 combat poses.
- slime-pixel-v2.png: 256x256, four columns / four rows, 64x64 cells. Frames 0–7 are basic poses and 8–15 combat poses.
- meadow-pixel-v2.png: 316x83.

New art was generated in the low-resolution pixel visual direction of Trickster Online, then exported with nearest-neighbor sampling and a limited indexed palette. Character identity is shared within one atlas across all actions. All scene art textures use NEAREST filtering; interface text retains its normal rendering. Contact flashes, speed marks and companion hearts use square pixel clusters.

Audit coverage: training idle/run, charge/contact, dodge/fall/recovery, pause, results, and the public eight-clip rabbit gallery. Runtime requests for the previous painted rabbit, action sheets, slime and meadow were checked: none. Previous originals remain on disk as historical assets, not active art. No audio integration was added.

Validation: 62 tests, TypeScript, ESLint, production build; local Edge mobile/desktop correct/incorrect/reduced-motion flows and pause/results/gallery screenshots.
