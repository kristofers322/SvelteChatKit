<script>
	import { createEventDispatcher } from "svelte";
	import { _ } from "svelte-i18n";
	const dispatch = createEventDispatcher();

	export let isOpen = false;
	let showMessage = false;

	function handleClick() {
		dispatch("click");
	}

	function closeMessage() {
		showMessage = false;
	}

	setTimeout(() => {
		showMessage = true;
	}, 10000); // 10 seconds
</script>

<div class="chat-container">
	{#if showMessage && !isOpen}
		<div class="speech-bubble right-4">
			<button on:click={closeMessage} class="close-button" aria-label={$_('chat.closeChat')}>×</button>
			<div class="text-white font-bold text-sm">
				<span>{$_('chatIcon.greeting')}</span>
			</div>
		</div>
	{/if}
	<button
		on:click={handleClick}
		aria-label={isOpen ? $_('chat.closeChat') : $_('chatIcon.openChat')}
		class="
    bg-gradient-to-br from-[#0a998e] to-[#10b3a8]
    text-white
    rounded-full
    h-12 w-12
    flex items-center justify-center
    shadow-lg
    cursor-pointer
    z-10
    transition-all duration-300 ease-in-out
    hover:shadow-[0_0_16px_rgba(16,179,168,0.4)]
    hover:scale-110
    font-family: 'Inter', sans-serif
  "
	>
		{#if !isOpen}
			<svg class="w-7 h-7" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
				<!-- Antenna -->
				<line x1="32" y1="8" x2="32" y2="16" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
				<circle cx="32" cy="6" r="3" fill="white"/>
				<!-- Head -->
				<rect x="12" y="16" width="40" height="30" rx="8" fill="white"/>
				<!-- Eyes -->
				<ellipse cx="23" cy="30" rx="4" ry="4.5" fill="#0a998e"/>
				<ellipse cx="41" cy="30" rx="4" ry="4.5" fill="#0a998e"/>
				<!-- Eye shine -->
				<circle cx="24.5" cy="28.5" r="1.5" fill="white"/>
				<circle cx="42.5" cy="28.5" r="1.5" fill="white"/>
				<!-- Smile -->
				<path d="M24 39 Q32 46 40 39" stroke="#0a998e" stroke-width="2.5" stroke-linecap="round" fill="none"/>
				<!-- Ears -->
				<rect x="4" y="26" width="6" height="12" rx="3" fill="white"/>
				<rect x="54" y="26" width="6" height="12" rx="3" fill="white"/>
				<!-- Body -->
				<rect x="18" y="48" width="28" height="12" rx="5" fill="white"/>
			</svg>
		{:else}
			<svg
				class="text-white"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
			>
				<path
					d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
				/>
			</svg>
		{/if}
	</button>
</div>

<style>
	.chat-container {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	/* Mobile-specific positioning */
	@media (max-width: 768px) {
		.chat-container {
			bottom: 1rem;
			right: auto;
			left: 50%;
			transform: translateX(-50%);
			flex-direction: column;
			align-items: center;
		}
	}

	.speech-bubble {
		background: linear-gradient(135deg, #0a998e, #10b3a8);
		color: white;
		padding: 12px 24px 12px 16px;
		border-radius: 16px;
		margin-bottom: 8px;
		position: relative;
		animation: fadeIn 0.3s ease-out;
		max-width: 250px;
		box-shadow: 0 4px 12px rgba(10, 153, 142, 0.2);
		font-family: "Inter", sans-serif;
	}

	.speech-bubble::after {
		content: "";
		position: absolute;
		bottom: -5px;
		right: 10px;
		border-width: 6px 6px 0;
		border-style: solid;
		border-color: #10b3a8 transparent;
	}

	/* Mobile-specific speech bubble positioning */
	@media (max-width: 768px) {
		.speech-bubble {
			margin-bottom: 8px;
		}
	}

	.close-button {
		position: absolute;
		top: 4px;
		right: 10px;
		background: none;
		border: none;
		color: black;
		font-size: 14px;
		font-weight: bold;
		cursor: pointer;
		padding: 2px;
		margin: 0;
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		z-index: 1;
	}

	.close-button:hover {
		opacity: 0.7;
	}

	.waving-hand {
		position: absolute;
		animation: wave 2s infinite;
		transform-origin: 70% 70%;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes wave {
		0% {
			transform: rotate(0deg);
		}
		10% {
			transform: rotate(14deg);
		}
		20% {
			transform: rotate(-8deg);
		}
		30% {
			transform: rotate(14deg);
		}
		40% {
			transform: rotate(-4deg);
		}
		50% {
			transform: rotate(10deg);
		}
		60% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(0deg);
		}
	}
</style>
