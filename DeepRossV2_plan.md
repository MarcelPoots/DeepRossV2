See: /Users/marcel/Documents/cd cube/DeepRoss/V08

Deep Ross is a Windows VCL chess GUI with a home-grown engine, not just a board display. The main program is in Main.pas and uChessFunctions.pas; Main.dfm holds the form layout and embedded piece sprites. There’s also a separate mask-generation utility (Project1.dpr / Unit1.pas) and a .MPC INI-style file format for saved games and settings.
The current app supports human-vs-human, human-vs-computer and computer-vs-computer play; drag-and-drop moves; promotion; board flipping and color settings; move history; position setup via FEN; save/load; and a basic TCP mode. Its engine uses bitboards, alpha-beta search and capture extensions, with configurable search depth.
Important rewrite considerations: I wouldn’t port the rules engine line-for-line. The code separates board state across a piece array, bitboards and globals, then relies on explicit make/unmake logic—an approach that is difficult to keep consistent. The FEN reader/writer handles the piece placement and side to move, but not the full FEN state (castling rights, en-passant square, clocks); en passant is not fully implemented, and castling validation does not check every standard condition. These mean a rewrite should establish correct rules rather than assume every legacy behavior is intentional. The AI also searches synchronously on the UI thread, so stopping a search depends on the application processing UI events.
Original suggested migration plan

The outline below records the initial migration proposal. The implemented
project scope is the local human-vs-computer browser app described in the
finished status; suggestions to retain other legacy play modes or import
`.MPC` files were not included.

1.
Set the migration scope. Treat this as a browser-based, local-first chess app. Preserve the existing play modes and useful UI features, including visible board coordinates (files A–H and ranks 1–8), but decide whether the old TCP play is in scope: browsers cannot listen on raw TCP, so online play would need a WebSocket service and is best treated as a separate phase.
2.
Build a self-contained rules engine. Use ES modules and an explicit game-state object: 64 squares, side to move, castling rights, en-passant square, clocks, and move history. Implement legal moves, check/checkmate, stalemate, all promotions, castling, en passant, and draw conditions. Keep UI and search code out of the rules module.
3.
Establish correctness tests before adding the AI. Test FEN parsing/serialization, move legality, and make/unmake behavior against standard chess positions and known legal-move counts. Use the many positions embedded in Main.dfm as additional regression cases, while accounting for the legacy FEN parser’s limited format.
4.
Rebuild the interface with native browser APIs. Use semantic HTML buttons for board squares, CSS Grid for layout, and JavaScript for selection, dragging, legal-move hints, history navigation, board orientation, and promotion choice. Reuse the piece sprites embedded in Main.dfm if they can be extracted cleanly; otherwise replace them with a consistent set of assets.
5.
Add the computer opponent in a Web Worker. Port the current search ideas only after the rules engine is reliable. A worker keeps the board responsive and allows stop/progress messages; the main thread should own display state and apply the chosen move.
6.
Replace desktop persistence. Support FEN import/export and browser-friendly save/load (download/upload), and optionally autosave the current game and settings locally. Add an importer for .MPC files if preserving existing saved games is important; the legacy file stores position snapshots and move labels that can be mapped into a browser format.
7.
Finish with browser-level verification. Check complete games, undo/history navigation, promotion, save/load round trips, search cancellation, and responsive/accessibility behavior. Keep the mask utility out of the user-facing rewrite unless you still need it as a development tool.
Recommended first milestone: a vanilla-JS board with a tested rules engine and full FEN support. That gives the rest of the rewrite a sound foundation and separates chess correctness from the legacy UI and search code.

### Finished implementation status

The browser app now includes navigable move history, undo to the previous
human turn, versioned JSON game saves with move replay validation, file-based
save/load, and optional browser-local autosave for games and settings. FEN
imports begin a fresh history; saves preserve their move timeline and
repetition state. Unit tests cover the rules engine, FEN, search, and save-file
validation. Manual browser checks cover move-history navigation, autosave
restoration, and loading a JSON save. The current human-vs-computer scope is
finished. Network play, other game modes, `.MPC` import, and the mask utility
remain out of scope; board flipping and legal-move hints are optional future
enhancements.

## Alpha-beta search implementation

The computer opponent uses a negamax alpha-beta core with positional
evaluation, capture/promotion ordering, quiescence search,
principal-variation and killer/history move ordering, mate and draw scoring,
iterative deepening, time/node limits, repetition history, and Web Worker
integration. Search works on copied child positions so it does not mutate the
live game. A transposition table and broader evaluation improvements are
optional future optimizations.

### 1. Search prerequisites

- Game-end detection covers checkmate, stalemate, the fifty-move rule, threefold
  repetition, and common insufficient-material cases. Repetition history is
  tracked through reversible moves and reset after an irreversible move; a FEN
  import starts a new history because FEN contains no prior moves.
- One canonical position transition handles promotion,
  castling, en passant, castling rights, en-passant target, and clocks.
- Search uses cloned child positions, preserving the live game. A
  make/unmake API remains deferred unless profiling shows cloning is a
  bottleneck.
- Regression tests verify that search leaves its input unchanged and that
  checkmate, stalemate, and draw positions are scored correctly.

### 2. Search core

- `src/search.js` provides a pure search entry point that accepts a position,
  maximum depth, and optional search controls, and returns a legal move, score,
  completed depth, and node count.
- Negamax alpha-beta evaluates every position from the side-to-move
  perspective, negates child scores, and narrows the alpha/beta window on
  return. Terminal states are checked before the depth-zero evaluation.
- A finite score scale prefers faster checkmates and avoids
  confusing mate scores with ordinary material/evaluation scores.
- The evaluator includes material, piece-square positioning, pawn
  advancement, and bishop-pair bonuses. Quiescence search handles captures,
  promotions, and check evasions; iterative deepening reuses the previous best
  move and tracks killer/history moves for ordering.
- Search tests cover legal results, mate, material capture, stalemate,
  repetition, shallow minimax agreement, iterative-deepening limits, and
  unchanged root state.

### 3. Bounded strength and responsiveness

- Iterative deepening, time/node limits, last-completed-iteration results, and
  worker termination for cancellation are implemented. Cancellation within a
  synchronous search iteration is immediate by terminating the worker.
- A transposition table is deferred until repetition-history-aware keys and
  benchmark evidence justify the added complexity.

### 4. Web Worker integration

- The worker entry point receives full FEN, reversible-position history,
  difficulty limits, and a request ID.
- The main thread owns the displayed game. The worker searches
  a separate position and returns a move in the engine's existing move shape;
  the main thread validates and applies it before rendering.
- Cancellation and stale-result rejection protect resets, position loads, and
  history navigation. Worker and search failures are surfaced to the player.
- Quick, Standard, and Strong choices use documented search limits.

### Completion gates

1. **Met:** Rules and draw-condition tests run independently of search.
2. **Met:** Search returns legal moves, scores terminal positions, preserves
   its input, and is compared with unpruned minimax at shallow depth.
3. **Implemented:** Iterative deepening retains the last completed result;
   worker termination and request/FEN checks reject stale results.
4. **Implemented:** Search runs in a worker and worker/search failures are
   shown to the player.