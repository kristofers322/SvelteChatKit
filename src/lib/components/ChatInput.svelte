<script lang="ts">
	import type { Chat } from '../chat/chat.svelte.js';
	import type { ChatAttachment } from '../chat/types.js';
	import { fileToAttachment, isImage, MAX_ATTACHMENT_BYTES } from '../chat/attachments.js';

	let {
		chat,
		placeholder = 'Send a message…',
		maxAttachments = 4,
		maxAttachmentBytes = MAX_ATTACHMENT_BYTES
	}: {
		chat: Chat;
		placeholder?: string;
		maxAttachments?: number;
		maxAttachmentBytes?: number;
	} = $props();

	let value = $state('');
	let textarea = $state<HTMLTextAreaElement>();
	let fileInput = $state<HTMLInputElement>();
	let attachButton = $state<HTMLButtonElement>();
	let chipRow = $state<HTMLDivElement>();
	let staged = $state<ChatAttachment[]>([]);
	let attachError = $state<string | null>(null);
	let liveStatus = $state('');
	// Bumped when the staged list is committed (send); files still being read
	// from a previous batch must not leak into the next message.
	let generation = 0;

	const canSend = $derived(value.trim().length > 0 || staged.length > 0);

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

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
		return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
	}

	async function addFiles(files: File[]): Promise<void> {
		const batch = generation;
		let error: string | null = null;
		let added = false;
		for (const file of files) {
			if (staged.length >= maxAttachments) {
				error = `You can attach up to ${maxAttachments} files.`;
				break;
			}
			if (file.size > maxAttachmentBytes) {
				error = `"${file.name}" is too large (max ${formatSize(maxAttachmentBytes)}).`;
				continue;
			}
			try {
				const attachment = await fileToAttachment(file);
				// The message may have been sent while the file was read.
				if (batch !== generation) return;
				if (staged.length >= maxAttachments) {
					error = `You can attach up to ${maxAttachments} files.`;
					break;
				}
				staged.push(attachment);
				liveStatus = `${file.name} attached, ${staged.length} of ${maxAttachments} files`;
				added = true;
			} catch (readError) {
				error = readError instanceof Error ? readError.message : String(readError);
			}
		}
		if (batch !== generation) return;
		if (error) attachError = error;
		else if (added) attachError = null;
	}

	function handleFileChange(
		event: Event & { currentTarget: EventTarget & HTMLInputElement }
	): void {
		const input = event.currentTarget;
		const files = input.files ? Array.from(input.files) : [];
		input.value = '';
		void addFiles(files);
	}

	function handlePaste(event: ClipboardEvent): void {
		const files = event.clipboardData?.files;
		if (!files || files.length === 0) return;
		event.preventDefault();
		void addFiles(Array.from(files));
	}

	function removeAttachment(id: string): void {
		const index = staged.findIndex((attachment) => attachment.id === id);
		const name = staged[index]?.name ?? '';
		staged = staged.filter((attachment) => attachment.id !== id);
		liveStatus = `${name} removed`;
		// Keep keyboard focus somewhere sensible instead of dropping it.
		queueMicrotask(() => {
			const buttons = chipRow?.querySelectorAll<HTMLButtonElement>('button[data-remove]');
			if (buttons && buttons.length > 0) {
				buttons[Math.min(index, buttons.length - 1)]?.focus();
			} else {
				attachButton?.focus();
			}
		});
	}

	function submit(): void {
		const text = value.trim();
		if (chat.busy || (text === '' && staged.length === 0)) return;
		const attachments = staged;
		generation += 1;
		value = '';
		staged = [];
		attachError = null;
		liveStatus = '';
		void chat.send(text, attachments);
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
		class="rounded-xl border border-zinc-200 bg-white p-1.5 transition-colors focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-600 dark:focus-within:ring-white/10"
	>
		{#if staged.length > 0}
			<div bind:this={chipRow} class="flex flex-wrap gap-2 px-1 pb-1.5 pt-1">
				{#each staged as attachment (attachment.id)}
					{#if isImage(attachment)}
						<div class="relative">
							<img
								src={attachment.dataUrl}
								alt={attachment.name}
								class="h-12 w-12 rounded-md object-cover"
							/>
							<button
								type="button"
								data-remove
								onclick={() => removeAttachment(attachment.id)}
								aria-label="Remove {attachment.name}"
								class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:focus-visible:ring-white"
							>
								<svg
									class="h-3 w-3"
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
					{:else}
						<div
							class="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 py-1 pl-2 pr-1 dark:border-zinc-700 dark:bg-zinc-800"
						>
							<svg
								class="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
								<path d="M14 2v6h6" />
							</svg>
							<span class="max-w-32 truncate text-xs text-zinc-700 dark:text-zinc-200"
								>{attachment.name}</span
							>
							<span class="text-xs text-zinc-400 dark:text-zinc-500"
								>{formatSize(attachment.size)}</span
							>
							<button
								type="button"
								data-remove
								onclick={() => removeAttachment(attachment.id)}
								aria-label="Remove {attachment.name}"
								class="flex h-5 w-5 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:focus-visible:ring-white"
							>
								<svg
									class="h-3 w-3"
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
					{/if}
				{/each}
			</div>
		{/if}
		{#if attachError}
			<p role="alert" class="px-2 pb-1 pt-0.5 text-xs text-red-600 dark:text-red-400">
				{attachError}
			</p>
		{/if}
		<p class="sr-only" role="status" aria-live="polite">{liveStatus}</p>
		<div class="flex items-end gap-2">
			<button
				bind:this={attachButton}
				type="button"
				onclick={() => fileInput?.click()}
				disabled={chat.busy}
				aria-label="Attach files"
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors enabled:hover:bg-zinc-100 enabled:hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:text-zinc-300 dark:text-zinc-400 dark:enabled:hover:bg-zinc-800 dark:enabled:hover:text-zinc-100 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-900 dark:disabled:text-zinc-700"
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
					<path
						d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
					/>
				</svg>
			</button>
			<textarea
				bind:this={textarea}
				bind:value
				onkeydown={handleKeydown}
				onpaste={handlePaste}
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
	</div>
	<input bind:this={fileInput} type="file" multiple onchange={handleFileChange} class="hidden" />
</form>
