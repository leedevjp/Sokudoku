# Study music

Copied from the user-provided local asset folder `C:/Lass/Public/Temp/Trickster Sound`.

| Runtime asset | Original asset | Map |
|---|---|---|
| study-lobby-night-v1.mp3 | Office_lobby_night.mp3 | All maps, continuous across questions |

Music loops after user interaction. One HTMLAudioElement lasts for the scene, including question preparation, settling and map changes. Pause, mute, hidden tab and session end pause playback; resuming preserves currentTime. Base gain is 0.075; impact ducking targets 0.045 for 160ms, with a 450ms release, reducing repeated volume pumping. Attack gain is 0.12; impact gain is 0.28–0.355, with an optional 0.07 accent. These are playback gains, not perceived-loudness measurements. The former meadow/forest/ruins tracks are retained as unused assets.
