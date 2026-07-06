# Contributing to SvelteChatKit

Thanks for helping out. Bug reports, new providers, UI polish, and docs improvements are all welcome.

## Dev setup

```bash
git clone https://github.com/kristofers322/SvelteChatKit.git
cd SvelteChatKit
npm install          # or: pnpm install
cp .env.example .env # optional — the mock provider needs no config
npm run dev
```

Before opening a PR, make sure both pass clean:

```bash
npm run check     # svelte-check + TypeScript
npm run lint      # Prettier formatting check
npm run build     # demo app build
npm run package   # library build (svelte-package) + publint
```

Node 20+ is required.

## Project layout

```
src/lib/chat/            core (framework-agnostic where possible)
  types.ts               ChatMessage, ChatProvider, ProviderConfig, errors
  chat.svelte.ts         Chat runes state class
  config.ts              defineChatKitConfig + env-driven defaults
  stream.ts              sseStream / lineStream / textStream / ensureOk
  markdown.ts            renderMarkdown (marked + highlight.js + DOMPurify)
  storage.ts             SSR-safe localStorage persistence
  providers/             registry + built-in providers
src/lib/components/      ChatWindow, MessageList, MessageBubble,
                         ChatInput, Markdown, TypingIndicator
src/lib/index.ts         public API — everything exported lives here
src/routes/              demo app
docs/                    guides
```

## Code style

- **Prettier** is wired up (tabs, single quotes, 100-column lines) — run `npm run format` before committing; `npm run lint` checks formatting in CI-style.
- **TypeScript strict**; no `any` unless there is genuinely no better type.
- Imports between `.ts` modules inside `src/lib` use relative `./x.js` specifiers (bundler resolution).
- JSDoc on public API only; skip narrating comments inside function bodies.
- Svelte 5 runes (`$state`, `$derived`, `$props`) — no legacy stores in kit code.
- UI components stay self-contained: Tailwind classes, no global CSS leakage.

## Adding a provider

The most valuable contribution. Providers implement the `ChatProvider` interface from `src/lib/chat/types.ts` and register through `registerProvider` — no kit code changes needed. Full tutorial: [docs/adding-a-provider.md](docs/adding-a-provider.md).

Checklist for provider PRs:

- Honors `options.signal` (pass it to `fetch`; let `AbortError` propagate unwrapped)
- Maps HTTP failures to `ChatProviderError` with an actionable message
- Never logs or echoes the API key
- Streams incrementally (yield chunks as they arrive, don't buffer the whole reply)

## Pull requests

- Keep PRs small and focused — one feature or fix per PR.
- Describe what changed and how you tested it (which provider, which browser).
- Include before/after screenshots for UI changes (light and dark mode).
- New public API needs a JSDoc comment and a mention in the README where relevant.
- `npm run check` and `npm run build` must pass.

## Commit style

Short imperative subject lines ("Add Anthropic provider", "Fix scroll pill flicker"), with an optional body explaining _why_. Conventional-commit prefixes (`feat:`, `fix:`, `docs:`) are appreciated but not required.

## Reporting bugs

Open an issue with: what you expected, what happened, the provider in use, browser/OS, and a minimal reproduction if you can. Never paste API keys into issues.
