# Deep Ross V2

A browser-based, local-first chess app, planned for human-vs-computer play.

## Current status

The current version is an initial UI scaffold. It displays the standard chess
starting position, but the board is not interactive yet. Chess rules, legal
moves, and the computer opponent have not been implemented.

## Run locally

Requirements: Node.js/npm and Python 3 (used by the static development server).
From the project directory, start the server with:

```sh
npm start
```

Open [http://localhost:8000](http://localhost:8000) in your browser. Stop the
server with Ctrl+C.

## Project files

- `src/index.html` — page structure and app title
- `src/styles.css` — responsive page and chessboard styling
- `src/main.js` — renders the starting board

## Planned direction

The first milestone is a vanilla JavaScript chessboard backed by a tested rules
engine with full FEN support. The initial game scope is one human playing
against the computer; network play and other modes are not planned for this
version. See [DeepRossV2_plan.md](./DeepRossV2_plan.md) for the broader roadmap.