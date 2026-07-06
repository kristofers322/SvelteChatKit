<div class="flex items-center gap-1 py-1 text-zinc-400 dark:text-zinc-500" role="status" aria-label="Assistant is typing">
	<span class="typing-dot h-1.5 w-1.5 rounded-full bg-current"></span>
	<span class="typing-dot h-1.5 w-1.5 rounded-full bg-current"></span>
	<span class="typing-dot h-1.5 w-1.5 rounded-full bg-current"></span>
</div>

<style>
	.typing-dot {
		animation: typing-bounce 1.2s ease-in-out infinite;
	}
	.typing-dot:nth-child(2) {
		animation-delay: 0.15s;
	}
	.typing-dot:nth-child(3) {
		animation-delay: 0.3s;
	}
	@keyframes typing-bounce {
		0%,
		60%,
		100% {
			transform: translateY(0);
			opacity: 0.5;
		}
		30% {
			transform: translateY(-3px);
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.typing-dot {
			animation: none;
			opacity: 0.6;
		}
	}
</style>
