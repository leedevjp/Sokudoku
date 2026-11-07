# Study music

Copied from the user-provided local asset folder `C:/Lass/Public/Temp/Trickster Sound`.

| Runtime asset | Original asset | Map |
|---|---|---|
| study-lobby-night-v1.mp3 | Office_lobby_night.mp3 | All maps, continuous across questions |

Music loops after user interaction. One HTMLAudioElement lasts for the scene, including question preparation, settling and map changes. Pause, mute, hidden tab and session end pause playback; resuming preserves currentTime. New browsers start muted. Master mute persists in `sokudoku-battle-sound`; independent music/effects gains persist in `sokudoku-audio-volumes` (defaults 0.05/0.7). The settings dialog previews music while gameplay stays paused. Impact ducking uses 60% of the selected music gain for 160ms with a 450ms release. Attack gain is 0.12; impact gain is 0.28–0.355, with an optional 0.07 accent, multiplied by the effects gain. These are playback gains, not perceived-loudness measurements. The former meadow/forest/ruins tracks are retained as unused assets.
