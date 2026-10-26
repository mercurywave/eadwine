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
2. Start the **server** on an available loopback port
3. Start the **client** dev server on a separate available loopback port, configured to proxy API requests to the server

The selected client URL is printed to the terminal.

### Building for Production

```bash
npm run build
```

This builds both client and server.

### Running the Server Production Build

```bash
npm run start
```

Serves the built client from an available loopback port, printed to the terminal.

### Desktop Application

```bash
npm run dev:electron
```

Starts Vite and opens Eadwine in Electron. To run the compiled desktop application locally, use `npm run start:electron`. To create a Windows installer, use `npm run package:win`.

### Storage

Project Markdown files are stored in `Documents/Eadwine/projects`. Per-user application data, including settings, project metadata, and chat history, is stored in the operating system's application-data directory under `Eadwine`. The Electron application obtains both locations from Windows' known folders, including redirected or OneDrive-backed Documents folders.

Set `CONTENT_DIR` or `APP_DATA_DIR` to override either location when running the server outside the desktop application.
