<script>
	import { locale } from 'svelte-i18n';
	import { supportedLocales, setLocale } from './i18n/index.js';

	let isOpen = false;

	$: currentLocale = supportedLocales.find(l => l.code === $locale) || supportedLocales[0];

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function selectLocale(localeCode) {
		setLocale(localeCode);
		isOpen = false;
	}

	function handleClickOutside(event) {
		if (!event.target.closest('.language-switcher')) {
			isOpen = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="language-switcher relative">
	<button
		type="button"
		class="flex items-center gap-1 px-2 py-1 text-white text-xs rounded hover:bg-white/10 transition-colors"
		on:click|stopPropagation={toggleDropdown}
		aria-label="Change language"
		aria-expanded={isOpen}
	>
		<span class="font-medium">{currentLocale.code.toUpperCase()}</span>
		<svg
			class="w-3 h-3 transition-transform {isOpen ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if isOpen}
		<div class="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
			{#each supportedLocales as loc}
				<button
					type="button"
					class="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 {loc.code === $locale ? 'bg-gray-50 font-medium' : ''}"
					on:click={() => selectLocale(loc.code)}
				>
					<span class="text-xs font-medium text-gray-500">{loc.code.toUpperCase()}</span>
					<span>{loc.name}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
