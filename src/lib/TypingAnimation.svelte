<script>
	import { onMount, onDestroy } from "svelte";

	export let text = "";
	export let delay = 1000; // Increased default delay

	let displayText = [];
	let index = 0;
	let interval;

	function typeText() {
		if (index < text.length) {
			displayText = [
				...displayText,
				{ char: text[index], visible: false },
			];
			setTimeout(() => {
				displayText[index].visible = true;
				displayText = displayText;
			}, delay / 2); // Set visibility after half the delay
			index++;
		} else {
			clearInterval(interval);
		}
	}

	onMount(() => {
		interval = setInterval(typeText, delay);
	});

	onDestroy(() => {
		clearInterval(interval);
	});

	$: if (text) {
		displayText = [];
		index = 0;
		clearInterval(interval);
		interval = setInterval(typeText, delay);
	}
</script>

<span>
	{#each displayText as { char, visible }}
		<span class="char" class:visible>{char}</span>
	{/each}
</span>

<style>
	span {
		white-space: pre-wrap;
	}
	.char {
		opacity: 0;
		transition: opacity 0.3s ease-in-out; /* Increased transition duration */
	}
	.char.visible {
		opacity: 1;
	}
</style>

