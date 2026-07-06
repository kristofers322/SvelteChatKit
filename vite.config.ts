import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// Expose PUBLIC_* vars on import.meta.env so src/lib/chat/config.ts can
	// read them without depending on SvelteKit's $env modules.
	envPrefix: ['VITE_', 'PUBLIC_']
});
