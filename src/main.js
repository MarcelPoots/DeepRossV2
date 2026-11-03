import { enablePieceDragAndDrop } from "./drag-and-drop.js";
import { serializeFen } from "./fen.js";

const startingPosition = [
    ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
    ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
    ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"],
];
let position = startingPosition.map((rank) => [...rank]);

const pieceNames = {
    "♔": "king",
    "♕": "queen",
    "♖": "rook",
    "♗": "bishop",
    "♘": "knight",
    "♙": "pawn",
    "♚": "king",
    "♛": "queen",
    "♜": "rook",
    "♝": "bishop",
    "♞": "knight",
    "♟": "pawn",
};
const fenPieceLetters = {
    "♔": "K",
    "♕": "Q",
    "♖": "R",
    "♗": "B",
    "♘": "N",
    "♙": "P",
    "♚": "k",
    "♛": "q",
    "♜": "r",
    "♝": "b",
    "♞": "n",
    "♟": "p",
};
const whitePieces = new Set(["♔", "♕", "♖", "♗", "♘", "♙"]);
const board = document.querySelector("#chessboard");
const boardNote = document.querySelector("#board-note");
const resetButton = document.querySelector("#reset-game");
const copyFenButton = document.querySelector("#copy-fen");
const fenDisplay = document.querySelector("#current-fen");
let selectedSquare = null;
let sideToMove = "w";
let castlingRights = new Set(["K", "Q", "k", "q"]);
let enPassantTarget = null;
let halfmoveClock = 0;
let fullmoveNumber = 1;

function squareName(index) {
    const row = Math.floor(index / 8);
    const column = index % 8;
    return `${String.fromCharCode(97 + column)}${8 - row}`;
}

function describePiece(piece) {
    return `${whitePieces.has(piece) ? "White" : "Black"} ${pieceNames[piece]}`;
}

function getFen() {
    return serializeFen({
        board: position.map((rank) => rank.map((piece) => fenPieceLetters[piece] ?? "")),
        sideToMove,
        castlingRights: ["K", "Q", "k", "q"].filter((right) =>
            castlingRights.has(right),
        ).join("") || "-",
        enPassantTarget,
        halfmoveClock,
        fullmoveNumber,
    });
}

function updateFenDisplay() {
    fenDisplay.textContent = getFen();
}

async function copyFen() {
    if (!navigator.clipboard?.writeText) {
        setStatus("Copying FEN is unavailable in this browser context.");
        return;
    }

    try {
        await navigator.clipboard.writeText(getFen());
        setStatus("Current FEN copied to the clipboard.");
    } catch (error) {
        setStatus(`Could not copy FEN: ${error.message}`);
    }
}

function removeCastlingRightsForRook(square) {
    const rookRightsBySquare = {
        0: "q",
        7: "k",
        56: "Q",
        63: "K",
    };
    const right = rookRightsBySquare[square];
    if (right) {
        castlingRights.delete(right);
    }
}

function renderBoard(focusIndex = null) {
    const squares = document.createDocumentFragment();

    position.forEach((rank, row) => {
        rank.forEach((piece, column) => {
            const index = row * 8 + column;
            const square = document.createElement("button");
            const isLightSquare = (row + column) % 2 === 0;

            square.type = "button";
            square.className = `square ${isLightSquare ? "square--light" : "square--dark"}`;
            square.dataset.square = String(index);
            square.textContent = piece;
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
    updateFenDisplay();
    if (focusIndex !== null) {
        board.querySelector(`[data-square="${focusIndex}"]`)?.focus({ preventScroll: true });
    }
}

function setStatus(message) {
    boardNote.textContent = message;
}

function resetGame() {
    position = startingPosition.map((rank) => [...rank]);
    selectedSquare = null;
    sideToMove = "w";
    castlingRights = new Set(["K", "Q", "k", "q"]);
    enPassantTarget = null;
    halfmoveClock = 0;
    fullmoveNumber = 1;
    renderBoard();
    setStatus("Game reset. All pieces are back in their starting positions.");
}

function movePiece(from, to) {
    if (from === to) {
        return false;
    }

    const fromRow = Math.floor(from / 8);
    const fromColumn = from % 8;
    const toRow = Math.floor(to / 8);
    const toColumn = to % 8;
    const movingPiece = position[fromRow][fromColumn];
    const targetPiece = position[toRow][toColumn];

    if (!movingPiece) {
        return false;
    }

    if (targetPiece && whitePieces.has(movingPiece) === whitePieces.has(targetPiece)) {
        setStatus("You cannot capture your own piece.");
        return false;
    }

    const isPawnMove = movingPiece === "♙" || movingPiece === "♟";
    if (movingPiece === "♔") {
        castlingRights.delete("K");
        castlingRights.delete("Q");
    } else if (movingPiece === "♚") {
        castlingRights.delete("k");
        castlingRights.delete("q");
    } else if (movingPiece === "♖" || movingPiece === "♜") {
        removeCastlingRightsForRook(from);
    }

    if (targetPiece === "♖" || targetPiece === "♜") {
        removeCastlingRightsForRook(to);
    }

    enPassantTarget = isPawnMove && fromColumn === toColumn && Math.abs(fromRow - toRow) === 2
        ? squareName((from + to) / 2)
        : null;
    halfmoveClock = isPawnMove || targetPiece ? 0 : halfmoveClock + 1;
    if (!whitePieces.has(movingPiece)) {
        fullmoveNumber += 1;
        sideToMove = "w";
    } else {
        sideToMove = "b";
    }

    position[toRow][toColumn] = movingPiece;
    position[fromRow][fromColumn] = "";
    selectedSquare = null;
    renderBoard(to);
    setStatus(
        `Moved ${describePiece(movingPiece)} from ${squareName(from)} to ${squareName(to)}.`,
    );
    return true;
}

function selectSquare(index) {
    const row = Math.floor(index / 8);
    const column = index % 8;
    const piece = position[row][column];

    if (selectedSquare === null || selectedSquare === index) {
        selectedSquare = selectedSquare === index ? null : piece ? index : null;
        renderBoard(index);
        setStatus(
            selectedSquare === null
                ? "Drag a piece to move it, or select a piece and a destination."
                : `Selected ${describePiece(piece)} on ${squareName(index)}.`,
        );
        return;
    }

    const selectedRow = Math.floor(selectedSquare / 8);
    const selectedColumn = selectedSquare % 8;
    const selectedPiece = position[selectedRow][selectedColumn];

    if (piece && whitePieces.has(piece) === whitePieces.has(selectedPiece)) {
        selectedSquare = index;
        renderBoard(index);
        setStatus(`Selected ${describePiece(piece)} on ${squareName(index)}.`);
        return;
    }

    movePiece(selectedSquare, index);
}

board.addEventListener("click", (event) => {
    const square = event.target.closest("button[data-square]");
    if (square) {
        selectSquare(Number(square.dataset.square));
    }
});

resetButton.addEventListener("click", resetGame);
copyFenButton.addEventListener("click", copyFen);

renderBoard();

enablePieceDragAndDrop(board, {
    getPieceAt(index) {
        return position[Math.floor(index / 8)][index % 8];
    },
    movePiece,
    setSelectedSquare(index) {
        selectedSquare = index;
    },
    renderBoard,
    setStatus,
});
