import { useI18n } from '../hooks/useI18n.js';

/**
 * Known free-tier daily-request ceilings, best-effort reference values.
 * These are not authoritative - providers change them - but they give the
 * user a useful "~X of Y today" frame so they don't blow through quota
 * unexpectedly. Update if a provider publishes a new number.
 */
const DAILY_LIMITS = {
  gemini: 250,
  groq: 14_400,
  ollama: Infinity,
  'openai-compatible': null,
};

const WARN_THRESHOLD = 0.8;

/**
 * @param {{
 *   usage: { count: number, date?: string },
 *   providerId?: string,
 *   hideWhenZero?: boolean
 * }} props
 */
export function UsageMeter({ usage, providerId, hideWhenZero = false }) {
  const t = useI18n();
  const count = usage?.count ?? 0;
  if (hideWhenZero && count === 0) return null;

  const limit = DAILY_LIMITS[providerId];
  const hasKnownLimit = typeof limit === 'number' && Number.isFinite(limit);
  const pct = hasKnownLimit ? Math.min(count / limit, 1) : 0;
  const nearing = hasKnownLimit && pct >= WARN_THRESHOLD;

  const label = hasKnownLimit
    ? `${count} / ${limit.toLocaleString()} today`
    : t('popup_usage_today', [String(count)]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        {nearing && (
          <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
            {t('popup_usage_limit_nearing')}
          </span>
        )}
      </div>
      {hasKnownLimit && (
        <div
          role="progressbar"
          aria-valuenow={count}
          aria-valuemax={limit}
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
              width: `${Math.round(pct * 100)}%`,
              background: nearing ? 'var(--color-danger)' : 'var(--color-primary)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
    </div>
  );
}
