# Rabbit companion

Original generated quadrupedal rabbit art, made with the built-in imagegen tool.
Source: public/pets/rabbit-v1.png (1254 × 1254, 4 × 4 cells).
The selected artwork has a translucent ivory background and is presented on a clipped cream medallion; it is not a clean transparent cutout.

## Motion contract

| Motion    | Trigger                                | Behavior                                 |
| --------- | -------------------------------------- | ---------------------------------------- |
| idle      | Reading a question                     | Slow breath/blink loop                   |
| hop       | Start/retry                            | One four-pose hop, then idle             |
| happy     | Correct answer or completed correction | 600 ms reaction across question redraws  |
| encourage | Wrong answer/timeout correction        | Gentle head tilt, no punishment          |
| rest      | Pause                                  | Static resting pose; game remains paused |
| celebrate | Current selected learning exhausted    | Happy hop loop with a hold               |

Pure motion timing lives in lib/game/pet-motion.ts; Phaser rendering lives in rabbit-companion.ts. The scene owns the state so rebuilding display objects does not reset reactions. No effects on selection, FSRS, response timing, scoring or persistence. No invented XP or growth saves. Missing art leaves training usable. OS reduced-motion uses static expressions and is read each frame.

Preview all motions at /pets/rabbit-preview.html; this page uses no account or learning data. Its frame table mirrors PET_CLIPS and must be updated with that table.

## Generation prompt

Create a 4-column, 4-row sprite sheet of the original ivory-white quadrupedal rabbit, pink inner ears, plum eyes and lavender shading. Fixed left-facing three-quarter camera, consistent scale, centered cells, full ears and paws visible. Row 1 idle/breath/blink, row 2 crouch/push-off/airborne/landing, row 3 happy hop, row 4 two encouraging poses and two resting loaf poses. No text, props, grid or human anatomy. A follow-up requested removal of background noise while preserving all sixteen poses. The clean ivory-backed version was selected over the noisy transparency outputs.
