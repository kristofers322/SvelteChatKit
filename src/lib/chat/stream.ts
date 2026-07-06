import { ChatProviderError } from './types.js';

/**
 * Yields raw decoded text chunks from a streaming response body.
 * Releases the reader lock when the stream ends or the consumer breaks early.
 */
export async function* textStream(response: Response): AsyncGenerator<string> {
	const body = response.body;
	if (!body) return;
	const reader = body.getReader();
	const decoder = new TextDecoder();
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			const chunk = decoder.decode(value, { stream: true });
			if (chunk) yield chunk;
		}
		const tail = decoder.decode();
		if (tail) yield tail;
	} finally {
		try {
			await reader.cancel();
		} catch {
			// The stream may already be closed or errored; nothing to do.
		}
		reader.releaseLock();
	}
}

/**
 * Yields complete lines (NDJSON-friendly), buffering partial lines across
 * chunks. Handles both `\n` and `\r\n` terminators; a trailing unterminated
 * line is yielded when the stream ends.
 */
export async function* lineStream(response: Response): AsyncGenerator<string> {
	let buffer = '';
	for await (const chunk of textStream(response)) {
		buffer += chunk;
		let newline: number;
		while ((newline = buffer.indexOf('\n')) !== -1) {
			let line = buffer.slice(0, newline);
			buffer = buffer.slice(newline + 1);
			if (line.endsWith('\r')) line = line.slice(0, -1);
			yield line;
		}
	}
	if (buffer.length > 0) {
		yield buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
	}
}

/**
 * Yields the payload of each Server-Sent Event `data:` field verbatim
 * (whitespace preserved — raw-text token streams carry significant spaces),
 * skipping comments and events without data. Multi-line `data:` fields are
 * joined with newlines, and events split across network chunks are
 * reassembled correctly.
 */
export async function* sseStream(response: Response): AsyncGenerator<string> {
	let dataLines: string[] = [];

	const flush = (): string | null => {
		if (dataLines.length === 0) return null;
		const payload = dataLines.join('\n');
		dataLines = [];
		return payload;
	};

	for await (const line of lineStream(response)) {
		if (line === '') {
			const payload = flush();
			if (payload !== null) yield payload;
			continue;
		}
		if (line.startsWith(':')) continue;
		if (line.startsWith('data:')) {
			let value = line.slice(5);
			if (value.startsWith(' ')) value = value.slice(1);
			dataLines.push(value);
		}
		// Other SSE fields (event:, id:, retry:) are intentionally ignored.
	}

	const payload = flush();
	if (payload !== null) yield payload;
}

/**
 * Throws a ChatProviderError with an actionable message when the response is
 * not OK, attempting to extract an error message from the response body.
 */
export async function ensureOk(response: Response, provider: string): Promise<void> {
	if (response.ok) return;

	const status = response.status;
	let detail = '';
	try {
		const text = await response.text();
		if (text) {
			try {
				const parsed: unknown = JSON.parse(text);
				const record = parsed as Record<string, unknown> | null;
				const nested = record?.error as Record<string, unknown> | string | undefined;
				const candidate =
					(typeof nested === 'object' && nested !== null ? nested.message : nested) ??
					record?.message ??
					record?.detail;
				detail = typeof candidate === 'string' ? candidate : text;
			} catch {
				detail = text;
			}
		}
	} catch {
		// Body already consumed or unreadable; the status line is enough.
	}

	const parts = [`HTTP ${status}${response.statusText ? ` ${response.statusText}` : ''}`];
	const hint = statusHint(status);
	if (hint) parts.push(hint);
	if (detail) parts.push(detail.slice(0, 300).trim());
	throw new ChatProviderError(provider, parts.join(' — '), status);
}

function statusHint(status: number): string {
	if (status === 401) return 'check your API key';
	if (status === 403) return 'your key does not have access to this resource';
	if (status === 404) return 'check the base URL and endpoint path';
	if (status === 429) return 'rate limited, wait a moment and try again';
	if (status >= 500) return 'the server had an internal error, try again';
	return '';
}

/**
 * @internal Fetch wrapper shared by the built-in providers: maps network
 * failures to ChatProviderError with an actionable message, lets AbortError
 * pass through unwrapped, and validates the response with ensureOk.
 */
export async function providerFetch(
	provider: string,
	url: string,
	init: RequestInit
): Promise<Response> {
	let response: Response;
	try {
		response = await fetch(url, init);
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') throw error;
		const detail = error instanceof Error ? error.message : String(error);
		throw new ChatProviderError(
			provider,
			`Could not reach ${url} (${detail}). Check the base URL, that the server is running, and CORS settings.`
		);
	}
	await ensureOk(response, provider);
	return response;
}
