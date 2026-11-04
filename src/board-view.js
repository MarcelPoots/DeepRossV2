export const pieceNames = {
    K: "king",
    Q: "queen",
    R: "rook",
    B: "bishop",
    N: "knight",
    P: "pawn",
    k: "king",
    q: "queen",
    r: "rook",
    b: "bishop",
    n: "knight",
    p: "pawn",
};

export const pieceSymbols = {
    K: "♔",
    Q: "♕",
    R: "♖",
    B: "♗",
    N: "♘",
    P: "♙",
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
};

const whitePieces = new Set(["K", "Q", "R", "B", "N", "P"]);

export function squareName(index) {
    const row = Math.floor(index / 8);
    const column = index % 8;
    return `${String.fromCharCode(97 + column)}${8 - row}`;
}

export function describePiece(piece) {
    return `${whitePieces.has(piece) ? "White" : "Black"} ${pieceNames[piece]}`;
}

export function createBoardView({ board, fenDisplay, getGame, getSelectedSquare, getFen }) {
    function renderBoard(focusIndex = null) {
        const game = getGame();
        const selectedSquare = getSelectedSquare();
        const squares = document.createDocumentFragment();

        // Rebuild from game state so labels, accessibility text, and selection
        // styling stay in sync after each move.
        game.board.forEach((rank, row) => {
            rank.forEach((piece, column) => {
                const index = row * 8 + column;
                const square = document.createElement("button");
                const isLightSquare = (row + column) % 2 === 0;

                square.type = "button";
                square.className = `square ${isLightSquare ? "square--light" : "square--dark"}`;
                square.dataset.square = String(index);
                if (piece) {
                    const pieceElement = document.createElement("span");
                    pieceElement.className = "piece";
                    pieceElement.textContent = pieceSymbols[piece];
                    pieceElement.setAttribute("aria-hidden", "true");
                    square.append(pieceElement);
                }
                square.setAttribute(
                    "aria-label",
                    `${squareName(index)}${piece ? `, ${describePiece(piece)}` : ", empty"}`,
                );
                square.setAttribute("aria-pressed", String(selectedSquare === index));

                if (column === 0) {
                    const rankLabel = document.createElement("span");
                    rankLabel.className = "square-coordinate square-coordinate--rank";
                    if (row === 7) {
                        rankLabel.classList.add("square-coordinate--rank-bottom");
                    }
                    rankLabel.textContent = String(8 - row);
                    rankLabel.setAttribute("aria-hidden", "true");
                    square.append(rankLabel);
                }

                if (row === 7) {
                    const fileLabel = document.createElement("span");
                    fileLabel.className = "square-coordinate square-coordinate--file";
                    fileLabel.textContent = String.fromCharCode(65 + column);
                    fileLabel.setAttribute("aria-hidden", "true");
                    square.append(fileLabel);
                }

                if (selectedSquare === index) {
                    square.classList.add("square--selected");
                }

                squares.append(square);
            });
        });

        board.replaceChildren(squares);
        fenDisplay.textContent = getFen();
        if (focusIndex !== null) {
            board.querySelector(`[data-square="${focusIndex}"]`)?.focus({ preventScroll: true });
        }
    }

    return { renderBoard };
}
