import type { ProviderConfig } from './types.js';

export interface ChatKitConfig {
	/** Registry id of the provider selected by default. */
	defaultProvider: string;
	/** Provider configs keyed by registry id. */
	providers: Record<string, ProviderConfig>;
	/** localStorage key for persisted history; null disables persistence. */
	storageKey: string | null;
	/** Prepended as a system message when set. */
	systemPrompt?: string;
}

// The literal `import.meta.env` expression is required because Vite only
// injects env vars into modules where it sees that exact member access.
const metaEnv = (import.meta.env ?? {}) as unknown as Record<string, unknown>;

function env(name: string): string | undefined {
	const value = metaEnv[name];
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Default configuration, populated from `PUBLIC_*` environment variables
 * (see .env.example). With no environment set at all, the mock provider is
 * selected so the kit works with zero configuration.
 */
export const defaultConfig: ChatKitConfig = {
	defaultProvider: env('PUBLIC_DEFAULT_PROVIDER') ?? 'mock',
	storageKey: 'sveltechatkit:history',
	providers: {
		mock: {
			id: 'mock'
		},
		openai: {
			id: 'openai',
			baseUrl: env('PUBLIC_OPENAI_BASE_URL') ?? 'https://api.openai.com/v1',
			apiKey: env('PUBLIC_OPENAI_API_KEY'),
			model: env('PUBLIC_OPENAI_MODEL') ?? 'gpt-4o-mini'
		},
		dify: {
			id: 'dify',
			baseUrl: env('PUBLIC_DIFY_BASE_URL') ?? 'https://api.dify.ai/v1',
			apiKey: env('PUBLIC_DIFY_API_KEY')
		},
		ollama: {
			id: 'ollama',
			baseUrl: env('PUBLIC_OLLAMA_BASE_URL') ?? 'http://localhost:11434',
			model: env('PUBLIC_OLLAMA_MODEL') ?? 'llama3.1'
		},
		n8n: {
			id: 'n8n',
			baseUrl: env('PUBLIC_N8N_WEBHOOK_URL')
		},
		custom: {
			id: 'custom',
			baseUrl: env('PUBLIC_CUSTOM_ENDPOINT')
		}
	}
};

/**
 * Merges a partial configuration over {@link defaultConfig}. Provider entries
 * are merged per id, so overriding a single field (e.g. the OpenAI model)
 * keeps the rest of that provider's defaults.
 */
export function defineChatKitConfig(config: Partial<ChatKitConfig>): ChatKitConfig {
	const providers: Record<string, ProviderConfig> = {};
	for (const [id, base] of Object.entries(defaultConfig.providers)) {
		providers[id] = { ...base };
	}
	for (const [id, override] of Object.entries(config.providers ?? {})) {
		providers[id] = { ...providers[id], ...override };
	}
	return {
		...defaultConfig,
		...config,
		providers
	};
}
