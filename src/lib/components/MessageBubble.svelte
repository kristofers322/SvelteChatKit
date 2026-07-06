<script lang="ts">
	import type { ChatMessage } from '../chat/types.js';
	import Markdown from './Markdown.svelte';
	import TypingIndicator from './TypingIndicator.svelte';

	let { message, streaming = false }: { message: ChatMessage; streaming?: boolean } = $props();
</script>

{#if message.role === 'user'}
	<div class="flex justify-end">
		<div
			class="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-900 px-4 py-2.5 text-sm leading-relaxed text-white dark:bg-white dark:text-zinc-900"
		>
			<p class="whitespace-pre-wrap break-words">{message.content}</p>
		</div>
	</div>
{:else if message.role === 'assistant'}
	<div class="flex justify-start">
		<div
			class="max-w-[85%] rounded-2xl rounded-bl-md border bg-white px-4 py-3 shadow-sm dark:bg-zinc-900 {message.error
				? 'border-red-200 dark:border-red-900/60'
				: 'border-zinc-200 dark:border-zinc-800'}"
		>
			{#if streaming && message.content.length === 0}
				<TypingIndicator />
			{:else}
				<Markdown source={message.content} />
			{/if}
			{#if message.error}
				<p class="mt-2 text-xs leading-relaxed text-red-600 dark:text-red-400">{message.error}</p>
			{/if}
		</div>
	</div>
{/if}
