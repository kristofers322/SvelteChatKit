<script>
	import { fade, slide } from "svelte/transition";
	import ChatIcon from "./lib/ChatIcon.svelte";
	import ChatWindow from "./lib/ChatWindow.svelte";

	let isChatOpen = false;

	function toggleChat() {
		isChatOpen = !isChatOpen;
	}
</script>

<main class="fixed bottom-20 right-20 z-10 pointer-events-auto">
	<ChatIcon on:click={toggleChat} isOpen={isChatOpen} />
	{#if isChatOpen}
		<div
			class="transition duration-300"
			transition:slide={{ duration: 300 }}
		>
			<div
				class="transition duration-300"
				transition:fade={{ duration: 300 }}
			>
				<ChatWindow on:close={toggleChat} />
			</div>
		</div>
	{/if}
</main>
