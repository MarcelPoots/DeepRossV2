import { enablePieceDragAndDrop } from "./drag-and-drop.js";

const position = [
    ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
    ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
    ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"],
];

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
const whitePieces = new Set(["♔", "♕", "♖", "♗", "♘", "♙"]);
const board = document.querySelector("#chessboard");
const boardNote = document.querySelector("#board-note");
let selectedSquare = null;

function squareName(index) {
    const row = Math.floor(index / 8);
    const column = index % 8;
    return `${String.fromCharCode(97 + column)}${8 - row}`;
}

function describePiece(piece) {
    return `${whitePieces.has(piece) ? "White" : "Black"} ${pieceNames[piece]}`;
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

            if (selectedSquare === index) {
                square.classList.add("square--selected");
            }

            squares.append(square);
        });
    });

    board.replaceChildren(squares);
    if (focusIndex !== null) {
        board.querySelector(`[data-square="${focusIndex}"]`)?.focus({ preventScroll: true });
    }
}

function setStatus(message) {
    boardNote.textContent = message;
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
