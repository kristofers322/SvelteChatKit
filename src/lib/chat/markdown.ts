import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';

const marked = new Marked(
	markedHighlight({
		emptyLangClass: 'hljs',
		langPrefix: 'hljs language-',
		highlight(code: string, lang: string): string {
			const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
			try {
				return hljs.highlight(code, { language }).value;
			} catch {
				return hljs.highlight(code, { language: 'plaintext' }).value;
			}
		}
	})
);

marked.setOptions({ gfm: true, breaks: true });

if (typeof window !== 'undefined' && DOMPurify.isSupported) {
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.tagName === 'A' && node.hasAttribute('href')) {
			node.setAttribute('target', '_blank');
			node.setAttribute('rel', 'noopener noreferrer');
		}
	});
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

// Assistant output is untrusted (prompt injection via RAG/tools/web content
// reaches it), so beyond DOMPurify's XSS defaults we also strip what enables
// phishing UI: form controls, style elements/attributes, and SVG/MathML.
const SANITIZE_CONFIG = {
	USE_PROFILES: { html: true },
	FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea', 'style'],
	FORBID_ATTR: ['style']
};

/**
 * Renders markdown to sanitized HTML. Fenced code blocks receive highlight.js
 * classes ("hljs language-x"), and links open in a new tab with
 * rel="noopener noreferrer". Browser-only (DOMPurify): on the server it
 * returns the source as escaped plain text instead.
 */
export function renderMarkdown(source: string): string {
	if (typeof window === 'undefined' || !DOMPurify.isSupported) {
		return escapeHtml(source);
	}
	const html = marked.parse(source, { async: false }) as string;
	return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
