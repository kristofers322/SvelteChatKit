# Adding a provider

This guide walks through adding a new backend to SvelteChatKit from scratch. As the worked example we'll build an **Anthropic** provider that streams from the Claude Messages API — it exercises everything a real provider needs: auth headers, request shaping, SSE parsing, abort handling, and error mapping.

The kit never needs to be modified. You implement one interface, register a factory, and the provider shows up everywhere — including the demo app's provider dropdown.

## 1. The contract

Every backend implements `ChatProvider` from `src/lib/chat/types.ts`:

```ts
export interface ChatProvider {
	/** Registry id, e.g. "openai". */
	readonly id: string;
	/** Human-readable name, e.g. "OpenAI-compatible". */
	readonly label: string;
	sendMessage(
		messages: ChatMessage[],
		options?: SendMessageOptions
	): AsyncGenerator<string, void, unknown>;
	/** Clear provider-side conversation state (e.g. Dify's conversation id). */
	reset?(): void;
}
```

The rules:

- `sendMessage` receives the **full history** (including a leading `system` message when the app configured one) and yields the assistant reply as text chunks.
- Honor `options.signal` — pass it to `fetch` so the stop button can abort mid-stream. Let the resulting `AbortError` propagate unwrapped; the `Chat` class treats it as a clean stop, not an error.
- Map HTTP and protocol failures to `ChatProviderError` with a message a user can act on.
- `reset()` is optional — implement it only if your backend keeps server-side conversation state. Anthropic's Messages API is stateless, so we skip it.

The transport helpers in `src/lib/chat/stream.ts` do the heavy lifting: `sseStream` yields each SSE `data:` payload (handling multi-line fields and events split across network chunks), `lineStream` yields NDJSON lines, `textStream` yields raw text, and `ensureOk` throws a `ChatProviderError` with the response body when the status isn't 2xx.

## 2. Implement the provider

Create `src/lib/chat/providers/anthropic.ts`.

Two Anthropic-specific details to handle:

1. The Messages API takes the system prompt as a top-level `system` field, not as a message — so we split it out of the history.
2. The stream is SSE where every `data:` payload is JSON with a `type` field. Text arrives on `content_block_delta` events whose `delta.type` is `text_delta`; the stream ends with `message_stop`.

```ts
import type { ChatMessage, ChatProvider, ProviderConfig, SendMessageOptions } from '../types.js';
import { ChatProviderError } from '../types.js';
import { ensureOk, sseStream } from '../stream.js';

interface AnthropicStreamEvent {
	type: string;
	delta?: { type?: string; text?: string };
	error?: { type?: string; message?: string };
}

/**
 * Streams chat completions from the Anthropic Messages API.
 * Stateless — no reset() needed.
 */
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

		const response = await fetch(`${baseUrl}/messages`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': this.#config.apiKey ?? '',
				'anthropic-version': '2023-06-01',
				// Anthropic rejects browser-origin requests unless you opt in.
				// Acceptable for local development; use a server proxy in production.
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

What this gets right, and every provider should copy:

- **Abort:** `signal: options?.signal` is all it takes — an aborted `fetch`/read throws an `AbortError` that we deliberately don't catch.
- **Errors:** `ensureOk` turns a 401 into a thrown `ChatProviderError` whose message includes the body Anthropic sent back ("invalid x-api-key" etc.), which surfaces in the UI's error banner.
- **Reader cleanup:** `sseStream` releases the underlying reader lock even if the consumer breaks early, so stopping mid-stream never leaks a locked body.
- **No key leakage:** the API key is only ever written into the request header — never logged, never included in error messages.

## 3. Register it

Registration binds a config `id` to a factory. Do it once at module scope, anywhere that runs before the provider is first created:

```ts
import { registerProvider } from '$lib';
import { AnthropicProvider } from '$lib/chat/providers/anthropic.js';

registerProvider('anthropic', (config) => new AnthropicProvider(config));
```

From this point on `createProvider({ id: 'anthropic', ... })` works, and `getRegisteredProviders()` includes `{ id: 'anthropic', label: 'Anthropic' }`.

## 4. Use it in an app

Either construct it directly:

```ts
import { Chat, createProvider } from '$lib';

const provider = createProvider({
	id: 'anthropic',
	apiKey: 'sk-ant-...',
	model: 'claude-opus-4-8'
});

const chat = new Chat(provider, { storageKey: 'my-app:chat-history' });
```

Or fold it into a kit config so it lives alongside the built-ins:

```ts
import { defineChatKitConfig } from '$lib';

export const config = defineChatKitConfig({
	defaultProvider: 'anthropic',
	providers: {
		anthropic: {
			id: 'anthropic',
			baseUrl: 'https://api.anthropic.com/v1',
			apiKey: import.meta.env?.PUBLIC_ANTHROPIC_API_KEY ?? '',
			model: 'claude-opus-4-8'
		}
	}
});
```

`defineChatKitConfig` merges over the defaults, so the other providers stay available.

## 5. Wire it into the demo

The demo page (`src/routes/+page.svelte`) builds its provider dropdown from `getRegisteredProviders()`, so a registered provider appears automatically. Add the registration snippet from step 3 to the top of the demo page's `<script>` block (or any module it imports), restart `npm run dev`, and:

1. Pick **Anthropic** in the provider dropdown.
2. Open **Connection settings** and paste your API key (it stays in your browser and is never persisted).
3. Set the model if you want something other than the default.
4. Send a message — you should see the reply stream in token by token, and the stop button should cut it off instantly.

## 6. Test the edges

Before opening a PR, verify the unhappy paths:

- **Bad key** → the error banner shows a `401`-flavored message, and the failed assistant message is marked with an error state.
- **Stop mid-stream** → partial text is kept, status returns to idle, no error shown.
- **Network down** → a `ChatProviderError` with a readable message, not an unhandled rejection.
- **Reload** → history persists (when a `storageKey` is set) and no duplicate messages appear.

## Production note

Calling Anthropic (or any keyed API) straight from the browser exposes the key to every visitor. For production, put a ~20-line proxy route on your server that injects the key — Anthropic's official SDK works well there — and point SvelteChatKit's built-in **custom endpoint** provider (`id: 'custom'`) at it. The streaming UI works identically either way.
