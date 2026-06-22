# Eadwine

Automated notetaker and organizer. Named for the 12th centry scribe, Eadwine of Canterbury.

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation & Run

```bash
npm install
npm run dev
```

This will:
1. Install dependencies for both `client` and `server`
2. Start the **server** on `http://localhost:3003`
3. Start the **client** dev server on `http://localhost:6777` (configured to proxy API requests to the server)

Open `http://localhost:6777` in your browser.

### Building for Production

```bash
npm run build
```

This builds both client and server.

### Running Production Build

```bash
npm run start
```

Serves the built client from the server at `http://localhost:3003`.
