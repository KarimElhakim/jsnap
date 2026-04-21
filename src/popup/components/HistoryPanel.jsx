import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { Clock, Trash2, RefreshCw } from 'lucide-preact';
import { Platform } from '../../core/platform.js';
import { message, MESSAGE_TYPES } from '../../background/router.js';
import { useI18n } from '../hooks/useI18n.js';

const items = signal([]);
const loading = signal(false);
const query = signal('');

async function refresh() {
  loading.value = true;
  const resp = await Platform.runtime.sendMessage(
    message(MESSAGE_TYPES.GET_HISTORY, { query: query.value.trim() || undefined }),
  );
  if (resp?.ok) items.value = resp.data ?? [];
  loading.value = false;
}

async function remove(id) {
  await Platform.runtime.sendMessage(message(MESSAGE_TYPES.DELETE_HISTORY, { id }));
  await refresh();
}

async function clearAll(confirmLabel) {
  if (!confirm(confirmLabel)) return;
  await Platform.runtime.sendMessage(message(MESSAGE_TYPES.CLEAR_HISTORY));
  await refresh();
}

function downloadEntry(entry) {
  const blob = new Blob([JSON.stringify(entry.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jsnap-${entry.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function HistoryPanel({ onPick }) {
  const t = useI18n();

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div class="history">
      <div class="history__header">
        <input
          class="history__search"
          type="search"
          value={query.value}
          placeholder={t('popup_history_search')}
          onInput={(e) => {
            query.value = e.currentTarget.value;
            refresh();
          }}
        />
        <button class="btn btn--ghost" title={t('popup_history_refresh')} onClick={refresh}>
          <RefreshCw size={12} />
        </button>
        <button
          class="btn btn--ghost"
          title={t('popup_history_clear')}
          onClick={() => clearAll(t('popup_history_clear_confirm'))}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {loading.value && items.value.length === 0 && (
        <div class="history__empty">{t('popup_history_loading')}</div>
      )}

      {!loading.value && items.value.length === 0 && (
        <div class="history__empty">{t('popup_history_empty')}</div>
      )}

      <ul class="history__list">
        {items.value.map((entry) => (
          <li key={entry.id} class="history__item">
            <button
              class="history__entry"
              onClick={() => onPick?.(entry)}
              title={entry.url || entry.title}
            >
              <span class="history__title">{entry.title}</span>
              <span class="history__meta">
                <Clock size={10} /> {formatTime(entry.extractedAt)} · {formatBytes(entry.sizeBytes)}
                {entry.apiCalls ? ` · ${entry.apiCalls} API` : ''}
              </span>
            </button>
            <div class="history__actions">
              <button
                class="btn btn--ghost"
                onClick={() => downloadEntry(entry)}
                title={t('popup_result_download')}
              >
                ↓
              </button>
              <button
                class="btn btn--ghost"
                onClick={() => remove(entry.id)}
                title={t('popup_history_delete')}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
