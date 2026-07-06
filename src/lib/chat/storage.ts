import type { ChatMessage, ChatRole } from './types.js';

const ROLES: readonly ChatRole[] = ['system', 'user', 'assistant'];

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
		if (!Array.isArray(parsed) || !parsed.every(isChatMessage)) {
			throw new Error('invalid history shape');
		}
		return parsed;
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
 * Persists messages to localStorage. No-ops on the server and swallows
 * storage failures (private mode, quota exceeded).
 */
export function saveMessages(key: string, messages: ChatMessage[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(messages));
	} catch {
		// Quota exceeded or storage unavailable; persistence is best-effort.
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
