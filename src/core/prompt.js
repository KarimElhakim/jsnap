/**
 * JSnap extraction prompt — the single highest-leverage artifact in the project.
 *
 * `PROMPT_VERSION` is stamped into every stored result so regressions can be
 * correlated with prompt changes. Bump it on every meaningful edit to the
 * `SYSTEM_PROMPT`, section prompt, or mode directives below.
 */

export const PROMPT_VERSION = '1.2.0';

export const MODES = Object.freeze({
  STRUCTURE: 'structure',
  SUMMARY: 'summary',
  DATA: 'data',
});

export const DEFAULT_MODE = MODES.STRUCTURE;

const BASE_SYSTEM_PROMPT = [
  'You are JSnap, a precision page-to-JSON extractor. You receive the sanitized',
  'textual content of one web page, plus metadata (title, URL) and an optional',
  'user hint describing what they care about.',
  '',
  'Your single job: return ONE well-formed JSON object that matches the MODE',
  'directive below and any user hint provided.',
  '',
  'UNIVERSAL RULES (non-negotiable):',
  '1. Return ONLY a JSON object. No prose before or after. No code fences. No',
  '   comments. No explanations.',
  '2. Use typed values where unambiguous: numbers, booleans, ISO-8601 date',
  '   strings. When in doubt, use a string.',
  '3. Never fabricate. If information is not present, omit the key rather',
  '   than inventing content.',
  '4. Include a "__meta" object at the top level with at minimum:',
  '   { "sourceUrl", "extractedAt", "userHint", "mode" }.',
  '5. If a user hint is provided, prioritize content matching the hint and',
  '   omit unrelated content. Interpret the hint liberally.',
  '6. Ignore ads, cookie banners, author bios, "related posts", social-share',
  '   widgets, comment sections, footer boilerplate, legal disclaimers.',
  '7. Output MUST be pure JSON valid against RFC 8259.',
].join('\n');

const MODE_DIRECTIVES = {
  [MODES.STRUCTURE]: [
    '',
    'MODE: STRUCTURE — preserve all meaningful content, organize it.',
    'Do NOT summarize. Do NOT paraphrase. Do NOT condense.',
    'Preserve ALL meaningful text verbatim. The reader wants a lossless,',
    'structured version of the page, not a digest of it.',
    'Organize content into sections keyed by the actual headings from the page.',
    'Tables → arrays of row objects keyed by column headers.',
    'Lists → JSON arrays. Code/ASCII-art blocks → string values preserved exactly.',
  ].join('\n'),

  [MODES.SUMMARY]: [
    '',
    'MODE: SUMMARY — condense the page into key points.',
    'You MAY paraphrase and shorten.',
    'Always include: { "title", "summary" (1-3 sentence overview), "keyPoints" (array) }.',
    'Add typed fields when the domain suggests them.',
    'Target output size: 10-20% of input length.',
  ].join('\n'),

  [MODES.DATA]: [
    '',
    'MODE: DATA — extract structured data only, drop narrative prose.',
    'Return ONLY tables, specifications, lists, product info, prices, dates,',
    'quantities, ratings, contact details, or other discretely structured data.',
    'If no structured data exists, return { "hasStructuredData": false }.',
  ].join('\n'),
};

/**
 * System prompt for when the ENTIRE page fits in one call (short pages,
 * Summary mode, Data mode). For long-form Structure-mode extractions we use
 * `buildSectionSystemPrompt` instead and call per-section.
 */
export function buildSystemPrompt(mode = DEFAULT_MODE) {
  const directive = MODE_DIRECTIVES[mode] ?? MODE_DIRECTIVES[DEFAULT_MODE];
  return BASE_SYSTEM_PROMPT + directive;
}

export const SYSTEM_PROMPT = buildSystemPrompt(DEFAULT_MODE);

function formatUserMessage({ pageTitle, pageUrl, pageText, userHint, mode }) {
  const lines = [];
  if (pageTitle) lines.push(`PAGE TITLE: ${pageTitle}`);
  if (pageUrl) lines.push(`PAGE URL: ${pageUrl}`);
  lines.push(`MODE: ${mode}`);
  lines.push(userHint ? `USER HINT: ${userHint}` : 'USER HINT: (none)');
  lines.push('');
  lines.push('PAGE CONTENT:');
  lines.push('---');
  lines.push(pageText);
  lines.push('---');
  lines.push('');
  lines.push('Return the JSON object now, following the MODE directive exactly.');
  return lines.join('\n');
}

/**
 * @param {object} args
 * @param {string} args.pageText
 * @param {string} [args.pageTitle]
 * @param {string} [args.pageUrl]
 * @param {string | null} [args.userHint]
 * @param {'structure' | 'summary' | 'data'} [args.mode]
 */
export function buildExtractionPrompt({ pageText, pageTitle, pageUrl, userHint, mode }) {
  const resolvedMode = MODES[String(mode ?? '').toUpperCase()] ? mode : DEFAULT_MODE;
  return {
    system: buildSystemPrompt(resolvedMode),
    user: formatUserMessage({
      pageTitle: pageTitle ?? '',
      pageUrl: pageUrl ?? '',
      pageText: pageText ?? '',
      userHint: (userHint ?? '').trim() || null,
      mode: resolvedMode,
    }),
    responseFormat: { type: 'json_object' },
    mode: resolvedMode,
  };
}

/* ── Section-wise extraction (Structure mode, long documents) ──────────── */

const SECTION_SYSTEM_PROMPT = [
  'You are JSnap, a precision section-to-JSON extractor. You receive exactly',
  'ONE section from a larger web document. Your job is to return a JSON object',
  'representing this section with ALL of its content preserved verbatim.',
  '',
  'RULES (non-negotiable):',
  '1. Return ONLY a JSON object. No code fences. No prose before or after.',
  '2. Preserve the FULL text of this section. Do NOT summarize, shorten, or',
  '   paraphrase. Verbatim preservation is the entire point.',
  '3. Output shape:',
  '   {',
  '     "heading": "<the section heading exactly as provided>",',
  '     "content": "<full prose text, verbatim>",',
  '     "lists": [[...], ...],            // arrays of string items if any lists appear',
  '     "tables": [[{col: val, ...}], ...],// arrays of row objects if any tables appear',
  '     "code": ["<raw block>", ...],     // preserve code/ASCII-art exactly',
  '     "subsections": [{ "heading": "...", "content": "..." }, ...]',
  '   }',
  '   Include only the keys that apply. Always include "heading" and at least',
  '   one of "content" / "lists" / "tables" / "code" / "subsections".',
  '4. If the section has clear internal sub-structure (e.g. ### subheadings),',
  '   nest them under "subsections" following the same shape.',
  '5. Tables become arrays of row objects keyed by column headers.',
  '6. Code blocks delimited by ``` in the input are preserved EXACTLY in "code".',
  '7. If a user hint is provided, prioritize matching content and trim the',
  '   rest — but never invent content.',
  '8. Never fabricate. Never omit content except pure boilerplate.',
  '9. Output MUST be pure JSON valid against RFC 8259.',
].join('\n');

function formatSectionUserMessage({ pageTitle, pageUrl, userHint, sectionHeading, sectionText, sectionIndex, sectionTotal }) {
  const lines = [];
  if (pageTitle) lines.push(`DOCUMENT TITLE: ${pageTitle}`);
  if (pageUrl) lines.push(`DOCUMENT URL: ${pageUrl}`);
  lines.push(`SECTION ${sectionIndex} OF ${sectionTotal}: ${sectionHeading}`);
  lines.push(userHint ? `USER HINT: ${userHint}` : 'USER HINT: (none)');
  lines.push('');
  lines.push('SECTION CONTENT:');
  lines.push('---');
  lines.push(sectionText);
  lines.push('---');
  lines.push('');
  lines.push('Return the JSON object for this section now. Preserve ALL content.');
  return lines.join('\n');
}

/**
 * Build a prompt for a single section. Used by the section-wise extractor
 * when Structure mode is applied to long documents.
 */
export function buildSectionPrompt({ pageTitle, pageUrl, userHint, sectionHeading, sectionText, sectionIndex, sectionTotal }) {
  return {
    system: SECTION_SYSTEM_PROMPT,
    user: formatSectionUserMessage({
      pageTitle: pageTitle ?? '',
      pageUrl: pageUrl ?? '',
      userHint: (userHint ?? '').trim() || null,
      sectionHeading: sectionHeading ?? '(untitled)',
      sectionText: sectionText ?? '',
      sectionIndex,
      sectionTotal,
    }),
    responseFormat: { type: 'json_object' },
  };
}
