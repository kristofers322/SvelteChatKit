<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { Chat } from '../chat/chat.svelte.js';
	import MessageBubble from './MessageBubble.svelte';

	let { chat }: { chat: Chat } = $props();

	let container = $state<HTMLDivElement>();
	let atBottom = $state(true);

	const visible = $derived(chat.messages.filter((m) => m.role !== 'system'));

	function isNearBottom(el: HTMLElement): boolean {
		return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
	}

	function handleScroll(): void {
		if (container) atBottom = isNearBottom(container);
	}

	function scrollToBottom(behavior: ScrollBehavior): void {
		container?.scrollTo({ top: container.scrollHeight, behavior });
	}

	$effect(() => {
		void container;
		void visible.length;
		void visible.at(-1)?.content;
		void visible.at(-1)?.error;
		if (untrack(() => atBottom)) scrollToBottom('auto');
	});
</script>

<div class="relative min-h-0 flex-1">
	<div
		bind:this={container}
		onscroll={handleScroll}
		role="log"
		aria-label="Chat messages"
		class="h-full overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 sm:py-5"
	>
		<div class="flex flex-col gap-3">
			{#each visible as message, index (message.id)}
				<MessageBubble
					{message}
					streaming={chat.status === 'streaming' && index === visible.length - 1}
				/>
			{/each}
		</div>
	</div>

	{#if !atBottom}
		<button
			type="button"
			transition:fade={{ duration: 120 }}
			onclick={() => scrollToBottom('smooth')}
			aria-label="Scroll to bottom"
			class="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-zinc-200 bg-white p-2 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:focus-visible:ring-white"
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
				<path d="M12 5v14m-7-7 7 7 7-7" />
			</svg>
		</button>
	{/if}
</div>
