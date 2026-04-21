/**
 * Heading-aware text splitter. Engaged only when the sanitized page exceeds
 * a provider's input budget. For v0.1.0 this is a safety valve — most pages
 * fit in a single call after sanitization.
 *
 * Token estimation uses the classic `chars / 4` heuristic, which is accurate
 * enough to pick chunk sizes without pulling a tokenizer dependency.
 */

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Split a markdown-ish text by top-level headings (# and ##).
 *
 * Returns `[{ heading, level, text }]`. Text preceding the first heading is
 * captured as a "(Preamble)" section. Sections whose body is empty after
 * trimming are dropped.
 *
 * This is the primary splitter used by Structure-mode extraction: each
 * section becomes one API call, which lets us handle arbitrarily long
 * documents without hitting provider output-token ceilings.
 */
export function splitBySections(pageText) {
  if (!pageText) return [];
  const lines = pageText.split('\n');
  const sections = [];
  let current = { heading: '(Preamble)', level: 0, lines: [] };

  const flush = () => {
    const text = current.lines.join('\n').trim();
    if (text) sections.push({ heading: current.heading, level: current.level, text });
  };

  for (const line of lines) {
    const match = line.match(/^(#{1,2})\s+(.+?)\s*$/);
    if (match) {
      flush();
      current = { heading: match[2].trim(), level: match[1].length, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  flush();

  return sections;
}

/**
 * @param {string} pageText
 * @param {{ maxTokens: number, budget?: number }} opts budget defaults to 0.8
 * @returns {string[]} array of chunks; returns `[pageText]` if it fits.
 */
export function chunk(pageText, { maxTokens, budget = 0.8 }) {
  if (!pageText) return [''];
  const softLimitTokens = Math.max(256, Math.floor(maxTokens * budget));
  if (estimateTokens(pageText) <= softLimitTokens) return [pageText];

  const softLimitChars = softLimitTokens * CHARS_PER_TOKEN;
  const sections = splitByHeadings(pageText);

  const chunks = [];
  let current = '';
  for (const section of sections) {
    if (!current) {
      current = section;
      continue;
    }
    if (current.length + section.length + 2 <= softLimitChars) {
      current += `\n\n${section}`;
    } else {
      chunks.push(current);
      current = section;
    }
  }
  if (current) chunks.push(current);

  return chunks.flatMap((c) =>
    c.length > softLimitChars ? splitByParagraphs(c, softLimitChars) : [c],
  );
}

function splitByHeadings(text) {
  const lines = text.split('\n');
  const sections = [];
  let buf = [];
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line) && buf.length) {
      sections.push(buf.join('\n').trim());
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length) sections.push(buf.join('\n').trim());
  return sections.filter(Boolean);
}

function splitByParagraphs(text, maxChars) {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let current = '';
  for (const p of paragraphs) {
    if (!current) {
      current = p;
      continue;
    }
    if (current.length + p.length + 2 <= maxChars) {
      current += `\n\n${p}`;
    } else {
      chunks.push(current);
      current = p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Deterministic merge of per-chunk extraction results.
 *
 * - arrays concatenate (shallow-dedupe by JSON.stringify)
 * - objects deep-merge; non-object conflicts prefer the later value and
 *   record the discarded value under `__meta.conflicts`
 * - primitives: later wins, earlier recorded as conflict if different
 */
export function mergeResults(results) {
  if (!results?.length) return {};
  let merged = {};
  const conflicts = [];

  for (let i = 0; i < results.length; i += 1) {
    merged = mergeInto(merged, results[i], conflicts, `$[${i}]`);
  }

  if (conflicts.length) {
    merged.__meta = { ...(merged.__meta ?? {}), conflicts };
  }
  return merged;
}

function mergeInto(base, next, conflicts, path) {
  if (next == null) return base;
  if (Array.isArray(base) && Array.isArray(next)) {
    const seen = new Set(base.map((v) => JSON.stringify(v)));
    const out = base.slice();
    for (const v of next) {
      const key = JSON.stringify(v);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(v);
      }
    }
    return out;
  }
  if (isPlainObject(base) && isPlainObject(next)) {
    const out = { ...base };
    for (const [k, v] of Object.entries(next)) {
      out[k] = k in out ? mergeInto(out[k], v, conflicts, `${path}.${k}`) : v;
    }
    return out;
  }
  if (base !== undefined && JSON.stringify(base) !== JSON.stringify(next)) {
    conflicts.push({ path, discarded: base });
  }
  return next;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
