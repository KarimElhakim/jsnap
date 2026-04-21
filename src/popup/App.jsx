import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { Platform } from '../core/platform.js';
import { message, MESSAGE_TYPES, MESSAGE_VERSION } from '../background/router.js';
import { ProviderSelect } from './components/ProviderSelect.jsx';
import { HintInput } from './components/HintInput.jsx';
import { ExtractButton } from './components/ExtractButton.jsx';
import { ResultView } from './components/ResultView.jsx';
import { UsageMeter } from './components/UsageMeter.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { DonateFooter } from './components/DonateFooter.jsx';
import { useI18n } from './hooks/useI18n.js';

// Module-level signals — stable across re-renders, survive popup re-open.
const providers = signal([]);
const selectedProviderId = signal('');
const hint = signal('');
const phase = signal('idle'); // 'idle' | 'extracting' | 'done' | 'error'
const progress = signal({ stage: '', pct: 0 });
const result = signal(null);
const extractionError = signal(null);
const usage = signal({ count: 0 });
const settings = signal(null);
const activeTabId = signal(null);
const currentRequestId = signal(null);

function resolveHasApiKey() {
  const s = settings.value;
  const pid = selectedProviderId.value;
  if (!s || !pid) return false;
  const cfg = s.providers?.[pid];
  if (!cfg) return false;
  if (pid === 'ollama') return true; // Ollama is local; no key required
  return !!cfg.apiKey?.trim();
}

async function refreshUsage(providerId) {
  if (!providerId) return;
  const resp = await Platform.runtime.sendMessage(message(MESSAGE_TYPES.GET_USAGE, { providerId }));
  if (resp?.ok) usage.value = resp.data ?? { count: 0 };
}

export function App() {
  const t = useI18n();

  useEffect(() => {
    async function init() {
      const tabs = await Platform.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) activeTabId.value = tabs[0].id;

      const pResp = await Platform.runtime.sendMessage(message(MESSAGE_TYPES.LIST_PROVIDERS));
      if (pResp?.ok) providers.value = pResp.data ?? [];

      const sResp = await Platform.runtime.sendMessage(message(MESSAGE_TYPES.GET_SETTINGS));
      if (sResp?.ok) {
        settings.value = sResp.data;
        const theme = sResp.data?.ui?.theme ?? 'system';
        if (theme !== 'system') document.documentElement.setAttribute('data-theme', theme);
        selectedProviderId.value = sResp.data?.defaultProviderId ?? '';
      }

      await refreshUsage(selectedProviderId.value);
    }

    init();

    // Listen for push messages from background (EXTRACT_PROGRESS / EXTRACT_RESULT).
    Platform.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.v !== MESSAGE_VERSION) return;
      const rid = msg.payload?.requestId;
      if (!rid || rid !== currentRequestId.value) return;

      if (msg.type === MESSAGE_TYPES.EXTRACT_PROGRESS) {
        progress.value = msg.payload;
      } else if (msg.type === MESSAGE_TYPES.EXTRACT_RESULT) {
        if (msg.payload.ok) {
          result.value = msg.payload.data;
          phase.value = 'done';
        } else {
          extractionError.value = msg.payload.error;
          phase.value = 'error';
        }
        currentRequestId.value = null;
        refreshUsage(selectedProviderId.value);
      }
    });
  }, []);

  async function handleExtract() {
    if (!activeTabId.value || !selectedProviderId.value || phase.value === 'extracting') return;
    const requestId = crypto.randomUUID();
    currentRequestId.value = requestId;
    phase.value = 'extracting';
    progress.value = { stage: 'fetching', pct: 0 };
    result.value = null;
    extractionError.value = null;

    await Platform.runtime.sendMessage(
      message(MESSAGE_TYPES.EXTRACT_REQUEST, {
        tabId: activeTabId.value,
        providerId: selectedProviderId.value,
        hint: hint.value.trim() || undefined,
        requestId,
      }),
    );
  }

  function handleCancel() {
    if (currentRequestId.value) {
      Platform.runtime.sendMessage(
        message(MESSAGE_TYPES.CANCEL_REQUEST, { requestId: currentRequestId.value }),
      );
    }
    currentRequestId.value = null;
    phase.value = 'idle';
  }

  const hasApiKey = resolveHasApiKey();
  const noTab = !activeTabId.value;

  return (
    <div class="app">
      {!hasApiKey && phase.value === 'idle' && (
        <div class="notice notice--warning">
          <span>{t('popup_no_key_configured')}</span>
          <button class="link-btn" onClick={() => Platform.runtime.openOptionsPage()}>
            {t('popup_open_settings')}
          </button>
        </div>
      )}

      <ProviderSelect
        providers={providers.value}
        value={selectedProviderId.value}
        onChange={(id) => {
          selectedProviderId.value = id;
          refreshUsage(id);
        }}
      />

      <HintInput
        value={hint.value}
        onChange={(v) => {
          hint.value = v;
        }}
        disabled={phase.value === 'extracting'}
      />

      <ExtractButton
        phase={phase.value}
        disabled={noTab || !hasApiKey || phase.value === 'extracting'}
        onClick={handleExtract}
        onCancel={handleCancel}
      />

      {phase.value !== 'idle' && (
        <StatusBar phase={phase.value} progress={progress.value} error={extractionError.value} />
      )}

      {phase.value === 'done' && result.value != null && <ResultView data={result.value} />}

      <UsageMeter usage={usage.value} />
      <DonateFooter />
    </div>
  );
}
