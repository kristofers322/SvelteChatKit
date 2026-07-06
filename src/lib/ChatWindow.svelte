<script>
	import {
		createEventDispatcher,
		afterUpdate,
		onDestroy,
		onMount,
	} from "svelte";
	import { fade, scale } from "svelte/transition";
	import SvelteMarkdown from "svelte-markdown";
	import LoadingDots from "./LoadingDots.svelte";
	import Link from "./Link.svelte";
	import LanguageSwitcher from "./LanguageSwitcher.svelte";
	import { v4 as uuidv4 } from "uuid";
	import logo from "./images/logo.svg";
	import { _, locale } from "svelte-i18n";
	import * as countryCodes from "country-codes-list";
	const dispatch = createEventDispatcher();

	const countries = countryCodes.customList(
		"countryNameEn",
		"{countryCallingCode}",
	);

	let message = "";
	let messages = [];
	let showScrollButton = false;

	let chatMessagesElement;
	let isTyping = false;
	let isStreaming = false;
	let currentTypingMessage = "";
	let streamBuffer = ""; // Buffer for handling partial button patterns
	let conversationId = "";
	let conversationTimestamp = null;
	let abortController;
	let userId = null;
	let jwtToken = null;
	let isLoadingToken = false;
	let isTokenError = false;
	let lastAgentThought = "";
	let openingStatement = "";

	// Contact form state
	let isFormOpen = false;

	// Map locales to default country codes
	const localeToCountryCode = {
		en: "44", // UK
		fi: "358", // Finland
		sv: "46", // Sweden
		no: "47", // Norway
	};

	// Get default country code based on current locale
	$: defaultCountryCode =
		localeToCountryCode[$locale?.substring(0, 2)] || "44";

	let formData = {
		firstName: "",
		lastName: "",
		email: "",
		countryCode: "44",
		phone: "",
		message: "",
	};
	let privacyPolicyAgreed = false;
	let formJustSubmitted = false;
	let formHasBeenSubmitted = false; // Permanent flag to prevent form reopening
	let hitSpecialPattern = false; // Flag to stop displaying content when { is detected
	let isCountryDropdownOpen = false;
	let countrySearch = "";
	let hasUserSelectedCountry = false; // Track if user manually selected a country

	const API_BASE =
		import.meta.env.BACKEND_CUSTOM_URL || "http://localhost:3000";
	const TOKEN_ENDPOINT = `${API_BASE}/generate-token`;
	const CONVERSATION_EXPIRY_TIME = 60 * 60 * 1000; // 1 hour in milliseconds

	async function reportError(errorMessage) {
		try {
			await fetch(`${API_BASE}/report-error`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ error: errorMessage }),
			});
		} catch (e) {
			console.error("Failed to report error:", e);
		}
	}

	// Function to check and manage conversation timestamp
	function manageConversationTimestamp() {
		const storedTimestamp = localStorage.getItem("conversationTimestamp");
		const storedConversationId = localStorage.getItem("conversationId");
		const currentTime = new Date().getTime();

		if (storedTimestamp) {
			const timeSinceCreation = currentTime - parseInt(storedTimestamp);

			// If conversation is older than 1 hour
			if (timeSinceCreation >= CONVERSATION_EXPIRY_TIME) {
				console.log("Conversation timestamp expired. Resetting.");

				// Remove existing conversationId and timestamp
				localStorage.removeItem("conversationId");
				localStorage.removeItem("conversationTimestamp");

				conversationId = "";
				conversationTimestamp = null;
			} else {
				// Use existing timestamp and conversationId if not expired
				conversationTimestamp = parseInt(storedTimestamp);
				conversationId = storedConversationId || "";
			}
		} else {
			// No timestamp exists
			conversationTimestamp = null;
			conversationId = "";
		}
	}

	// Function to set conversation timestamp
	function setConversationTimestamp() {
		const currentTime = new Date().getTime();
		conversationTimestamp = currentTime;
		localStorage.setItem("conversationTimestamp", currentTime.toString());
	}

	function checkScrollability() {
		if (!chatMessagesElement) return;
		const { scrollTop, scrollHeight, clientHeight } = chatMessagesElement;

		// Check if content is actually scrollable
		const isScrollable = scrollHeight > clientHeight;

		// Check if we're at the bottom
		const isAtBottom =
			Math.abs(scrollHeight - clientHeight - scrollTop) < 50;

		// Show button only if content is scrollable AND we're not at bottom
		showScrollButton = isScrollable && !isAtBottom;
	}

	afterUpdate(() => {
		checkScrollability();
	});

	async function getJwtToken() {
		isLoadingToken = true;
		isTokenError = false;
		try {
			console.log("Requesting JWT token for userId:", userId);
			const response = await fetch(TOKEN_ENDPOINT, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ userId }),
			});
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			jwtToken = data.token;
			console.log("JWT token received successfully");

			if (userId) await getDifyParameters();
			if (userId && conversationId) {
				await getConversationHistories(userId, conversationId);
			}
		} catch (error) {
			console.error("Error getting JWT token:", error);
			isTokenError = true;
			addMessage("agent", $_("errors.technicalError"));
			reportError(`JWT token error: ${error.message}`);
		} finally {
			isLoadingToken = false;
		}
	}

	function handleScroll(event) {
		if (!chatMessagesElement) return;
		checkScrollability();
	}

	onMount(async () => {
		userId = localStorage.getItem("userId");

		// Manage conversation timestamp on mount
		manageConversationTimestamp();

		if (!userId) {
			userId = uuidv4();
			localStorage.setItem("userId", userId);
		}

		// Set initial country code based on locale
		const localeCode = $locale?.substring(0, 2);
		if (localeCode && localeToCountryCode[localeCode]) {
			formData.countryCode = localeToCountryCode[localeCode];
		}

		if (chatMessagesElement) {
			chatMessagesElement.addEventListener("scroll", handleScroll);
		}

		await getJwtToken();
	});

	onDestroy(() => {
		if (abortController) {
			abortController.abort();
		}
		if (chatMessagesElement) {
			chatMessagesElement.removeEventListener("scroll", handleScroll);
		}
	});

	function shouldAutoScrollDuringTyping() {
		if (!chatMessagesElement) return false;
		const lastMessage =
			chatMessagesElement.lastElementChild?.lastElementChild;
		if (!lastMessage) return true;

		const containerRect = chatMessagesElement.getBoundingClientRect();
		const lastMessageRect = lastMessage.getBoundingClientRect();
		const upperBoundY = containerRect.top;

		// If the top of the last message is above the upper bound, don't auto-scroll
		return lastMessageRect.top > upperBoundY;
	}

	function autoScrollDuringTyping() {
		if (chatMessagesElement && shouldAutoScrollDuringTyping()) {
			const lastMessage =
				chatMessagesElement.lastElementChild?.lastElementChild;
			if (lastMessage) {
				lastMessage.scrollIntoView({
					behavior: "smooth",
					block: "nearest",
				});
			}
		}
	}

	function scrollToBottom() {
		if (chatMessagesElement) {
			// Always scroll to the very bottom when button is clicked
			chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
		}
	}

	function handleClose() {
		dispatch("close");
	}

	function addMessage(type, content) {
		messages = [...messages, { type, content: [content] }];
		// Always scroll to bottom for user messages, use auto-scroll logic for agent messages
		if (type === "user") {
			// Use a small delay to ensure the DOM has updated
			setTimeout(() => {
				if (chatMessagesElement) {
					chatMessagesElement.scrollTop =
						chatMessagesElement.scrollHeight;
				}
			}, 0);
		}
	}

	async function getConversationHistories(userId, conversationId) {
		try {
			console.log(
				"Fetching conversation history for:",
				userId,
				conversationId,
			);
			const response = await fetch(`${API_BASE}/conversation-histories`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${jwtToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					user: `web-user-${userId}`,
					conversation_id: conversationId,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				if (response.status == 500 && data.code == "not_found") {
					localStorage.removeItem("conversationId");
					conversationId = "";
				}
			}

			console.log("Conversation history received:", data);
			// Clear existing messages but preserve opening statement
			messages = [];
			if (openingStatement) {
				addMessage("agent", openingStatement);
			}
			data.forEach((message) => {
				// Filter out form submission messages that contain metadata
				const isFormSubmission =
					message.query &&
					message.query.includes("conversation_id:") &&
					message.query.includes("user_id:");

				if (!isFormSubmission) {
					addMessage("user", message.query);
				}
				addMessage("agent", message.answer);
			});
		} catch (error) {
			console.error("Error fetching conversation history:", error);
		}
	}
	function fakeStreamMessage(text) {
		return new Promise((resolve) => {
			if (!text) {
				resolve();
				return;
			}
			const charsPerTick = 2;
			const tickMs = 15;
			let i = 0;
			currentTypingMessage = "";
			const id = setInterval(() => {
				i = Math.min(i + charsPerTick, text.length);
				currentTypingMessage = text.substring(0, i);
				autoScrollDuringTyping();
				if (i >= text.length) {
					clearInterval(id);
					resolve();
				}
			}, tickMs);
		});
	}

	async function sendMessageToAPI(userMessage) {
		// If no conversation timestamp exists, create one
		if (!conversationTimestamp) {
			setConversationTimestamp();
		}

		if (!jwtToken) {
			console.log("Token not available, attempting to get new token");
			await getJwtToken();
			if (!jwtToken || isTokenError) {
				addMessage("agent", $_("errors.unableToConnect"));
				return;
			}
		}

		isTyping = true;
		isStreaming = true;
		currentTypingMessage = "";
		streamBuffer = "";
		hitSpecialPattern = false; // Reset flag for new message
		let fullDifyAnswer = "";

		const requestBody = {
			inputs: {},
			query: userMessage,
			response_mode: "streaming",
			conversation_id: conversationId,
			user: `web-user-${userId}`,
		};

		abortController = new AbortController();

		const resetStreamingState = () => {
			isTyping = false;
			isStreaming = false;
		};

		try {
			const response = await fetch(`${API_BASE}/chat-messages`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${jwtToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
				signal: abortController.signal,
			});

			if (!response.ok) {
				if (response.status === 401) {
					console.log("Token expired, getting new token");
					await getJwtToken();
					if (jwtToken && !isTokenError) {
						await sendMessageToAPI(userMessage);
						return;
					}
				}
				const errorBody = await response.text();
				console.error("API Error response:", errorBody);
				throw new Error(
					`HTTP error! status: ${response.status}, body: ${errorBody}`,
				);
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let sseBuffer = "";
			let finalMessage = "";

			try {
				while (true) {
					const { value, done } = await reader.read();
					if (done) {
						const braceIndex = fullDifyAnswer.indexOf("{");
						const displayText = (braceIndex === -1
							? fullDifyAnswer
							: fullDifyAnswer.substring(0, braceIndex)).trimEnd();

						await fakeStreamMessage(displayText);

						const buttonRegex = /\{button:[^}]+\}/g;
						let match;
						while (
							(match = buttonRegex.exec(fullDifyAnswer)) !== null
						) {
							addMessage("agent", match[0]);
						}

						if (
							fullDifyAnswer.includes("{open_form") &&
							!formJustSubmitted &&
							!formHasBeenSubmitted
						) {
							isFormOpen = true;
						}

						try {
							// Refetch conversation history to get properly formatted messages
							if (conversationId) {
								await getConversationHistories(
									userId,
									conversationId,
								);
							}
						} catch (error) {
							console.error(
								"Error refetching conversation history:",
								error,
							);
							// If refetch fails, at least show the streamed message
							if (displayText) {
								addMessage("agent", displayText);
							}
						} finally {
							resetStreamingState();
							break;
						}
					}

					sseBuffer += decoder.decode(value, { stream: true });
					const lines = sseBuffer.split("\n\n");
					sseBuffer = lines.pop() || "";

					for (const line of lines) {
						if (line.startsWith("data:")) {
							try {
								const data = JSON.parse(line.slice(5));

								if (data.event === "agent_message") {
									lastAgentThought = "";
									fullDifyAnswer += data.answer || "";
									if (
										!conversationId &&
										data.conversation_id
									) {
										conversationId = data.conversation_id;
										localStorage.setItem(
											"conversationId",
											conversationId,
										);
									}
								} else if (data.event == "agent_thought") {
									lastAgentThought = data.thought;
								} else if (data.event === "error") {
									addMessage(
										"agent",
										$_("errors.technicalError"),
									);
									reportError(`Dify error: ${data.message}`);
									throw new Error(
										`API Error: ${data.message}`,
									);
								}
							} catch (parseError) {
								console.error(
									"Error parsing JSON:",
									parseError,
								);
								console.log("Problematic line:", line);
							}
						}
					}
				}
			} catch (streamError) {
				console.error("Error in stream processing:", streamError);
				// If we have accumulated content when an error occurs, preserve it
				if (fullDifyAnswer) {
					const braceIndex = fullDifyAnswer.indexOf("{");
					const partialDisplay =
						braceIndex === -1
							? fullDifyAnswer
							: fullDifyAnswer.substring(0, braceIndex);
					if (partialDisplay) {
						addMessage("agent", partialDisplay);
					}
				}
				resetStreamingState();
				throw streamError;
			}
		} catch (error) {
			if (error.name === "AbortError") {
				console.log("Fetch aborted");
			} else {
				console.error("Error in sendMessageToAPI:", error);
				reportError(`Chat API error: ${error.message}`);
				// Only add error message if we haven't preserved the typing message
				if (!fullDifyAnswer) {
					addMessage("agent", $_("errors.technicalError"));
				}
			}
			resetStreamingState();
		}
	}

	async function getDifyParameters() {
		try {
			console.log(`Fetching parameters for:`, userId);
			const response = await fetch(`${API_BASE}/parameters`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${jwtToken}`,
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			console.log("Parameters received:", data);

			// Use opening message from Dify if available, otherwise use default
			if (data.opening_statement) {
				openingStatement = data.opening_statement;
				console.log("Using Dify opening statement:", openingStatement);
			} else {
				// Use default opening message
				openingStatement = openingMessage;
				console.log("Using default opening message:", openingStatement);
			}

			addMessage("agent", openingStatement);
		} catch (error) {
			console.error("Error fetching parameters:", error);
			// Fallback to default opening message on error
			openingStatement = openingMessage;
			console.log("Using fallback opening message:", openingStatement);
			addMessage("agent", openingStatement);
		}
	}

	async function handleSubmit() {
		if (message.trim()) {
			const userMessage = message;
			addMessage("user", userMessage);
			message = "";
			await sendMessageToAPI(userMessage);
		}
	}

	// Markdown options with custom Link component
	const markdownRenderers = {
		link: Link,
	};

	function handleButtonMessage(buttonText) {
		addMessage("user", buttonText);
		sendMessageToAPI(buttonText);
	}

	function handleFormSubmit() {
		if (
			formData.firstName.trim() &&
			formData.lastName.trim() &&
			formData.email.trim() &&
			formData.phone.trim() &&
			privacyPolicyAgreed
		) {
			const formMessage = `First Name: ${formData.firstName}\nLast Name: ${formData.lastName}\nEmail: ${formData.email}\nPhone Number: +${formData.countryCode} ${formData.phone}\nMessage: ${formData.message || "No additional message provided"}`;
			sendMessageToAPI(formMessage);

			// Reset form
			isFormOpen = false;
			formData = {
				firstName: "",
				lastName: "",
				email: "",
				countryCode: defaultCountryCode,
				phone: "",
				message: "",
			};
			privacyPolicyAgreed = false;
			hasUserSelectedCountry = false;

			// Set permanent flag to prevent future form openings
			formHasBeenSubmitted = true;

			// Prevent immediate reopening
			formJustSubmitted = true;
			setTimeout(() => {
				formJustSubmitted = false;
			}, 10000); // Wait 10 seconds before allowing form to open again
		}
	}

	function closeForm() {
		isFormOpen = false;
		formData = {
			firstName: "",
			lastName: "",
			email: "",
			countryCode: defaultCountryCode,
			phone: "",
			message: "",
		};
		privacyPolicyAgreed = false;
		hasUserSelectedCountry = false;
	}

	// Normalizes message content to split out {button:...} patterns as separate entries and filter out {open_form:...} patterns
	function normalizeContent(content) {
		// This regex splits out all {button:...} patterns, even if concatenated
		const buttonRegex = /(\{button:[^}]+\})/g;
		// This regex removes {open_form:...} patterns completely
		const formRegex = /\{open_form(?::[^}]+)?\}/g;

		const splitContent = (str) => {
			// Check for form patterns and trigger form opening
			if (str.includes("{open_form")) {
				if (!formJustSubmitted && !formHasBeenSubmitted) {
					isFormOpen = true;
				}
			}

			// First remove form patterns, then split buttons
			const withoutForms = str.replace(formRegex, "").trim();
			if (!withoutForms) return [];
			// Split and keep delimiters
			return withoutForms
				.split(buttonRegex)
				.map((s) => s.trim())
				.filter(Boolean);
		};
		if (Array.isArray(content)) {
			let result = [];
			for (let item of content) {
				if (typeof item === "string") {
					result.push(...splitContent(item));
				} else {
					result.push(item);
				}
			}
			return result;
		} else if (typeof content === "string") {
			return splitContent(content);
		} else {
			return [];
		}
	}

	// Opening message - now uses translations
	$: openingMessage = `${$_("opening.welcome")}
${$_("opening.interested")}

{button:${$_("opening.bookHoliday")}}
{button:${$_("opening.helpWithBooking")}}
{button:${$_("opening.contactAgent")}}`;

	// Track previous locale to detect changes
	let previousLocale = $locale;

	// Convert countries object to array format
	const countriesArray = Object.entries(countries).map(([country, code]) => ({
		country,
		code,
	}));

	// Priority countries (Nordic + common European) to show at top of list
	const priorityCountries = [
		"Finland",
		"Sweden",
		"Norway",
		"Denmark",
		"United Kingdom",
		"Germany",
		"Estonia",
		"Spain",
		"France",
		"Italy",
		"Netherlands",
		"Poland",
		"United States",
	];
	const sortedCountries = [
		...countriesArray.filter((c) => priorityCountries.includes(c.country)),
		...countriesArray.filter((c) => !priorityCountries.includes(c.country)),
	];

	// Filter countries based on search
	$: filteredCountries = countrySearch
		? sortedCountries.filter(
				(c) =>
					c.country
						.toLowerCase()
						.includes(countrySearch.toLowerCase()) ||
					c.code.includes(countrySearch),
			)
		: sortedCountries;

	// Update opening statement and country code when locale changes
	$: if ($locale && $locale !== previousLocale) {
		previousLocale = $locale;
		// Update the first message (opening statement) if messages exist
		if (messages.length > 0 && messages[0].type === "agent") {
			messages[0].content = [openingMessage];
			messages = messages; // Trigger Svelte reactivity
		}
		// Update country code if user hasn't manually selected one
		if (!hasUserSelectedCountry) {
			formData.countryCode = defaultCountryCode;
		}
	}
</script>

<div class="chatbot-widget-container">
	<div
		class="chatbot-main-container w-full h-[calc(100dvh-16px)] sm:w-[500px] sm:h-[700px] bg-gray-50 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] flex flex-col fixed right-0 top-2 bottom-2 sm:top-auto sm:bottom-4 sm:right-4 text-sm"
		style="font-family: 'Inter', sans-serif;"
	>
		<div
			class="p-3 sm:p-4 text-white rounded-t-2xl flex justify-between items-center"
			style="background: linear-gradient(135deg, #0a998e, #10b3a8);"
		>
			<div class="flex items-center space-x-2 sm:space-x-3">
				<img
					src={logo}
					alt="Vanilla Travel Logo"
					class="h-8 sm:h-10 w-auto rounded-lg"
					style="max-width: 120px;"
				/>
				<div>
					<h3 class="text-base sm:text-lg font-semibold">
						{$_("chat.title")}
					</h3>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<LanguageSwitcher />
				<button
					class="text-white text-1xl sm:text-2xl font-bold hover:bg-teal-200 hover:text-teal-600 hover:ring-2 hover:ring-teal-400 rounded-full transition-all w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center leading-none pb-1"
					on:click={handleClose}
					aria-label={$_("chat.closeChat")}
				>
					×
				</button>
			</div>
		</div>
		<div
			class="flex-grow p-3 sm:p-4 overflow-y-auto custom-scrollbar relative"
			bind:this={chatMessagesElement}
			on:scroll={handleScroll}
		>
			{#if isLoadingToken}
				<div class="flex justify-center items-center h-full">
					<LoadingDots dotSize="4" />
				</div>
			{:else}
				<div class="flex flex-col">
					{#each messages as message}
						{@const normalizedContent = normalizeContent(
							message.content,
						)}
						<div
							class="mb-3 sm:mb-4 max-w-[95%] flex items-start {message.type ===
							'agent'
								? 'self-start'
								: 'self-end justify-end'}"
						>
							{#if message.type === "agent"}
								<div class="relative mr-2">
									<div
										class="h-10 sm:h-12 w-10 sm:w-12 rounded-full overflow-hidden flex items-center justify-center p-1"
										style="background: linear-gradient(135deg, #0a998e, #10b3a8);"
									>
										<img
											src={logo}
											alt="Agent"
											class="h-full w-auto object-contain"
										/>
									</div>
									<div
										class="absolute right-[-4px] top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-white"
									></div>
								</div>
							{/if}
							<div
								class="p-3 sm:p-4 {message.type === 'agent'
									? 'bg-white text-[#173d66] shadow-sm rounded-xl'
									: 'text-white rounded-xl'}"
								style={message.type === "user"
									? "background: linear-gradient(135deg, #0a998e, #10b3a8);"
									: ""}
							>
								{#each normalizedContent as text, i}
									{@const nextItem = normalizedContent[i + 1]}
									{@const nextIsButton =
										nextItem &&
										((typeof nextItem === "object" &&
											nextItem.button) ||
											(typeof nextItem === "string" &&
												nextItem
													.trim()
													.startsWith("{button:")))}
									{#if typeof text === "object" && text.button}
										<button
											class="px-4 py-2 text-sm bg-white text-[#0a998e] border-2 border-[#0a998e] rounded-lg hover:bg-[#0a998e] hover:text-white transition-colors min-w-[140px] max-w-[350px] mb-2 mr-2 text-left inline-block"
											on:click={() =>
												handleButtonMessage(
													text.button,
												)}
										>
											{text.button}
										</button>
									{:else if typeof text === "string" && text
											.trim()
											.startsWith("{button:") && text
											.trim()
											.endsWith("}")}
										<button
											class="px-4 py-2 text-sm bg-white text-[#0a998e] border-2 border-[#0a998e] rounded-lg hover:bg-[#0a998e] hover:text-white transition-colors min-w-[140px] max-w-[350px] mb-2 mr-2 text-left inline-block"
											on:click={() =>
												handleButtonMessage(
													text
														.trim()
														.slice(8, -1)
														.trim(),
												)}
										>
											{text.trim().slice(8, -1).trim()}
										</button>
									{:else}
										<div
											class="prose prose-sm max-w-none break-words {nextIsButton
												? 'mb-3'
												: ''} {message.type === 'agent'
												? 'text-[#173d66]'
												: 'text-white'}"
										>
											<SvelteMarkdown
												source={text}
												renderers={markdownRenderers}
											/>
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/each}

					{#if isTyping}
						<div
							class="mb-3 sm:mb-4 max-w-[95%] flex items-start self-start"
						>
							<div class="relative mr-2">
								<div
									class="h-10 sm:h-12 w-10 sm:w-12 rounded-full overflow-hidden flex items-center justify-center p-1"
									style="background: linear-gradient(135deg, #0a998e, #10b3a8);"
								>
									<img
										src={logo}
										alt="Agent"
										class="h-full w-auto object-contain"
									/>
								</div>
								<div
									class="absolute right-[-4px] top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-white"
								></div>
							</div>
							<div
								class="p-3 sm:p-4 rounded-xl bg-white text-[#173d66] shadow-sm overflow-hidden min-w-0"
							>
								<div class="prose prose-sm max-w-none break-words">
									{#if currentTypingMessage}
										<SvelteMarkdown
											source={currentTypingMessage
												.replace(
													/\{button:[^}]*\}?/g,
													"",
												)
												.trim()}
											renderers={markdownRenderers}
										/>
									{:else}
										<LoadingDots />
									{/if}
								</div>
							</div>
						</div>
					{/if}
					{#if showScrollButton}
						<div class="scroll-button-container">
							<button
								transition:scale|local={{
									duration: 200,
									start: 0.8,
								}}
								class="text-white p-2 rounded-full shadow-lg transition-all duration-300 hover:shadow-[0_0_8px_#10b3a8]"
								style="background: linear-gradient(135deg, #0a998e, #10b3a8);"
								on:click={scrollToBottom}
								aria-label={$_("chat.scrollToBottom")}
							>
								<div transition:fade|local={{ duration: 150 }}>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M12 5v14M19 12l-7 7-7-7" />
									</svg>
								</div>
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		{#if isFormOpen}
			<div class="bg-white border-t border-gray-200 p-3">
				<div class="flex justify-between items-center mb-2">
					<h4 class="text-base font-semibold text-[#173d66]">
						{$_("form.title")}
					</h4>
					<button
						type="button"
						class="text-gray-400 hover:text-gray-600 text-xl"
						on:click={closeForm}
						aria-label={$_("form.closeForm")}
					>
						×
					</button>
				</div>
				<form
					on:submit|preventDefault={handleFormSubmit}
					class="space-y-2"
				>
					<div class="flex gap-2">
						<div class="flex-1">
							<label
								class="block text-xs font-medium text-[#173d66] mb-0.5"
								>{$_("form.firstNameLabel")}</label
							>
							<input
								type="text"
								bind:value={formData.firstName}
								required
								class="w-full p-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0a998e] transition-colors"
								placeholder={$_("form.firstNamePlaceholder")}
							/>
						</div>
						<div class="flex-1">
							<label
								class="block text-xs font-medium text-[#173d66] mb-0.5"
								>{$_("form.lastNameLabel")}</label
							>
							<input
								type="text"
								bind:value={formData.lastName}
								required
								class="w-full p-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0a998e] transition-colors"
								placeholder={$_("form.lastNamePlaceholder")}
							/>
						</div>
					</div>
					<div>
						<label
							class="block text-xs font-medium text-[#173d66] mb-0.5"
							>{$_("form.emailLabel")}</label
						>
						<input
							type="email"
							bind:value={formData.email}
							required
							class="w-full p-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0a998e] transition-colors"
							placeholder={$_("form.emailPlaceholder")}
						/>
					</div>
					<div>
						<label
							class="block text-xs font-medium text-[#173d66] mb-0.5"
							>{$_("form.phoneLabel")}</label
						>
						<div class="flex gap-1">
							<div class="country-select-wrapper relative">
								<button
									type="button"
									class="w-fit h-full px-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0a998e] transition-colors bg-white text-left flex items-center justify-between"
									on:click={() =>
										(isCountryDropdownOpen =
											!isCountryDropdownOpen)}
								>
									<span>+{formData.countryCode}</span>
									<svg
										class="w-3 h-3 ml-1 text-gray-500"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M6 9l6 6 6-6" />
									</svg>
								</button>
								{#if isCountryDropdownOpen}
									<!-- svelte-ignore a11y-click-events-have-key-events -->
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<div
										class="fixed inset-0 z-40"
										on:click={() => {
											isCountryDropdownOpen = false;
											countrySearch = "";
										}}
									></div>
									<div
										class="absolute z-50 mt-1 w-[240px] max-h-[200px] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg country-dropdown"
									>
										<input
											type="text"
											bind:value={countrySearch}
											placeholder="Search..."
											class="w-full p-2 text-sm border-b border-gray-200 outline-none focus:border-[#0a998e] sticky top-0 bg-white"
											on:click|stopPropagation
										/>
										{#each filteredCountries as country}
											<button
												type="button"
												class="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors {formData.countryCode ===
												country.code
													? 'bg-teal-50 text-[#0a998e] font-medium'
													: ''}"
												on:click={() => {
													formData.countryCode =
														country.code;
													hasUserSelectedCountry = true;
													isCountryDropdownOpen = false;
													countrySearch = "";
												}}
											>
												<span class="font-medium"
													>+{country.code}</span
												>
												<span class="text-gray-600 ml-1"
													>{country.country}</span
												>
											</button>
										{/each}
										{#if filteredCountries.length === 0}
											<div
												class="px-3 py-2 text-sm text-gray-500"
											>
												No results
											</div>
										{/if}
									</div>
								{/if}
							</div>
							<input
								type="tel"
								bind:value={formData.phone}
								required
								class="flex-1 p-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0a998e] transition-colors"
								placeholder={$_("form.phonePlaceholder")}
							/>
						</div>
					</div>
					<div>
						<label
							class="block text-xs font-medium text-[#173d66] mb-0.5"
							>{$_("form.messageLabel")}</label
						>
						<textarea
							bind:value={formData.message}
							rows="2"
							class="w-full p-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0a998e] transition-colors resize-none"
							placeholder={$_("form.messagePlaceholder")}
						></textarea>
					</div>
					<div class="flex items-center space-x-2">
						<input
							type="checkbox"
							id="privacy-policy"
							bind:checked={privacyPolicyAgreed}
							class="h-4 w-4 text-[#0a998e] border-gray-300 rounded focus:ring-[#0a998e] focus:ring-2"
						/>
						<label
							for="privacy-policy"
							class="text-xs text-[#173d66]"
						>
							{$_("form.privacyText")}
							<a
								href="https://holidaybest.com/privacy-policy"
								target="_blank"
								class="text-[#0a998e] hover:underline"
								>{$_("form.privacyLink")}</a
							>
						</label>
					</div>
					<button
						type="submit"
						class="w-full py-2 text-sm text-white rounded-lg transition-all duration-300 hover:shadow-[0_0_8px_#10b3a8] disabled:opacity-50"
						style="background: linear-gradient(135deg, #0a998e, #10b3a8);"
						disabled={!formData.firstName.trim() ||
							!formData.lastName.trim() ||
							!formData.email.trim() ||
							!formData.phone.trim() ||
							!privacyPolicyAgreed}
					>
						{$_("form.submitButton")}
					</button>
				</form>
			</div>
		{/if}

		<form
			on:submit|preventDefault={handleSubmit}
			class="bg-white rounded-b-2xl"
		>
			<div class="flex px-3 pt-3 sm:px-4 sm:pt-4 gap-2 items-center">
				<input
					type="text"
					bind:value={message}
					placeholder={isStreaming || isLoadingToken
						? $_("chat.inputPlaceholderWait")
						: $_("chat.inputPlaceholder")}
					class="flex-grow p-3 sm:p-3 text-sm border border-gray-200 rounded-2xl outline-none focus:border-[#0a998e] transition-colors"
					style="font-size: 14px; font-family: 'Inter', sans-serif;"
					disabled={isStreaming || isLoadingToken}
				/>
				<button
					type="submit"
					class="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
					style="background: linear-gradient(135deg, #0a998e, #10b3a8); box-shadow: 0 2px 8px rgba(10, 153, 142, 0.3);"
					disabled={isStreaming || isLoadingToken}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="translate-x-[1px]"
					>
						<path d="M5 12h14" />
						<path d="M13 6l6 6-6 6" />
					</svg>
				</button>
			</div>
			<span class="flex justify-center text-[10px] text-gray-400"
				>{$_("chat.poweredBy")}&nbsp;<a
					href="https://balticai.eu/"
					target="_blank"
					class="font-bold">BalticAI</a
				></span
			>
		</form>
	</div>
</div>

<style>
	/* Scrollbar styles */
	.chatbot-widget-container .custom-scrollbar::-webkit-scrollbar {
		width: 6px !important;
		margin-right: 4px !important;
	}

	.chatbot-widget-container .custom-scrollbar::-webkit-scrollbar-track {
		background: transparent !important;
		margin: 4px !important;
	}

	.chatbot-widget-container .custom-scrollbar::-webkit-scrollbar-thumb,
	.chatbot-widget-container .country-dropdown::-webkit-scrollbar-thumb {
		background: linear-gradient(135deg, #0a998e, #10b3a8) !important;
		border-radius: 999px !important;
		border: 2px solid transparent !important;
		background-clip: padding-box !important;
	}

	/* Country dropdown scrollbar */
	.chatbot-widget-container .country-dropdown::-webkit-scrollbar {
		width: 6px !important;
	}

	.chatbot-widget-container .country-dropdown::-webkit-scrollbar-track {
		background: transparent !important;
	}

	.chatbot-widget-container .country-dropdown {
		scrollbar-width: thin !important;
		scrollbar-color: #0a998e transparent !important;
	}

	.chatbot-widget-container .custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: linear-gradient(135deg, #08877d, #0e9f95) !important;
		background-clip: padding-box !important;
	}

	/* Firefox scrollbar - scoped to widget */
	.chatbot-widget-container .custom-scrollbar {
		scroll-behavior: smooth !important;
		scrollbar-width: thin !important;
		scrollbar-color: #0a998e transparent !important;
	}

	/* Prevent iOS zoom - scoped to widget */
	.chatbot-widget-container input[type="text"],
	.chatbot-widget-container input[type="email"],
	.chatbot-widget-container input[type="tel"],
	.chatbot-widget-container textarea {
		font-size: 16px !important;
		-webkit-appearance: none !important;
		appearance: none !important;
	}

	/* Sticky scroll button - scoped to widget */
	.chatbot-widget-container .scroll-button-container {
		position: sticky !important;
		bottom: 0 !important;
		z-index: 10 !important;
		display: flex !important;
		justify-content: center !important;
		pointer-events: none !important;
		margin-top: -40px !important;
	}

	.chatbot-widget-container .scroll-button-container > button {
		pointer-events: auto !important;
	}

</style>
