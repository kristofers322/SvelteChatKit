import type { ChatMessage, ChatProvider, ProviderConfig, SendMessageOptions } from '../types.js';
import { ChatProviderError } from '../types.js';
import { providerFetch, sseStream } from '../stream.js';

interface CompletionChunk {
	choices?: { delta?: { content?: unknown } }[];
	error?: { message?: unknown; code?: unknown };
}

/**
 * Streams chat completions from any OpenAI-compatible server: OpenAI,
 * OpenRouter, Groq, LM Studio, vLLM, llama.cpp, Azure-style gateways, etc.
 * Point `baseUrl` at the API root (e.g. "https://api.openai.com/v1").
 */
export class OpenAICompatibleProvider implements ChatProvider {
	readonly id = 'openai';
	readonly label: string;

	private readonly baseUrl: string;
	private readonly apiKey?: string;
	private readonly model: string;
	private readonly headers: Record<string, string>;

	constructor(config: ProviderConfig) {
		this.label = config.label ?? 'OpenAI-compatible';
		this.baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
		this.apiKey = config.apiKey;
		this.model = config.model ?? 'gpt-4o-mini';
		this.headers = config.headers ?? {};
	}

	async *sendMessage(
		messages: ChatMessage[],
		options: SendMessageOptions = {}
	): AsyncGenerator<string, void, unknown> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...this.headers
		};
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

		const body: Record<string, unknown> = {
			model: options.model ?? this.model,
			messages: messages.map((message) => ({ role: message.role, content: message.content })),
			stream: true
		};
		if (options.temperature !== undefined) body['temperature'] = options.temperature;
		if (options.maxTokens !== undefined) body['max_tokens'] = options.maxTokens;

		const response = await providerFetch(this.id, `${this.baseUrl}/chat/completions`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			signal: options.signal
		});

		for await (const payload of sseStream(response)) {
			if (payload.trim() === '[DONE]') return;
			let chunk: CompletionChunk;
			try {
				chunk = JSON.parse(payload) as CompletionChunk;
			} catch {
				continue;
			}
			// OpenRouter and some gateways deliver mid-stream failures as an
			// HTTP-200 SSE event of the form {"error": {...}}.
			if (chunk.error) {
				const message =
					typeof chunk.error.message === 'string' && chunk.error.message
						? chunk.error.message
						: 'The server reported an error mid-stream.';
				const status = typeof chunk.error.code === 'number' ? chunk.error.code : undefined;
				throw new ChatProviderError(this.id, message, status);
			}
			const delta = chunk.choices?.[0]?.delta?.content;
			if (typeof delta === 'string' && delta.length > 0) yield delta;
		}
	}
}
