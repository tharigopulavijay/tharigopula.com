#!/usr/bin/env node
/* =========================================================================
   logo-tool.js — inspect and downsample the product logos.

   WHY THIS EXISTS. Vijay makes the logos in Canva and exports them huge:
   2172x724, half a megabyte each. The landing page shows all three at 44px
   tall, so shipping the originals sends 1.4 MB to a doctor opening the page
   on mobile data to look at three pictures 132 pixels wide. That is the
   whole reason.

   WHY IT HAS NO DEPENDENCIES. This repo has one runtime dependency and a
   documented rule against adding more. sharp pulls a compiled binary and
   ImageMagick is not installed on this machine, so a 200-line decoder that
   uses only node:zlib is genuinely the smaller cost. It handles exactly the
   format Canva exports - 8-bit RGBA, non-interlaced - and refuses anything
   else rather than guessing.

   ALPHA-WEIGHTED AVERAGING is the part worth not "simplifying" later. In a
   transparent PNG the colour under a fully transparent pixel is arbitrary,
   and Canva writes black there. Averaging those into an edge pixel draws a
   dark halo around every letter, which is exactly the fringing that makes a
   downsampled logo look cheap. So colour is averaged weighted by alpha, and
   fully transparent pixels contribute nothing to it.

   WHERE THE ORIGINALS LIVE. Not in this repo. Canva is the source of truth
   and Vijay re-exports from there; the 2172px PNGs are kept in the shared
   brand folder beside the other products' artwork, because they belong to
   Tharigopula rather than to TCOS. This repo carries only what the browser
   downloads. To regenerate after a new export:

     node scripts/logo-tool.js resize <brand>/ayurcos-logo.png assets/ayurcos-logo.png 680

   680 is deliberate: the widest the lockup is ever shown is 340px on the
   sign-in page, and 2x covers a retina screen. Anything larger is bytes
   nobody can see.
   ========================================================================= */

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/* ---------------------------------------------------------------- decode */

function decode(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');

  let width = 0, height = 0, depth = 0, colour = 0, interlace = 0;
  const idat = [];

  for (let p = 8; p < buf.length;) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8]; colour = data[9]; interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;

    p += 12 + len;                       /* len + type + data + crc */
  }

  /* Refuse rather than guess. A 16-bit or palette PNG decoded as if it were
     8-bit RGBA produces garbage that still writes a valid file, which is the
     worst possible failure - it looks like it worked. */
  if (depth !== 8 || colour !== 6) {
    throw new Error('expected 8-bit RGBA (depth 8, colour type 6), got depth ' +
      depth + ' colour type ' + colour);
  }
  if (interlace !== 0) throw new Error('interlaced PNGs are not supported');

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = Buffer.alloc(height * stride);

  /* Undo the per-scanline filters. Each row is predicted from the row above
     and the pixel to the left; this walks it back to actual samples. */
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? row[x - 4] : 0;          /* left */
      const b = prev ? prev[x] : 0;               /* up */
      const c = (prev && x >= 4) ? prev[x - 4] : 0; /* up-left */
      let v = src[x];

      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      } else if (filter !== 0) throw new Error('bad filter type ' + filter);

      row[x] = v & 0xff;
    }
  }

  return { width, height, px };
}

/* ---------------------------------------------------------------- encode */

function encode({ width, height, px }) {
  const stride = width * 4;
  const out = Buffer.alloc(height * (stride + 1));

  /* Pick a filter per row by the standard minimum-sum-of-absolute-differences
     heuristic. Costs nothing and typically halves the file against filter 0. */
  for (let y = 0; y < height; y++) {
    const row = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : null;

    let best = 0, bestScore = Infinity, bestRow = null;
    for (const f of [0, 1, 2, 4]) {
      const cand = Buffer.alloc(stride);
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? row[x - 4] : 0;
        const b = prev ? prev[x] : 0;
        const c = (prev && x >= 4) ? prev[x - 4] : 0;
        let v;
        if (f === 0) v = row[x];
        else if (f === 1) v = row[x] - a;
        else if (f === 2) v = row[x] - b;
        else {
          const pp = a + b - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v = row[x] - ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c));
        }
        cand[x] = v & 0xff;
        score += Math.min(cand[x], 256 - cand[x]);
      }
      if (score < bestScore) { bestScore = score; best = f; bestRow = cand; }
    }

    out[y * (stride + 1)] = best;
    bestRow.copy(out, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(out, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* CRC-32, table built once. */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');

  let c = -1;
  const body = Buffer.concat([head.subarray(4), data]);
  for (let i = 0; i < body.length; i++) c = CRC[(c ^ body[i]) & 0xff] ^ (c >>> 8);

  const crc = Buffer.alloc(4);
  crc.writeInt32BE(c ^ -1, 0);
  return Buffer.concat([head, data, crc]);
}

/* -------------------------------------------------------------- resample */

function resize(img, outW) {
  const scale = img.width / outW;
  const outH = Math.round(img.height / scale);
  const px = Buffer.alloc(outW * outH * 4);

  for (let y = 0; y < outH; y++) {
    const y0 = Math.floor(y * scale), y1 = Math.min(img.height, Math.ceil((y + 1) * scale));
    for (let x = 0; x < outW; x++) {
      const x0 = Math.floor(x * scale), x1 = Math.min(img.width, Math.ceil((x + 1) * scale));

      let r = 0, g = 0, b = 0, aSum = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * img.width + sx) * 4;
          const a = img.px[i + 3];
          /* Weighted by alpha: a transparent pixel's colour is meaningless
             and must not darken the edge. See the header note. */
          r += img.px[i] * a; g += img.px[i + 1] * a; b += img.px[i + 2] * a;
          aSum += a; n++;
        }
      }

      const o = (y * outW + x) * 4;
      if (aSum === 0) { px[o] = px[o + 1] = px[o + 2] = px[o + 3] = 0; continue; }
      px[o] = Math.round(r / aSum);
      px[o + 1] = Math.round(g / aSum);
      px[o + 2] = Math.round(b / aSum);
      px[o + 3] = Math.round(aSum / n);
    }
  }

  return { width: outW, height: outH, px };
}

/* --------------------------------------------------------------- inspect */

function inspect(img, name) {
  let opaque = 0, clear = 0, partial = 0;
  for (let i = 3; i < img.px.length; i += 4) {
    const a = img.px[i];
    if (a === 255) opaque++; else if (a === 0) clear++; else partial++;
  }
  const total = img.width * img.height;

  /* The four corners tell you what the background really is. A logo exported
     "with transparency" that has opaque white corners is not transparent -
     it is a white rectangle, and it will show as one on a dark sidebar. */
  const at = (x, y) => {
    const i = (y * img.width + x) * 4;
    return [img.px[i], img.px[i + 1], img.px[i + 2], img.px[i + 3]];
  };
  const corners = [at(0, 0), at(img.width - 1, 0), at(0, img.height - 1),
                   at(img.width - 1, img.height - 1)];

  /* Where the partial alpha actually sits. Antialiasing on letter edges is
     normal and shows up as a thin spread near the top. A background remover
     that has eaten the whole logo shows up as a mass in the middle - the
     letterforms themselves rendered at half opacity, which looks faint and
     washed out on every background. The two are impossible to tell apart
     from the percentage alone. */
  const bins = new Array(8).fill(0);
  for (let i = 3; i < img.px.length; i += 4) {
    const a = img.px[i];
    if (a > 0 && a < 255) bins[Math.min(7, Math.floor(a / 32))]++;
  }

  const pct = n => (n * 100 / total).toFixed(1) + '%';
  console.log('\n' + name);
  console.log('  ' + img.width + ' x ' + img.height);
  console.log('  opaque ' + pct(opaque) + '   transparent ' + pct(clear) +
              '   partial ' + pct(partial));
  console.log('  partial alpha spread ' +
    bins.map((n, i) => (i * 32) + '-' + (i * 32 + 31) + ':' + pct(n)).join('  '));
  console.log('  corners ' + corners.map(c => 'rgba(' + c.join(',') + ')').join('  '));
  console.log('  verdict: ' + (corners.every(c => c[3] === 0)
    ? 'transparent background'
    : 'BACKGROUND IS NOT TRANSPARENT - corners are opaque'));
}

/* ------------------------------------------------------------------ main */

/* Exported for scripts/app-icons.js, which needs the same decoder to turn
   the wide logo lockup into the square icons a phone home screen wants.
   A second PNG decoder in this repo would be a second decoder to be wrong,
   and this one has been read and tested. The CLI below is unaffected: it
   still runs when this file is executed directly, and importing it costs
   nothing because the dispatch checks for a command first. */
export { decode, encode, resize };

/* The dispatch below runs ONLY when this file is the program. Without this
   guard, importing it printed the usage text and called process.exit(1) -
   so app-icons.js died before its first line, reporting a usage error for
   a command nobody typed. */
const RUN_AS_CLI = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

const [cmd, a, b, c] = RUN_AS_CLI ? process.argv.slice(2) : [];

if (!RUN_AS_CLI) {
  /* imported: nothing runs */
} else if (cmd === 'inspect') {
  inspect(decode(readFileSync(a)), a);
} else if (cmd === 'resize') {
  const img = decode(readFileSync(a));
  const out = resize(img, Number(c));
  writeFileSync(b, encode(out));
  const before = readFileSync(a).length, after = readFileSync(b).length;
  console.log(a + '  ' + img.width + 'x' + img.height + ' ' + Math.round(before / 1024) + 'KB' +
              '  ->  ' + b + '  ' + out.width + 'x' + out.height + ' ' + Math.round(after / 1024) + 'KB' +
              '  (' + Math.round(100 - after * 100 / before) + '% smaller)');
} else {
  console.log('usage: logo-tool.js inspect <in.png>');
  console.log('       logo-tool.js resize <in.png> <out.png> <width>');
  process.exit(1);
}
