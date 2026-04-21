import { Platform } from '../../core/platform.js';

/**
 * Returns a translation helper bound to chrome.i18n.getMessage via Platform.
 * @returns {(key: string, subs?: string | string[]) => string}
 */
export function useI18n() {
  return (key, subs) => Platform.i18n.t(key, subs);
}
