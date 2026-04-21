import { useI18n } from '../hooks/useI18n.js';

const DAILY_LIMIT = 50;
const WARN_THRESHOLD = 0.8;

/**
 * Shows today's request count for the active provider with a progress bar.
 * @param {{ usage: { count: number, date?: string } }} props
 */
export function UsageMeter({ usage }) {
  const t = useI18n();
  const count = usage?.count ?? 0;
  const pct = Math.min(count / DAILY_LIMIT, 1);
  const nearing = pct >= WARN_THRESHOLD;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>
          {t('popup_usage_today', [String(count)])}
        </span>
        {nearing && (
          <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
            {t('popup_usage_limit_nearing')}
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={count}
        aria-valuemax={DAILY_LIMIT}
        aria-label={t('popup_usage_today', [String(count)])}
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
    </div>
  );
}
