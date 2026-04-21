/**
 * Generates placeholder PNG icons for JSnap using only Node.js built-ins.
 * Produces solid purple squares (#5B21B6) with a white "J" glyph.
 * Run: node scripts/generate-placeholder-icons.mjs
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// CRC32 lookup table
const CRC_TABLE = buildCrcTable();

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function encodePng(width, height, getPixelRgb) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = 1 + width * 3;
  const raw = Buffer.allocUnsafe(height * stride);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getPixelRgb(x, y, width, height);
      const off = y * stride + 1 + x * 3;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Purple/indigo background: #5B21B6
const BG = [0x5b, 0x21, 0xb6];
// White glyph
const FG = [0xff, 0xff, 0xff];

/**
 * Returns true if normalized coordinates (nx, ny) fall within the "J" glyph.
 * The J is drawn with a top horizontal bar, a right-side vertical stem,
 * and a bottom-left curl.
 */
function isJGlyph(nx, ny) {
  const pad = 0.18;
  const sw = 0.14; // stroke width

  // Top horizontal bar
  if (ny >= pad && ny <= pad + sw && nx >= pad && nx <= 1 - pad) return true;
  // Vertical right stem
  if (nx >= 1 - pad - sw && nx <= 1 - pad && ny >= pad && ny <= 0.74) return true;
  // Bottom-left foot (horizontal)
  if (ny >= 0.72 && ny <= 0.72 + sw && nx >= pad && nx <= 1 - pad - sw) return true;
  // Left upward curl
  if (nx >= pad && nx <= pad + sw && ny >= 0.58 && ny <= 0.72 + sw) return true;

  return false;
}

function getPixel(x, y, w, h) {
  const nx = (x + 0.5) / w;
  const ny = (y + 0.5) / h;
  return isJGlyph(nx, ny) ? FG : BG;
}

const SIZES = [16, 32, 48, 128];
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

for (const size of SIZES) {
  const buf = encodePng(size, size, getPixel);
  const outPath = join(outDir, `icon-${size}.png`);
  writeFileSync(outPath, buf);
  console.log(`icon-${size}.png  (${buf.length} bytes)`);
}

console.log(`\nIcons written to ${outDir}`);
