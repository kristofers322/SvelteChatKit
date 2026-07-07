import type { ChatMessage, ChatProvider, ProviderConfig, SendMessageOptions } from '../types.js';
import { ChatProviderError } from '../types.js';
import { providerFetch, sseStream, textStream } from '../stream.js';

/**
 * Talks to your own HTTP endpoint (`baseUrl` is the full endpoint URL).
 * Sends `{ messages, model? }` as JSON, where each message is
 * `{ role, content }` plus, when the message has attachments, an
 * `attachments` array of `{ name, mimeType, size, dataUrl }` objects.
 * Auto-detects the response format:
 * `text/event-stream` responses are parsed as SSE (JSON payloads with a
 * `content`, `text`, or `delta` string field, `[DONE]` sentinel, or raw
 * text); anything else is streamed as plain text, which also covers
 * non-streaming responses. Ideal as a server-side proxy so API keys never
 * reach the browser.
 */
export class CustomEndpointProvider implements ChatProvider {
	readonly id = 'custom';
	readonly label: string;

	private readonly endpoint?: string;
	private readonly apiKey?: string;
	private readonly model?: string;
	private readonly headers: Record<string, string>;

	constructor(config: ProviderConfig) {
		this.label = config.label ?? 'Custom endpoint';
		this.endpoint = config.baseUrl;
		this.apiKey = config.apiKey;
		this.model = config.model;
		this.headers = config.headers ?? {};
	}

	async *sendMessage(
		messages: ChatMessage[],
		options: SendMessageOptions = {}
	): AsyncGenerator<string, void, unknown> {
		if (!this.endpoint) {
			throw new ChatProviderError(
				this.id,
				'No endpoint configured. Set baseUrl (PUBLIC_CUSTOM_ENDPOINT) to the full URL of your chat endpoint.'
			);
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...this.headers
		};
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

		const body: Record<string, unknown> = {
			messages: messages.map((message) => {
				const entry: Record<string, unknown> = { role: message.role, content: message.content };
				if (message.attachments && message.attachments.length > 0) {
					entry['attachments'] = message.attachments.map(({ name, mimeType, size, dataUrl }) => ({
						name,
						mimeType,
						size,
						dataUrl
					}));
				}
				return entry;
			})
		};
		const model = options.model ?? this.model;
		if (model) body['model'] = model;

		const response = await providerFetch(this.id, this.endpoint, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			signal: options.signal
		});

		const contentType = response.headers.get('content-type') ?? '';
		if (contentType.includes('text/event-stream')) {
			for await (const payload of sseStream(response)) {
				if (payload === '[DONE]') return;
				const text = extractText(payload);
				if (text.length > 0) yield text;
			}
			return;
		}

		for await (const chunk of textStream(response)) {
			if (chunk.length > 0) yield chunk;
		}
	}
}

function extractText(payload: string): string {
	let parsed: unknown;
	try {
		parsed = JSON.parse(payload);
	} catch {
		return payload;
	}
	if (typeof parsed === 'object' && parsed !== null) {
		const record = parsed as Record<string, unknown>;
		for (const field of ['content', 'text', 'delta']) {
			const value = record[field];
			if (typeof value === 'string') return value;
		}
	}
	return payload;
}
