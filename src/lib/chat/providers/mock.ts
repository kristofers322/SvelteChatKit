import type {
	ChatAttachment,
	ChatMessage,
	ChatProvider,
	ProviderConfig,
	SendMessageOptions
} from '../types.js';
import { isImage } from '../attachments.js';

const RESPONSES: readonly string[] = [
	`Hi! I'm the **demo provider** built into SvelteChatKit. No API calls here, every reply is generated locally, so you can click around without any setup.

Here's a taste of what the message renderer handles:

- Streaming responses, word by word
- **Bold**, *italic*, and \`inline code\`
- Syntax-highlighted code blocks

\`\`\`ts
import { Chat, createProvider } from 'sveltechatkit';

const provider = createProvider({ id: 'mock' });
const chat = new Chat(provider);
await chat.send('Hello!');
\`\`\`

Pick a real provider from the toolbar above when you're ready to connect an actual model.`,

	`Good question! Under the hood, every backend implements a single \`ChatProvider\` interface: it receives the full message history and yields the reply as an async stream of text chunks.

That keeps the UI completely decoupled from the transport:

- **OpenAI-compatible** servers speak SSE with JSON deltas
- **Ollama** streams newline-delimited JSON
- **Custom endpoints** can return SSE or plain streamed text

\`\`\`ts
export interface ChatProvider {
	readonly id: string;
	readonly label: string;
	sendMessage(
		messages: ChatMessage[],
		options?: SendMessageOptions
	): AsyncGenerator<string, void, unknown>;
}
\`\`\`

Implement those few lines and \`registerProvider()\` does the rest.`,

	`Here are a few things you can try right now:

1. Press the **stop button** mid-reply (the partial text is kept)
2. Reload the page (history persists via \`localStorage\`)
3. Scroll up while I'm streaming (auto-scroll stays out of your way)
4. Toggle your OS dark mode (the theme follows along)

Everything you see is plain Svelte 5 with Tailwind, so it's easy to restyle. The chat state lives in one \`Chat\` class driven by runes, and the components just read from it.`,

	`One more tip: for production you generally don't want API keys in the browser. That's what the \`custom\` provider is for. Point it at a small server route that holds the key and forwards the conversation.

\`\`\`ts
// src/routes/api/chat/+server.ts
export async function POST({ request }) {
	const { messages } = await request.json();
	// call your model server-side and stream the reply back
}
\`\`\`

Then set \`PUBLIC_CUSTOM_ENDPOINT=/api/chat\` and the kit streams straight from your own backend. That's the whole tour. From here on I'll start repeating myself!`
];

function humanSize(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)} kB`;
	return `${bytes} B`;
}

function attachmentResponse(attachments: ChatAttachment[]): string {
	const intro =
		attachments.length === 1
			? 'Thanks! I received your attachment:'
			: `Thanks! I received your ${attachments.length} attachments:`;
	const items = attachments
		.map(
			(attachment) =>
				`- **${attachment.name}** (${humanSize(attachment.size)}, ${
					isImage(attachment) ? 'image' : 'file'
				} of type \`${attachment.mimeType}\`)`
		)
		.join('\n');
	return `${intro}

${items}

I'm the built-in demo provider, so I can't look inside files, but a real vision model would analyze them right here. Note how images render as thumbnails in the message bubble above, while other files appear as compact chips.`;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal?.aborted) {
			resolve();
			return;
		}
		const timer = setTimeout(finish, ms);
		function finish(): void {
			clearTimeout(timer);
			signal?.removeEventListener('abort', finish);
			resolve();
		}
		signal?.addEventListener('abort', finish, { once: true });
	});
}

/**
 * A deterministic offline provider for demos and tests: streams canned
 * markdown responses word by word with no network access. Cycles through a
 * fixed set of replies; `reset()` starts the cycle over.
 */
export class MockProvider implements ChatProvider {
	readonly id = 'mock';
	readonly label: string;

	private turn = 0;

	constructor(config: ProviderConfig) {
		this.label = config.label ?? 'Demo (no API)';
	}

	reset(): void {
		this.turn = 0;
	}

	async *sendMessage(
		messages: ChatMessage[],
		options: SendMessageOptions = {}
	): AsyncGenerator<string, void, unknown> {
		const signal = options.signal;

		let latest: ChatMessage | null = null;
		for (let i = messages.length - 1; i >= 0; i -= 1) {
			const message = messages[i];
			if (message && message.role === 'user') {
				latest = message;
				break;
			}
		}

		let text: string;
		if (latest?.attachments && latest.attachments.length > 0) {
			// Attachment replies sit outside the canned cycle so the tour
			// resumes where it left off on the next plain message.
			text = attachmentResponse(latest.attachments);
		} else {
			text = RESPONSES[this.turn % RESPONSES.length] as string;
			this.turn += 1;
		}

		const tokens = text.match(/\S+\s*/g) ?? [text];
		for (const token of tokens) {
			if (signal?.aborted) return;
			await wait(20, signal);
			if (signal?.aborted) return;
			yield token;
		}
	}
}
