import { useI18n } from '../hooks/useI18n.js';

/**
 * Extraction mode selector.
 *
 * - raw (default): deterministic DOM walk; free, instant, no API key required
 * - structure: full-text preservation via LLM (section-by-section)
 * - summary: condensed digest via LLM
 * - data: tables/specs/lists only via LLM
 */
export function ModeSelect({ value, onChange, disabled }) {
  const t = useI18n();
  const modes = [
    { id: 'raw', label: t('popup_mode_raw'), badge: t('popup_mode_raw_badge') },
    { id: 'structure', label: t('popup_mode_structure') },
    { id: 'summary', label: t('popup_mode_summary') },
    { id: 'data', label: t('popup_mode_data') },
  ];

  const helpKey =
    value === 'raw'
      ? 'popup_mode_help_raw'
      : value === 'structure'
        ? 'popup_mode_help_structure'
        : value === 'summary'
          ? 'popup_mode_help_summary'
          : 'popup_mode_help_data';

  return (
    <div class="field">
      <label class="field__label">{t('popup_mode_label')}</label>
      <div class="segmented segmented--four" role="radiogroup" aria-label={t('popup_mode_label')}>
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
            {m.badge && <span class="segmented__badge">{m.badge}</span>}
          </button>
        ))}
      </div>
      <p class="field__help">{t(helpKey)}</p>
    </div>
  );
}
