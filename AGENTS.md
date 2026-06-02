# ZombiaTauriClient

From the name, this is a native client for a game called zombia.io, made with Tauri.

## Project Tech Stack
- [Tauri v2](https://v2.tauri.app/)
- [SvelteKit](https://kit.svelte.dev/) - frontend framework; no SSR, just statically generated
- [Tailwind v4](https://tailwindcss.com/) - utility-first CSS framework 
- [Vite](https://vitejs.dev/) - build tool for the frontend
- [pnpm](https://pnpm.io/) - package manager

### Tauri plugins
```toml
tauri-plugin-svelte = "1.1.0"
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-shell = "2.2.1"
tauri-plugin-http = "2"
```

## Project Quirks
- This client contains a local server at `./Server/`. The binaries are shipped with the release build.

## Project Structure
- `./src/` - frontend code: UI components are written in Svelte and engine components are written in JavaScript (with some .svelte.js files)
- `./Server/` - local server code, written entirely in JavaScript
- `./src-tauri/` - backend code in Rust, does not do too much other than holding Tauri configurations.
- `./static/` - static assets such as images, fonts, and other resources that are served directly to the client.
