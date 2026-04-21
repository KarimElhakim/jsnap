import { Coffee, Heart } from 'lucide-preact';
import { useI18n } from '../hooks/useI18n.js';

/**
 * Non-intrusive footer with Buy Me a Coffee and GitHub Sponsors links.
 */
export function DonateFooter() {
  const t = useI18n();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        paddingTop: '4px',
        borderTop: '1px solid var(--color-border)',
        fontSize: '11px',
        color: 'var(--color-text-muted)',
      }}
    >
      <span>{t('popup_donate_text')}</span>
      <a
        href="https://buymeacoffee.com/karimali"
        target="_blank"
        rel="noopener noreferrer"
        title="Buy Me a Coffee"
        style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}
      >
        <Coffee size={13} />
      </a>
      <a
        href="https://github.com/sponsors/KarimElhakim"
        target="_blank"
        rel="noopener noreferrer"
        title="GitHub Sponsors"
        style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}
      >
        <Heart size={13} />
      </a>
    </div>
  );
}
