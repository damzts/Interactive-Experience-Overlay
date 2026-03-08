# IEOM Assets

Drop your custom assets here. Each subfolder has a specific role:

| Folder          | Contents                             | Notes                                  |
|-----------------|--------------------------------------|----------------------------------------|
| `backgrounds/`  | Static background images             | `.jpg` `.png` `.webp`                  |
| `videos/`       | Looping video backgrounds            | `.mp4` `.webm` (short, no audio)       |
| `overlays/`     | Frame decorations, borders           | `.png` `.svg` (transparent)            |
| `fonts/`        | Custom webfonts                      | `.woff2` preferred, `.ttf` accepted    |
| `sfx/`          | Sound effects                        | `.wav` preferred, `.mp3` accepted      |
| `music/`        | Background music tracks              | `.mp3` `.flac` `.ogg`                  |
| `particles/`    | Custom particle sprites (future)     | `.png` (transparent, small)            |

## Serving assets

The IEOM server (`:3000`) serves this folder at `/assets/*`.

Example URL: `http://localhost:3000/assets/backgrounds/my-bg.jpg`

In the Overlay Style editor set `Image URL` to `/assets/backgrounds/my-bg.jpg`.

## Recommended naming convention

```
backgrounds/
  dark-forest.webp
  deep-space.webp
videos/
  rain-loop.mp4
sfx/
  death.wav
  victory.wav
  startup.wav
  transition.wav
  revive.wav
  glitch.wav
```
