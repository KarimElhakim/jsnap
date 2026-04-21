/**
 * JSnap extraction prompt — the single highest-leverage artifact in the project.
 *
 * `PROMPT_VERSION` is stamped into every stored result so regressions can be
 * correlated with prompt changes. Bump it on every meaningful edit to the
 * `SYSTEM_PROMPT` or mode directives below.
 */

export const PROMPT_VERSION = '1.1.0';

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
  '3. Never fabricate. If information is not present on the page, omit the key',
  '   rather than inventing content.',
  '4. Include a "__meta" object at the top level with at minimum:',
  '   { "sourceUrl": "...", "extractedAt": "<ISO-8601>", "userHint": "<hint or null>", "mode": "<mode>" }.',
  '5. If a user hint is provided, prioritize content matching the hint and omit',
  '   unrelated content. Interpret the hint liberally. Never refuse; always',
  '   return your best-effort JSON.',
  '6. Ignore these kinds of content unless the hint explicitly asks for them:',
  '   site navigation, ads, cookie banners, author bios, "related posts",',
  '   social-share widgets, comment sections, footer boilerplate, legal',
  '   disclaimers.',
  '7. Output MUST be pure JSON valid against RFC 8259.',
].join('\n');

const MODE_DIRECTIVES = {
  [MODES.STRUCTURE]: [
    '',
    'MODE: STRUCTURE (default) — preserve all meaningful content, organize it.',
    '',
    'STRUCTURE RULES:',
    '- Do NOT summarize. Do NOT paraphrase. Do NOT condense.',
    '- Preserve ALL meaningful text verbatim. The reader wants a lossless,',
    '  structured version of the page, not a digest of it.',
    '- Organize the content into a hierarchy of sections that mirrors the page:',
    '  - Use the actual section headings from the page as keys when present.',
    '  - For long-form content (articles, guides, walkthroughs, manuals,',
    '    tutorials, documentation), the output must contain the full text of',
    '    each section under a descriptive key.',
    '  - Preserve ordering where it conveys meaning (steps, chapters, timelines).',
    '- Tables become arrays of row objects keyed by column headers.',
    '- Lists become JSON arrays.',
    '- Code blocks (delimited by ``` in the input) are preserved verbatim as',
    '  string values under a "code" or similarly-named key.',
    '- If the page is a single flowing prose document with no visible',
    '  sub-structure, return: { "title": "...", "sections": [{ "heading": "...", "text": "..." }], ... }',
    '  where "text" contains the full content of that section verbatim.',
  ].join('\n'),

  [MODES.SUMMARY]: [
    '',
    'MODE: SUMMARY — condense the page into key points.',
    '',
    'SUMMARY RULES:',
    '- Produce a compact digest. You MAY (and should) paraphrase and shorten.',
    '- Always include: { "title", "summary" (1-3 sentence overview), "keyPoints" (array of short strings) }.',
    '- Add typed fields when the domain suggests them (e.g. "author", "publishedAt",',
    '  "price", "rating", "topics").',
    '- Target output size: roughly 10-20% of the input length.',
  ].join('\n'),

  [MODES.DATA]: [
    '',
    'MODE: DATA — extract structured data only, drop narrative prose.',
    '',
    'DATA RULES:',
    '- Return ONLY tables, specifications, lists, product info, prices, dates,',
    '  quantities, ratings, contact details, or other discretely structured data.',
    '- Drop all narrative prose. If a paragraph cannot be represented as a',
    '  typed field or a row, ignore it.',
    '- Tables become arrays of row objects keyed by column headers.',
    '- If the page contains no structured data at all, return:',
    '  { "hasStructuredData": false, "__meta": { ... } }.',
  ].join('\n'),
};

export function buildSystemPrompt(mode = DEFAULT_MODE) {
  const directive = MODE_DIRECTIVES[mode] ?? MODE_DIRECTIVES[DEFAULT_MODE];
  return BASE_SYSTEM_PROMPT + directive;
}

// Exported for backwards compatibility and tests.
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
 * @returns {{ system: string, user: string, responseFormat: { type: 'json_object' }, mode: string }}
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
