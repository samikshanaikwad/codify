# Codify Chat Frontend

A minimal ChatGPT-style web frontend for custom n8n workflows.

## Features

- **Chat Interface**: Clean, dark-themed chat UI with sidebar for chat threads
- **Local Storage**: Chats saved locally in browser
- **Markdown Support**: Renders assistant responses with code blocks, headers, bold, italics, links
- **Copy Functionality**: Copy buttons for messages and code blocks
- **Mobile Responsive**: Sidebar overlays on mobile devices
- **Shareable Links**: Export chats as shareable URLs
- **Stop Generation**: Abort ongoing requests

## Setup

1. **Clone or download** the files: `index.html`, `styles.css`, `app.js`, `config.js`

2. **Configure webhook URL** in `config.js`:
   ```javascript
   const config = {
     webhookUrl: "https://your-n8n-webhook-url"
   };
   export default config;
   ```

3. **Open `index.html`** in your browser to start chatting

## n8n Integration

The frontend sends POST requests to your n8n webhook with this payload:

```json
{
  "source": "codify-frontend",
  "thread_id": "t_1234567890",
  "timestamp": 1640995200000,
  "messages": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"}
  ],
  "latest": "Hello",
  "meta": {"user": "Anusha", "app": "Codify"}
}
```

Your n8n workflow should return responses in one of these formats:

```json
// Simple
{"reply": "Hello from n8n"}

// OpenAI-like
{"choices": [{"message": {"content": "Hi!"}}]}

// Plain text
Hi from n8n
```

## Deployment

### Static Hosting

For static hosting (GitHub Pages, Netlify, etc.), simply upload the HTML, CSS, and JS files. The webhook URL in `config.js` will be public, so consider using environment variables if your host supports them.

### Vercel/Next.js

For server-side proxying (recommended for production):

1. Create `api/codify.js` with the handler code
2. Set environment variables:
   - `N8N_WEBHOOK_URL`: Your n8n webhook URL
   - `CODIFY_SHARED_TOKEN`: Optional auth token
   - `ALLOW_ORIGIN`: CORS origin (default: "*")
3. Deploy to Vercel

## Security

- Add `config.js` to `.gitignore` to keep webhook URLs private
- Use environment variables for sensitive data in production
- Configure CORS appropriately for your domain

## Browser Support

Modern browsers with ES6 modules support (Chrome 61+, Firefox 60+, Safari 10.1+)
