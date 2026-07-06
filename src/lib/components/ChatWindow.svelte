<script lang="ts">
	import type { Chat } from '../chat/chat.svelte.js';
	import MessageList from './MessageList.svelte';
	import ChatInput from './ChatInput.svelte';

	let {
		chat,
		placeholder,
		class: className = ''
	}: { chat: Chat; placeholder?: string; class?: string } = $props();

	const isEmpty = $derived(chat.messages.filter((m) => m.role !== 'system').length === 0);
</script>

<div class="flex min-h-0 flex-col {className}">
	{#if isEmpty}
		<div
			class="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-6 py-10 text-center"
		>
			<svg
				class="mb-2 h-10 w-10 text-zinc-300 dark:text-zinc-700"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path
					d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
				/>
			</svg>
			<p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Start a conversation</p>
			<p class="max-w-xs text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
				Messages stream in as they are generated and stay in this browser.
			</p>
		</div>
	{:else}
		<MessageList {chat} />
	{/if}

	{#if chat.error}
		<div class="mx-3 mb-2 sm:mx-4" role="alert">
			<div
				class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
			>
				<p class="min-w-0 flex-1 break-words leading-relaxed">{chat.error}</p>
				<button
					type="button"
					onclick={() => (chat.error = null)}
					aria-label="Dismiss error"
					class="-m-1 shrink-0 rounded p-1 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-900/40"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<div class="border-t border-zinc-200 p-3 sm:p-4 dark:border-zinc-800">
		<ChatInput {chat} {placeholder} />
	</div>
</div>
