import { enablePieceDragAndDrop } from "./drag-and-drop.js";
import {
    applyMove,
    chooseRandomLegalMove,
    createGame,
    generateLegalMoves,
    getGameFen,
    getPieceAt,
} from "./game.js";

const pieceNames = {
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
const pieceSymbols = {
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
const board = document.querySelector("#chessboard");
const boardNote = document.querySelector("#board-note");
const resetButton = document.querySelector("#reset-game");
const copyFenButton = document.querySelector("#copy-fen");
const fenDisplay = document.querySelector("#current-fen");
const sideChoiceInputs = document.querySelectorAll('input[name="human-side"]');
const promotionDialog = document.querySelector("#promotion-dialog");
const promotionChoices = document.querySelector("#promotion-choices");
let game = createGame();
let selectedSquare = null;
let pendingPromotion = null;
let humanSide = "w";
let computerMoveTimeout = null;

function squareName(index) {
    const row = Math.floor(index / 8);
    const column = index % 8;
    return `${String.fromCharCode(97 + column)}${8 - row}`;
}

function describePiece(piece) {
    return `${whitePieces.has(piece) ? "White" : "Black"} ${pieceNames[piece]}`;
}

function getFen() {
    return getGameFen(game);
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

function renderBoard(focusIndex = null) {
    const squares = document.createDocumentFragment();

    game.board.forEach((rank, row) => {
        rank.forEach((piece, column) => {
            const index = row * 8 + column;
            const square = document.createElement("button");
            const isLightSquare = (row + column) % 2 === 0;

            square.type = "button";
            square.className = `square ${isLightSquare ? "square--light" : "square--dark"}`;
            square.dataset.square = String(index);
            square.textContent = pieceSymbols[piece] ?? "";
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
    window.clearTimeout(computerMoveTimeout);
    pendingPromotion = null;
    if (promotionDialog.open) {
        promotionDialog.close();
    }
    game = createGame();
    selectedSquare = null;
    renderBoard();
    setStatus("Game reset. All pieces are back in their starting positions.");
    scheduleComputerMove();
}

function finishMove(from, to, promotion = null) {
    const candidates = generateLegalMoves(game).filter(
        (move) => move.from === from && move.to === to,
    );
    if (candidates.length === 0) {
        setStatus("That is not a legal move.");
        return false;
    }

    const promotionMoves = candidates.filter((move) => move.promotion);
    if (promotionMoves.length > 0 && promotion === null) {
        pendingPromotion = { from, to };
        promotionChoices.replaceChildren();
        for (const move of promotionMoves) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "promotion-choice";
            button.textContent = pieceSymbols[move.promotion];
            button.setAttribute(
                "aria-label",
                `Promote to ${pieceNames[move.promotion]}`,
            );
            button.addEventListener("click", () => {
                const pending = pendingPromotion;
                pendingPromotion = null;
                promotionDialog.close();
                if (pending) {
                    movePiece(pending.from, pending.to, move.promotion);
                }
            });
            promotionChoices.append(button);
        }
        promotionDialog.showModal();
        setStatus("Choose a piece for promotion.");
        return false;
    }

    const result = applyMove(game, from, to, promotion);
    if (!result.moved) {
        setStatus(result.reason === "own-piece"
            ? "You cannot capture your own piece."
            : "That is not a legal move.");
        return false;
    }

    selectedSquare = null;
    renderBoard(to);
    setStatus(result.promotion
        ? `Promoted pawn to ${pieceNames[result.promotion]}.`
        : `Moved ${describePiece(result.piece)} from ${squareName(from)} to ${squareName(to)}.`);
    return true;
}

function movePiece(from, to, promotion = null) {
    if (game.sideToMove !== humanSide) {
        setStatus("Wait for the computer to move.");
        return false;
    }

    if (finishMove(from, to, promotion)) {
        scheduleComputerMove();
        return true;
    }
    return false;
}

function scheduleComputerMove() {
    window.clearTimeout(computerMoveTimeout);
    if (game.sideToMove === humanSide) {
        return;
    }

    setStatus("Computer is choosing a move...");
    computerMoveTimeout = window.setTimeout(() => {
        if (game.sideToMove === humanSide) {
            return;
        }

        const move = chooseRandomLegalMove(game);
        if (!move) {
            setStatus("The game is over; the computer has no legal moves.");
            return;
        }

        finishMove(move.from, move.to, move.promotion);
    }, 350);
}

function startNewGame(side) {
    humanSide = side;
    resetGame();
}

function selectSquare(index) {
    if (game.sideToMove !== humanSide) {
        return;
    }

    const piece = getPieceAt(game, index);

    if (selectedSquare === null || selectedSquare === index) {
        selectedSquare = selectedSquare === index
            ? null
            : piece && whitePieces.has(piece) === (humanSide === "w")
                ? index
                : null;
        renderBoard(index);
        setStatus(
            selectedSquare === null
                ? piece
                    ? "Select one of your own pieces."
                    : "Drag a piece to move it, or select a piece and a legal destination."
                : `Selected ${describePiece(piece)} on ${squareName(index)}.`,
        );
        return;
    }

    const selectedPiece = getPieceAt(game, selectedSquare);

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
sideChoiceInputs.forEach((input) => {
    input.addEventListener("change", () => {
        if (input.checked) {
            startNewGame(input.value);
        }
    });
});
promotionDialog.addEventListener("close", () => {
    if (pendingPromotion) {
        pendingPromotion = null;
        setStatus("Promotion cancelled.");
    }
});

renderBoard();

enablePieceDragAndDrop(board, {
    getPieceAt(index) {
        if (game.sideToMove !== humanSide) {
            return "";
        }
        return pieceSymbols[getPieceAt(game, index)] ?? "";
    },
    movePiece,
    setSelectedSquare(index) {
        selectedSquare = index;
    },
    renderBoard,
    setStatus,
});

scheduleComputerMove();
