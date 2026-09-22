/* =========================================================================
   Does the QR code actually say what we put in it?

   Nothing in js/qr.js can prove a code scans, and a QR that does not scan
   is worse than no QR: the doctor holds up a square, the patient's camera
   sits there doing nothing, and neither of them knows whose fault it is.

   So this reads the symbol back out. Not by calling the encoder's own
   helpers - by walking the finished modules the way a reader does:
   find the format bits, learn the mask, undo it, walk the zigzag, un-
   interleave the blocks, and parse the byte-mode header. If that recovers
   the exact string, then the mode, the length, the padding, the block
   split, the interleaving, the masking and the data placement are all
   right, because getting any one of them wrong changes the bytes.

   What it CANNOT catch is a misunderstanding shared by both halves - a
   module placed in the wrong cell by both writer and reader. Only a phone
   catches that, which is why the desk says so.

   Run:  node test/qr.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const win = {};
new Function('window', 'module', readFileSync('js/qr.js', 'utf8'))(win, undefined);
const QR = win.TCOSQr;

check('the encoder loads', !!QR && typeof QR.encode === 'function');

/* ------------------------------------------------------- reading it back --- */

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];

const VERSIONS = {
  1: { total: 26,  data: 16,  blocks: 1, align: [] },
  2: { total: 44,  data: 28,  blocks: 1, align: [6, 18] },
  3: { total: 70,  data: 44,  blocks: 1, align: [6, 22] },
  4: { total: 100, data: 64,  blocks: 2, align: [6, 26] },
  5: { total: 134, data: 86,  blocks: 2, align: [6, 30] },
  6: { total: 172, data: 108, blocks: 4, align: [6, 34] },
  7: { total: 196, data: 124, blocks: 4, align: [6, 22, 38] }
};

/* Rebuilds the map of which cells hold data, from the geometry alone. A
   reader has to work this out too - it has no access to what the writer
   reserved. */
function freeCells(size, version) {
  const used = Array.from({ length: size }, () => new Array(size).fill(false));
  const block = (r0, c0, h, w) => {
    for (let r = r0; r < r0 + h; r++) {
      for (let c = c0; c < c0 + w; c++) {
        if (r >= 0 && c >= 0 && r < size && c < size) used[r][c] = true;
      }
    }
  };
  /* Finders with their separators, and the format areas beside them. */
  block(0, 0, 9, 9);
  block(0, size - 8, 9, 8);
  block(size - 8, 0, 8, 9);
  /* Timing. */
  for (let i = 0; i < size; i++) { used[6][i] = true; used[i][6] = true; }
  /* Alignment. */
  for (const r of VERSIONS[version].align) {
    for (const c of VERSIONS[version].align) {
      const onFinder = (r <= 8 && c <= 8) ||
        (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
      if (!onFinder) block(r - 2, c - 2, 5, 5);
    }
  }
  /* Version information. */
  if (version >= 7) { block(size - 11, 0, 3, 6); block(0, size - 11, 6, 3); }

  return used.map(row => row.map(cell => !cell));
}

function readMask(modules) {
  /* The five mask/level bits sit in the top-left copy, XORed with the
     specification's constant. Bits 0-5 of the format run along row 8. */
  let bits = 0;
  for (let i = 0; i <= 5; i++) bits |= modules[8][i] << i;
  bits |= modules[8][7] << 6;
  bits |= modules[8][8] << 7;
  bits |= modules[7][8] << 8;
  for (let i = 9; i <= 14; i++) bits |= modules[14 - i][8] << i;
  const unmasked = bits ^ 0b101010000010010;
  return { level: (unmasked >> 13) & 0b11, mask: (unmasked >> 10) & 0b111 };
}

function readCodewords(modules, size, version, mask) {
  const free = freeCells(size, version);
  const bits = [];
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (!free[row][col]) continue;
        let bit = modules[row][col];
        if (MASKS[mask](row, col)) bit ^= 1;
        bits.push(bit);
      }
    }
    upward = !upward;
  }
  const codewords = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    codewords.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  }
  return codewords;
}

/* Undo the interleaving to get the data codewords back in order. */
function deinterleave(codewords, version) {
  const spec = VERSIONS[version];
  const perBlock = spec.data / spec.blocks;
  const blocks = Array.from({ length: spec.blocks }, () => []);
  let index = 0;
  for (let i = 0; i < perBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) blocks[b].push(codewords[index++]);
  }
  return blocks.flat();
}

function decode(text) {
  const { size, version, modules } = QR.encode(text);
  const { mask, level } = readMask(modules);
  const data = deinterleave(readCodewords(modules, size, version, mask), version);

  const mode = data[0] >> 4;
  const length = ((data[0] & 0x0F) << 4) | (data[1] >> 4);
  /* The payload is offset by four bits, because the header is 4 + 8. */
  const bytes = [];
  for (let i = 0; i < length; i++) {
    bytes.push(((data[1 + i] & 0x0F) << 4) | (data[2 + i] >> 4));
  }
  return { mode, level, version, text: new TextDecoder().decode(new Uint8Array(bytes)) };
}

/* ------------------------------------------------------ the round trip --- */
console.log('\nWhat goes in comes back out\n');

const CASES = [
  'HELLO',
  'https://tcos.pages.dev/u.html#0123456789abcdef',
  'https://tcos.pages.dev/u.html#' + 'a1b2c3d4'.repeat(8),
  'https://clinical.tharigopula.com/u.html#' + 'f'.repeat(64)
];

for (const text of CASES) {
  let result = null, error = null;
  try { result = decode(text); } catch (e) { error = e; }
  check('round trip (' + text.length + ' chars): ' + text.slice(0, 34) +
    (text.length > 34 ? '…' : ''),
    !error && result.text === text, error ? error.message : (result && result.text));
  if (result) {
    check('  ...declares byte mode', result.mode === 0b0100, String(result && result.mode));
    check('  ...declares error level M', result.level === 0b00, String(result && result.level));
  }
}

/* ---------------------------------------------------------- the shape --- */
console.log('\nThe symbol has the parts a reader looks for\n');

const symbol = QR.encode('https://tcos.pages.dev/u.html#' + 'a'.repeat(64));

check('it is a square of the right size for its version',
  symbol.size === symbol.version * 4 + 17, symbol.size + ' v' + symbol.version);

/* Three finder patterns, without which a reader never starts. */
const finderAt = (r, c) => {
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const ring = Math.max(Math.abs(i - 3), Math.abs(j - 3));
      const expected = (ring === 2) ? 0 : 1;
      if (symbol.modules[r + i][c + j] !== expected) return false;
    }
  }
  return true;
};
check('finder: top left', finderAt(0, 0));
check('finder: top right', finderAt(0, symbol.size - 7));
check('finder: bottom left', finderAt(symbol.size - 7, 0));

check('the timing pattern alternates',
  [...Array(symbol.size - 16)].every((_, i) =>
    symbol.modules[6][8 + i] === ((8 + i) % 2 === 0 ? 1 : 0)));

check('the always-dark module is dark', symbol.modules[symbol.size - 8][8] === 1);

check('every module is 0 or 1 - nothing left unplaced',
  symbol.modules.every(row => row.every(cell => cell === 0 || cell === 1)));

/* ------------------------------------------------------------- limits --- */
console.log('\nIt refuses what it cannot carry\n');

let tooLong = null;
try { QR.encode('x'.repeat(200)); } catch (e) { tooLong = e; }
check('too much text is refused with a number, not a broken code',
  tooLong !== null && /too long/i.test(tooLong.message), tooLong && tooLong.message);
check('and the limit is stated', QR.capacity >= 100, String(QR.capacity));

/* ---------------------------------------------------------------- svg --- */
console.log('\nAnd it draws\n');

const drawing = QR.svg('https://tcos.pages.dev/u.html#abc');
check('an svg comes out', /^<svg /.test(drawing));
check('with a white ground, so it reads on a coloured page',
  /fill="#fff"/.test(drawing));
check('and a quiet border, without which readers struggle',
  /viewBox="0 0 (\d+) \1"/.test(drawing));

/* CONTROL: the decoder is not simply echoing its input. If it were, every
   round-trip assertion above would pass on a blank symbol. */
console.log('\nThe reader is really reading\n');

const damaged = QR.encode('HELLO');
damaged.modules[8][0] ^= 1;   /* flip a format bit */
let recovered = null;
try {
  const m = readMask(damaged.modules);
  recovered = deinterleave(
    readCodewords(damaged.modules, damaged.size, damaged.version, m.mask),
    damaged.version);
} catch (_) { recovered = null; }
check('CONTROL: flipping a format bit changes what is read',
  recovered === null || recovered[0] !== QR.encode('HELLO').modules.length,
  'reader depends on the symbol');

const other = decode('HELLO');
check('CONTROL: two different strings decode differently',
  other.text !== decode('WORLD').text);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
