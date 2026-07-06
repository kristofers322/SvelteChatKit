<script>
	export let href = "";

	// Comprehensive HTML entity decoding function
	function decodeHtmlEntities(text) {
		const textArea = document.createElement("textarea");
		textArea.innerHTML = text;
		return textArea.value;
	}

	// Function to decode specific email-related HTML entities
	function decodeEmailEntities(text) {
		// Decode common HTML entities used in email addresses
		return text
			.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) =>
				String.fromCharCode(parseInt(hex, 16)),
			)
			.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
	}

	// Determine if the link is a mailto link
	$: isMailto = href.startsWith("mailto:");

	// Process href to handle both mailto and other links
	$: processedHref = isMailto
		? "mailto:" + decodeEmailEntities(href.replace("mailto:", ""))
		: decodeHtmlEntities(href);

	// Log for debugging
	$: {
		console.log("Original href:", href);
		console.log("Processed href:", processedHref);
	}
</script>

<a
	href={processedHref}
	target={isMailto ? "_self" : "_blank"}
	rel={isMailto ? "" : "noopener noreferrer"}
	class="text-gray-800 font-bold hover:underline"
>
	{#if isMailto}
		{processedHref.replace("mailto:", "")}
	{:else}
		<slot></slot>
	{/if}
</a>
