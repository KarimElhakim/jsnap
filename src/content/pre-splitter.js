/**
 * Heading detector for pages whose content lives in one giant <pre> block
 * (GameFAQs walkthroughs, man pages, ASCII-styled FAQs).
 *
 * Recognises three common heading conventions:
 *   1. Underlined text:      "TITLE" followed by "======" or "------" on the next line.
 *   2. Roman-numeral prefix: "I. INTRODUCTION", "II. BASICS", "III. WALKTHROUGH".
 *   3. Lower-roman prefix:   "i. Vacation!", "ii. ACDC Town".
 *
 * When a heading is found, the lines between it and the next heading become
 * a section's content, split into paragraphs on blank lines.
 *
 * Output: an array of section objects that matches the shape used by
 * `structured.js` (heading, level, blocks, subsections).
 */

const UNDERLINE_HEAVY = /^={3,}\s*$/;
const UNDERLINE_LIGHT = /^-{3,}\s*$/;
const UNDERLINE_TILDE = /^~{3,}\s*$/;
const ROMAN_UPPER = /^([IVXLC]+)\.\s+(.+?)\s*$/;
const ROMAN_LOWER = /^([ivxlc]+)\.\s+(.+?)\s*$/;
const NUMBERED_HEADING = /^(\d{1,3})\.\s+([A-Z][^.]{2,})$/;

export function splitPreText(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = null;
  let buffer = [];

  const flush = () => {
    if (!current) return;
    current.blocks = toBlocks(buffer);
    sections.push(current);
    buffer = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = lines[i + 1] ?? '';

    const underlineHit = detectUnderlineHeading(line, next);
    if (underlineHit) {
      flush();
      current = {
        heading: underlineHit.heading,
        level: underlineHit.level,
        blocks: [],
        subsections: [],
      };
      i += 1;
      continue;
    }

    const prefixHit = detectPrefixHeading(line);
    if (prefixHit) {
      flush();
      current = {
        heading: prefixHit.heading,
        level: prefixHit.level,
        blocks: [],
        subsections: [],
      };
      continue;
    }

    if (!current) {
      current = { heading: null, level: 0, blocks: [], subsections: [] };
    }
    buffer.push(line);
  }
  flush();

  return nestByLevel(sections.filter((s) => s.heading || s.blocks.length));
}

function detectUnderlineHeading(line, next) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.length > 120) return null;
  if (UNDERLINE_HEAVY.test(next)) return { heading: trimmed, level: 1 };
  if (UNDERLINE_TILDE.test(next)) return { heading: trimmed, level: 1 };
  if (UNDERLINE_LIGHT.test(next)) return { heading: trimmed, level: 2 };
  return null;
}

function detectPrefixHeading(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.length > 160) return null;

  const upper = ROMAN_UPPER.exec(trimmed);
  if (upper) return { heading: trimmed, level: 1 };

  const lower = ROMAN_LOWER.exec(trimmed);
  if (lower) return { heading: trimmed, level: 2 };

  const numbered = NUMBERED_HEADING.exec(trimmed);
  if (numbered && numbered[2].length <= 80) return { heading: trimmed, level: 2 };

  return null;
}

function toBlocks(lines) {
  const joined = lines.join('\n').replace(/[ \t]+$/gm, '');
  const paragraphs = joined
    .split(/\n{2,}/)
    .map((p) => p.replace(/^\n+|\n+$/g, ''))
    .filter(Boolean);
  const blocks = [];
  for (const para of paragraphs) {
    // Preserve ASCII-art / aligned content as a code block when it looks tabular.
    if (isLikelyAsciiBlock(para)) {
      blocks.push({ type: 'code', text: para, language: null });
    } else {
      blocks.push({ type: 'paragraph', text: collapseInlineWhitespace(para) });
    }
  }
  return blocks;
}

function isLikelyAsciiBlock(text) {
  if (text.length < 40) return false;
  const lines = text.split('\n');
  if (lines.length < 2) return false;
  const tabLike = lines.filter((l) => /\t|\s{3,}\S/.test(l)).length;
  const ratio = tabLike / lines.length;
  return ratio > 0.4;
}

function collapseInlineWhitespace(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n +/g, '\n')
    .trim();
}

function nestByLevel(flat) {
  // Convert a flat sequence of {heading, level, blocks} into a nested tree so
  // level-2 items become subsections of the preceding level-1.
  const rootMarker = { heading: null, level: 0, blocks: [], subsections: [] };
  const stack = [rootMarker];
  for (const section of flat) {
    while (stack.length > 1 && stack[stack.length - 1].level >= section.level) stack.pop();
    stack[stack.length - 1].subsections.push(section);
    stack.push(section);
  }
  return rootMarker.subsections;
}
