import { signal } from '@preact/signals';
import { Copy, FileJson, FileText } from 'lucide-preact';
import { useI18n } from '../hooks/useI18n.js';
import { jsonToMarkdown } from '../../core/format/markdown.js';
import { downloadResult } from '../../core/download.js';

const copied = signal(false);

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

/**
 * Shows the extracted JSON with three explicit actions:
 *   - Copy (copies the raw JSON)
 *   - Save as JSON (Chrome Save As dialog, filename derived from page title)
 *   - Save as Markdown (same dialog, Markdown rendering of the same data)
 *
 * Everything is local — no network touched here.
 *
 * @param {{ data: unknown }} props
 */
export function ResultView({ data }) {
  const t = useI18n();
  const jsonStr = JSON.stringify(data, null, 2);

  async function handleCopy() {
    await navigator.clipboard.writeText(jsonStr);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1800);
  }

  async function handleSaveJson() {
    await downloadResult(data, { format: 'json', saveAs: true });
  }

  async function handleSaveMarkdown() {
    await downloadResult(data, { format: 'markdown', saveAs: true });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {t('popup_result_title')}
        </span>
        <div class="actions-row">
          <button class="btn btn--ghost" onClick={handleCopy} title={t('popup_result_copy')}>
            <Copy size={12} />
            {copied.value ? t('popup_result_copied') : t('popup_result_copy')}
          </button>
          <button
            class="btn btn--ghost"
            onClick={handleSaveJson}
            title={t('popup_result_save_json')}
          >
            <FileJson size={12} /> {t('popup_result_save_json')}
          </button>
          <button
            class="btn btn--ghost"
            onClick={handleSaveMarkdown}
            title={t('popup_result_save_md')}
          >
            <FileText size={12} /> {t('popup_result_save_md')}
          </button>
        </div>
      </div>
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
      <details style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
        <summary style={{ cursor: 'pointer' }}>{t('popup_result_preview_md')}</summary>
        <pre
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px',
            marginTop: '4px',
            maxHeight: '200px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {jsonToMarkdown(data)}
        </pre>
      </details>
    </div>
  );
}
