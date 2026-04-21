import { useI18n } from '../hooks/useI18n.js';

const ERROR_CODE_TO_I18N_KEY = {
  'config.missing_key': 'error_config_missing_key',
  'config.invalid': 'error_config_missing_key',
  'provider.auth': 'error_provider_auth',
  'provider.rate_limit': 'error_provider_rate_limit',
  'provider.network': 'error_provider_network',
  'provider.timeout': 'error_provider_network',
  'provider.failed': 'error_provider_failed',
  'provider.unknown': 'error_provider_failed',
  'schema.unrepairable': 'error_schema_unrepairable',
  'schema.invalid': 'error_schema_unrepairable',
  'content.too_large': 'error_content_too_large',
  'content.empty': 'error_content_empty',
  cancelled: 'error_cancelled',
  internal: 'error_generic',
};

const STAGE_LABELS = {
  fetching: 'Reading page…',
  thinking: 'Thinking…',
  parsing: 'Parsing result…',
};

/**
 * Renders extraction progress stages or a human-readable error mapped from error.code.
 *
 * @param {{
 *   phase: 'idle' | 'extracting' | 'done' | 'error',
 *   progress: { stage: string, pct: number },
 *   error: { code: string, message: string } | null
 * }} props
 */
export function StatusBar({ phase, progress, error }) {
  const t = useI18n();

  if (phase === 'error' && error) {
    const i18nKey = ERROR_CODE_TO_I18N_KEY[error.code] ?? 'error_generic';
    const detail = error.message && error.message !== t(i18nKey) ? error.message : null;
    return (
      <div
        role="alert"
        style={{
          padding: '7px 10px',
          borderRadius: 'var(--radius-sm)',
          background: '#fee2e2',
          color: 'var(--color-danger)',
          fontSize: '12px',
          fontWeight: 500,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <span>{t(i18nKey)}</span>
        {detail && (
          <span style={{ fontSize: '10.5px', fontWeight: 400, opacity: 0.8, fontFamily: 'monospace' }}>
            {error.code}: {detail}
          </span>
        )}
      </div>
    );
  }

  if (phase === 'extracting' && progress?.stage) {
    const label = STAGE_LABELS[progress.stage] ?? t('popup_extracting');
    const pct = progress.pct ?? 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{label}</span>
        <div
          style={{
            height: '3px',
            background: 'var(--color-border)',
            borderRadius: '99px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: pct ? `${pct}%` : '30%',
              background: 'var(--color-primary)',
              transition: pct ? 'width 0.3s ease' : 'none',
              animation: pct ? 'none' : 'indeterminate 1.4s ease infinite',
            }}
          />
        </div>
      </div>
    );
  }

  return null;
}
