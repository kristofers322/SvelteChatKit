<script lang="ts">
	import type { Chat } from '../chat/chat.svelte.js';

	let { chat, placeholder = 'Send a message…' }: { chat: Chat; placeholder?: string } = $props();

	let value = $state('');
	let textarea = $state<HTMLTextAreaElement>();

	const canSend = $derived(value.trim().length > 0);

	function resize(): void {
		const el = textarea;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
	}

	$effect(() => {
		void value;
		resize();
	});

	function submit(): void {
		const text = value.trim();
		if (!text || chat.busy) return;
		value = '';
		void chat.send(text);
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		submit();
	}
</script>

<form
	onsubmit={(event) => {
		event.preventDefault();
		submit();
	}}
>
	<div
		class="flex items-end gap-2 rounded-xl border border-zinc-200 bg-white p-1.5 transition-colors focus-within:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-600"
	>
		<textarea
			bind:this={textarea}
			bind:value
			onkeydown={handleKeydown}
			rows="1"
			{placeholder}
			aria-label="Chat message"
			class="max-h-40 w-full resize-none overflow-y-auto bg-transparent px-2.5 py-1.5 text-base leading-6 text-zinc-900 placeholder:text-zinc-400 focus:outline-none sm:text-sm sm:leading-6 dark:text-zinc-100 dark:placeholder:text-zinc-600"
		></textarea>
		{#if chat.busy}
			<button
				type="button"
				onclick={() => chat.stop()}
				aria-label="Stop generating"
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-900"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<rect x="7" y="7" width="10" height="10" rx="1.5" />
				</svg>
			</button>
		{:else}
			<button
				type="submit"
				disabled={!canSend}
				aria-label="Send message"
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors enabled:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:bg-zinc-100 disabled:text-zinc-400 dark:bg-white dark:text-zinc-900 dark:enabled:hover:bg-zinc-200 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-900 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
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
					<path d="M12 19V5m-6 6 6-6 6 6" />
				</svg>
			</button>
		{/if}
	</div>
</form>
