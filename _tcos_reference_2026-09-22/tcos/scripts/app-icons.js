#!/usr/bin/env node
/* =========================================================================
   app-icons.js — the square icons a phone home screen needs.

   A doctor asked to install TCOS as an app on his phone. A home-screen icon
   has to be SQUARE, and every logo in assets/ is a wide lockup - 1954x805 -
   because it was drawn to sit across the top of a page. Resizing that to
   512 wide gives 512x211, which Android will happily accept and then render
   as a letterbox floating in a white circle.

   So the lockup is centred on a square field of the brand green.

   WHY THE PADDING IS SO GENEROUS. Android crops an icon to whatever shape
   the launcher uses - circle, squircle, rounded square, teardrop - and the
   spec only guarantees the middle 80% survives. The safe zone is a circle
   of 80% diameter, so the artwork is drawn into the middle 60% and the rest
   is brand colour. An icon that looks slightly small in a grid is the
   correct trade against one whose letters are shaved off on a Samsung.

   WHY NOT sharp OR ImageMagick. Same argument as logo-tool.js, whose
   decoder this borrows rather than writing a second one: this repo has one
   runtime dependency and a documented rule against casually adding more.

   Run:  node scripts/app-icons.js
   ========================================================================= */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decode, encode, resize } from './logo-tool.js';

/* WHITE, AND THAT WAS NOT THE FIRST ANSWER.
 *
   The obvious choice is the brand teal the app wears everywhere, and it was
   tried first. The TCOS lockup is dark navy lettering beside a TEAL mark,
   so on a teal field the mark vanished into the background and the letters
   sat at poor contrast - visible only by rendering it and looking, which is
   the reason this file generates a picture rather than describing one.
 *
   White carries both colours of the lockup at full strength, and the
   `theme_color` in the manifest keeps the teal where it does work: the
   status bar and the splash screen. */
const BACKGROUND = [255, 255, 255];

/* Android guarantees only the middle 80% of a maskable icon. Drawing into
   60% leaves the artwork inside that circle with room to spare. */
const ARTWORK_FRACTION = 0.6;

function squareOnBrand(logo, size) {
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = BACKGROUND[0]; px[i * 4 + 1] = BACKGROUND[1];
    px[i * 4 + 2] = BACKGROUND[2]; px[i * 4 + 3] = 255;
  }

  /* Scale the lockup to the artwork width, keeping its aspect ratio. */
  const artW = Math.round(size * ARTWORK_FRACTION);
  const art = resize(logo, artW);
  const offX = Math.round((size - art.width) / 2);
  const offY = Math.round((size - art.height) / 2);

  /* Composite over the brand field. The logo is white-on-transparent, so
     this is a straight source-over alpha blend; skipping it and copying
     raw pixels is how a transparent PNG ends up with black fringes, which
     is the exact trap logo-tool.js documents. */
  for (let y = 0; y < art.height; y++) {
    for (let x = 0; x < art.width; x++) {
      const s = (y * art.width + x) * 4;
      const alpha = art.px[s + 3] / 255;
      if (alpha === 0) continue;
      const dy = offY + y, dx = offX + x;
      if (dy < 0 || dy >= size || dx < 0 || dx >= size) continue;
      const d = (dy * size + dx) * 4;
      for (let ch = 0; ch < 3; ch++) {
        px[d + ch] = Math.round(art.px[s + ch] * alpha + px[d + ch] * (1 - alpha));
      }
      px[d + 3] = 255;
    }
  }
  return { width: size, height: size, px };
}

/* ---- the owner console's own icon ----

   Vijay: "what is the owner app, tell me how can i download it."

   The console is now installable too, and it needs an icon he can tell
   apart from the clinic app at a glance on the same home screen. Both
   carry the TCOS lockup, because both are TCOS.

   WHY A WHITE DISC ON NAVY rather than simply a navy field. The lockup is
   dark navy lettering beside a teal mark - that is precisely why the clinic
   icon above ended up white after teal was tried and the mark disappeared
   into it. Navy behind navy letters would repeat that mistake in a new
   colour. So the artwork keeps the white it is legible on, and the
   DIFFERENCE is carried by the ring of navy around it.

   The disc is 78% of the icon, just inside the 80% Android guarantees for
   a maskable icon. Whatever shape a launcher crops to, the white disc and
   the lockup inside it survive; only navy is ever cut away. */
const OWNER_RING = [2, 37, 75];        /* --navy, the console's colour */
const DISC_FRACTION = 0.78;

function discOnRing(logo, size) {
  const base = squareOnBrand(logo, size);
  const r = (size * DISC_FRACTION) / 2;
  const cx = (size - 1) / 2, cy = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r - 1) continue;                    /* inside: leave the artwork */
      const i = (y * size + x) * 4;
      /* One pixel of feathering at the rim, so the circle does not look
         like it was cut out with scissors at 192px. */
      const blend = d >= r ? 1 : d - (r - 1);
      for (let ch = 0; ch < 3; ch++) {
        base.px[i + ch] = Math.round(OWNER_RING[ch] * blend + base.px[i + ch] * (1 - blend));
      }
      base.px[i + 3] = 255;
    }
  }
  return base;
}

const SIZES = [192, 512];
const logo = decode(readFileSync('assets/tcos-logo.png'));

mkdirSync('assets/app', { recursive: true });
const written = [
  ['icon', squareOnBrand],
  ['owner', discOnRing]
];
for (const [name, draw] of written) {
  for (const size of SIZES) {
    const out = draw(logo, size);
    const path = 'assets/app/' + name + '-' + size + '.png';
    writeFileSync(path, encode(out));
    console.log(path + '  ' + size + 'x' + size + '  ' +
      Math.round(readFileSync(path).length / 1024) + 'KB');
  }
}
