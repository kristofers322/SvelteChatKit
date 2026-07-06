import css from './app.css?inline';
// Import i18n first - it initializes synchronously on import
import './lib/i18n/index.js';
import App from './App.svelte';

// Load Google Fonts in the document head (fonts are global, not scoped by shadow DOM)
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
document.head.appendChild(fontLink);

// Create or find the shadow DOM host element
const host = document.getElementById('svelte-chat-widget') || document.createElement('div');
if (!host.parentNode) document.body.appendChild(host);

// Ensure the host sits above all host page elements
host.style.position = 'fixed';
host.style.inset = '0';
host.style.zIndex = '2147483647';
host.style.pointerEvents = 'none';

const shadow = host.attachShadow({ mode: 'open' });

// Inject Tailwind and global CSS into the shadow root
const style = document.createElement('style');
style.textContent = css;
shadow.appendChild(style);

// Create mount point for the Svelte app inside the shadow root
const mountPoint = document.createElement('div');
shadow.appendChild(mountPoint);

const app = new App({ target: mountPoint });

export default app;
