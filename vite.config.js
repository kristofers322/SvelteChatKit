import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte({ emitCss: false })],
	build: {
		lib: {
			entry: 'src/main.js',
			name: 'SvelteChatWidget',
			fileName: 'agent-chat-widget',
			formats: ['es', 'umd']
		},
		rollupOptions: {
			output: {
				entryFileNames: `[name].[format].js`,
				chunkFileNames: `[name].[format].js`,
				assetFileNames: `[name].[ext]`
			}
		}
	},
	define: {
		'import.meta.env.BACKEND_CUSTOM_URL': JSON.stringify(process.env.BACKEND_CUSTOM_URL),
		'import.meta.env.FRONTEND_CUSTOM_URL': JSON.stringify(process.env.FRONTEND_CUSTOM_URL)
	},
	server: {
		open: '/demo.html'
	}
});
