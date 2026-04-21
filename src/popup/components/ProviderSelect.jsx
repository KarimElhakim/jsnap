import { useI18n } from '../hooks/useI18n.js';

/**
 * Dropdown populated from the providers list returned by the background
 * via the LIST_PROVIDERS message. No direct provider imports.
 *
 * @param {{ providers: Array<{id: string, meta: {displayName: string}}>, value: string, onChange: (id: string) => void }} props
 */
export function ProviderSelect({ providers, value, onChange }) {
  const t = useI18n();

  return (
    <div>
      <label htmlFor="provider-select">{t('popup_provider_label')}</label>
      <select
        id="provider-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={providers.length === 0}
      >
        {providers.length === 0 && <option value="">—</option>}
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.meta.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
