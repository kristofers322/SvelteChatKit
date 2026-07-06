<script lang="ts">
	import { renderMarkdown } from '../chat/markdown.js';

	let { source }: { source: string } = $props();

	const html = $derived(renderMarkdown(source));
</script>

<div
	class="prose prose-sm prose-zinc max-w-none break-words dark:prose-invert prose-pre:overflow-x-auto prose-a:font-medium prose-a:underline prose-a:underline-offset-2"
>
	{@html html}
</div>
