import type {
	ChatAttachment,
	ChatMessage,
	ChatProvider,
	ProviderConfig,
	SendMessageOptions
} from '../types.js';
import { ChatProviderError, generateId } from '../types.js';
import { attachmentToBlob } from '../attachments.js';
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

interface DifyFile {
	type: 'image' | 'audio' | 'video' | 'document';
	transfer_method: 'local_file';
	upload_file_id: string;
}

// Dify validates the uploaded file against the declared type category.
function difyFileType(mimeType: string): DifyFile['type'] {
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType.startsWith('audio/')) return 'audio';
	if (mimeType.startsWith('video/')) return 'video';
	return 'document';
}

function latestUserMessage(messages: ChatMessage[]): ChatMessage | null {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const message = messages[i];
		if (message && message.role === 'user') return message;
	}
	return null;
}

/**
 * Streams answers from a Dify chat app (`/chat-messages`). Dify is
 * conversation-based rather than messages-array-based, so this provider
 * sends only the latest user message as the query and keeps Dify's
 * conversation id; `reset()` starts a new conversation. The conversation id
 * is persisted to localStorage (keyed by base URL and a key hint) so the
 * conversation survives page reloads and provider re-instantiation, in step
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
		// Uploads run once, OUTSIDE the retried stream() call: a 404 from the
		// upload endpoint must not trigger the stale-conversation reset below,
		// and the retry must not upload the same files twice.
		const files = await this.uploadAttachments(messages, options.signal);
		try {
			yield* this.stream(messages, files, options);
		} catch (error) {
			// A persisted conversation id can go stale (deleted app-side);
			// Dify answers 404 on /chat-messages. Start a fresh conversation
			// and retry once, safe because nothing was yielded before the 404.
			if (
				error instanceof ChatProviderError &&
				error.status === 404 &&
				this.conversationId !== null
			) {
				this.reset();
				yield* this.stream(messages, files, options);
				return;
			}
			throw error;
		}
	}

	// Only the latest user message's attachments are uploaded: Dify is
	// conversation-based, so older attachments were sent in earlier turns.
	private async uploadAttachments(
		messages: ChatMessage[],
		signal?: AbortSignal
	): Promise<DifyFile[]> {
		const attachments = latestUserMessage(messages)?.attachments ?? [];
		if (attachments.length === 0) return [];
		const user = this.getUserId();
		const files: DifyFile[] = [];
		for (const attachment of attachments) {
			files.push({
				type: difyFileType(attachment.mimeType),
				transfer_method: 'local_file',
				upload_file_id: await this.uploadAttachment(attachment, user, signal)
			});
		}
		return files;
	}

	private async *stream(
		messages: ChatMessage[],
		files: DifyFile[],
		options: SendMessageOptions = {}
	): AsyncGenerator<string, void, unknown> {
		let query = latestUserMessage(messages)?.content ?? '';
		if (!query && files.length === 0) {
			throw new ChatProviderError(this.id, 'No user message to send.');
		}
		// Recent Dify versions reject an empty query even when files are sent.
		if (!query) query = 'See the attached file(s).';

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...this.headers
		};
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

		const body: Record<string, unknown> = {
			inputs: {},
			query,
			response_mode: 'streaming',
			conversation_id: this.conversationId ?? '',
			user: this.getUserId()
		};
		if (files.length > 0) body['files'] = files;

		const response = await providerFetch(this.id, `${this.baseUrl}/chat-messages`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
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

	// Dify wants files uploaded ahead of the chat call; the returned file id is
	// then referenced from the chat-messages body. No Content-Type header here:
	// the browser sets the multipart boundary itself.
	private async uploadAttachment(
		attachment: ChatAttachment,
		user: string,
		signal?: AbortSignal
	): Promise<string> {
		const headers: Record<string, string> = {};
		if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

		const formData = new FormData();
		formData.append('file', attachmentToBlob(attachment), attachment.name);
		formData.append('user', user);

		let response: Response;
		try {
			response = await providerFetch(this.id, `${this.baseUrl}/files/upload`, {
				method: 'POST',
				headers,
				body: formData,
				signal
			});
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') throw error;
			const detail = error instanceof Error ? error.message : String(error);
			const status = error instanceof ChatProviderError ? error.status : undefined;
			throw new ChatProviderError(
				this.id,
				`Uploading "${attachment.name}" failed: ${detail}`,
				status
			);
		}

		let uploadId: unknown;
		try {
			uploadId = ((await response.json()) as { id?: unknown }).id;
		} catch {
			uploadId = undefined;
		}
		if (typeof uploadId !== 'string' || uploadId === '') {
			throw new ChatProviderError(
				this.id,
				`Uploading "${attachment.name}" failed: the server did not return a file id.`
			);
		}
		return uploadId;
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
