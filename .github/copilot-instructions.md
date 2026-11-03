# Deep Ross Agent Guide

## Project direction

Deep Ross is being rewritten as a browser-based, local-first chess app. The
initial version is for human-vs-computer play only. Use `DeepRossV2_plan.md` as
the project roadmap, while prioritizing correct chess rules over reproducing
legacy bugs.

The legacy application is a Windows VCL program. Its rules and UI are tightly
coupled, so treat it as a behavioral reference rather than a design to port
line-for-line. The legacy source files described by the plan are not currently
in this workspace; do not assume they are available.

## Engineering principles

- Keep the chess rules engine independent of the interface and computer player.
- Represent game state explicitly, including side to move, castling rights,
  en-passant square, clocks, and move history.
- Implement and test legal chess behavior—including castling, en passant,
  promotion, check, and draw conditions—before adding search features.
- Use browser-native APIs and ES modules for the initial implementation. Keep
  the board responsive; run computer search in a Web Worker.
- Focus the interface and game flow on one human player against the computer.
  Do not add human-vs-human, computer-vs-computer, or network play.
- Preserve a simple, accessible interface and support browser-friendly
  save/load alongside full FEN import/export.
- Keep `.MPC` importing and the mask utility out of scope unless a task
  explicitly brings them in.

## Working approach

1. Follow the roadmap's recommended first milestone: a vanilla-JavaScript board
   backed by a tested rules engine with full FEN support.
2. Make focused changes that fit the existing project structure; inspect the
   relevant code and tests before choosing or adding dependencies.
3. Add regression tests for behavior changes. Use standard chess positions and
   known legal-move counts where applicable.
4. Run the smallest relevant checks after changes and report anything that
   could not be verified.