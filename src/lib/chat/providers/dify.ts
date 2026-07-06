import type { ChatMessage, ChatProvider, ProviderConfig, SendMessageOptions } from '../types.js';
import { ChatProviderError, generateId } from '../types.js';
import { providerFetch, sseStream } from '../stream.js';

const DIFY_USER_KEY = 'sveltechatkit:dify-user';

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
 * conversation id as instance state; `reset()` starts a new conversation.
 */
export class DifyProvider implements ChatProvider {
	readonly id = 'dify';
	readonly label: string;

	private readonly baseUrl: string;
	private readonly apiKey?: string;
	private readonly headers: Record<string, string>;
	private conversationId: string | null = null;
	private anonUser: string | null = null;

	constructor(config: ProviderConfig) {
		this.label = config.label ?? 'Dify';
		this.baseUrl = (config.baseUrl ?? 'https://api.dify.ai/v1').replace(/\/+$/, '');
		this.apiKey = config.apiKey;
		this.headers = config.headers ?? {};
	}

	reset(): void {
		this.conversationId = null;
	}

	async *sendMessage(
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
				this.conversationId = event.conversation_id;
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
