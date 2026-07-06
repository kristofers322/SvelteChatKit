# Svelte Chat Widget Documentation

## 1. Project Overview

The Svelte Chat Widget is a customizable chat interface built using Svelte, Vite, and Tailwind CSS. It provides a floating chat icon that expands into a full chat window when clicked. The widget is designed to be easily integrated into existing web applications and features a typewriting animation for bot responses.

## 2. Installation

To set up the project, follow these steps:

1. Clone the repository
2. Navigate to the project directory
3. Install dependencies:
   ```
   npm install
   ```

## 3. Project Structure

The project structure is as follows:

```
svelte-chat-widget/
├── public/
│   └── index.html
├── src/
│   ├── lib/
│   │   ├── ChatIcon.svelte
│   │   ├── ChatWindow.svelte
│   │   ├── LoadingDots.svelte
│   │   └── TypingAnimation.svelte
│   ├── App.svelte
│   ├── main.js
│   └── app.css
├── package.json
├── package-lock.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── demo.html
└── demo-build.html
```

## 4. Main Components

### 4.1 App.svelte

This is the main component that renders the chat widget. It manages the state of whether the chat window is open or closed and handles the transition animations.

Key features:

- Toggles the chat window visibility
- Applies slide and fade transitions when opening/closing the chat window

### 4.2 ChatIcon.svelte

This component displays the chat icon that users can click to open the chat window.

### 4.3 ChatWindow.svelte

This is the main chat interface component. It handles the display of messages, user input, and integrates with a backend API for real-time chat functionality.

Key features:

- Displays chat messages with different styles for user and agent messages
- Handles user input and message submission
- Integrates with Dify.ai API for chat functionality
- Implements streaming responses for real-time message display
- Supports Markdown rendering for rich text formatting
- Utilizes the `marked` library for Markdown parsing and `DOMPurify` for sanitizing rendered HTML
- Displays an avatar for the agent in the chat header and messages
- Provides a close button to dismiss the chat window
- Uses Tailwind CSS for styling, including responsive design and custom colors
- Implements proper avatar image handling to maintain aspect ratio
- Manages conversation history with local storage
- Handles user and conversation ID management for persistent chats
- Implements error handling and retry logic for improved reliability
- Incorporates LoadingDots component for visual feedback during message processing

### 4.3.1 API Integration

The ChatWindow component integrates with the Dify.ai API to provide real chat functionality:

- Uses fetch API to send and receive messages
- Implements streaming responses for real-time message display
- Manages conversation history and user sessions
- Handles API errors and provides user feedback

### 4.4 TypingAnimation.svelte

This component displays a typewriting animation when the agent is composing a response. It renders the text character by character, creating a realistic typing effect.

Key features:

- Accepts text input and displays it progressively
- Customizable typing speed
- Can be easily integrated into the chat flow

### 4.5 LoadingDots.svelte

This component displays an animated loading indicator using three bouncing dots. It's used to show that the chat is waiting for a response or processing information.

Key features:

- Provides a visual indication of loading or processing using Tailwind CSS animations
- Uses three small, rounded dots that bounce with a slight delay between each
- Includes a screen reader-only text for accessibility ("Typing...")
- Can be easily integrated into the chat flow to improve user experience
- Utilizes Tailwind CSS classes for styling and animations

## 5. Building and Running the Project

To run the project in development mode:

```
npm run dev
```

To build the project for production:

```
npm run build
```

To preview the production build:

```
npm run preview
```

The project includes two HTML files for demonstration purposes:

- `demo.html`: Used for live development and testing
- `demo-build.html`: A production-ready version of the demo

## 6. Customization

### 6.1 Styling with Tailwind CSS

The chat widget's appearance is customized using Tailwind CSS. Key areas for customization include:

- Colors (background, text, buttons)
- Dimensions (width, height)
- Font styles
- Border radius
- Message bubble styles
- Avatar appearance

To modify styles:

1. Edit the Tailwind classes in the `ChatWindow.svelte` component.
2. For custom styles not covered by Tailwind, you can add them to the `src/app.css` file or use Tailwind's `@apply` directive in the component.

### 6.2 Tailwind Configuration

The project uses a custom Tailwind configuration file (`tailwind.config.js`) which includes the Typography plugin for improved Markdown rendering. You can modify this file to:

- Change the default theme
- Add custom colors, fonts, or other design tokens
- Modify the Typography plugin settings

### 6.3 PostCSS Configuration

The project includes a `postcss.config.js` file, which is used to configure PostCSS. This is typically used in conjunction with Tailwind CSS to process and optimize the CSS output.

### 6.4 Functionality

To modify the chat widget's behavior:

- Edit the `generateDummyReply` function in `ChatWindow.svelte` to change the simulated responses
- Adjust the typing animation duration and speed in `ChatWindow.svelte` and `TypingAnimation.svelte`
- Modify the initial messages in the `messages` array in `ChatWindow.svelte`
- Customize the Markdown rendering options by modifying the `marked` configuration

## 7. Dependencies

The project uses the following main dependencies:

- Svelte: ^3.54.0
- Vite: ^4.0.0
- @sveltejs/vite-plugin-svelte: ^2.0.0
- Tailwind CSS: ^3.x
- @tailwindcss/typography: ^0.5.x
- marked: (for Markdown parsing)
- DOMPurify: (for sanitizing rendered HTML)

For a complete list of dependencies, refer to the `package.json` file.

## 8. Building as a Library

The project is configured to be built as a library using Vite. The `vite.config.js` file specifies the library configuration:

```javascript
export default defineConfig({
  plugins: [svelte()],
  build: {
    lib: {
      entry: 'src/main.js',
      name: 'SvelteChatWidget',
      fileName: 'svelte-chat-widget'
    }
  }
});
```

This configuration allows the chat widget to be easily integrated into other projects as a reusable component.

## 9. Tailwind CSS Integration

The project now uses Tailwind CSS for styling, which provides several benefits:

- Rapid UI development with utility classes
- Consistent design language across the application
- Easy responsiveness and dark mode implementation
- Reduced CSS bundle size through purging unused styles

### 9.1 Tailwind CSS Setup

The Tailwind CSS setup includes:

1. Installation of Tailwind CSS and its dependencies.
2. Configuration file (`tailwind.config.js`) with content sources defined.
3. PostCSS configuration (`postcss.config.js`) for processing Tailwind directives.
4. Integration of the `@tailwindcss/typography` plugin for improved Markdown rendering.

### 9.2 Usage in Components

Tailwind classes are used directly in the HTML markup of Svelte components. For example:

```html
<div class="w-[390px] h-[550px] bg-gray-100 rounded-lg shadow-md flex flex-col fixed bottom-[90px] right-5 z-[1000] text-sm">
  <!-- Component content -->
</div>
```

This approach allows for rapid styling and easy modifications without the need for custom CSS in most cases.

### 9.3 Custom Styles

For any styles that can't be achieved with Tailwind's utility classes, you can:

1. Use the `@apply` directive in a `<style>` block within a Svelte component.
2. Add custom CSS to the `src/app.css` file.
3. Extend the Tailwind theme in the `tailwind.config.js` file.

### 9.4 Responsive Design

Tailwind's responsive utilities are used to ensure the chat widget looks good on various screen sizes. You can further customize the responsive behavior by using Tailwind's responsive prefixes (e.g., `md:`, `lg:`) in the component markup.

### 9.5 Performance Considerations

Tailwind CSS is configured to purge unused styles in production builds, ensuring a minimal CSS bundle size. Make sure to run production builds when deploying to benefit from this optimization.

## 10. Docker Deployment

The project includes a Dockerfile for easy deployment using Docker. Here are the key aspects of the Docker setup:

- Uses Node.js 14 as the base image
- Installs project dependencies
- Builds the application
- Serves the built application using ``npx serve`` on port 5000
- To build and run the Docker container:

Build the Docker image:

``docker build -t svelte-chat-widget .``


Run the container:

``docker run -p 5000:5000 svelte-chat-widget``


The application will be accessible at http://localhost:5000.

With these updates, the documentation should now accurately reflect the current state of the project, including the new features in ChatWindow.svelte and ChatIcon.svelte, as well as the Docker deployment process.
