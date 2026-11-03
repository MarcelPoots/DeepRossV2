# Deep Ross V2
![Deep Ross V2](./documentation/deeprosv2.png)

A browser-based, local-first chess app, planned for human-vs-computer play.

## Current status

The current version displays the standard chess starting position and supports
moving pieces by dragging or by selecting a piece and destination. Capturing an
opposing piece is supported, but chess movement rules and legal-move validation
have not been implemented, so pieces can be moved to any square. File labels
A–H and rank labels 1–8 are shown on the board. Use the Reset button to restore
the original piece positions. The current position is displayed as FEN; its
board layout and tracked move metadata update as pieces move. Because legal
moves are not validated, this FEN reflects the app's current board and move
actions rather than a guaranteed legal chess position. The computer opponent
has not been implemented.

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
- `src/main.js` — renders the board and handles UI interaction
- `src/fen.js` — parses and serializes Forsyth–Edwards Notation positions
- `src/game.js` — UI-independent game state, move application, and FEN access
- `src/drag-and-drop.js` — handles pointer-based piece dragging
- `test/fen.test.js` — FEN parsing and serialization tests
- `test/game.test.js` — game state and move application tests

## Run tests

Run the chess-logic unit tests with Node.js:

```sh
npm test
```

## Planned direction

The first milestone is a vanilla JavaScript chessboard backed by a tested rules
engine with full FEN support. The initial game scope is one human playing
against the computer; network play and other modes are not planned for this
version. See [DeepRossV2_plan.md](./DeepRossV2_plan.md) for the broader roadmap.