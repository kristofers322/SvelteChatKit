// SvelteChatKit public API

// Types & errors
export type {
	ChatRole,
	ChatMessage,
	SendMessageOptions,
	ChatProvider,
	ProviderConfig
} from './chat/types.js';
export { ChatProviderError, generateId } from './chat/types.js';

// Configuration
export { defineChatKitConfig, defaultConfig, type ChatKitConfig } from './chat/config.js';

// Chat state
export { Chat, type ChatStatus, type ChatOptions } from './chat/chat.svelte.js';

// Providers & registry
export {
	registerProvider,
	createProvider,
	getRegisteredProviders,
	type ProviderFactory
} from './chat/providers/index.js';
export { OpenAICompatibleProvider } from './chat/providers/openai.js';
export { DifyProvider } from './chat/providers/dify.js';
export { OllamaProvider } from './chat/providers/ollama.js';
export { N8nProvider } from './chat/providers/n8n.js';
export { CustomEndpointProvider } from './chat/providers/custom.js';
export { MockProvider } from './chat/providers/mock.js';

// Utilities
export { renderMarkdown } from './chat/markdown.js';
export { loadMessages, saveMessages, clearMessages } from './chat/storage.js';
export { sseStream, lineStream, textStream, ensureOk } from './chat/stream.js';

// Components
export { default as ChatWindow } from './components/ChatWindow.svelte';
export { default as MessageList } from './components/MessageList.svelte';
export { default as MessageBubble } from './components/MessageBubble.svelte';
export { default as ChatInput } from './components/ChatInput.svelte';
export { default as Markdown } from './components/Markdown.svelte';
export { default as TypingIndicator } from './components/TypingIndicator.svelte';
