# How Deep Ross works

Deep Ross is a small chess app that runs in your browser. It is built with
plain JavaScript modules and browser APIs; it does not need a server for chess
rules, computer play, or saving games. The local Python server is only used to
serve the files while developing.

## The main idea

The app keeps the chess rules, the screen, and the computer player separate:

```text
index.html + styles.css
        |
        v
     main.js  <------>  chess-board.js
        |                     draws the board
        |                     sends player actions
        +------> game.js
        |         owns chess rules and positions
        |
        +------> game-save.js
        |         checks and restores saved games
        |
        +------> search-worker.js
                  runs the computer's search
                         |
                         v
                     search.js
```

`main.js` connects these pieces. It decides what should happen after a click,
a move, a history action, or a computer reply. The rules engine does not know
about buttons or the page, and the computer search does not control the
displayed board.

## What each file does

- `src/index.html` contains the page structure and controls.
- `src/styles.css` lays out the page and makes the board and controls fit
  different screen sizes.
- `src/main.js` coordinates the current game, player settings, move history,
  dialogs, saves, and computer turns.
- `src/components/chess-board.js` is the `<chess-board>` browser component. It
  draws accessible square buttons and turns clicks and drags into move events.
- `src/game.js` stores the chess position and implements legal moves,
  check/checkmate, stalemate, draw detection, and move application. It has no
  user-interface or computer-search responsibilities.
- `src/fen.js` reads and writes all six fields of a FEN position, including
  castling rights, en-passant target, and move clocks.
- `src/search.js` evaluates positions and searches legal moves using
  iterative-deepening negamax with alpha-beta pruning, move ordering,
  quiescence, and limits.
- `src/search-worker.js` runs the search in a Web Worker so it does not block
  the page while thinking.
- `src/game-save.js` reads and writes versioned game-save files. It rebuilds
  imported games by replaying the moves and checking that they are legal.
- `src/animation.js` adds a short visual animation after a move.

## What happens when someone moves

1. The board component reports the selected squares to `main.js`.
2. The page asks `game.js` to apply the move. The rules engine checks it and
   updates the position only if it is legal.
3. The page records the resulting position and move in its history, updates the
   board and FEN display, and autosaves if autosave is enabled.
4. If the computer is next, the page sends the current FEN, repetition history,
   difficulty limits, and a request ID to `search-worker.js`.
5. The worker searches its own position and sends progress and a move back.
   The page checks that the result still belongs to the current game and then
   applies the move through `game.js` before drawing it.

Resetting, loading a position, or navigating to another history entry cancels
the current worker. Request IDs and a FEN check help prevent an old search
result from changing a newer game.

## Position and move history

The rules engine keeps the current board and chess metadata together: whose
turn it is, castling rights, the en-passant target, the halfmove clock, and the
fullmove number. Its position history also keeps the reversible sequence
needed for threefold-repetition detection. Pawn moves, captures, or lost
castling rights start a new reversible sequence.

Separately, the page keeps a timeline for the visible move list and navigation.
Each timeline entry has a FEN snapshot, the move that led to it, and its
repetition history. This lets the page show an earlier position without
changing or guessing chess state. Moving after visiting an earlier entry starts
a new line by dropping the later entries.

Undo returns to the previous position where it was the human player's turn,
which normally removes the human move and the computer's reply together. The
move list can also jump directly to a specific position.

## FEN and saved games

FEN is useful for sharing a single position. Loading a FEN starts a new game
history because a FEN string does not contain the moves that led to that
position.

A Deep Ross JSON save preserves more: the starting FEN, the sequence of moves,
the selected position in the timeline, the human's side, and the difficulty.
When a save is loaded, `game-save.js` replays each move from the starting
position and checks the resulting FEN. Invalid or inconsistent saves are
rejected before they replace the current game. Replaying also rebuilds
repetition history.

Browser autosave uses `localStorage` on this device. It is enabled by default;
turning it off removes the locally stored game. Downloaded JSON saves can be
kept or moved separately. No account or network service is involved.

## The computer player

`search.js` examines possible legal moves and scores positions from the
current player's perspective. It looks at material and simple positional
features, and searches tactical continuations such as captures and promotions.
Iterative deepening completes one depth at a time; the search limits stop work
when the chosen depth, time, or node budget is reached.

The difficulty presets are:

| Level | Maximum depth | Time limit | Node limit |
|---|---:|---:|---:|
| Quick | 2 | 350 ms | 20,000 |
| Standard | 4 | 1,500 ms | 120,000 |
| Strong | 6 | 3,500 ms | 500,000 |

These are maximum limits, not guaranteed search depths: the first limit
reached stops the search. If a deeper iteration is interrupted, the worker
returns the best move from the last fully completed iteration.

## Run and test

From the project directory:

```sh
npm start
```

Then open [http://localhost:8000](http://localhost:8000). Run the unit tests
with:

```sh
npm test
```

The tests cover FEN, legal moves and special rules, draw detection, search
behavior, and save-file validation.

## Scope

This version is for one human playing against the computer. Network play,
human-vs-human and computer-vs-computer modes, `.MPC` importing, and the
legacy mask utility are outside the current project scope. A transposition
table and optional interface enhancements such as board flipping and legal
move hints can be considered separately; they are not required for the
finished current version.
