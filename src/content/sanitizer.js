/**
 * DOM sanitizer for JSnap content scripts.
 *
 * Strategy: two-pass. The aggressive pass is the preferred output (semantic,
 * markdown-ish, ad-stripped). If it returns too little content, we fall back
 * to a light pass that only strips scripts/styles/iframes and returns
 * whitespace-collapsed innerText. That fallback is what lets us still work
 * on older sites, heavily-styled layouts, and pages that wrap their content
 * in ways the aggressive pass does not recognise.
 *
 * Never reads storage or API keys.
 */

const STRIP_TAGS = ['script', 'style', 'noscript', 'svg', 'template'];
const STRIP_STRUCTURAL = ['nav', 'aside', 'footer', 'header'];
const STRIP_ROLES = ['navigation', 'banner', 'contentinfo', 'complementary'];

const NOISE_PATTERN =
  /\b(cookie|consent|gdpr|newsletter[-_]signup|social[-_]share|share[-_]bar|promoted|sponsor|popup|modal|overlay)\b/i;

const HEADING_PREFIX = {
  h1: '# ',
  h2: '## ',
  h3: '### ',
  h4: '#### ',
  h5: '##### ',
  h6: '###### ',
};

const AGGRESSIVE_MIN_CHARS = 300;

function hasHiddenStyle(el) {
  const style = el.getAttribute?.('style');
  if (!style) return false;
  return /display\s*:\s*none|visibility\s*:\s*hidden/i.test(style);
}

function classString(el) {
  const cls = el.className;
  if (!cls) return '';
  if (typeof cls === 'string') return cls;
  if (typeof cls.baseVal === 'string') return cls.baseVal;
  return '';
}

function isNoise(el) {
  return NOISE_PATTERN.test(el.id ?? '') || NOISE_PATTERN.test(classString(el));
}

function removeAll(root, selector) {
  root.querySelectorAll(selector).forEach((el) => el.remove());
}

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

    if (tag === 'pre' || tag === 'code') {
      const t = node.textContent;
      if (t && t.trim()) {
        parts.push(tag === 'pre' ? `\n\`\`\`\n${t}\n\`\`\`\n` : `\`${t.trim()}\``);
      }
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

    for (const child of node.childNodes) walk(child);
  }

  walk(root);
  return parts.join('\n');
}

function aggressivePass(doc) {
  const clone = doc.cloneNode(true);

  for (const tag of STRIP_TAGS) removeAll(clone, tag);
  for (const tag of STRIP_STRUCTURAL) removeAll(clone, tag);
  for (const role of STRIP_ROLES) removeAll(clone, `[role="${role}"]`);

  removeAll(clone, '[hidden]');
  removeAll(clone, '[aria-hidden="true"]');
  clone.querySelectorAll('*').forEach((el) => {
    if (hasHiddenStyle(el)) el.remove();
  });

  clone.querySelectorAll('[id], [class]').forEach((el) => {
    if (isNoise(el)) el.remove();
  });

  const body = clone.body ?? clone;
  return extractText(body).replace(/\n{3,}/g, '\n\n').trim();
}

function lightPass(doc) {
  const clone = doc.cloneNode(true);
  for (const tag of STRIP_TAGS) removeAll(clone, tag);
  removeAll(clone, 'iframe');
  const body = clone.body ?? clone;
  const raw = body.innerText ?? body.textContent ?? '';
  return raw.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * @param {Document} doc
 * @returns {{ text: string, title: string, url: string, meta: string, stats: object }}
 */
export function sanitize(doc) {
  const aggressive = aggressivePass(doc);
  const useAggressive = aggressive.length >= AGGRESSIVE_MIN_CHARS;
  const text = useAggressive ? aggressive : lightPass(doc);

  return {
    text,
    title: doc.title ?? '',
    url: doc.location?.href ?? '',
    meta: doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
    stats: {
      aggressiveChars: aggressive.length,
      finalChars: text.length,
      passUsed: useAggressive ? 'aggressive' : 'light',
    },
  };
}
