import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.FRONTEND_PORT || 5000;

// Enable CORS for all routes
app.use(cors());

// Serve static files from the 'dist' directory with correct MIME types
app.use(express.static(path.join(__dirname, 'dist'), {
	setHeaders: (res, path) => {
		if (path.endsWith('.js')) {
			res.setHeader('Content-Type', 'application/javascript');
		}
	}
}));

// Serve the ES module build for module loaders (embed uses type="module")
app.get('/chat-widget.js', (req, res) => {
	res.sendFile(path.join(__dirname, 'dist', 'main.es.js'));
});

// Optional explicit endpoints (useful for advanced embeds)
app.get('/chat-widget.es.js', (req, res) => {
	res.sendFile(path.join(__dirname, 'dist', 'main.es.js'));
});
app.get('/chat-widget.umd.js', (req, res) => {
	res.sendFile(path.join(__dirname, 'dist', 'main.umd.js'));
});

// Handle all other routes
app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
	console.log(`Frontend URL: ${process.env.FRONTEND_CUSTOM_URL}`);
	console.log(`Backend URL: ${process.env.BACKEND_CUSTOM_URL}`);
});
