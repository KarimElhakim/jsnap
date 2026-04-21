import { signal } from '@preact/signals';
import { Copy, Download } from 'lucide-preact';
import { useI18n } from '../hooks/useI18n.js';

const copied = signal(false);

/**
 * Per-token JSON syntax highlighter (no external dependencies).
 * Escapes HTML entities first, then wraps tokens in typed spans.
 */
function highlight(jsonStr) {
  const safe = jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return safe.replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-num';
      if (match.startsWith('"')) {
        cls = match.trimEnd().endsWith(':') ? 'json-key' : 'json-str';
      } else if (match === 'true' || match === 'false') {
        cls = 'json-lit';
      } else if (match === 'null') {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

/**
 * Renders the extracted JSON with syntax highlighting, Copy and Download buttons.
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

  function handleDownload() {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jsnap-output.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {t('popup_result_title')}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
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
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: highlight(jsonStr) }}
      />
    </div>
  );
}
