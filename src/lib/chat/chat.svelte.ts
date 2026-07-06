import type { ChatMessage, ChatProvider, SendMessageOptions } from './types.js';
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

	/** Appends a user message and streams the assistant reply. No-op if busy or text is blank. */
	async send(text: string): Promise<void> {
		const content = text.trim();
		if (this.busy || content === '') return;

		this.error = null;
		const controller = new AbortController();
		this.#controller = controller;

		const assistantId = generateId();
		this.messages.push(
			{ id: generateId(), role: 'user', content, createdAt: Date.now() },
			{ id: assistantId, role: 'assistant', content: '', createdAt: Date.now() }
		);
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
			history.push({
				id: message.id,
				role: message.role,
				content: message.content,
				createdAt: message.createdAt
			});
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
				this.#commit();
			}
			aborted = controller.signal.aborted;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				aborted = true;
			} else {
				failed = true;
				const message = error instanceof Error ? error.message : String(error);
				assistant.error = message;
				this.error = message;
			}
		}

		if (aborted && assistant.content === '') {
			const index = this.messages.findIndex((message) => message.id === assistantId);
			if (index !== -1) this.messages.splice(index, 1);
		}

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
		if (this.#storageKey) saveMessages(this.#storageKey, this.messages);
		this.#onUpdate?.(this.messages);
	}
}
