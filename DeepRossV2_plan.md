See: /Users/marcel/Documents/cd cube/DeepRoss/V08

Deep Ross is a Windows VCL chess GUI with a home-grown engine, not just a board display. The main program is in Main.pas and uChessFunctions.pas; Main.dfm holds the form layout and embedded piece sprites. There’s also a separate mask-generation utility (Project1.dpr / Unit1.pas) and a .MPC INI-style file format for saved games and settings.
The current app supports human-vs-human, human-vs-computer and computer-vs-computer play; drag-and-drop moves; promotion; board flipping and color settings; move history; position setup via FEN; save/load; and a basic TCP mode. Its engine uses bitboards, alpha-beta search and capture extensions, with configurable search depth.
Important rewrite considerations: I wouldn’t port the rules engine line-for-line. The code separates board state across a piece array, bitboards and globals, then relies on explicit make/unmake logic—an approach that is difficult to keep consistent. The FEN reader/writer handles the piece placement and side to move, but not the full FEN state (castling rights, en-passant square, clocks); en passant is not fully implemented, and castling validation does not check every standard condition. These mean a rewrite should establish correct rules rather than assume every legacy behavior is intentional. The AI also searches synchronously on the UI thread, so stopping a search depends on the application processing UI events.
Suggested plan
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