import type { ChatMessage, ChatProvider, ProviderConfig, SendMessageOptions } from '../types.js';
import { ChatProviderError } from '../types.js';
import { attachmentBase64, isImage } from '../attachments.js';
import { lineStream, providerFetch } from '../stream.js';

interface OllamaChunk {
	message?: { content?: unknown };
	done?: boolean;
	error?: unknown;
}

// Ollama takes image attachments as raw base64 strings in `images`; non-image
// attachments are noted in the text since the API has no slot for them.
function toOllamaMessage(message: ChatMessage): Record<string, unknown> {
	let content = message.content;
	const images: string[] = [];
	for (const attachment of message.attachments ?? []) {
		if (isImage(attachment)) {
			images.push(attachmentBase64(attachment));
		} else {
			const note = `[Attachment "${attachment.name}" (${attachment.mimeType}) omitted: this provider only sends images]`;
			content = content === '' ? note : `${content}\n${note}`;
		}
	}
	const result: Record<string, unknown> = { role: message.role, content };
	if (images.length > 0) result['images'] = images;
	return result;
}

/**
 * Streams chat responses from a local Ollama server (`/api/chat`, NDJSON).
 * No authentication. For direct browser access, Ollama must allow your
 * origin, e.g. start it with `OLLAMA_ORIGINS=http://localhost:5173`.
 */
export class OllamaProvider implements ChatProvider {
	readonly id = 'ollama';
	readonly label: string;

	private readonly baseUrl: string;
	private readonly model: string;
	private readonly headers: Record<string, string>;

	constructor(config: ProviderConfig) {
		this.label = config.label ?? 'Ollama';
		this.baseUrl = (config.baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
		this.model = config.model ?? 'llama3.1';
		this.headers = config.headers ?? {};
	}

	async *sendMessage(
		messages: ChatMessage[],
		options: SendMessageOptions = {}
	): AsyncGenerator<string, void, unknown> {
		const body: Record<string, unknown> = {
			model: options.model ?? this.model,
			messages: messages.map((message) => toOllamaMessage(message)),
			stream: true
		};
		const modelOptions: Record<string, unknown> = {};
		if (options.temperature !== undefined) modelOptions['temperature'] = options.temperature;
		if (options.maxTokens !== undefined) modelOptions['num_predict'] = options.maxTokens;
		if (Object.keys(modelOptions).length > 0) body['options'] = modelOptions;

		const response = await providerFetch(this.id, `${this.baseUrl}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...this.headers },
			body: JSON.stringify(body),
			signal: options.signal
		});

		for await (const line of lineStream(response)) {
			if (line.trim() === '') continue;
			let chunk: OllamaChunk;
			try {
				chunk = JSON.parse(line) as OllamaChunk;
			} catch {
				continue;
			}
			if (typeof chunk.error === 'string' && chunk.error) {
				throw new ChatProviderError(this.id, chunk.error);
			}
			const content = chunk.message?.content;
			if (typeof content === 'string' && content.length > 0) yield content;
			if (chunk.done === true) return;
		}
	}
}
