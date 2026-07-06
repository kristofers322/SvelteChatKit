<div align="center">

# SvelteChatKit

**AI chat UI for SvelteKit that works with any backend.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-ff3e00.svg)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

![SvelteChatKit demo — streaming a GPT-4o-mini reply with syntax-highlighted code](docs/demo.gif)

</div>

One chat UI, any LLM. Swap between OpenAI, Ollama, Dify, n8n or your own API by changing a config object — streaming, markdown, history and the UI stay the same. Svelte 5 + SvelteKit 2, TypeScript, MIT.

## What you get

- Token-by-token streaming with a stop button that actually aborts
- One small `ChatProvider` interface — your own backend in ~20 lines
- Chat history that survives reloads (localStorage)
- Markdown with syntax-highlighted code blocks, sanitized
- Auto-scroll that follows the stream but never yanks the view while you read
- Errors surfaced where you can see them, not swallowed
- Dark mode, mobile friendly, fully typed
- Runs with zero config — the built-in demo provider needs no API key

## Providers

| `id`     | Works with                                                  | Needs                                     |
| -------- | ----------------------------------------------------------- | ----------------------------------------- |
| `openai` | OpenAI, OpenRouter, Groq, LM Studio, vLLM, llama.cpp, …     | `baseUrl`, `apiKey`, `model`              |
| `ollama` | Local models via Ollama                                     | `baseUrl` (+ `OLLAMA_ORIGINS` in browser) |
| `dify`   | Dify chat apps                                              | `baseUrl`, `apiKey`                       |
| `n8n`    | n8n workflows behind a Chat Trigger                         | `baseUrl` = chat webhook URL              |
| `custom` | Your own endpoint or proxy (SSE, streamed text, plain JSON) | `baseUrl`                                 |
| `mock`   | Demo mode, no network                                       | nothing                                   |

## Try it

```bash
git clone https://github.com/kristofers322/SvelteChatKit.git
cd SvelteChatKit
npm install
npm run dev
```

Works out of the box on the mock provider. Copy `.env.example` to `.env` to point it at a real backend. Node 20+.

## Use it in your app

```bash
npm install sveltechatkit
```

```svelte
<script lang="ts">
	import { Chat, ChatWindow, createProvider } from 'sveltechatkit';
	import 'sveltechatkit/styles.css';

	const provider = createProvider({
		id: 'openai',
		baseUrl: 'https://api.openai.com/v1',
		apiKey: 'sk-...',
		model: 'gpt-4o-mini'
	});

	const chat = new Chat(provider, { storageKey: 'my-app:chat' });
</script>

<ChatWindow {chat} placeholder="Ask anything…" />
```

The components are styled with Tailwind (v3 or v4), and Tailwind doesn't scan `node_modules` on its own — **skip this and they render unstyled**:

**Tailwind v4** — in your main CSS file:

```css
@import 'tailwindcss';
@plugin '@tailwindcss/typography';
@source '../node_modules/sveltechatkit/dist';
```

**Tailwind v3** — in `tailwind.config.js`:

```js
import typography from '@tailwindcss/typography';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}', './node_modules/sveltechatkit/dist/**/*.svelte'],
	plugins: [typography]
};
```

Don't want the prebuilt UI? `Chat` gives you reactive `messages`, `status`, `error` and `busy` plus `send()`, `stop()`, `clear()`, `setProvider()` — build your own components on top.

## Your own backend

Implement one interface, register it, done:

```ts
import { ensureOk, registerProvider, sseStream } from 'sveltechatkit';
import type { ChatMessage, ChatProvider, ProviderConfig, SendMessageOptions } from 'sveltechatkit';

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

Full walkthrough with a working Anthropic provider: [docs/adding-a-provider.md](docs/adding-a-provider.md).

## Config

The demo reads `PUBLIC_*` vars from `.env` — every variable is listed in [.env.example](.env.example), all optional. In your own app, prefer passing a `ProviderConfig` object directly (like the snippet above); it works with any bundler.

One warning: `PUBLIC_*` vars end up in the client bundle, visible to anyone. Fine locally — in production keep keys on your server and point the `custom` provider at a small proxy route.

## Screenshots

| Light                                                  | Dark                                                 |
| ------------------------------------------------------ | ---------------------------------------------------- |
| ![SvelteChatKit light mode](docs/screenshot-light.png) | ![SvelteChatKit dark mode](docs/screenshot-dark.png) |

## How it fits together

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
     ┌─────────┬─────────┬─────────┼─────────┬────────────┐
     ▼         ▼         ▼         ▼         ▼            ▼
  OpenAI-   Ollama     Dify      n8n      Custom        Mock
  compat.                               endpoint    (no network)
     │         │         │         │         │
     ▼         ▼         ▼         ▼         ▼
    SSE      NDJSON     SSE     NDJSON   SSE / text
                (upstream chat APIs)
```

## Roadmap

- [ ] Auth support
- [ ] Vector DB / RAG helpers
- [ ] Plugin system (message middleware, custom renderers)
- [ ] More themes
- [ ] Precompiled CSS — use the kit without Tailwind
- [ ] File attachments
- [ ] Tool-calling UI
- [x] npm package

## Contributing

PRs welcome — new providers are the most useful thing you can add. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) — use it, fork it, ship it.
