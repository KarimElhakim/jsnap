import { signal } from '@preact/signals';
import { Copy, Download, FileCode2, FileText } from 'lucide-preact';
import { useI18n } from '../hooks/useI18n.js';
import { jsonToMarkdown } from '../../core/format/markdown.js';

const copied = signal(false);
const format = signal('json');

function highlight(jsonStr) {
  const safe = jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return safe.replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-num';
      if (match.startsWith('"')) cls = match.trimEnd().endsWith(':') ? 'json-key' : 'json-str';
      else if (match === 'true' || match === 'false') cls = 'json-lit';
      else if (match === 'null') cls = 'json-null';
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

function slugify(text) {
  return (
    (text ?? 'jsnap')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80) || 'jsnap'
  );
}

function suggestedFilename(data, ext) {
  const title = data?.title ?? data?.__meta?.sourceUrl ?? 'jsnap';
  const date = new Date().toISOString().slice(0, 10);
  return `jsnap-${slugify(title)}-${date}.${ext}`;
}

/**
 * Renders the extracted document with a format toggle (JSON / Markdown),
 * a Copy button, and a Download button. All output is prepared locally —
 * nothing leaves the popup.
 *
 * @param {{ data: unknown }} props
 */
export function ResultView({ data }) {
  const t = useI18n();
  const isJson = format.value === 'json';
  const jsonStr = JSON.stringify(data, null, 2);
  const markdownStr = jsonToMarkdown(data);
  const body = isJson ? jsonStr : markdownStr;

  async function handleCopy() {
    await navigator.clipboard.writeText(body);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1800);
  }

  function handleDownload() {
    const mime = isJson ? 'application/json' : 'text/markdown';
    const ext = isJson ? 'json' : 'md';
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedFilename(data, ext);
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {t('popup_result_title')}
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <div class="segmented" style={{ gridTemplateColumns: 'repeat(2, auto)' }}>
            <button
              type="button"
              class={`segmented__option${isJson ? ' segmented__option--active' : ''}`}
              onClick={() => (format.value = 'json')}
              title="JSON"
            >
              <FileCode2 size={12} /> JSON
            </button>
            <button
              type="button"
              class={`segmented__option${!isJson ? ' segmented__option--active' : ''}`}
              onClick={() => (format.value = 'markdown')}
              title="Markdown"
            >
              <FileText size={12} /> MD
            </button>
          </div>
          <button class="btn btn--ghost" onClick={handleCopy} title={t('popup_result_copy')}>
            <Copy size={12} />
            {copied.value ? t('popup_result_copied') : t('popup_result_copy')}
          </button>
          <button
            class="btn btn--ghost"
            onClick={handleDownload}
            title={t('popup_result_download')}
          >
            <Download size={12} />
          </button>
        </div>
      </div>
      {isJson ? (
        <pre
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            maxHeight: '260px',
            overflowY: 'auto',
            overflowX: 'auto',
            whiteSpace: 'pre',
            lineHeight: 1.5,
          }}
          dangerouslySetInnerHTML={{ __html: highlight(jsonStr) }}
        />
      ) : (
        <pre
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            maxHeight: '260px',
            overflowY: 'auto',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          {markdownStr}
        </pre>
      )}
    </div>
  );
}
