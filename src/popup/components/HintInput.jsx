import { useI18n } from '../hooks/useI18n.js';

/**
 * Optional free-text hint that scopes the extraction.
 * Auto-grows from 1 to 3 rows as content is entered.
 *
 * @param {{ value: string, onChange: (v: string) => void, disabled: boolean }} props
 */
export function HintInput({ value, onChange, disabled }) {
  const t = useI18n();

  return (
    <div>
      <label htmlFor="hint-input">{t('popup_hint_label')}</label>
      <textarea
        id="hint-input"
        rows={1}
        value={value}
        placeholder={t('popup_hint_placeholder')}
        disabled={disabled}
        onInput={(e) => onChange(e.currentTarget.value)}
        aria-describedby="hint-help"
      />
      <p
        id="hint-help"
        style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}
      >
        {t('popup_hint_help')}
      </p>
    </div>
  );
}
