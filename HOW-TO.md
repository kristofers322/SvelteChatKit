# How to Deploy the Chat Widget Project

## Prerequisites

- A Linux VPS (e.g., Ubuntu 20.04 or later)
- Docker and Docker Compose installed on the VPS
- A domain name pointing to your VPS (recommended)

## Steps

1. Copy the compressed project to your VPS:
   ```
   scp /path/to/local/chat-widget.tar.gz user@your-vps-ip:/path/on/vps/
   ```

2. SSH into your VPS and navigate to the project directory:
   ```
   ssh user@your-vps-ip
   cd /path/on/vps/
   tar -xzvf chat-widget.tar.gz
   cd chat-widget
   ```

3. Create and edit the .env file:
   ```
   cp .env.example .env
   nano .env
   ```

   Explanation of .env variables:
   - ALLOWED_DOMAINS: An array of domains allowed to access your backend API (e.g., ["https://your-frontend-domain.com"])
   - FRONTEND_CUSTOM_URL: The URL where your frontend will be hosted (e.g., https://widget.yourdomain.com)
   - BACKEND_CUSTOM_URL: The URL where your backend API will be hosted (e.g., https://api.yourdomain.com)
   - DIFY_API_KEY: Your Dify API key for authentication
   - NODE_ENV: Set to "production" for deployment
   - JWT_SECRET: A secret key for JWT token generation. Generate a strong, random string using https://jwtsecret.com/generate
   - FRONTEND_PORT: The port for the frontend service (default is 5000)
   - BACKEND_PORT: The port for the backend service (default is 3000)

4. Configure your domain and ports:
   - Set up your domain's DNS to point to your VPS IP address
   - Configure your VPS to route traffic:
     - BACKEND_CUSTOM_URL should route to localhost:3000
     - FRONTEND_CUSTOM_URL should route to localhost:5000
   
   You may need to set up a reverse proxy (like Nginx) to handle this routing.

5. Build and run the Docker containers:
   ```
   docker-compose up -d
   ```

   This command will build the images and start the containers based on the configuration in docker-compose.yml.

6. Embedding the chat widget:
   Add the following script and style tags to your website's HTML:

   ```html
   <script type="module" src="FRONTEND_CUSTOM_URL/chat-widget.js"></script>
   <link rel="stylesheet" href="FRONTEND_CUSTOM_URL/style.css">
   ```

   Replace FRONTEND_CUSTOM_URL with the actual URL you set in the .env file (e.g., https://widget.yourdomain.com).

## Additional Notes

- Ensure that your VPS firewall allows traffic on ports 80 and 443 for HTTP and HTTPS traffic.
- Set up HTTPS using a reverse proxy like Nginx and Let's Encrypt for secure connections. This is crucial for production deployments.
- Regularly update your application and server for security and performance improvements.
- If you need to change the default ports, update the FRONTEND_PORT and BACKEND_PORT variables in your .env file. The docker-compose.yml file will use these variables to map the correct ports.
- Monitor your application logs using `docker-compose logs` for troubleshooting and ensuring smooth operation.
