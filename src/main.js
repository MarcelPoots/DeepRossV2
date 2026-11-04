import { enablePieceDragAndDrop } from "./drag-and-drop.js";
import { animateMove } from "./animation.js";
import {
    createBoardView,
    describePiece,
    pieceNames,
    pieceSymbols,
    squareName,
} from "./board-view.js";
import {
    applyMove,
    chooseRandomLegalMove,
    createGame,
    generateLegalMoves,
    getGameFen,
    getPieceAt,
} from "./game.js";

const whitePieces = new Set(["K", "Q", "R", "B", "N", "P"]);
const board = document.querySelector("#chessboard");
const boardNote = document.querySelector("#board-note");
const resetButton = document.querySelector("#reset-game");
const openFenDialogButton = document.querySelector("#open-fen-dialog");
const copyFenButton = document.querySelector("#copy-fen");
const fenDisplay = document.querySelector("#current-fen");
const sideChoiceInputs = document.querySelectorAll('input[name="human-side"]');
const promotionDialog = document.querySelector("#promotion-dialog");
const promotionChoices = document.querySelector("#promotion-choices");
const fenDialog = document.querySelector("#fen-dialog");
const fenForm = document.querySelector("#fen-form");
const fenInput = document.querySelector("#fen-input");
const fenError = document.querySelector("#fen-error");
let game = createGame();
let selectedSquare = null;
let pendingPromotion = null;
let humanSide = "w";
let computerMoveTimeout = null;

function getFen() {
    return getGameFen(game);
}

const { renderBoard } = createBoardView({
    board,
    fenDisplay,
    getGame: () => game,
    getSelectedSquare: () => selectedSquare,
    getFen,
});

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

function loadFen(fen) {
    let loadedGame;
    try {
        loadedGame = createGame(fen);
    } catch (error) {
        fenError.textContent = `Invalid FEN: ${error.message}`;
        return;
    }

    // Replace the current game only after parsing succeeds, preserving it on invalid input.
    window.clearTimeout(computerMoveTimeout);
    pendingPromotion = null;
    if (promotionDialog.open) {
        promotionDialog.close();
    }
    game = loadedGame;
    selectedSquare = null;
    fenError.textContent = "";
    fenDialog.close();
    renderBoard();
    setStatus("Position loaded from FEN.");
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
        // Pause the move until the player chooses which piece the pawn becomes.
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
    animateMove(board, from, to, () => renderBoard(to), result.piece);
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
        // The game may have been reset or loaded while the computer was waiting.
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

    // A second click changes the selection to another friendly piece or attempts a move.
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
openFenDialogButton.addEventListener("click", () => {
    window.clearTimeout(computerMoveTimeout);
    fenError.textContent = "";
    fenInput.value = getFen();
    fenDialog.showModal();
    fenInput.focus();
});
document.querySelector("#cancel-fen-load").addEventListener("click", () => {
    fenDialog.close();
});
fenForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadFen(fenInput.value);
});
fenDialog.addEventListener("close", scheduleComputerMove);
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
