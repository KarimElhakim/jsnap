/**
 * Download helpers shared by popup, options, and background.
 *
 * Critical: MV3 service workers do not expose `URL.createObjectURL`. The
 * obvious fallback (a base64 data URL) is unreliable because Chrome often
 * refuses to honour the `filename` option of `chrome.downloads.download`
 * when the source is a data URL — downloads land as `download.json` with
 * no regard for the name we asked for.
 *
 * The reliable path is a Blob URL. In the popup we get it directly; in the
 * service worker we bounce through an offscreen document (per the official
 * Chrome MV3 pattern) which exposes `URL.createObjectURL`.
 *
 * Filenames always derive from the page title. Never from opaque IDs.
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
  const suf = suffix ? `-${suffix}` : '';
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

function isDocumentContext() {
  return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
}

async function blobUrlFromOffscreen(body, mime) {
  try {
    await ensureOffscreenDocument();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { target: 'offscreen', type: 'CREATE_BLOB_URL', body, mime },
      (resp) => resolve(resp?.ok ? resp.url : null),
    );
  });
}

let offscreenPromise = null;

async function ensureOffscreenDocument() {
  if (!chrome?.offscreen) throw new Error('offscreen API unavailable');
  if (offscreenPromise) return offscreenPromise;
  offscreenPromise = (async () => {
    const path = 'offscreen.html';
    const url = chrome.runtime.getURL(path);
    if (chrome.runtime.getContexts) {
      try {
        const contexts = await chrome.runtime.getContexts({
          contextTypes: ['OFFSCREEN_DOCUMENT'],
          documentUrls: [url],
        });
        if (contexts.length > 0) return;
      } catch {
        /* proceed to create */
      }
    }
    try {
      await chrome.offscreen.createDocument({
        url: path,
        reasons: ['BLOBS'],
        justification: 'Create blob URLs for downloads from the service worker',
      });
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (!msg.toLowerCase().includes('only a single offscreen')) {
        offscreenPromise = null;
        throw err;
      }
    }
  })();
  return offscreenPromise;
}

async function makeDownloadUrl(body, mime) {
  if (isDocumentContext()) {
    try {
      const blob = new Blob([body], { type: mime });
      return { url: URL.createObjectURL(blob), revokable: 'local' };
    } catch {
      /* fall through */
    }
  }
  const url = await blobUrlFromOffscreen(body, mime);
  if (url) return { url, revokable: 'offscreen' };
  return { url: `data:${mime};base64,${utf8ToBase64(body)}`, revokable: 'none' };
}

async function revokeDownloadUrl(url, kind) {
  if (kind === 'local') {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } else if (kind === 'offscreen') {
    setTimeout(() => {
      try {
        chrome.runtime.sendMessage({ target: 'offscreen', type: 'REVOKE_BLOB_URL', url });
      } catch {
        /* ignore */
      }
    }, 60_000);
  }
}

/**
 * Download a JSnap result as JSON or Markdown.
 *
 * `saveAs: true` opens the Save As dialog (single user-initiated saves).
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
  const { url, revokable } = await makeDownloadUrl(body, mime);
  const filename = suggestedFilename(data, ext, { prefix, suffix });

  try {
    const downloadId = await Platform.downloads.download({ url, filename, saveAs });
    return { downloadId, filename };
  } finally {
    revokeDownloadUrl(url, revokable);
  }
}
