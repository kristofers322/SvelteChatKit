import type { ChatProvider, ProviderConfig } from '../types.js';
import { ChatProviderError } from '../types.js';
import { OpenAICompatibleProvider } from './openai.js';
import { DifyProvider } from './dify.js';
import { OllamaProvider } from './ollama.js';
import { CustomEndpointProvider } from './custom.js';
import { MockProvider } from './mock.js';

export type ProviderFactory = (config: ProviderConfig) => ChatProvider;

interface RegistryEntry {
	factory: ProviderFactory;
	label: string;
}

const registry = new Map<string, RegistryEntry>();

/**
 * Registers a provider factory under an id, making it available to
 * {@link createProvider}. Registering an existing id replaces it.
 */
export function registerProvider(id: string, factory: ProviderFactory): void {
	let label = id;
	try {
		label = factory({ id }).label;
	} catch {
		// Factories that need more config to instantiate fall back to the id.
	}
	registry.set(id, { factory, label });
}

/**
 * Instantiates the provider registered under `config.id`.
 * Throws ChatProviderError when the id is unknown.
 */
export function createProvider(config: ProviderConfig): ChatProvider {
	const entry = registry.get(config.id);
	if (!entry) {
		const known = [...registry.keys()].join(', ');
		throw new ChatProviderError(
			config.id,
			`Unknown provider "${config.id}". Registered providers: ${known}.`
		);
	}
	return entry.factory(config);
}

/**
 * Lists all registered providers with their default labels, in registration
 * order — handy for building a provider picker.
 */
export function getRegisteredProviders(): { id: string; label: string }[] {
	return [...registry.entries()].map(([id, entry]) => ({ id, label: entry.label }));
}

registerProvider('mock', (config) => new MockProvider(config));
registerProvider('openai', (config) => new OpenAICompatibleProvider(config));
registerProvider('ollama', (config) => new OllamaProvider(config));
registerProvider('dify', (config) => new DifyProvider(config));
registerProvider('custom', (config) => new CustomEndpointProvider(config));

export { OpenAICompatibleProvider } from './openai.js';
export { DifyProvider } from './dify.js';
export { OllamaProvider } from './ollama.js';
export { CustomEndpointProvider } from './custom.js';
export { MockProvider } from './mock.js';
