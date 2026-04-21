/**
 * Download helpers shared by popup, options, and background.
 *
 * All filenames are derived from the page title (slugified) and the current
 * date, never from opaque IDs. Two output formats are supported: JSON and
 * Markdown. The conversion to Markdown reuses the pure renderer in
 * `format/markdown.js` so tools and popup see identical output.
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

export function suggestedFilename(data, ext, { prefix = '' } = {}) {
  const title = data?.title ?? data?.__meta?.sourceUrl ?? 'jsnap';
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(title);
  const p = prefix ? `${prefix}/` : '';
  return `${p}${slug}-${date}.${ext}`;
}

function toBlobUrl(body, mime) {
  const blob = new Blob([body], { type: mime });
  return URL.createObjectURL(blob);
}

/**
 * Download a JSnap result as JSON or Markdown.
 *
 * `saveAs` true opens the Save As dialog (appropriate for single downloads
 * triggered by user intent). `saveAs` false saves silently into Downloads
 * (used by batch multi-tab workflows to avoid N dialogs).
 */
export async function downloadResult(data, { format = 'json', saveAs = true, prefix = '' } = {}) {
  const isJson = format === 'json';
  const body = isJson ? JSON.stringify(data, null, 2) : jsonToMarkdown(data);
  const mime = isJson ? 'application/json' : 'text/markdown';
  const ext = isJson ? 'json' : 'md';
  const url = toBlobUrl(body, mime);
  const filename = suggestedFilename(data, ext, { prefix });

  try {
    await Platform.downloads.download({ url, filename, saveAs });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
