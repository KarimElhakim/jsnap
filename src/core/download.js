/**
 * Download helpers shared by popup, options, and background.
 *
 * Three things had to line up for Chrome to honour our filename:
 *
 *  1. We need a `blob:` URL, not a `data:` URL. Chrome ignores the
 *     `filename` option of `chrome.downloads.download` when the source is
 *     a data URL.
 *  2. The blob has to be wrapped in a `File` whose `name` property matches
 *     the filename we want. With a plain `Blob`, Chrome sometimes uses the
 *     URL's UUID as the Save As default and ignores our filename.
 *  3. In the service worker we cannot call `URL.createObjectURL` directly,
 *     so we bounce through an offscreen document. That document's script
 *     has to be external — inline scripts are blocked by MV3's default
 *     CSP.
 *
 * All three are now addressed. If offscreen fails, we surface the error
 * instead of silently writing a `download.json`.
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

function baseName(path) {
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function isDocumentContext() {
  return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
}

let offscreenPromise = null;

async function ensureOffscreenDocument() {
  if (!globalThis.chrome?.offscreen) {
    throw new Error(
      'offscreen API unavailable — reinstall the extension to grant the new permission',
    );
  }
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
        /* fall through */
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

async function blobUrlFromOffscreen(body, mime, filename) {
  await ensureOffscreenDocument();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('offscreen timed out (check service worker console)')),
      4000,
    );
    chrome.runtime.sendMessage(
      { target: 'offscreen', type: 'CREATE_BLOB_URL', body, mime, filename },
      (resp) => {
        clearTimeout(timeout);
        const runtimeErr = chrome.runtime?.lastError?.message;
        if (runtimeErr) reject(new Error(`offscreen sendMessage: ${runtimeErr}`));
        else if (resp?.ok) resolve(resp.url);
        else reject(new Error(resp?.error ?? 'offscreen returned no URL'));
      },
    );
  });
}

async function makeDownloadUrl(body, mime, filename) {
  const name = baseName(filename);
  if (isDocumentContext()) {
    const file = new File([body], name, { type: mime });
    return { url: URL.createObjectURL(file), revokable: 'local' };
  }
  const url = await blobUrlFromOffscreen(body, mime, name);
  return { url, revokable: 'offscreen' };
}

function revokeDownloadUrl(url, kind) {
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
 * Throws a descriptive error if the URL creation step fails — we never fall
 * back to a data URL silently, because that path produced `download.json`
 * in the wild.
 */
export async function downloadResult(
  data,
  { format = 'json', saveAs = true, prefix = '', suffix = '' } = {},
) {
  const isJson = format === 'json';
  const body = isJson ? JSON.stringify(data, null, 2) : jsonToMarkdown(data);
  const mime = isJson ? 'application/json' : 'text/markdown';
  const ext = isJson ? 'json' : 'md';
  const filename = suggestedFilename(data, ext, { prefix, suffix });
  const { url, revokable } = await makeDownloadUrl(body, mime, filename);

  try {
    const downloadId = await Platform.downloads.download({ url, filename, saveAs });
    return { downloadId, filename };
  } finally {
    revokeDownloadUrl(url, revokable);
  }
}
