import type { ChatMessage, ChatProvider, ProviderConfig, SendMessageOptions } from '../types.js';
import { ChatProviderError, generateId } from '../types.js';
import { providerFetch, sseStream } from '../stream.js';

const DIFY_USER_KEY = 'sveltechatkit:dify-user';

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
		// Storage unavailable; the conversation id stays in-memory only.
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

interface DifyEvent {
	event?: unknown;
	answer?: unknown;
	conversation_id?: unknown;
	message?: unknown;
	status?: unknown;
}

/**
 * Streams answers from a Dify chat app (`/chat-messages`). Dify is
 * conversation-based rather than messages-array-based, so this provider
 * sends only the latest user message as the query and keeps Dify's
 * conversation id; `reset()` starts a new conversation. The conversation id
 * is persisted to localStorage (keyed by base URL and a key hint) so the
 * conversation survives page reloads and provider re-instantiation — in step
 * with the kit's persisted message history.
 */
export class DifyProvider implements ChatProvider {
	readonly id = 'dify';
	readonly label: string;

	private readonly baseUrl: string;
	private readonly apiKey?: string;
	private readonly headers: Record<string, string>;
	private readonly conversationKey: string;
	private conversationId: string | null = null;
	private anonUser: string | null = null;

	constructor(config: ProviderConfig) {
		this.label = config.label ?? 'Dify';
		this.baseUrl = (config.baseUrl ?? 'https://api.dify.ai/v1').replace(/\/+$/, '');
		this.apiKey = config.apiKey;
		this.headers = config.headers ?? {};
		this.conversationKey = `sveltechatkit:dify-conversation:${this.baseUrl}:${
			this.apiKey ? this.apiKey.slice(-4) : 'anon'
		}`;
		this.conversationId = readStorage(this.conversationKey);
	}

	reset(): void {
		this.conversationId = null;
		removeStorage(this.conversationKey);
	}

	async *sendMessage(
		messages: ChatMessage[],
		options: SendMessageOptions = {}
	): AsyncGenerator<string, void, unknown> {
		try {
			yield* this.stream(messages, options);
		} catch (error) {
			// A persisted conversation id can go stale (deleted app-side);
			// Dify answers 404. Start a fresh conversation and retry once —
			// safe because the 404 arrives before anything is yielded.
			if (
				error instanceof ChatProviderError &&
				error.status === 404 &&
				this.conversationId !== null
			) {
				this.reset();
				yield* this.stream(messages, options);
				return;
			}
			throw error;
		}
	}

	private async *stream(
		messages: ChatMessage[],
		options: SendMessageOptions = {}
	): AsyncGenerator<string, void, unknown> {
		let query = '';
		for (let i = messages.length - 1; i >= 0; i -= 1) {
			const message = messages[i];
			if (message && message.role === 'user') {
				query = message.content;
				break;
			}
		}
		if (!query) {
			throw new ChatProviderError(this.id, 'No user message to send.');
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...this.headers
		};
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

		const response = await providerFetch(this.id, `${this.baseUrl}/chat-messages`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				inputs: {},
				query,
				response_mode: 'streaming',
				conversation_id: this.conversationId ?? '',
				user: this.getUserId()
			}),
			signal: options.signal
		});

		for await (const payload of sseStream(response)) {
			let event: DifyEvent;
			try {
				event = JSON.parse(payload) as DifyEvent;
			} catch {
				continue;
			}
			if (typeof event.conversation_id === 'string' && event.conversation_id) {
				if (this.conversationId !== event.conversation_id) {
					this.conversationId = event.conversation_id;
					writeStorage(this.conversationKey, event.conversation_id);
				}
			}
			if (event.event === 'error') {
				const detail =
					typeof event.message === 'string' && event.message
						? event.message
						: 'Dify returned an error event.';
				const status = typeof event.status === 'number' ? event.status : undefined;
				throw new ChatProviderError(this.id, detail, status);
			}
			if (event.event === 'message' || event.event === 'agent_message') {
				if (typeof event.answer === 'string' && event.answer.length > 0) {
					yield event.answer;
				}
			}
		}
	}

	private getUserId(): string {
		if (this.anonUser) return this.anonUser;
		if (typeof localStorage !== 'undefined') {
			try {
				const existing = localStorage.getItem(DIFY_USER_KEY);
				if (existing) {
					this.anonUser = existing;
					return existing;
				}
				const created = generateId();
				localStorage.setItem(DIFY_USER_KEY, created);
				this.anonUser = created;
				return created;
			} catch {
				// Storage unavailable; fall back to a per-instance id.
			}
		}
		this.anonUser = generateId();
		return this.anonUser;
	}
}
