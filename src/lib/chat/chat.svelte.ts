import type { ChatAttachment, ChatMessage, ChatProvider, SendMessageOptions } from './types.js';
import { generateId } from './types.js';
import { clearMessages, loadMessages, saveMessages } from './storage.js';

export type ChatStatus = 'idle' | 'streaming' | 'error';

export interface ChatOptions {
	/** localStorage key; null disables persistence. Default null. */
	storageKey?: string | null;
	systemPrompt?: string;
	model?: string;
	/** Called after every mutation of messages (post-persist). */
	onUpdate?: (messages: ChatMessage[]) => void;
}

/**
 * Reactive chat session state (Svelte 5 runes). Owns the message history,
 * drives the provider stream, and persists to localStorage when configured.
 */
export class Chat {
	messages: ChatMessage[] = $state([]);
	status: ChatStatus = $state('idle');
	/** Last error message, cleared on next send. */
	error: string | null = $state(null);
	provider: ChatProvider = $state()!;

	readonly #isBusy = $derived(this.status === 'streaming');

	#controller: AbortController | null = null;
	#persistTimer: ReturnType<typeof setTimeout> | null = null;
	#persistDegraded = false;
	readonly #storageKey: string | null;
	readonly #systemPrompt?: string;
	readonly #model?: string;
	readonly #onUpdate?: (messages: ChatMessage[]) => void;

	constructor(provider: ChatProvider, options: ChatOptions = {}) {
		this.provider = provider;
		this.#storageKey = options.storageKey ?? null;
		this.#systemPrompt = options.systemPrompt;
		this.#model = options.model;
		this.#onUpdate = options.onUpdate;
		if (this.#storageKey) {
			const stored = loadMessages(this.#storageKey);
			if (stored) this.messages = stored;
		}
	}

	/** True while status === 'streaming'. */
	get busy(): boolean {
		return this.#isBusy;
	}

	/** Appends a user message and streams the assistant reply. No-op if busy, or if text is blank and there are no attachments. */
	async send(text: string, attachments?: ChatAttachment[]): Promise<void> {
		const content = text.trim();
		const attached = attachments && attachments.length > 0 ? [...attachments] : undefined;
		if (this.busy || (content === '' && !attached)) return;

		this.error = null;
		const controller = new AbortController();
		this.#controller = controller;

		const assistantId = generateId();
		const userMessage: ChatMessage = {
			id: generateId(),
			role: 'user',
			content,
			createdAt: Date.now()
		};
		if (attached) userMessage.attachments = attached;
		this.messages.push(userMessage, {
			id: assistantId,
			role: 'assistant',
			content: '',
			createdAt: Date.now()
		});
		this.status = 'streaming';
		this.#commit();

		const history: ChatMessage[] = [];
		if (this.#systemPrompt) {
			history.push({
				id: generateId(),
				role: 'system',
				content: this.#systemPrompt,
				createdAt: Date.now()
			});
		}
		for (const message of this.messages) {
			if (message.error || message.id === assistantId) continue;
			const messageAttachments = message.attachments;
			const hasAttachments = messageAttachments !== undefined && messageAttachments.length > 0;
			if (message.content === '' && !hasAttachments) continue;
			const entry: ChatMessage = {
				id: message.id,
				role: message.role,
				content: message.content,
				createdAt: message.createdAt
			};
			if (hasAttachments) entry.attachments = messageAttachments;
			history.push(entry);
		}

		const assistant = this.messages[this.messages.length - 1] as ChatMessage;
		const options: SendMessageOptions = { signal: controller.signal };
		if (this.#model) options.model = this.#model;

		let aborted = false;
		let failed = false;
		try {
			for await (const chunk of this.provider.sendMessage(history, options)) {
				if (chunk === '') continue;
				assistant.content += chunk;
				this.#schedulePersist();
				this.#onUpdate?.(this.messages);
			}
			aborted = controller.signal.aborted;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				aborted = true;
			} else {
				failed = true;
				assistant.error = error instanceof Error ? error.message : String(error);
			}
		}

		// clear() or a newer send() owns the session state now; this run must
		// not touch status, error, the controller, or storage.
		if (this.#controller !== controller) return;

		if (assistant.content === '') {
			if (aborted) {
				const index = this.messages.findIndex((message) => message.id === assistantId);
				if (index !== -1) this.messages.splice(index, 1);
			} else if (!failed) {
				failed = true;
				assistant.error = 'The provider returned an empty response.';
			}
		}
		if (failed) this.error = assistant.error ?? null;

		this.status = failed ? 'error' : 'idle';
		this.#controller = null;
		this.#commit();
	}

	/** Aborts the in-flight stream; partial assistant text is kept. */
	stop(): void {
		this.#controller?.abort();
	}

	/** Clears the history, persisted storage, and provider-side state. */
	clear(): void {
		this.#controller?.abort();
		this.#controller = null;
		this.#cancelScheduledPersist();
		this.#persistDegraded = false;
		this.messages = [];
		this.status = 'idle';
		this.error = null;
		if (this.#storageKey) clearMessages(this.#storageKey);
		this.provider.reset?.();
		this.#onUpdate?.(this.messages);
	}

	/** Switches the provider mid-session, keeping the history. */
	setProvider(provider: ChatProvider): void {
		this.provider = provider;
	}

	#commit(): void {
		this.#cancelScheduledPersist();
		if (this.#storageKey) this.#persist(this.#storageKey);
		this.#onUpdate?.(this.messages);
	}

	#persist(key: string): void {
		const ok = saveMessages(key, this.messages);
		if (!ok && !this.#persistDegraded) {
			console.warn(
				'sveltechatkit: history no longer fits localStorage; attachment data was dropped from the persisted copy.'
			);
		}
		this.#persistDegraded = !ok;
	}

	// Persisting the full history on every streamed chunk is O(history) of
	// synchronous work per token; a trailing throttle keeps crash-resilience
	// without competing with rendering. Terminal states persist immediately.
	// Once a save has degraded (quota), streaming persists pause until a
	// terminal commit succeeds again, to avoid re-serializing megabytes of
	// attachment data every tick for nothing.
	#schedulePersist(): void {
		const key = this.#storageKey;
		if (!key || this.#persistDegraded || this.#persistTimer !== null) return;
		this.#persistTimer = setTimeout(() => {
			this.#persistTimer = null;
			this.#persist(key);
		}, 250);
	}

	#cancelScheduledPersist(): void {
		if (this.#persistTimer !== null) {
			clearTimeout(this.#persistTimer);
			this.#persistTimer = null;
		}
	}
}
