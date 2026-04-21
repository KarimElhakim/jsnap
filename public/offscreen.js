// JSnap offscreen helper.
//
// This file exists because MV3 service workers do not expose
// URL.createObjectURL, and because MV3's default CSP ('script-src self')
// forbids inline scripts in extension pages — so the handler has to live
// in an external file referenced by offscreen.html.
//
// We build a `File` (not a `Blob`) so the filename is attached to the
// object itself; Chrome's Save As dialog picks up File.name even when it
// would otherwise use the URL's last path segment as the default.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return false;

  if (msg.type === 'CREATE_BLOB_URL') {
    try {
      const name = typeof msg.filename === 'string' && msg.filename ? msg.filename : 'download';
      const file = new File([msg.body], name, { type: msg.mime || 'application/octet-stream' });
      const url = URL.createObjectURL(file);
      sendResponse({ ok: true, url });
    } catch (err) {
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    }
    return false;
  }

  if (msg.type === 'REVOKE_BLOB_URL') {
    try {
      URL.revokeObjectURL(msg.url);
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    }
    return false;
  }

  if (msg.type === 'PING_OFFSCREEN') {
    sendResponse({ ok: true, alive: true });
    return false;
  }

  return false;
});
