import type { ChatMessage, ChatProvider, ProviderConfig, SendMessageOptions } from '../types.js';
import { ChatProviderError, generateId } from '../types.js';
import { lineStream, providerFetch } from '../stream.js';

const SESSION_KEY_PREFIX = 'sveltechatkit:n8n-session:';

// The chunk format n8n emits in "Streaming" response mode: newline-delimited
// JSON, mirroring the official @n8n/chat client's parser.
interface StructuredChunk {
	type?: unknown;
	content?: unknown;
}

// The JSON body n8n returns in "When Last Node Finishes" response mode.
interface N8nResponse {
	output?: unknown;
	text?: unknown;
	message?: unknown;
}

function readStorage(key: string): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStorage(key: string, value: string): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, value);
	} catch {
		// Storage unavailable; the session id stays in-memory only.
	}
}

function removeStorage(key: string): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(key);
	} catch {
		// Storage unavailable; nothing to remove.
	}
}

function extractReply(data: N8nResponse): string {
	if (typeof data.output === 'string') return data.output;
	if (typeof data.text === 'string') return data.text;
	if (typeof data.message === 'string') return data.message;
	if (
		typeof data.message === 'object' &&
		data.message !== null &&
		typeof (data.message as { text?: unknown }).text === 'string'
	) {
		return (data.message as { text: string }).text;
	}
	return '';
}

/**
 * Streams answers from an n8n workflow behind a Chat Trigger node. Point
 * `baseUrl` at the production chat webhook URL (e.g.
 * "https://your-n8n.example.com/webhook/<id>/chat"). Both Chat Trigger
 * response modes work: "Streaming" (newline-delimited JSON chunks) and
 * "When Last Node Finishes" (a single JSON body with `output`/`text`).
 *
 * n8n keys conversation memory on `sessionId`; this provider persists one
 * per webhook URL in localStorage so context survives reloads, and `reset()`
 * starts a fresh session. For Basic Auth on the trigger, pass an
 * `Authorization` header via `config.headers`; `config.apiKey` is sent as a
 * Bearer token for header-auth setups.
 */
export class N8nProvider implements ChatProvider {
	readonly id = 'n8n';
	readonly label: string;

	private readonly webhookUrl?: string;
	private readonly apiKey?: string;
	private readonly headers: Record<string, string>;
	private readonly sessionKey: string;
	private sessionId: string | null = null;

	constructor(config: ProviderConfig) {
		this.label = config.label ?? 'n8n';
		this.webhookUrl = config.baseUrl?.replace(/\/+$/, '');
		this.apiKey = config.apiKey;
		this.headers = config.headers ?? {};
		this.sessionKey = `${SESSION_KEY_PREFIX}${this.webhookUrl ?? 'unconfigured'}`;
		this.sessionId = readStorage(this.sessionKey);
	}

	reset(): void {
		this.sessionId = null;
		removeStorage(this.sessionKey);
	}

	async *sendMessage(
		messages: ChatMessage[],
		options: SendMessageOptions = {}
	): AsyncGenerator<string, void, unknown> {
		if (!this.webhookUrl) {
			throw new ChatProviderError(
				this.id,
				'No webhook URL configured. Set baseUrl to your n8n chat webhook URL (e.g. https://your-n8n.example.com/webhook/<id>/chat).'
			);
		}

		let chatInput = '';
		for (let i = messages.length - 1; i >= 0; i -= 1) {
			const message = messages[i];
			if (message && message.role === 'user') {
				chatInput = message.content;
				break;
			}
		}
		if (!chatInput) {
			throw new ChatProviderError(this.id, 'No user message to send.');
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...this.headers
		};
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

		if (!this.sessionId) {
			this.sessionId = generateId();
			writeStorage(this.sessionKey, this.sessionId);
		}

		const response = await providerFetch(this.id, this.webhookUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				action: 'sendMessage',
				sessionId: this.sessionId,
				chatInput
			}),
			signal: options.signal
		});

		const contentType = response.headers.get('content-type') ?? '';
		if (contentType.includes('application/json') && !contentType.includes('json-lines')) {
			// "When Last Node Finishes" mode: one JSON body. A misconfigured
			// server may label NDJSON this way, so fall back to line parsing.
			const bodyText = await response.text();
			try {
				const reply = extractReply(JSON.parse(bodyText) as N8nResponse);
				if (reply) yield reply;
				return;
			} catch {
				yield* this.parseChunks(lines(bodyText));
				return;
			}
		}

		yield* this.parseChunks(lineStream(response));
	}

	// Newline-delimited JSON per the official @n8n/chat client: "item" chunks
	// carry text, "error" chunks abort, unparseable lines pass through as
	// plain text. "begin"/"end" chunks are structural and skipped.
	private async *parseChunks(
		source: AsyncGenerator<string> | Generator<string>
	): AsyncGenerator<string, void, unknown> {
		for await (const line of source) {
			if (!line.trim()) continue;
			let chunk: StructuredChunk;
			try {
				chunk = JSON.parse(line) as StructuredChunk;
			} catch {
				yield line;
				continue;
			}
			if (chunk.type === 'error') {
				throw new ChatProviderError(
					this.id,
					typeof chunk.content === 'string' && chunk.content
						? chunk.content
						: 'The n8n workflow reported an error.'
				);
			}
			if (chunk.type === 'item' && typeof chunk.content === 'string' && chunk.content) {
				yield chunk.content;
			}
		}
	}
}

function* lines(text: string): Generator<string> {
	for (const line of text.split('\n')) {
		yield line.endsWith('\r') ? line.slice(0, -1) : line;
	}
}
