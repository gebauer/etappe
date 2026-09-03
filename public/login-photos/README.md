# Sign-in photos

Drop your photos in this folder and list them in `photos.json`. They fill the
full-bleed background of the sign-in screen, one per visit, crossfading every
7 s while the page stays open.

## Choosing photos

- **8–12 images.** Fewer looks thin once you've seen the screen a few times.
- **Wide format**, 2400×1400 or larger. They're shown `object-fit: cover` on a
  full desktop viewport.
- **A quiet left third.** The headline and form card sit over the left ~440 px;
  a busy subject there fights the text. Landscapes, horizons and open water work;
  a centred building does not.
- **JPEG or WebP — not HEIC** (browsers can't show it in an `<img>`). At least
  2400×1400; wider is fine, past ~2560 is wasted.
- Compressed: aim 200–500 KB each, this screen loads before auth. `npm`-installed
  `sharp` can batch it — resize to fit 2560×1600, JPEG quality ~78.

## photos.json

A flat array. `place` is the only required field; everything else is optional
and the caption **only renders the fields that are present** — a missing
`coords`/`month` just drops that piece of the mono line. An optional field may
be left out, set to `null`, or `""` — all three read as "absent". Never write
`"Unknown"`. Extra keys (e.g. `photographer`) are ignored, not an error.

```json
[
  {
    "file": "yosemite-tunnel-view.jpg",
    "place": "Tunnel View, Yosemite",
    "region": "California",
    "coords": "37°43′N",
    "month": "July"
  }
]
```

| field    | required | shown as                                                             | example                     |
| -------- | -------- | -------------------------------------------------------------------- | --------------------------- |
| `file`   | yes      | — (the image filename in this folder)                                | `"big-sur-coast.jpg"`       |
| `place`  | yes      | caption, bold line                                                   | `"McWay Falls, California"` |
| `region` | no       | caption, appended after `place` when `place` doesn't already name it | `"California"`              |
| `coords` | no       | small mono line above the place                                      | `"36°09′N"`                 |
| `month`  | no       | small mono line, next to `coords`                                    | `"April"`                   |

If `photos.json` is missing, unreadable or empty, the sign-in falls back to a
plain dark background — the form still works.

## Prompt for generating photos.json

> I have wide landscape photos for an app's sign-in background. Produce a
> `photos.json`: a flat JSON array, one object per photo, with fields `file`
> (the exact filename), `place` (required — `"Landmark, Region"`, or just the
> place name), and optional `region`, `coords` (latitude only, like
> `"37°43′N"`), and `month` (the month you'd most want to be there, e.g.
> `"July"`). Omit any field you are not sure of — never guess a value, never
> write `"Unknown"`. The files are: [list the filenames, or attach the images].
> Output only the JSON array.
