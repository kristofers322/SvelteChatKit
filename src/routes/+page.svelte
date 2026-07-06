<script lang="ts">
	import { slide } from 'svelte/transition';
	import {
		Chat,
		ChatWindow,
		createProvider,
		defaultConfig,
		getRegisteredProviders,
		type ProviderConfig
	} from '$lib';

	const SETTINGS_KEY = 'sveltechatkit:demo-settings';
	const HISTORY_KEY = 'sveltechatkit:demo-history';

	interface StoredSettings {
		provider?: string;
		overrides?: Record<string, { model?: string; baseUrl?: string }>;
	}

	function loadSettings(): StoredSettings {
		try {
			const raw = localStorage.getItem(SETTINGS_KEY);
			if (!raw) return {};
			const parsed: unknown = JSON.parse(raw);
			if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
				return parsed as StoredSettings;
			}
		} catch {
			// Corrupt JSON; fall through and self-heal below.
		}
		try {
			localStorage.removeItem(SETTINGS_KEY);
		} catch {
			/* storage unavailable */
		}
		return {};
	}

	const providerOptions = getRegisteredProviders();
	const stored = loadSettings();
	const overrides: Record<string, { model?: string; baseUrl?: string }> = stored.overrides ?? {};
	const sessionKeys: Record<string, string> = {};

	function defaultsFor(id: string): { model: string; baseUrl: string } {
		const base = defaultConfig.providers[id];
		const saved = overrides[id];
		return {
			model: saved?.model ?? base?.model ?? '',
			baseUrl: saved?.baseUrl ?? base?.baseUrl ?? ''
		};
	}

	const initialProvider =
		stored.provider && providerOptions.some((p) => p.id === stored.provider)
			? stored.provider
			: defaultConfig.defaultProvider;

	let providerId = $state(initialProvider);
	let model = $state(defaultsFor(initialProvider).model);
	let baseUrl = $state(defaultsFor(initialProvider).baseUrl);
	let apiKey = $state('');
	let showConnection = $state(false);

	function buildConfig(): ProviderConfig {
		const base = defaultConfig.providers[providerId] ?? { id: providerId };
		const config: ProviderConfig = { ...base, id: providerId };
		if (model.trim()) config.model = model.trim();
		if (baseUrl.trim()) config.baseUrl = baseUrl.trim();
		if (apiKey.trim()) config.apiKey = apiKey.trim();
		return config;
	}

	function configKey(config: ProviderConfig): string {
		return JSON.stringify([config.id, config.model, config.baseUrl, config.apiKey]);
	}

	const initialConfig = buildConfig();
	const chat = new Chat(createProvider(initialConfig), { storageKey: HISTORY_KEY });
	let activeConfigKey = configKey(initialConfig);

	function selectProvider(id: string): void {
		providerId = id;
		const defaults = defaultsFor(id);
		model = defaults.model;
		baseUrl = defaults.baseUrl;
		apiKey = sessionKeys[id] ?? '';
	}

	$effect(() => {
		const config = buildConfig();
		sessionKeys[providerId] = apiKey;
		overrides[providerId] = {
			model: model.trim() || undefined,
			baseUrl: baseUrl.trim() || undefined
		};
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify({ provider: providerId, overrides }));
		} catch {
			/* storage unavailable */
		}
		// Only swap the provider when the effective config actually changed —
		// recreating on every keystroke would discard provider-side state.
		const key = configKey(config);
		if (key !== activeConfigKey) {
			activeConfigKey = key;
			chat.setProvider(createProvider(config));
		}
	});

	const fieldClass =
		'h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600 dark:focus:ring-white/10';
	const labelClass = 'text-xs font-medium text-zinc-500 dark:text-zinc-400';
</script>

<svelte:head>
	<title>SvelteChatKit — provider-agnostic AI chat UI kit</title>
	<meta
		name="description"
		content="A universal, provider-agnostic AI chat UI kit for SvelteKit. Streaming, markdown, dark mode — works with OpenAI-compatible APIs, Ollama, Dify, and custom backends."
	/>
</svelte:head>

<div class="flex h-dvh flex-col">
	<header
		class="shrink-0 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
	>
		<div class="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
			<div class="flex items-center gap-2.5">
				<svg
					class="h-5 w-5 text-zinc-900 dark:text-zinc-100"
					viewBox="0 0 32 32"
					fill="currentColor"
					aria-hidden="true"
				>
					<rect x="3" y="3" width="26" height="19" rx="5.5" />
					<path d="M8 19h7.6l-6 6.3c-.63.66-1.6.2-1.6-.72V19z" />
				</svg>
				<span class="text-sm font-semibold tracking-tight">SvelteChatKit</span>
				<span
					class="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
				>
					v0.1
				</span>
			</div>
			<a
				href="https://github.com/kristofers322/SvelteChatKit"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="GitHub repository"
				class="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 dark:focus-visible:ring-white"
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path
						d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.66.41.35.77 1.04.77 2.1v3.11c0 .3.21.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
					/>
				</svg>
			</a>
		</div>
	</header>

	<main
		class="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4"
	>
		<section
			class="shrink-0 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
			aria-label="Chat settings"
		>
			<div class="flex flex-wrap items-end gap-3">
				<label class="flex min-w-[9rem] flex-1 flex-col gap-1.5">
					<span class={labelClass}>Provider</span>
					<div class="relative">
						<select
							value={providerId}
							onchange={(event) => selectProvider(event.currentTarget.value)}
							class="{fieldClass} appearance-none pr-8"
						>
							{#each providerOptions as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
						<svg
							class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="m6 9 6 6 6-6" />
						</svg>
					</div>
				</label>
				<label class="flex min-w-[9rem] flex-1 flex-col gap-1.5">
					<span class={labelClass}>Model</span>
					<input
						type="text"
						bind:value={model}
						placeholder="Provider default"
						autocomplete="off"
						spellcheck="false"
						class={fieldClass}
					/>
				</label>
				<button
					type="button"
					onclick={() => chat.clear()}
					class="h-9 shrink-0 rounded-lg bg-zinc-900 px-3.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-950"
				>
					New chat
				</button>
			</div>

			<div class="mt-3 border-t border-zinc-100 pt-2.5 dark:border-zinc-900">
				<button
					type="button"
					onclick={() => (showConnection = !showConnection)}
					aria-expanded={showConnection}
					aria-controls="connection-settings"
					class="flex items-center gap-1 rounded text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 dark:focus-visible:ring-white"
				>
					<svg
						class="h-3.5 w-3.5 transition-transform {showConnection ? 'rotate-90' : ''}"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="m9 6 6 6-6 6" />
					</svg>
					Connection settings
				</button>
				{#if showConnection}
					<div
						id="connection-settings"
						class="mt-3 grid gap-3 sm:grid-cols-2"
						transition:slide={{ duration: 150 }}
					>
						<label class="flex flex-col gap-1.5">
							<span class={labelClass}>Base URL</span>
							<input
								type="url"
								bind:value={baseUrl}
								placeholder="https://api.example.com/v1"
								autocomplete="off"
								spellcheck="false"
								class={fieldClass}
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class={labelClass}>API key</span>
							<input
								type="password"
								bind:value={apiKey}
								placeholder="Optional"
								autocomplete="off"
								class={fieldClass}
							/>
						</label>
						<p class="text-xs leading-relaxed text-zinc-400 sm:col-span-2 dark:text-zinc-500">
							Keys entered here stay in your browser, but client-side keys are visible to users —
							use a server proxy in production.
						</p>
					</div>
				{/if}
			</div>
		</section>

		<section
			class="flex min-h-[16rem] flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
			aria-label="Chat"
		>
			<ChatWindow {chat} class="min-h-0 flex-1" placeholder="Message the assistant…" />
		</section>

		<footer class="shrink-0 text-center text-xs text-zinc-400 dark:text-zinc-600">
			MIT licensed · Built with SvelteKit
		</footer>
	</main>
</div>
