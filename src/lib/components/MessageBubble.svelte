<script lang="ts">
	import type { ChatAttachment, ChatMessage } from '../chat/types.js';
	import { attachmentToBlob, isImage } from '../chat/attachments.js';
	import Markdown from './Markdown.svelte';
	import TypingIndicator from './TypingIndicator.svelte';

	let { message, streaming = false }: { message: ChatMessage; streaming?: boolean } = $props();

	const attachments = $derived(message.attachments ?? []);

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
		return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
	}

	// An attachment can lose its data when persisted history had to be
	// slimmed to fit the localStorage quota; those render as chips.
	function hasData(attachment: ChatAttachment): boolean {
		return attachment.dataUrl.startsWith('data:');
	}

	// Chromium blocks top-frame navigation to data: URLs, so open a blob copy.
	function openAttachment(attachment: ChatAttachment): void {
		try {
			const url = URL.createObjectURL(attachmentToBlob(attachment));
			window.open(url, '_blank', 'noopener');
			setTimeout(() => URL.revokeObjectURL(url), 60_000);
		} catch {
			// Malformed data; nothing to open.
		}
	}
</script>

{#snippet attachmentRow(chipClass: string, imageBorder: string)}
	<div class="flex flex-wrap gap-2 {message.content.length > 0 ? 'mb-2' : ''}">
		{#each attachments as attachment (attachment.id)}
			{#if isImage(attachment) && hasData(attachment)}
				<button
					type="button"
					onclick={() => openAttachment(attachment)}
					aria-label="Open {attachment.name} full size"
					class="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
				>
					<img
						src={attachment.dataUrl}
						alt={attachment.name}
						class="max-h-40 max-w-48 rounded-lg border object-cover {imageBorder}"
					/>
				</button>
			{:else}
				<span class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs {chipClass}">
					<svg
						class="h-3.5 w-3.5 shrink-0"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path
							d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
						/>
					</svg>
					<span class="max-w-40 truncate">{attachment.name}</span>
					<span class="opacity-60">{formatSize(attachment.size)}</span>
				</span>
			{/if}
		{/each}
	</div>
{/snippet}

{#if message.role === 'user'}
	<div class="flex justify-end">
		<div
			class="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-900 px-4 py-2.5 text-sm leading-relaxed text-white dark:bg-white dark:text-zinc-900"
		>
			{#if attachments.length > 0}
				{@render attachmentRow(
					'bg-white/10 dark:bg-zinc-900/10',
					'border-white/20 dark:border-zinc-900/20'
				)}
			{/if}
			{#if message.content.length > 0 || attachments.length === 0}
				<p class="whitespace-pre-wrap break-words">{message.content}</p>
			{/if}
		</div>
	</div>
{:else if message.role === 'assistant'}
	<div class="flex justify-start">
		<div
			class="max-w-[85%] rounded-2xl rounded-bl-md border bg-white px-4 py-3 shadow-sm dark:bg-zinc-900 {message.error
				? 'border-red-200 dark:border-red-900/60'
				: 'border-zinc-200 dark:border-zinc-800'}"
		>
			{#if attachments.length > 0}
				{@render attachmentRow(
					'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
					'border-zinc-200 dark:border-zinc-700'
				)}
			{/if}
			{#if streaming && message.content.length === 0}
				<TypingIndicator />
			{:else if message.content.length > 0 || attachments.length === 0}
				<Markdown source={message.content} />
			{/if}
			{#if message.error}
				<p class="mt-2 text-xs leading-relaxed text-red-600 dark:text-red-400">{message.error}</p>
			{/if}
		</div>
	</div>
{/if}
