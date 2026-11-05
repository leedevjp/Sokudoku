# User reference art — v3

This revision changes artwork only. Battle placement, timing, hit/miss effects and progression are unchanged. All prior v1/v2 assets remain intact.

The user supplied Baby Bunny.png, Fanta Slime.png, Cucool.png and Jellyfish.png as authoritative style references. Rabbit frames 0–19 are extracted directly from Baby Bunny with the sheet background keyed to transparency, without rescaling or recoloring the source pixels. Rabbit frames 20–23 are generated supplemental fall/recovery poses resized into the same native sprite scale. Slime frames 0–11 are extracted directly from Fanta Slime; frames 12–15 are generated impact/flight/fragmentation poses. Jellyfish's defeat frames informed the fragmentation reference; Cucool was inspected for the shared thin-outline rendering style. No extra enemy types were added.

Both atlases retain the existing 64x64 cell interface and ground baseline at y=56. The generated meadow uses finer pixel detail and a subdued palette to match the supplied sprites. The coarse 32-color v2 palette reduction is not applied to these source frames.

Source sheet credits retained here: Baby Bunny — ripped by Mageker, sheeted by Solink. Fanta Slime — ripped by Dazz, sheeted by Mageker. Cucool/Jellyfish — ripped by Mageker. Original game art: Trickster Online / Trickster Online Revolution. Supplemental poses and meadow were generated for this project; they are not original game frames.

Validation: TypeScript, ESLint and production build; local mobile/desktop correct/incorrect/reduced-motion flows; pause, results and eight-clip gallery. Timing/learning code was not changed. Audio remains deferred.
