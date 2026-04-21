/**
 * DOM sanitizer for JSnap content scripts.
 *
 * Strips boilerplate (nav, ads, scripts) from a cloned document and converts
 * the remaining semantic content into a markdown-ish text representation that
 * the chunker can split on headings. Never reads storage or API keys.
 */

const STRIP_TAGS = ['script', 'style', 'noscript', 'iframe', 'svg', 'template'];
const STRIP_STRUCTURAL = ['nav', 'aside', 'footer', 'header'];
const STRIP_ROLES = ['navigation', 'banner', 'contentinfo', 'complementary'];

// Matches common ad/cookie/consent/social class and id fragments
const NOISE_PATTERN =
  /\b(ad[-_]|ads[-_]|cookie|consent|gdpr|share[-_]|social[-_]|related[-_]|promoted|sponsor|newsletter|popup|modal|overlay)\b/i;

const HEADING_PREFIX = {
  h1: '# ',
  h2: '## ',
  h3: '### ',
  h4: '#### ',
  h5: '##### ',
  h6: '###### ',
};

function hasHiddenStyle(el) {
  const style = el.getAttribute('style');
  if (!style) return false;
  return /display\s*:\s*none|visibility\s*:\s*hidden/i.test(style);
}

function isNoise(el) {
  const id = el.id ?? '';
  const cls = el.className && typeof el.className === 'string' ? el.className : '';
  return NOISE_PATTERN.test(id) || NOISE_PATTERN.test(cls);
}

function removeAll(root, selector) {
  root.querySelectorAll(selector).forEach((el) => el.remove());
}

/**
 * Converts semantic DOM nodes to a markdown-ish text representation.
 * @param {Element} root
 * @returns {string}
 */
function extractText(root) {
  const parts = [];

  function walk(node) {
    if (node.nodeType === 3) {
      const t = node.textContent?.trim();
      if (t) parts.push(t);
      return;
    }
    if (node.nodeType !== 1) return;

    const tag = node.tagName.toLowerCase();
    const prefix = HEADING_PREFIX[tag];

    if (prefix) {
      const t = node.textContent.trim();
      if (t) parts.push(prefix + t);
      return;
    }

    if (tag === 'p') {
      const t = node.textContent.trim();
      if (t) parts.push(t);
      return;
    }

    if (tag === 'blockquote') {
      const t = node.textContent.trim();
      if (t) parts.push('> ' + t);
      return;
    }

    if (tag === 'li') {
      const t = node.textContent.trim();
      if (t) parts.push('- ' + t);
      return;
    }

    if (tag === 'tr') {
      const cells = [...node.querySelectorAll('th, td')].map((c) => c.textContent.trim());
      if (cells.length) parts.push(cells.join(' | '));
      return;
    }

    // Recurse into container elements
    for (const child of node.childNodes) walk(child);
  }

  walk(root);
  return parts.join('\n');
}

/**
 * @param {Document} doc  The live page document.
 * @returns {{ text: string, title: string, url: string, meta: string }}
 */
export function sanitize(doc) {
  const clone = doc.cloneNode(true);

  // Strip non-content tags
  for (const tag of STRIP_TAGS) removeAll(clone, tag);
  for (const tag of STRIP_STRUCTURAL) removeAll(clone, tag);
  for (const role of STRIP_ROLES) removeAll(clone, `[role="${role}"]`);

  // Strip hidden elements
  removeAll(clone, '[hidden]');
  removeAll(clone, '[aria-hidden="true"]');
  clone.querySelectorAll('*').forEach((el) => {
    if (hasHiddenStyle(el)) el.remove();
  });

  // Strip noise selectors (ads, cookie banners, etc.)
  clone.querySelectorAll('[id], [class]').forEach((el) => {
    if (isNoise(el)) el.remove();
  });

  const body = clone.body ?? clone;
  const rawText = extractText(body);
  const text = rawText.replace(/\n{3,}/g, '\n\n').trim();

  return {
    text,
    title: doc.title ?? '',
    url: doc.location?.href ?? '',
    meta: doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
  };
}
