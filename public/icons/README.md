# Etappe app icon — asset set

Mark: three stops (dots) joined by two legs, asymmetric dogleg. Background is a
two-band ocean horizon. Nothing is illustrated, so every size is the same shapes
at different weights.

## Palette

| Role                    | Hex       |
| ----------------------- | --------- |
| Sky band (top 47%)      | `#3D8FA8` |
| Water band (bottom 53%) | `#0F3A4B` |
| Route (legs + stops)    | `#F7F2E7` |

`theme-color` / mask-icon color: `#0F3A4B`.

## Files

| File                                              | Use                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `etappe-icon.svg`                                 | Master, square, full horizon. Source of truth — regenerate PNGs from this.                             |
| `etappe-512.png`                                  | PWA manifest `any`, desktop, stores.                                                                   |
| `etappe-apple-touch-180.png`                      | `apple-touch-icon` (iOS home screen).                                                                  |
| `etappe-maskable.svg` / `etappe-maskable-512.png` | Android maskable. Route scaled to 80% so circle/squircle/teardrop masks don't clip a stop.             |
| `etappe-favicon.svg`                              | Favicon. Horizon dropped (solid `#0F3A4B`), legs 7.5 and stops r8 in the 64 grid so it survives 16 px. |
| `etappe-favicon-32.png`, `etappe-favicon-16.png`  | Favicon PNG fallbacks.                                                                                 |
| `etappe-safari-mask.svg`                          | Safari pinned tab: solid black route on transparent. Also the single-colour/stencil version.           |

All SVGs use `viewBox="0 0 64 64"`. Geometry: stops at `20 43`, `29 21`, `45 33`;
every stop centre is within 16 units of centre, i.e. inside the Android maskable
safe circle and clear of Apple's corner radius.

No corner radius is baked in — platforms apply their own. If you need a rounded
tile in-app, clip the master SVG with `border-radius: 22%`.

## HTML

```html
<link rel="icon" href="/icons/etappe-favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/icons/etappe-favicon-32.png" sizes="32x32" />
<link rel="apple-touch-icon" href="/icons/etappe-apple-touch-180.png" />
<link rel="mask-icon" href="/icons/etappe-safari-mask.svg" color="#0F3A4B" />
<meta name="theme-color" content="#0F3A4B" />
```

## manifest.webmanifest

```json
{
  "icons": [
    { "src": "/icons/etappe-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icons/etappe-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "theme_color": "#0F3A4B",
  "background_color": "#0F3A4B"
}
```

## Notes for regeneration

- Any PNG size: render `etappe-icon.svg` at N×N (no padding). For sizes at or
  below 32 px render `etappe-favicon.svg` instead.
- ICO not included; add only if a legacy target needs it (bundle 16/32/48 from
  `etappe-favicon.svg`).
- In-app UI can reuse `etappe-safari-mask.svg` as a currentColor glyph: replace
  `fill="#000000"`/`stroke="#000000"` with `currentColor`.
