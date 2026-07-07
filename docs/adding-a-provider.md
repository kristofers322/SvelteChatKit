# Adding a provider

You implement one interface, register a factory, and the provider shows up everywhere, including the demo's dropdown. No kit code changes. As the worked example we'll build an **Anthropic** provider, because it touches everything real: auth headers, SSE parsing, abort, error mapping.

## 1. The contract

```ts
export interface ChatProvider {
	readonly id: string; // registry id, e.g. "openai"
	readonly label: string; // shown in UIs, e.g. "OpenAI-compatible"
	sendMessage(
		messages: ChatMessage[],
		options?: SendMessageOptions
	): AsyncGenerator<string, void, unknown>;
	reset?(): void; // only if your backend keeps server-side conversation state
}
```

Rules:

- `sendMessage` gets the full history (with a leading `system` message if configured) and yields the reply as text chunks.
- Pass `options.signal` to `fetch` and let `AbortError` propagate unwrapped. That's the stop button.
- Throw `ChatProviderError` with a message a user can act on; don't swallow failures.
- Never log the API key.
- Messages may carry `attachments` (`{ name, mimeType, size, dataUrl }`). Send them if your backend can use them (see the built-ins for patterns: vision parts, multipart uploads, plain passthrough). Ignoring them is fine for text-only backends.

Helpers in `stream.ts` do the boring parts: `sseStream` (SSE payloads, handles chunk splits), `lineStream` (NDJSON), `textStream` (raw text), `ensureOk` (throws a readable `ChatProviderError` on non-2xx).

## 2. The provider

Create `src/lib/chat/providers/anthropic.ts`. (Building inside your own app instead? Import everything from `'sveltechatkit'` rather than the relative paths.)

Anthropic specifics: the system prompt goes in a top-level `system` field, and text arrives on `content_block_delta` SSE events until `message_stop`.

```ts
import type { ChatMessage, ChatProvider, ProviderConfig, SendMessageOptions } from '../types.js';
import { ChatProviderError } from '../types.js';
import { ensureOk, sseStream } from '../stream.js';

interface AnthropicStreamEvent {
	type: string;
	delta?: { type?: string; text?: string };
	error?: { type?: string; message?: string };
}

export class AnthropicProvider implements ChatProvider {
	readonly id = 'anthropic';
	readonly label = 'Anthropic';

	#config: ProviderConfig;

	constructor(config: ProviderConfig) {
		this.#config = config;
	}

	async *sendMessage(
		messages: ChatMessage[],
		options?: SendMessageOptions
	): AsyncGenerator<string, void, unknown> {
		const baseUrl = this.#config.baseUrl ?? 'https://api.anthropic.com/v1';
		const system = messages.find((m) => m.role === 'system')?.content;
		const turns = messages
			.filter((m) => m.role !== 'system')
			.map((m) => ({ role: m.role, content: m.content }));

		let response: Response;
		try {
			response = await fetch(`${baseUrl}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': this.#config.apiKey ?? '',
					'anthropic-version': '2023-06-01',
					// Anthropic rejects browser-origin requests unless you opt in.
					// Fine for local dev; use a server proxy in production.
					'anthropic-dangerous-direct-browser-access': 'true',
					...this.#config.headers
				},
				body: JSON.stringify({
					model: options?.model ?? this.#config.model ?? 'claude-opus-4-8',
					max_tokens: options?.maxTokens ?? 4096,
					...(system ? { system } : {}),
					messages: turns,
					stream: true
				}),
				signal: options?.signal
			});
		} catch (error) {
			// Aborts propagate as-is; connection failures become readable errors.
			if (error instanceof Error && error.name === 'AbortError') throw error;
			const detail = error instanceof Error ? error.message : String(error);
			throw new ChatProviderError(
				this.id,
				`Could not reach ${baseUrl} (${detail}). Check the URL and CORS settings.`
			);
		}

		await ensureOk(response, this.id);

		for await (const data of sseStream(response)) {
			let event: AnthropicStreamEvent;
			try {
				event = JSON.parse(data) as AnthropicStreamEvent;
			} catch {
				continue;
			}
			switch (event.type) {
				case 'content_block_delta':
					if (event.delta?.type === 'text_delta' && event.delta.text) {
						yield event.delta.text;
					}
					break;
				case 'message_stop':
					return;
				case 'error':
					throw new ChatProviderError(
						this.id,
						event.error?.message ?? 'Anthropic returned an error event'
					);
			}
		}
	}
}
```

## 3. Register it

Once, at module scope, anywhere that runs before the provider is first created:

```ts
import { registerProvider } from '$lib';
import { AnthropicProvider } from '$lib/chat/providers/anthropic.js';

registerProvider('anthropic', (config) => new AnthropicProvider(config));
```

Now `createProvider({ id: 'anthropic', ... })` works and `getRegisteredProviders()` lists it.

## 4. Use it

```ts
import { Chat, createProvider } from '$lib';

const chat = new Chat(
	createProvider({ id: 'anthropic', apiKey: 'sk-ant-...', model: 'claude-opus-4-8' }),
	{ storageKey: 'my-app:chat-history' }
);
```

Or merge it into the kit config so it lives alongside the built-ins:

```ts
import { defineChatKitConfig } from '$lib';

export const config = defineChatKitConfig({
	defaultProvider: 'anthropic',
	providers: {
		anthropic: {
			id: 'anthropic',
			apiKey: import.meta.env?.PUBLIC_ANTHROPIC_API_KEY ?? '',
			model: 'claude-opus-4-8'
		}
	}
});
```

## 5. Try it in the demo

The demo dropdown builds itself from `getRegisteredProviders()`, so a registered provider just appears. Add the step-3 snippet to the demo page's `<script>`, restart `npm run dev`, pick Anthropic, paste your key under Connection settings, send a message.

## 6. Test the unhappy paths

- Bad key → error banner with a 401-flavored message
- Stop mid-stream → partial text kept, no error shown
- Network down → readable `ChatProviderError`, not an unhandled rejection
- Reload → history persists, no duplicates

## Production note

Calling a keyed API straight from the browser shows the key to every visitor. In production, put a small proxy route on your server that injects the key and point the built-in `custom` provider at it. The UI works exactly the same.
