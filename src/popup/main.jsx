import { render } from 'preact';
import { App } from './App.jsx';
import { Platform } from '../core/platform.js';
import './styles.css';

// Apply RTL direction before first paint when UI language is Arabic.
const lang = Platform.i18n.getUILanguage();
if (lang.startsWith('ar')) {
  document.documentElement.setAttribute('dir', 'rtl');
}

render(<App />, document.getElementById('app'));
