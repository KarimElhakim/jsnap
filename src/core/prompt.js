/**
 * JSnap extraction prompt — the single highest-leverage artifact in the project.
 *
 * `PROMPT_VERSION` is stamped into every stored result so regressions can be
 * correlated with prompt changes. Bump it on every meaningful edit to the
 * `SYSTEM_PROMPT` constant.
 */

export const PROMPT_VERSION = '1.0.0';

export const SYSTEM_PROMPT = [
  'You are JSnap, a precision page-to-JSON extractor. You receive the sanitized',
  'textual content of one web page, plus metadata (title, URL) and an optional',
  'user hint describing what they care about.',
  '',
  'Your single job: return ONE well-formed JSON object that captures the',
  'meaningful structured content of the page.',
  '',
  'RULES (non-negotiable):',
  '1. Return ONLY a JSON object. No prose before or after. No code fences. No',
  '   comments. No explanations.',
  '2. Infer a clean, human-readable structure. Prefer flat, descriptive keys',
  '   over deep nesting. Use snake_case or camelCase consistently within one',
  '   output — pick one based on the content domain and stick to it.',
  '3. If a user hint is provided, prioritize content matching the hint and',
  '   omit unrelated content. Interpret the hint liberally. Never refuse;',
  '   always return your best-effort JSON.',
  '4. Preserve lists as JSON arrays. Preserve tables as arrays of row objects',
  '   keyed by their column headers.',
  '5. Use typed values where unambiguous: numbers, booleans, ISO-8601 date',
  '   strings. When in doubt, use a string.',
  '6. Omit these unless the hint explicitly asks for them: site navigation,',
  '   ads, cookie banners, author bios, "related posts", social-share widgets,',
  '   comment sections, footer boilerplate, legal disclaimers.',
  '7. If the content is fundamentally unstructured prose, return:',
  '   { "title": "...", "summary": "<1-2 sentence summary>", "content": "<full cleaned text>" }.',
  '8. Include a "__meta" object at the top level with at minimum:',
  '   { "sourceUrl": "...", "extractedAt": "<ISO-8601>", "userHint": "<hint or null>" }.',
  '9. Never fabricate values. If a piece of information is not present on the',
  '   page, omit the key rather than inventing content.',
  '10. Output MUST be pure JSON valid against RFC 8259.',
].join('\n');

function formatUserMessage({ pageTitle, pageUrl, pageText, userHint }) {
  const lines = [];
  if (pageTitle) lines.push(`PAGE TITLE: ${pageTitle}`);
  if (pageUrl) lines.push(`PAGE URL: ${pageUrl}`);
  lines.push(
    userHint
      ? `USER HINT: ${userHint}`
      : 'USER HINT: (none — infer the best structure automatically)',
  );
  lines.push('');
  lines.push('PAGE CONTENT:');
  lines.push('---');
  lines.push(pageText);
  lines.push('---');
  lines.push('');
  lines.push('Return the JSON object now.');
  return lines.join('\n');
}

/**
 * Build the normalized prompt triple that providers consume.
 *
 * @param {object} args
 * @param {string} args.pageText  sanitized page text (markdown-ish allowed)
 * @param {string} [args.pageTitle]
 * @param {string} [args.pageUrl]
 * @param {string | null} [args.userHint]
 * @returns {{ system: string, user: string, responseFormat: { type: 'json_object' } }}
 */
export function buildExtractionPrompt({ pageText, pageTitle, pageUrl, userHint }) {
  return {
    system: SYSTEM_PROMPT,
    user: formatUserMessage({
      pageTitle: pageTitle ?? '',
      pageUrl: pageUrl ?? '',
      pageText: pageText ?? '',
      userHint: (userHint ?? '').trim() || null,
    }),
    responseFormat: { type: 'json_object' },
  };
}
