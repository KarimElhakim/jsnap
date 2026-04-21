import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { Platform } from '../core/platform.js';
import { Settings } from '../core/settings.js';
import { useI18n } from '../popup/hooks/useI18n.js';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'];
const GROQ_MODELS = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'];
const OLLAMA_MODELS = ['llama3.2', 'mistral', 'phi3', 'gemma3'];

const PROVIDER_DEFS = [
  { id: 'gemini', name: 'Google Gemini', models: GEMINI_MODELS, hasKey: true },
  { id: 'groq', name: 'Groq', models: GROQ_MODELS, hasKey: true },
  { id: 'ollama', name: 'Ollama (local)', models: OLLAMA_MODELS, hasKey: false, hasUrl: true },
  { id: 'openai-compatible', name: 'OpenAI-compatible', models: [], hasKey: true, hasUrl: true },
];

const cfg = signal(null);
const saved = signal(false);
const clearPending = signal(false);
const securityDismissed = signal(
  globalThis.localStorage?.getItem('jsnap_sec_notice') === '1',
);

function updateCfg(patch) {
  cfg.value = { ...cfg.value, ...patch };
}

function updateProvider(id, field, value) {
  cfg.value = {
    ...cfg.value,
    providers: { ...cfg.value?.providers, [id]: { ...cfg.value?.providers?.[id], [field]: value } },
  };
}

function ProviderCard({ pdef, t }) {
  const pcfg = cfg.value?.providers?.[pdef.id] ?? {};

  return (
    <div class="provider-card">
      <span class="provider-card__name">{pdef.name}</span>

      {pdef.hasUrl && (
        <div class="field">
          <label htmlFor={`${pdef.id}-url`}>{t('options_base_url_label')}</label>
          <input
            id={`${pdef.id}-url`}
            type="text"
            value={pcfg.baseUrl ?? ''}
            onInput={(e) => updateProvider(pdef.id, 'baseUrl', e.currentTarget.value)}
          />
        </div>
      )}

      {pdef.hasKey && (
        <div class="field">
          <label htmlFor={`${pdef.id}-key`}>{t('options_api_key_label')}</label>
          <input
            id={`${pdef.id}-key`}
            type="password"
            autocomplete="off"
            value={pcfg.apiKey ?? ''}
            placeholder={t('options_api_key_placeholder')}
            onInput={(e) => updateProvider(pdef.id, 'apiKey', e.currentTarget.value)}
          />
        </div>
      )}

      <div class="field">
        <label htmlFor={`${pdef.id}-model`}>{t('options_model_label')}</label>
        {pdef.models.length > 0 ? (
          <select
            id={`${pdef.id}-model`}
            value={pcfg.model ?? pdef.models[0]}
            onChange={(e) => updateProvider(pdef.id, 'model', e.currentTarget.value)}
          >
            {pdef.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`${pdef.id}-model`}
            type="text"
            value={pcfg.model ?? ''}
            placeholder="e.g. gpt-4o"
            onInput={(e) => updateProvider(pdef.id, 'model', e.currentTarget.value)}
          />
        )}
      </div>
    </div>
  );
}

export function App() {
  const t = useI18n();

  useEffect(() => {
    Settings.getAll().then((s) => {
      cfg.value = s;
      const theme = s?.ui?.theme ?? 'system';
      if (theme !== 'system') document.documentElement.setAttribute('data-theme', theme);
    });
  }, []);

  async function handleSave() {
    if (!cfg.value) return;
    await Settings.update(cfg.value);
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 2000);
  }

  async function handleClear() {
    if (!clearPending.value) {
      clearPending.value = true;
      return;
    }
    const patch = { providers: {} };
    for (const p of PROVIDER_DEFS) {
      patch.providers[p.id] = { apiKey: '', ...(p.hasUrl ? { baseUrl: '' } : {}) };
    }
    await Settings.update(patch);
    cfg.value = await Settings.getAll();
    clearPending.value = false;
  }

  if (!cfg.value) return null;

  const theme = cfg.value?.ui?.theme ?? 'system';

  return (
    <div class="options">
      <h1>{t('options_title')}</h1>

      {!securityDismissed.value && (
        <div class="notice notice--warning" role="alert">
          <span>{t('options_security_notice')}</span>
          <button
            class="notice__dismiss"
            onClick={() => {
              securityDismissed.value = true;
              globalThis.localStorage?.setItem('jsnap_sec_notice', '1');
            }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <section>
        <h2>{t('options_provider_heading')}</h2>
        {PROVIDER_DEFS.map((p) => (
          <ProviderCard key={p.id} pdef={p} t={t} />
        ))}
      </section>

      <section>
        <div class="field">
          <label htmlFor="default-provider">{t('options_default_provider_label')}</label>
          <select
            id="default-provider"
            value={cfg.value?.defaultProviderId ?? 'gemini'}
            onChange={(e) => updateCfg({ defaultProviderId: e.currentTarget.value })}
          >
            {PROVIDER_DEFS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div class="field">
          <label>{t('options_theme_label')}</label>
          <div class="radio-group">
            {['system', 'light', 'dark'].map((th) => (
              <label key={th} class="radio-label">
                <input
                  type="radio"
                  name="theme"
                  value={th}
                  checked={theme === th}
                  onChange={() => {
                    updateCfg({ ui: { ...cfg.value?.ui, theme: th } });
                    const attr = th === 'system' ? null : th;
                    if (attr) document.documentElement.setAttribute('data-theme', attr);
                    else document.documentElement.removeAttribute('data-theme');
                  }}
                />
                {t(`options_theme_${th}`)}
              </label>
            ))}
          </div>
        </div>
      </section>

      <div class="actions">
        <button class="btn btn--primary" onClick={handleSave}>
          {saved.value ? t('options_saved') : t('popup_extract_button')}
        </button>
        <button class="btn btn--danger" onClick={handleClear}>
          {clearPending.value ? t('options_clear_keys_confirm') : t('options_clear_keys')}
        </button>
      </div>
    </div>
  );
}
