import { render } from 'preact';
import { App } from './App.jsx';
import { Platform } from '../core/platform.js';
import './styles.css';

const lang = Platform.i18n.getUILanguage();
if (lang.startsWith('ar')) {
  document.documentElement.setAttribute('dir', 'rtl');
}

render(<App />, document.getElementById('app'));
