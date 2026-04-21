import { useI18n } from '../hooks/useI18n.js';

/**
 * Primary CTA. Shows a spinner during extraction and allows cancellation.
 *
 * @param {{
 *   phase: 'idle' | 'extracting' | 'done' | 'error',
 *   disabled: boolean,
 *   onClick: () => void,
 *   onCancel: () => void
 * }} props
 */
export function ExtractButton({ phase, disabled, onClick, onCancel }) {
  const t = useI18n();
  const extracting = phase === 'extracting';

  if (extracting) {
    return (
      <div style={{ display: 'flex', gap: '6px' }}>
        <button class="btn btn--primary" disabled style={{ flex: 1 }}>
          <span class="spinner" role="status" aria-label={t('popup_extracting')} />
          {t('popup_extract_in_progress')}
        </button>
        <button
          class="btn btn--ghost"
          onClick={onCancel}
          aria-label="Cancel extraction"
          style={{ flexShrink: 0 }}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button class="btn btn--primary" disabled={disabled} onClick={onClick}>
      {t('popup_extract_button')}
    </button>
  );
}
