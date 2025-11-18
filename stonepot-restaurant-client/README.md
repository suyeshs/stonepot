# Stonepot Restaurant Client - Frontend

Next.js frontend for restaurant ordering with real-time multimodal display.

## Features

- Real-time WebSocket connection to Cloudflare Durable Objects
- Multimodal display (text transcriptions + visual content)
- Automatic reconnection on disconnect
- Responsive design with Tailwind CSS
- TypeScript for type safety

## Directory Structure

```
app/
├── components/          # React components
│   └── MultimodalDisplay.tsx
├── services/           # Client services
│   └── DisplayWebSocket.ts
├── layout.tsx          # Root layout
├── page.tsx           # Main page
└── globals.css        # Global styles
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Cloudflare Worker URL
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Environment Variables

```
NEXT_PUBLIC_WORKER_URL=https://your-worker.workers.dev
NEXT_PUBLIC_API_URL=https://your-bun-server.run.app
```

## Usage

### Connect to a Session

Open the app with a session ID:
```
http://localhost:3000?session=abc123
```

If no session ID is provided, a random one will be generated.

### Display Types

The app supports these visual display types:
- **dish_card**: Show detailed dish information
- **menu_section**: Display a section of the menu
- **order_summary**: Show current order
- **confirmation**: Order confirmation page
- **webpage**: Embedded webpage
- **snippet**: Text/markdown snippet

## Development

- Built with Next.js 14 (App Router)
- Styled with Tailwind CSS
- TypeScript throughout
- Real-time WebSocket updates

## Building for Production

```bash
npm run build
npm run start
```

## Deployment

Deploy to Vercel, Netlify, or any Node.js hosting:

### Vercel
```bash
vercel
```

### Docker
```bash
docker build -t stonepot-restaurant-client .
docker run -p 3000:3000 stonepot-restaurant-client
```

## Future Enhancements

- [ ] Implement full dish card component with images
- [ ] Add menu section grid layout
- [ ] Create interactive order summary with edit capabilities
- [ ] Add confirmation page with order tracking
- [ ] Implement error boundaries
- [ ] Add loading states
- [ ] Add accessibility features
- [ ] Add animations for display updates
