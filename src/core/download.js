/**
 * Download helpers shared by popup, options, and background.
 *
 * MV3 service workers do NOT expose `URL.createObjectURL`, so the popup and
 * background take different paths to produce a downloadable URL. This module
 * hides that split behind a single API.
 *
 * Filenames always derive from the page title (slugified) and the current
 * date, never from opaque IDs.
 */

import { Platform } from './platform.js';
import { jsonToMarkdown } from './format/markdown.js';

export function slugify(text) {
  return (
    (text ?? '')
      .toString()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'jsnap'
  );
}

export function suggestedFilename(data, ext, { prefix = '', suffix = '' } = {}) {
  const title = data?.title ?? data?.pageTitle ?? data?.__meta?.sourceUrl ?? 'jsnap';
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(title);
  const suf = suffix ? `-${slug ? '' : ''}${suffix}` : '';
  const p = prefix ? `${prefix}/` : '';
  return `${p}${slug}${suf}-${date}.${ext}`;
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Returns a URL suitable for passing to `chrome.downloads.download`.
 *
 * In document contexts (popup, options page) we use `URL.createObjectURL`
 * so the browser can stream the blob. In the MV3 service worker we fall
 * back to a base64-encoded data URL because `URL.createObjectURL` is not
 * available there.
 */
function makeDownloadUrl(body, mime) {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      const blob = new Blob([body], { type: mime });
      return { url: URL.createObjectURL(blob), revokable: true };
    } catch {
      /* fall through to data URL */
    }
  }
  return { url: `data:${mime};base64,${utf8ToBase64(body)}`, revokable: false };
}

/**
 * Download a JSnap result as JSON or Markdown.
 *
 * `saveAs: true` opens the native Save As dialog (single user-initiated saves).
 * `saveAs: false` saves silently into Downloads (batch operations).
 */
export async function downloadResult(
  data,
  { format = 'json', saveAs = true, prefix = '', suffix = '' } = {},
) {
  const isJson = format === 'json';
  const body = isJson ? JSON.stringify(data, null, 2) : jsonToMarkdown(data);
  const mime = isJson ? 'application/json' : 'text/markdown';
  const ext = isJson ? 'json' : 'md';
  const { url, revokable } = makeDownloadUrl(body, mime);
  const filename = suggestedFilename(data, ext, { prefix, suffix });

  try {
    await Platform.downloads.download({ url, filename, saveAs });
  } finally {
    if (revokable) setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
