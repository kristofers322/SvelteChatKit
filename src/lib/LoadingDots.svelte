<div class="inline-flex items-center h-[1em]">
	<span class="w-[4px] h-[4px] rounded-full bg-current mx-[2px] animate-blink"
	></span>
	<span
		class="w-[4px] h-[4px] rounded-full bg-current mx-[2px] animate-blink delay-200"
	></span>
	<span
		class="w-[4px] h-[4px] rounded-full bg-current mx-[2px] animate-blink delay-400"
	></span>
</div>

<style>
	@keyframes blink {
		0%,
		80%,
		100% {
			opacity: 0.4;
			transform: scale(0.8);
		}
		40% {
			opacity: 1;
			transform: scale(1);
		}
	}

	:global(.animate-blink) {
		animation: blink 1.4s infinite both;
	}

	:global(.delay-200) {
		animation-delay: 0.2s;
	}

	:global(.delay-400) {
		animation-delay: 0.4s;
	}
</style>
