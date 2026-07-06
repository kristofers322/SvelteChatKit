export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
	id: string;
	role: ChatRole;
	content: string;
	createdAt: number;
	/** Set when the message failed to complete (aborted messages are not errors). */
	error?: string;
}

export interface SendMessageOptions {
	/** Abort the in-flight request/stream. */
	signal?: AbortSignal;
	/** Override the model configured on the provider. */
	model?: string;
	temperature?: number;
	maxTokens?: number;
}

/**
 * A chat backend. Implementations receive the full message history
 * (including a leading system message, when configured) and yield the
 * assistant reply as a stream of text chunks.
 */
export interface ChatProvider {
	/** Registry id, e.g. "openai". */
	readonly id: string;
	/** Human-readable name, e.g. "OpenAI-compatible". */
	readonly label: string;
	sendMessage(
		messages: ChatMessage[],
		options?: SendMessageOptions
	): AsyncGenerator<string, void, unknown>;
	/** Clear provider-side conversation state (e.g. Dify's conversation id). */
	reset?(): void;
}

export interface ProviderConfig {
	/** Which registered provider factory to use: "openai" | "dify" | "ollama" | "custom" | "mock". */
	id: string;
	/** Display label override. */
	label?: string;
	/** Base URL of the API, without trailing slash. */
	baseUrl?: string;
	/** API key/token. In the browser this is visible to users — proxy in production. */
	apiKey?: string;
	/** Default model. */
	model?: string;
	/** Extra headers merged into every request. */
	headers?: Record<string, string>;
	/** Provider-specific options. */
	extra?: Record<string, unknown>;
}

export class ChatProviderError extends Error {
	readonly provider: string;
	readonly status?: number;

	constructor(provider: string, message: string, status?: number) {
		super(message);
		this.name = 'ChatProviderError';
		this.provider = provider;
		this.status = status;
	}
}

export function generateId(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
