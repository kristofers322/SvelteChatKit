import type { ChatAttachment, ChatMessage, ChatRole } from './types.js';

const ROLES: readonly ChatRole[] = ['system', 'user', 'assistant'];

function isChatAttachment(value: unknown): value is ChatAttachment {
	if (typeof value !== 'object' || value === null) return false;
	const attachment = value as Record<string, unknown>;
	return (
		typeof attachment.id === 'string' &&
		typeof attachment.name === 'string' &&
		typeof attachment.mimeType === 'string' &&
		typeof attachment.size === 'number' &&
		typeof attachment.dataUrl === 'string' &&
		// '' marks an attachment whose data was dropped to fit the quota.
		(attachment.dataUrl === '' || attachment.dataUrl.startsWith('data:'))
	);
}

function isChatMessage(value: unknown): value is ChatMessage {
	if (typeof value !== 'object' || value === null) return false;
	const message = value as Record<string, unknown>;
	return (
		typeof message.id === 'string' &&
		typeof message.content === 'string' &&
		typeof message.createdAt === 'number' &&
		ROLES.includes(message.role as ChatRole)
	);
}

// A malformed attachments array (poisoned or truncated storage) drops just
// the attachments, not the whole history.
function sanitizeMessage(value: unknown): ChatMessage | null {
	if (!isChatMessage(value)) return null;
	if (value.attachments === undefined) return value;
	if (Array.isArray(value.attachments) && value.attachments.every(isChatAttachment)) return value;
	return { ...value, attachments: undefined };
}

/**
 * Loads persisted messages from localStorage. Returns null on the server,
 * when nothing is stored, or when the stored value is corrupt (in which case
 * the key is removed).
 */
export function loadMessages(key: string): ChatMessage[] | null {
	if (typeof localStorage === 'undefined') return null;
	let raw: string | null;
	try {
		raw = localStorage.getItem(key);
	} catch {
		return null;
	}
	if (raw === null) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) throw new Error('invalid history shape');
		const messages = parsed.map(sanitizeMessage);
		if (messages.some((message) => message === null)) throw new Error('invalid history shape');
		return messages as ChatMessage[];
	} catch {
		try {
			localStorage.removeItem(key);
		} catch {
			// Storage unavailable; nothing else to clean up.
		}
		return null;
	}
}

/**
 * Persists messages to localStorage. No-ops on the server. When the write
 * does not fit the storage quota, it retries once with attachment data
 * stripped (name, type and size are kept so the UI can still show chips)
 * and returns false to signal the degradation.
 */
export function saveMessages(key: string, messages: ChatMessage[]): boolean {
	if (typeof localStorage === 'undefined') return true;
	try {
		localStorage.setItem(key, JSON.stringify(messages));
		return true;
	} catch {
		try {
			const slimmed = messages.map((message) =>
				message.attachments && message.attachments.length > 0
					? {
							...message,
							attachments: message.attachments.map((attachment) => ({
								...attachment,
								dataUrl: ''
							}))
						}
					: message
			);
			localStorage.setItem(key, JSON.stringify(slimmed));
		} catch {
			// Still over quota or storage unavailable; persistence is best-effort.
		}
		return false;
	}
}

/**
 * Removes persisted messages. No-ops on the server.
 */
export function clearMessages(key: string): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(key);
	} catch {
		// Storage unavailable; nothing to remove.
	}
}
