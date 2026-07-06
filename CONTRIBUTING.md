# Contributing

PRs welcome. New providers, bug fixes, UI polish, docs. All of it.

## Setup

```bash
git clone https://github.com/kristofers322/SvelteChatKit.git
cd SvelteChatKit
npm install
npm run dev
```

Node 20+. Before opening a PR, these must pass:

```bash
npm run check     # svelte-check + TypeScript
npm run lint      # Prettier
npm run build     # demo app
npm run package   # library build + publint
```

## Layout

```
src/lib/chat/            core
  types.ts               ChatMessage, ChatProvider, ProviderConfig, errors
  chat.svelte.ts         Chat runes state class
  config.ts              defineChatKitConfig + env defaults
  stream.ts              sseStream / lineStream / textStream / ensureOk
  markdown.ts            marked + highlight.js + DOMPurify
  storage.ts             SSR-safe localStorage persistence
  providers/             registry + built-ins
src/lib/components/      the UI
src/lib/index.ts         public API, everything exported lives here
src/routes/              demo app
docs/                    guides
```

## Style

- Prettier is wired up, run `npm run format` before committing
- TypeScript strict; no `any` unless there's genuinely no better type
- Svelte 5 runes only, no legacy stores
- JSDoc on public API; no comment noise inside functions
- Components stay self-contained: Tailwind classes, no global CSS leakage

## Adding a provider

The most useful contribution. Implement `ChatProvider`, register it with `registerProvider`, and you're done, no kit changes needed. Tutorial: [docs/adding-a-provider.md](docs/adding-a-provider.md).

Provider PR checklist:

- Honors `options.signal`; `AbortError` propagates unwrapped
- Maps HTTP failures to `ChatProviderError` with a message a user can act on
- Never logs the API key
- Streams incrementally, yield chunks as they arrive

## PRs

Keep them small and focused. Say what changed and how you tested it, with screenshots (light and dark) for UI changes. Short imperative commit subjects; `feat:`/`fix:` prefixes are nice but not required.

## Bugs

Open an issue with: what you expected, what happened, the provider, browser/OS. Never paste API keys.
