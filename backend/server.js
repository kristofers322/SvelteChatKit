require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Use environment variable in production
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const ALLOWED_DOMAINS = process.env.ALLOWED_DOMAINS ? JSON.parse(process.env.ALLOWED_DOMAINS) : ['http://localhost:5000'];
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SERVICES_API_TOKEN = process.env.SERVICES_API_TOKEN;
const SERVICES_ENPOINT = process.env.SERVICES_ENPOINT ? process.env.SERVICES_ENPOINT.trim().replace(/\/$/, '') : null;

if (!SERVICES_API_TOKEN || !SERVICES_ENPOINT) {
	console.error('SERVICES_API_TOKEN and SERVICES_ENPOINT are required environment variables');
	process.exit(1);
}

if (!SERVICES_ENPOINT.startsWith('http://') && !SERVICES_ENPOINT.startsWith('https://')) {
	console.error('SERVICES_ENPOINT must start with http:// or https://');
	process.exit(1);
}

if (!DIFY_API_KEY) {
	console.error('DIFY_API_KEY is not set in the environment variables');
	process.exit(1);
}

app.use((req, res, next) => {
	console.log(`Incoming request from origin: ${req.headers.origin}`);
	next();
});

app.use(cors({
	origin: function(origin, callback) {
		console.log(`Checking CORS for origin: ${origin}`);
		console.log(`IS_PRODUCTION: ${IS_PRODUCTION}`);
		console.log(`ALLOWED_DOMAINS: ${JSON.stringify(ALLOWED_DOMAINS)}`);

		if (!IS_PRODUCTION || !origin || ALLOWED_DOMAINS.some(domain => origin.startsWith(domain))) {
			console.log('CORS check passed');
			callback(null, true);
		} else {
			console.log('CORS check failed');
			callback(new Error('Not allowed by CORS'));
		}
	},
	credentials: true
}));

app.use(express.json());

// JWT generation endpoint
app.post('/generate-token', (req, res) => {
	const { userId } = req.body;
	console.log('Generating token for userId:', userId);
	if (!userId) {
		console.log('Token generation failed: User ID is required');
		return res.status(400).send('User ID is required');
	}
	const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
	console.log('Token generated successfully');
	res.json({ token });
});

// JWT verification middleware
const verifyToken = (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

	console.log('Verifying token:', token);

	if (!token) {
		console.log('Token verification failed: No token provided');
		return res.status(403).send('A token is required for authentication');
	}

	try {
		const decoded = jwt.verify(token, JWT_SECRET);
		req.user = decoded;
		console.log('Token verified successfully for userId:', decoded.userId);
		next();
	} catch (err) {
		console.log('Token verification failed:', err.message);
		return res.status(401).send('Invalid Token');
	}
};

// Async function for chat-messages endpoint
app.post('/chat-messages', verifyToken, async (req, res) => {
	try {
		// Dynamically import Dify client
		const { ChatClient } = await import('dify-client');

		// Initialize Chat Client
		const chatClient = new ChatClient(DIFY_API_KEY);

		console.log('Received chat message request:', req.body);
		const { query, conversation_id, user, files } = req.body;

		// Prepare chat message parameters
		const inputs = {};
		const streaming = true;
		const remoteUrlFiles = files && Array.isArray(files) ? files : null;

		// Create chat message
		const response = await chatClient.createChatMessage(
			inputs,
			query || 'What are the specs of the iPhone 13 Pro Max?',
			user || 'web-user',
			streaming,
			conversation_id || null,
			remoteUrlFiles
		);

		// Set headers for streaming
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		});

		// Get the stream from the response
		const stream = response.data;

		// Track the last agent thought for history recording
		let lastAgentThought = null;
		let buffer = '';

		stream.on('data', async (chunk) => {
			res.write(chunk);

			// Add chunk to buffer and try to process complete events
			buffer += chunk.toString();

			// Process complete events from buffer
			while (true) {
				const eventEnd = buffer.indexOf('\n\n');
				if (eventEnd === -1) break;

				const event = buffer.slice(0, eventEnd);
				buffer = buffer.slice(eventEnd + 2);

				if (event.startsWith('data:')) {
					try {
						const jsonStr = event.slice(5).trim();
						if (jsonStr) {
							const data = JSON.parse(jsonStr);
							if (data.event === 'agent_thought' && data.thought) {
								lastAgentThought = data;
								console.log('Found agent thought:', data.thought);
							}
						}
					} catch (error) {
						console.error('Error parsing event:', error);
					}
				}
			}
		});

		stream.on('end', async () => {
			console.log('Stream completed');

			try {
				if (lastAgentThought) {
					if (IS_PRODUCTION) {
						console.log('Recording history with thought:', lastAgentThought.thought);
						// Record chat history using the last agent thought (only in production)
						const historyUrl = `${SERVICES_ENPOINT}/api/public/chatbot/history`;
						console.log('Attempting to record chat history at URL:', historyUrl);

						const payload = {
							project_id: process.env.PROJECT_ID,
							conversation_id: lastAgentThought.conversation_id,
							chatbot_id: process.env.CHATBOT_ID,
							user_id: user,
							query: query,
							answer: lastAgentThought.thought,
							history_id: lastAgentThought.message_id
						};
						console.log('Request payload:', payload);

						try {
							const historyResponse = await fetch(historyUrl, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									'Authorization': `Bearer ${SERVICES_API_TOKEN}`
								},
								body: JSON.stringify(payload)
							});

							if (!historyResponse.ok) {
								const errorText = await historyResponse.text();
								console.error('History API error response:', {
									status: historyResponse.status,
									statusText: historyResponse.statusText,
									body: errorText
								});
								throw new Error(`History API responded with status ${historyResponse.status}: ${errorText}`);
							}

							const historyData = await historyResponse.json();
							console.log("Chat history recorded successfully:", historyData);
						} catch (error) {
							console.error("Failed to record chat history:", {
								error: error.message,
								url: historyUrl,
								stack: error.stack
							});
							throw error;
						}
					} else {
						console.log('Skipping history recording in development environment');
					}
				}
			} catch (error) {
				console.error("Error recording chat history:", error);
			}

			res.end();
		});

		stream.on('error', (error) => {
			console.error('Stream error:', error);
			res.status(500).end();
		});

	} catch (error) {
		console.error('Error in chat-messages endpoint:', error);
		if (!res.headersSent) {
			res.status(500).send(`Error: ${error.message}`);
		}
	}
});

// Endpoint for fetching conversation history
app.post('/conversation-histories', verifyToken, async (req, res) => {
	try {
		console.log('Received conversation history request:', req.body);
		const { user, conversation_id } = req.body;

		const difyResponse = await fetch(`https://api.dify.ai/v1/messages?user=${user}&conversation_id=${conversation_id}`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${DIFY_API_KEY}`,
				'Content-Type': 'application/json'
			}
		});

		console.log('Dify API conversation history response status:', difyResponse.status);
		const data = await difyResponse.json();

		if (!difyResponse.ok) {
			throw new Error(JSON.stringify(data));
		}

		res.json(data.data.sort((a, b) => a.created_at - b.created_at));
	} catch (error) {
		console.error('Error fetching conversation history:', error);
		res.status(500).send(JSON.parse(error.message));
	}
});

app.get("/parameters", verifyToken, async (req, res) => {
	try {
		const { user } = req.body;
		const difyResponse = await fetch(`https://api.dify.ai/v1/parameters?user=${user}`, {
			method: 'GET',
			headers: {
				"Authorization": `Bearer ${DIFY_API_KEY}`,
				"Content-Type": "application/json"
			}
		})

		console.log("Dify Parameters response:", difyResponse.status)

		if (!difyResponse.ok) {
			throw new Error(`Dify API responded with status: ${difyResponse.status}`)
		}

		const data = await difyResponse.json();
		res.json(data)
		console.log(data)
	} catch (error) {
		console.error('Error fetching parameters:', error);
		res.status(500).send(`Error fetching parameters: ${error.message}`);
	}
})

const ERROR_NOTIF_URL = 'https://chatnotif.balticai.ee/api/error';
const ERROR_NOTIF_API_KEY = 'd8b87513c917fd2374d239ed0bae2b4c89c1504efa1007a5ae0a8c89c63bb091';

app.post('/report-error', async (req, res) => {
	try {
		const { error } = req.body;
		await fetch(ERROR_NOTIF_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': ERROR_NOTIF_API_KEY
			},
			body: JSON.stringify({ service: 'holidaybest', error: error || 'Unknown error' })
		});
		res.json({ ok: true });
	} catch (err) {
		console.error('Error reporting to notification service:', err);
		res.status(500).json({ ok: false });
	}
});

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Server is running on port ${PORT}`);
	console.log('Environment:', IS_PRODUCTION ? 'Production' : 'Development');
	console.log('Allowed domains:', ALLOWED_DOMAINS);
	console.log('Services endpoint:', SERVICES_ENPOINT);
	console.log('Required environment variables loaded:', {
		DIFY_API_KEY: !!DIFY_API_KEY,
		SERVICES_API_TOKEN: !!SERVICES_API_TOKEN,
		PROJECT_ID: !!process.env.PROJECT_ID,
		CHATBOT_ID: !!process.env.CHATBOT_ID
	});
});
