<div align="center">

# SvelteChatKit

**A universal, provider-agnostic AI chat UI kit for SvelteKit.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-ff3e00.svg)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

SvelteChatKit is a complete, streaming chat interface for SvelteKit 2 and Svelte 5 (runes) that talks to any LLM backend through one small interface. Swap between OpenAI-compatible APIs, Ollama, Dify, or your own endpoint by changing a config object — the UI, state management, markdown rendering, and persistence stay exactly the same. If your chat UI shouldn't be married to one vendor's API shape, this is the kit for you.

## Features

- **Streaming responses** — token-by-token rendering over SSE, NDJSON, or raw text streams, with a stop button that aborts cleanly mid-stream
- **Provider-agnostic** — one `ChatProvider` interface; add a new backend without touching kit code
- **Persistence** — conversation history survives reloads via `localStorage` (opt-in, SSR-safe)
- **Markdown + syntax highlighting** — GFM rendering with highlight.js code blocks, sanitized with DOMPurify
- **Smart auto-scroll** — follows the stream while you're near the bottom, never yanks the view when you scroll up, floating scroll-to-bottom pill
- **Error handling** — typed `ChatProviderError` with actionable messages, dismissable inline error banner, per-message error states
- **Mobile responsive** — usable at 375px, 16px inputs (no iOS zoom), auto-growing textarea
- **Dark mode** — coherent light/dark styling via Tailwind `dark:` variants
- **TypeScript strict** — fully typed public API
- **Zero-config demo mode** — a built-in mock provider streams canned markdown responses with no API key, so `npm run dev` just works

## Supported providers

| Provider          | `id`     | Works with                                                                 | Transport                                        | Config                                                     |
| ----------------- | -------- | -------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| OpenAI-compatible | `openai` | OpenAI, OpenRouter, Groq, LM Studio, vLLM, llama.cpp, Azure-style gateways | SSE (`POST {baseUrl}/chat/completions`)          | `baseUrl`, `apiKey`, `model`                               |
| Ollama            | `ollama` | Local models via Ollama                                                    | NDJSON (`POST {baseUrl}/api/chat`)               | `baseUrl`, `model` — browser use requires `OLLAMA_ORIGINS` |
| Dify              | `dify`   | Dify chat apps (conversation-based)                                        | SSE (`POST {baseUrl}/chat-messages`)             | `baseUrl`, `apiKey`                                        |
| Custom endpoint   | `custom` | Your own backend or server proxy                                           | Auto-detected: SSE, streamed text, or plain body | `baseUrl` (full endpoint URL), `headers`                   |
| Mock              | `mock`   | Demo mode — no network calls                                               | —                                                | none                                                       |

## Quick start

```bash
git clone https://github.com/yourname/sveltechatkit.git
cd sveltechatkit

npm install        # or: pnpm install
cp .env.example .env
npm run dev        # or: pnpm dev
```

Open the printed URL and start chatting — the demo runs on the mock provider out of the box, no keys required. Fill in `.env` to point it at a real backend. Node 20+ required.

## Usage

Create a provider, hand it to a `Chat` instance, and render `ChatWindow`:

```svelte
<script lang="ts">
	import { Chat, ChatWindow, createProvider } from '$lib';

	const provider = createProvider({
		id: 'openai',
		baseUrl: 'https://api.openai.com/v1',
		apiKey: 'sk-...',
		model: 'gpt-4o-mini'
	});

	const chat = new Chat(provider, {
		storageKey: 'my-app:chat-history',
		systemPrompt: 'You are a concise, helpful assistant.'
	});
</script>

<ChatWindow {chat} placeholder="Ask anything…" />
```

`Chat` exposes runes-reactive `messages`, `status`, `error`, and `busy`, plus `send()`, `stop()`, `clear()`, and `setProvider()` — so you can also build a fully custom UI on top of it.

### A custom provider in ~20 lines

Any object implementing `ChatProvider` works. Register it once and it becomes available through the same factory as the built-ins:

```ts
import { ensureOk, registerProvider, sseStream } from '$lib';
import type { ChatMessage, ChatProvider, ProviderConfig, SendMessageOptions } from '$lib';

class MyBackendProvider implements ChatProvider {
	readonly id = 'my-backend';
	readonly label = 'My Backend';

	constructor(private config: ProviderConfig) {}

	async *sendMessage(messages: ChatMessage[], options?: SendMessageOptions) {
		const response = await fetch(`${this.config.baseUrl}/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...this.config.headers },
			body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })) }),
			signal: options?.signal
		});
		await ensureOk(response, this.id);
		for await (const data of sseStream(response)) {
			if (data === '[DONE]') return;
			yield JSON.parse(data).content as string;
		}
	}
}

registerProvider('my-backend', (config) => new MyBackendProvider(config));
```

For a complete walkthrough — including a working Anthropic provider — see [docs/adding-a-provider.md](docs/adding-a-provider.md).

## Configuration

The demo reads `PUBLIC_*` variables from `.env` (see `.env.example`). All are optional; with no `.env` at all the demo runs on the mock provider.

| Variable                  | Default                     | Description                                                                     |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `PUBLIC_DEFAULT_PROVIDER` | `mock`                      | Provider selected on load: `mock` \| `openai` \| `ollama` \| `dify` \| `custom` |
| `PUBLIC_OPENAI_BASE_URL`  | `https://api.openai.com/v1` | Any OpenAI-compatible base URL                                                  |
| `PUBLIC_OPENAI_API_KEY`   | —                           | API key sent as `Authorization: Bearer …`                                       |
| `PUBLIC_OPENAI_MODEL`     | `gpt-4o-mini`               | Default model                                                                   |
| `PUBLIC_DIFY_BASE_URL`    | `https://api.dify.ai/v1`    | Dify API base URL                                                               |
| `PUBLIC_DIFY_API_KEY`     | —                           | Dify app API key                                                                |
| `PUBLIC_OLLAMA_BASE_URL`  | `http://localhost:11434`    | Ollama server URL                                                               |
| `PUBLIC_OLLAMA_MODEL`     | `llama3.1`                  | Default Ollama model                                                            |
| `PUBLIC_CUSTOM_ENDPOINT`  | —                           | Full URL of your own chat endpoint                                              |

> **A note on keys:** `PUBLIC_*` variables are embedded in the client bundle and visible to anyone using your site. They're fine for local development, but in production keep keys server-side: point the [custom endpoint provider](docs/adding-a-provider.md) at a small proxy route that adds the `Authorization` header on the server.

## Screenshots

The demo app running on the built-in mock provider — no API key required.

| Light                                                  | Dark                                                 |
| ------------------------------------------------------ | ---------------------------------------------------- |
| ![SvelteChatKit light mode](docs/screenshot-light.png) | ![SvelteChatKit dark mode](docs/screenshot-dark.png) |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Components                        │
│   ChatWindow ─ MessageList ─ MessageBubble            │
│   ChatInput ─ Markdown ─ TypingIndicator              │
└──────────────────────────┬───────────────────────────┘
                           │ props
                  ┌────────▼─────────┐
                  │   Chat (runes)   │  messages · status · error
                  │ send/stop/clear  │  persistence · abort
                  └────────┬─────────┘
                           │ sendMessage(history, { signal, model })
               ┌───────────▼────────────┐
               │ ChatProvider interface │  AsyncGenerator<string>
               └───────────┬────────────┘
       ┌─────────┬─────────┼──────────┬───────────┐
       ▼         ▼         ▼          ▼           ▼
    OpenAI-   Ollama     Dify      Custom       Mock
    compat.                       endpoint   (no network)
       │         │         │          │
       ▼         ▼         ▼          ▼
      SSE      NDJSON     SSE     SSE / text
              (upstream chat APIs)
```

| Module                        | Purpose                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `src/lib/chat/types.ts`       | Core contracts: `ChatMessage`, `ChatProvider`, `ProviderConfig`, `ChatProviderError` |
| `src/lib/chat/chat.svelte.ts` | `Chat` runes state class: send/stop/clear, streaming loop, persistence               |
| `src/lib/chat/providers/`     | Provider registry (`registerProvider`, `createProvider`) + five built-ins            |
| `src/lib/chat/stream.ts`      | Transport helpers: `sseStream`, `lineStream`, `textStream`, `ensureOk`               |
| `src/lib/chat/config.ts`      | `defineChatKitConfig` + env-driven `defaultConfig`                                   |
| `src/lib/chat/markdown.ts`    | `renderMarkdown`: marked + highlight.js + DOMPurify                                  |
| `src/lib/chat/storage.ts`     | SSR-safe `localStorage` history persistence                                          |
| `src/lib/components/`         | The six UI components                                                                |
| `src/routes/`                 | Demo app (provider switcher, connection settings, chat)                              |

## Roadmap

- [ ] Auth support (session-scoped keys, token refresh hooks)
- [ ] Vector DB / RAG integration helpers
- [ ] Plugin system (message middleware, custom renderers)
- [ ] More UI themes
- [ ] File attachments
- [ ] Function/tool-calling UI
- [ ] Publish as an npm package

## Contributing

Contributions are welcome — bug reports, new providers, UI polish, docs. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, code style, and PR guidelines. Adding a backend? Start with [docs/adding-a-provider.md](docs/adding-a-provider.md).

## License

[MIT](LICENSE) — use it, fork it, ship it.
