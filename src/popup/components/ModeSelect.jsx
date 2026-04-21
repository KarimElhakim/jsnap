import { useI18n } from '../hooks/useI18n.js';

/**
 * Extraction mode selector.
 * - structure (default): preserve full content, organize into sections
 * - summary: condensed digest
 * - data: tables/specs/lists only
 */
export function ModeSelect({ value, onChange, disabled }) {
  const t = useI18n();
  const modes = [
    { id: 'structure', label: t('popup_mode_structure') },
    { id: 'summary', label: t('popup_mode_summary') },
    { id: 'data', label: t('popup_mode_data') },
  ];

  return (
    <div class="field">
      <label class="field__label" for="jsnap-mode">
        {t('popup_mode_label')}
      </label>
      <div class="segmented" role="radiogroup" aria-label={t('popup_mode_label')}>
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={value === m.id}
            class={`segmented__option${value === m.id ? ' segmented__option--active' : ''}`}
            disabled={disabled}
            onClick={() => onChange(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p class="field__help">{t('popup_mode_help')}</p>
    </div>
  );
}
