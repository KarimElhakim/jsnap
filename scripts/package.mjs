/**
 * scripts/package.mjs
 *
 * Packages the dist/ folder into a Chrome Web Store submission zip.
 * Usage: node scripts/package.mjs  (or: npm run package)
 *
 * Depends on Node built-ins only — no external packages required.
 */

import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const VERSION = PKG.version;
const OUT = join(ROOT, `jsnap-${VERSION}.zip`);

/** Files to unconditionally exclude by base name. */
const EXCLUDED_NAMES = new Set(['.DS_Store', 'Thumbs.db', '.gitkeep']);

function die(msg) {
  process.stderr.write(`\nError: ${msg}\n\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CRC-32
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Little-endian writers
// ---------------------------------------------------------------------------

function u16(buf, offset, val) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function u32(buf, offset, val) {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

// ---------------------------------------------------------------------------
// DOS date/time encoding (ZIP format requirement)
// ---------------------------------------------------------------------------

function dosDateTime(date) {
  const t =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const d =
    ((date.getFullYear() - 1980) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { t, d };
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

/**
 * Recursively collect files from dir.
 * Returns { absPath, zipPath }[] where zipPath uses forward slashes.
 */
function collectFiles(dir, prefix = '') {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const nested = collectFiles(abs, rel);
      results.push(...nested);
    } else {
      if (EXCLUDED_NAMES.has(entry.name)) continue;
      if (entry.name.endsWith('.map')) continue;
      results.push({ absPath: abs, zipPath: rel });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// ZIP builder (ZIP32 — safe for extensions well under 4 GB)
// ---------------------------------------------------------------------------

function buildZip(files) {
  const localHeaders = [];
  const centralEntries = [];
  const { t: modTime, d: modDate } = dosDateTime(new Date());
  let offset = 0;

  for (const { absPath, zipPath } of files) {
    const raw = readFileSync(absPath);
    const deflated = deflateRawSync(raw, { level: 6 });
    const useDeflate = deflated.length < raw.length;
    const payload = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const checksum = crc32(raw);
    const name = Buffer.from(zipPath, 'utf8');

    // Local file header (30 bytes + name)
    const lh = Buffer.alloc(30 + name.length);
    u32(lh, 0, 0x04034b50); // signature
    u16(lh, 4, 20); // version needed
    u16(lh, 6, 0); // flags
    u16(lh, 8, method);
    u16(lh, 10, modTime);
    u16(lh, 12, modDate);
    u32(lh, 14, checksum);
    u32(lh, 18, payload.length);
    u32(lh, 22, raw.length);
    u16(lh, 26, name.length);
    u16(lh, 28, 0); // extra field length
    name.copy(lh, 30);

    // Central directory entry (46 bytes + name)
    const cd = Buffer.alloc(46 + name.length);
    u32(cd, 0, 0x02014b50); // signature
    u16(cd, 4, 20); // version made by
    u16(cd, 6, 20); // version needed
    u16(cd, 8, 0); // flags
    u16(cd, 10, method);
    u16(cd, 12, modTime);
    u16(cd, 14, modDate);
    u32(cd, 16, checksum);
    u32(cd, 20, payload.length);
    u32(cd, 24, raw.length);
    u16(cd, 28, name.length);
    u16(cd, 30, 0); // extra length
    u16(cd, 32, 0); // comment length
    u16(cd, 34, 0); // disk number start
    u16(cd, 36, 0); // internal attributes
    u32(cd, 38, 0); // external attributes
    u32(cd, 42, offset); // local header offset
    name.copy(cd, 46);

    localHeaders.push(lh, payload);
    centralEntries.push(cd);
    offset += lh.length + payload.length;
  }

  const cdBuf = Buffer.concat(centralEntries);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  u32(eocd, 0, 0x06054b50);
  u16(eocd, 4, 0); // disk number
  u16(eocd, 6, 0); // disk with start of CD
  u16(eocd, 8, files.length); // entries on this disk
  u16(eocd, 10, files.length); // total entries
  u32(eocd, 12, cdBuf.length); // central dir size
  u32(eocd, 16, offset); // central dir offset
  u16(eocd, 20, 0); // comment length

  return Buffer.concat([...localHeaders, cdBuf, eocd]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!existsSync(DIST)) {
  die(`dist/ not found — run 'npm run build' first.`);
}

const files = collectFiles(DIST);

if (files.length === 0) {
  die(`dist/ is empty — run 'npm run build' first.`);
}

process.stdout.write(`Packaging JSnap v${VERSION} (${files.length} files from dist/)\n`);

let zipBuf;
try {
  zipBuf = buildZip(files);
} catch (err) {
  die(`Failed to build zip: ${err.message}`);
}

try {
  writeFileSync(OUT, zipBuf);
} catch (err) {
  die(`Failed to write ${OUT}: ${err.message}`);
}

const sha256 = createHash('sha256').update(zipBuf).digest('hex');
const sizeKb = (zipBuf.length / 1024).toFixed(1);

process.stdout.write(`\nOutput : ${OUT}\n`);
process.stdout.write(`Size   : ${sizeKb} KB\n`);
process.stdout.write(`SHA-256: ${sha256}\n`);
