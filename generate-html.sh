#!/bin/sh

# Exit on any error
set -e

# Check if FRONTEND_CUSTOM_URL is set
if [ -z "$FRONTEND_CUSTOM_URL" ]; then
    echo "Error: FRONTEND_CUSTOM_URL environment variable is not set"
    exit 1
fi

# Create the HTML file with the dynamic URL
cat > /usr/share/nginx/html/index.html << EOL
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HolidayBest Chatbot</title>
    <link rel="stylesheet" href="${FRONTEND_CUSTOM_URL}/style.css">
</head>
<body>
    <script type="module" src="${FRONTEND_CUSTOM_URL}/chat-widget.js"></script>
</body>
</html>
EOL

# Confirm file creation
echo "Generated index.html with FRONTEND_CUSTOM_URL: $FRONTEND_CUSTOM_URL"

# Start nginx in the foreground
exec nginx -g "daemon off;"
