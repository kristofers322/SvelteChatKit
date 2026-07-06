<script lang="ts">
	import type { Snippet } from 'svelte';
	import '../app.css';
	import '$lib/styles.css';

	let { children }: { children: Snippet } = $props();
</script>

<div
	class="min-h-dvh bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100"
>
	{@render children()}
</div>
