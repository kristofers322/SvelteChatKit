import { addMessages, init, getLocaleFromNavigator, locale } from 'svelte-i18n';

// Import translation files
import en from './en.json';
import sv from './sv.json';
import no from './no.json';
import fi from './fi.json';

// Supported languages
export const supportedLocales = [
	{ code: 'en', name: 'English', flag: 'GB' },
	{ code: 'sv', name: 'Svenska', flag: 'SE' },
	{ code: 'no', name: 'Norsk', flag: 'NO' },
	{ code: 'fi', name: 'Suomi', flag: 'FI' }
];

// Add translations synchronously (not register which is async)
addMessages('en', en);
addMessages('sv', sv);
addMessages('no', no);
addMessages('fi', fi);

// Get stored locale or detect from browser
function getInitialLocale() {
	// TEMP: Uncomment to test specific locale
	// return 'sv';  // Swedish
	// return 'no';  // Norwegian
	// return 'fi';  // Finnish

	// Check localStorage first
	const storedLocale = localStorage.getItem('preferredLocale');
	if (storedLocale && supportedLocales.some(l => l.code === storedLocale)) {
		return storedLocale;
	}


	// Detect from browser
	const browserLocale = getLocaleFromNavigator();
	if (browserLocale) {
		// Extract language code (e.g., 'en-US' -> 'en', 'sv-SE' -> 'sv')
		const langCode = browserLocale.split('-')[0].toLowerCase();

		// Handle Norwegian variants (nb, nn -> no)
		const normalizedCode = langCode === 'nb' || langCode === 'nn' ? 'no' : langCode;

		if (supportedLocales.some(l => l.code === normalizedCode)) {
			return normalizedCode;
		}
	}

	// Default to English
	return 'en';
}

// Initialize i18n synchronously
init({
	fallbackLocale: 'en',
	initialLocale: getInitialLocale()
});

// Set locale and persist to localStorage
export function setLocale(localeCode) {
	if (supportedLocales.some(l => l.code === localeCode)) {
		localStorage.setItem('preferredLocale', localeCode);
		locale.set(localeCode);
	}
}

// Export locale store for reactivity
export { locale };
