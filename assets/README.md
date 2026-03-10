# IEOM Assets

Drop your custom assets here. Each subfolder has a specific role:

| Folder                    | Contents                             | Notes                                  |
|---------------------------|--------------------------------------|----------------------------------------|
| `backgrounds/`            | Static background images             | `.jpg` `.png` `.webp`                  |
| `videos/`                 | Looping video backgrounds            | `.mp4` `.webm` (short, no audio)       |
| `overlays/`               | Frame decorations, borders           | `.png` `.svg` (transparent)            |
| `fonts/`                  | Custom webfonts                      | `.woff2` preferred, `.ttf` accepted    |
| `audio/sfx/`              | Sound effects (canonical)            | `.wav` preferred, `.mp3` accepted      |
| `audio/music/`            | Background music tracks              | `.mp3` `.flac` `.ogg`                  |
| `audio/music/ambient_mood/` | Ambient / mood music               |                                        |
| `audio/music/broadcast/`  | Broadcast / stream intro music       |                                        |
| `audio/music/chill/`      | Chill / background music             |                                        |
| `audio/music/suspense/`   | Suspense / tension music             |                                        |
| `audio/ambient/`          | Looping ambient environment sounds   | `.wav` `.ogg`                          |
| `particles/`              | Custom particle sprites (future)     | `.png` (transparent, small)            |

The `sfx/` and `music/` folders at the root are legacy. Use `audio/sfx/` and `audio/music/` instead.

## Serving assets

The IEOM server (`:3000`) serves this folder at `/assets/*`.

Example URL: `http://localhost:3000/assets/backgrounds/my-bg.jpg`

In the Overlay Style editor set `Image URL` to `/assets/backgrounds/my-bg.jpg`.

## Recommended naming convention

```
audio/
  sfx/
    death.wav
    victory.wav
    startup.wav
    transition.wav
    revive.wav
    glitch.wav
  music/
    chill/
      lofi-night.mp3
    ambient_mood/
      3am-browsing.mp3
  ambient/
    room-hum.ogg
backgrounds/
  dark-forest.webp
  deep-space.webp
videos/
  rain-loop.mp4
```

