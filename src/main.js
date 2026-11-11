import { animateMove } from "./animation.js";
import {
    describePiece,
    pieceNames,
    pieceSymbols,
    squareName,
} from "./components/chess-board.js";
import {
    applyMove,
    createGame,
    generateLegalMoves,
    getGameOutcome,
    getGameFen,
    getPieceAt,
} from "./game.js";
import { parseGameSave, serializeGameSave } from "./game-save.js";

const SEARCH_LEVELS = {
    quick: { depth: 2, maxNodes: 20_000, timeLimitMs: 350 },
    standard: { depth: 4, maxNodes: 120_000, timeLimitMs: 1_500 },
    strong: { depth: 6, maxNodes: 500_000, timeLimitMs: 3_500 },
};
const whitePieces = new Set(["K", "Q", "R", "B", "N", "P"]);
const board = document.querySelector("#chessboard");
const boardNote = document.querySelector("#board-note");
const gameLayout = document.querySelector(".game");
const gamePanelToggle = document.querySelector("#toggle-game-panel");
const gamePanelContent = document.querySelector("#game-panel-content");
const gamePanelToggleArrow = document.querySelector(".game-panel-toggle-arrow");
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
const difficulty = document.querySelector("#difficulty");
const downloadSaveButton = document.querySelector("#download-save");
const openSaveButton = document.querySelector("#open-save");
const saveFileInput = document.querySelector("#save-file");
const autosaveCheckbox = document.querySelector("#autosave-game");
const saveNote = document.querySelector("#save-note");
const moveHistoryList = document.querySelector("#move-history-list");
const historyStartButton = document.querySelector("#history-start");
const historyUndoButton = document.querySelector("#history-undo");
const historyNextButton = document.querySelector("#history-next");
const historyLatestButton = document.querySelector("#history-latest");
const AUTOSAVE_KEY = "deepross.v2.autosave";
const AUTOSAVE_ENABLED_KEY = "deepross.v2.autosave-enabled";
let game = createGame();
let timeline = [createTimelineEntry(game, null)];
let timelineIndex = 0;
let selectedSquare = null;
let pendingPromotion = null;
let humanSide = "w";
let autosaveEnabled = true;
let computerMoveTimeout = null;
let computerWorker = null;
let computerRequestId = 0;

function createTimelineEntry(position, move) {
    return {
        fen: getGameFen(position),
        positionHistory: [...position.positionHistory],
        sideToMove: position.sideToMove,
        move,
    };
}

function toggleGamePanel() {
    const nextIsOpen = gamePanelToggle.getAttribute("aria-expanded") !== "true";
    gamePanelToggle.setAttribute("aria-expanded", String(nextIsOpen));
    gamePanelContent.hidden = !nextIsOpen;
    gameLayout.dataset.panelOpen = String(nextIsOpen);
    gamePanelToggleArrow.textContent = nextIsOpen ? "<" : ">";
    gamePanelToggle.setAttribute(
        "aria-label",
        nextIsOpen ? "Close controls" : "Open controls",
    );
}

function getFen() {
    return getGameFen(game);
}

function renderBoard(focusIndex = null) {
    const outcome = getGameOutcome(game);
    board.position = game.board;
    board.selectedSquare = selectedSquare;
    board.interactionEnabled = game.sideToMove === humanSide && !outcome;
    fenDisplay.textContent = getFen();
    if (focusIndex !== null) {
        board.render(focusIndex);
    }
}

function renderHistory() {
    const items = timeline.map((entry, index) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.historyIndex = String(index);
        if (index === timelineIndex) {
            button.setAttribute("aria-current", "step");
        }
        if (index === 0) {
            button.textContent = "Starting position";
        } else {
            const previousEntry = timeline[index - 1];
            const mover = previousEntry.sideToMove;
            const moveNumber = previousEntry.fen.split(" ")[5];
            const move = entry.move;
            const separator = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
            button.textContent = `${moveNumber}${mover === "w" ? "." : "..."} `
                + `${mover === "w" ? "White" : "Black"}: `
                + `${squareName(move.from)}–${squareName(move.to)}${separator}`;
        }
        button.addEventListener("click", () => navigateToHistoryIndex(index));
        item.append(button);
        return item;
    });
    moveHistoryList.replaceChildren(...items);

    historyStartButton.disabled = timelineIndex === 0;
    historyUndoButton.disabled = getUndoTarget() === null;
    historyNextButton.disabled = timelineIndex >= timeline.length - 1;
    historyLatestButton.disabled = timelineIndex === timeline.length - 1;
}

function getUndoTarget() {
    // Undo returns to the previous human decision, skipping the computer's reply.
    for (let index = timelineIndex - 1; index >= 0; index -= 1) {
        if (timeline[index].sideToMove === humanSide) {
            return index;
        }
    }
    return timelineIndex > 0 ? 0 : null;
}

function persistSession() {
    if (!autosaveEnabled) {
        saveNote.textContent = "";
        return;
    }
    try {
        localStorage.setItem(AUTOSAVE_KEY, serializeGameSave({
            timeline,
            currentIndex: timelineIndex,
            humanSide,
            difficulty: difficulty.value,
        }));
        saveNote.textContent = "";
    } catch (error) {
        saveNote.textContent = `Could not autosave this game: ${error.message}`;
    }
}

function replaceSession(saved) {
    timeline = saved.timeline;
    timelineIndex = saved.currentIndex;
    humanSide = saved.humanSide;
    difficulty.value = saved.difficulty;
    for (const input of sideChoiceInputs) {
        input.checked = input.value === humanSide;
    }
    game = createGame(timeline[timelineIndex].fen);
    game.positionHistory = [...timeline[timelineIndex].positionHistory];
    selectedSquare = null;
}

function restoreAutosave() {
    try {
        autosaveEnabled = localStorage.getItem(AUTOSAVE_ENABLED_KEY) !== "false";
        autosaveCheckbox.checked = autosaveEnabled;
        if (!autosaveEnabled) {
            return;
        }
        const serialized = localStorage.getItem(AUTOSAVE_KEY);
        if (!serialized) {
            return;
        }
        replaceSession(parseGameSave(serialized));
        setStatus("Restored your autosaved game.");
    } catch (error) {
        saveNote.textContent = `Could not restore the autosaved game: ${error.message}`;
    }
}

function recordMove(from, to, promotion) {
    timeline = timeline.slice(0, timelineIndex + 1);
    timeline.push(createTimelineEntry(game, { from, to, promotion }));
    timelineIndex = timeline.length - 1;
    renderHistory();
    persistSession();
}

function navigateToHistoryIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= timeline.length) {
        return;
    }
    cancelComputerSearch();
    if (promotionDialog.open) {
        promotionDialog.close();
    }
    pendingPromotion = null;
    timelineIndex = index;
    game = createGame(timeline[index].fen);
    game.positionHistory = [...timeline[index].positionHistory];
    selectedSquare = null;
    renderBoard();
    renderHistory();
    persistSession();
    const outcome = getGameOutcome(game);
    setStatus(outcome?.message ?? `Showing position ${index} of ${timeline.length - 1}.`);
    if (timelineIndex === timeline.length - 1) {
        scheduleComputerMove();
    }
}

function undoTurn() {
    const target = getUndoTarget();
    if (target !== null) {
        navigateToHistoryIndex(target);
    }
}

function downloadSave() {
    try {
        const serialized = serializeGameSave({
            timeline,
            currentIndex: timelineIndex,
            humanSide,
            difficulty: difficulty.value,
        });
        const url = URL.createObjectURL(
            new Blob([serialized], { type: "application/json" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `deep-ross-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
        setStatus("Saved game downloaded.");
    } catch (error) {
        setStatus(`Could not download the save: ${error.message}`);
    }
}

async function loadSaveFile(file) {
    try {
        if (file.size > 2_000_000) {
            throw new RangeError("The save file is too large.");
        }
        const saved = parseGameSave(await file.text());
        cancelComputerSearch();
        if (promotionDialog.open) {
            promotionDialog.close();
        }
        pendingPromotion = null;
        replaceSession(saved);
        renderBoard();
        renderHistory();
        persistSession();
        setStatus("Saved game loaded.");
        scheduleComputerMove();
    } catch (error) {
        setStatus(`Could not load the saved game: ${error.message}`);
    } finally {
        saveFileInput.value = "";
    }
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

function setStatus(message) {
    boardNote.textContent = message;
}

function cancelComputerSearch() {
    window.clearTimeout(computerMoveTimeout);
    computerMoveTimeout = null;
    computerRequestId += 1;
    computerWorker?.terminate();
    computerWorker = null;
}

function resetGame() {
    cancelComputerSearch();
    pendingPromotion = null;
    if (promotionDialog.open) {
        promotionDialog.close();
    }
    game = createGame();
    timeline = [createTimelineEntry(game, null)];
    timelineIndex = 0;
    selectedSquare = null;
    renderBoard();
    renderHistory();
    persistSession();
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
    cancelComputerSearch();
    pendingPromotion = null;
    if (promotionDialog.open) {
        promotionDialog.close();
    }
    game = loadedGame;
    timeline = [createTimelineEntry(game, null)];
    timelineIndex = 0;
    selectedSquare = null;
    fenError.textContent = "";
    fenDialog.close();
    renderBoard();
    renderHistory();
    persistSession();
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

    recordMove(from, to, promotion);
    selectedSquare = null;
    animateMove(board, from, to, () => renderBoard(to), result.piece);
    setStatus(result.promotion
        ? `Promoted pawn to ${pieceNames[result.promotion]}.`
        : `Moved ${describePiece(result.piece)} from ${squareName(from)} to ${squareName(to)}.`);
    const outcome = getGameOutcome(game);
    if (outcome) {
        setStatus(outcome.message);
    }
    return true;
}

function movePiece(from, to, promotion = null) {
    const outcome = getGameOutcome(game);
    if (outcome) {
        setStatus(outcome.message);
        return false;
    }
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
    const outcome = getGameOutcome(game);
    if (outcome) {
        setStatus(outcome.message);
        return;
    }
    if (game.sideToMove === humanSide) {
        return;
    }
    if (timelineIndex !== timeline.length - 1) {
        return;
    }

    setStatus("Computer is choosing a move...");
    computerMoveTimeout = window.setTimeout(() => {
        // The game may have been reset or loaded while the computer was waiting.
        if (game.sideToMove === humanSide) {
            return;
        }

        const requestId = ++computerRequestId;
        const positionFen = getFen();
        let worker;
        try {
            worker = new Worker(new URL("./search-worker.js", import.meta.url), {
                type: "module",
            });
        } catch (error) {
            setStatus(`Could not start the computer: ${error.message}`);
            return;
        }
        computerWorker = worker;
        worker.addEventListener("message", (event) => {
            const message = event.data;
            if (
                message.requestId !== computerRequestId
                || worker !== computerWorker
                || positionFen !== getFen()
                || game.sideToMove === humanSide
            ) {
                return;
            }

            if (message.type === "progress") {
                const { completedDepth, nodes } = message.iteration;
                setStatus(`Computer thinking: depth ${completedDepth}, ${nodes.toLocaleString()} positions…`);
                return;
            }

            worker.terminate();
            computerWorker = null;
            if (message.type === "error") {
                setStatus(`Computer search failed: ${message.message}`);
                return;
            }

            if (!message.result.move) {
                setStatus("The game is over; the computer has no legal moves.");
                return;
            }

            finishMove(
                message.result.move.from,
                message.result.move.to,
                message.result.move.promotion,
            );
        });
        worker.addEventListener("error", (event) => {
            if (worker !== computerWorker || requestId !== computerRequestId) {
                return;
            }
            worker.terminate();
            computerWorker = null;
            setStatus(`Computer worker failed: ${event.message}`);
        });
        worker.postMessage({
            type: "search",
            requestId,
            fen: positionFen,
            positionHistory: game.positionHistory,
            limits: SEARCH_LEVELS[difficulty.value],
        });
    }, 350);
}

function startNewGame(side) {
    humanSide = side;
    resetGame();
}

function selectSquare(index) {
    const outcome = getGameOutcome(game);
    if (outcome) {
        setStatus(outcome.message);
        return;
    }
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

board.addEventListener("square-select", (event) => {
    selectSquare(event.detail.index);
});
board.addEventListener("piece-move", (event) => {
    movePiece(event.detail.from, event.detail.to);
});
board.addEventListener("move-cancelled", () => {
    selectedSquare = null;
    renderBoard();
    setStatus("Move cancelled.");
});

resetButton.addEventListener("click", resetGame);
gamePanelToggle.addEventListener("click", toggleGamePanel);
downloadSaveButton.addEventListener("click", downloadSave);
openSaveButton.addEventListener("click", () => saveFileInput.click());
saveFileInput.addEventListener("change", () => {
    const [file] = saveFileInput.files;
    if (file) {
        loadSaveFile(file);
    }
});
autosaveCheckbox.addEventListener("change", () => {
    autosaveEnabled = autosaveCheckbox.checked;
    try {
        localStorage.setItem(AUTOSAVE_ENABLED_KEY, String(autosaveEnabled));
        if (autosaveEnabled) {
            persistSession();
            saveNote.textContent = "Autosave enabled for this browser.";
        } else {
            localStorage.removeItem(AUTOSAVE_KEY);
            saveNote.textContent = "Autosave disabled; the local saved game was removed.";
        }
    } catch (error) {
        saveNote.textContent = `Could not update autosave settings: ${error.message}`;
    }
});
historyStartButton.addEventListener("click", () => navigateToHistoryIndex(0));
historyUndoButton.addEventListener("click", undoTurn);
historyNextButton.addEventListener("click", () => navigateToHistoryIndex(timelineIndex + 1));
historyLatestButton.addEventListener("click", () => navigateToHistoryIndex(timeline.length - 1));
openFenDialogButton.addEventListener("click", () => {
    cancelComputerSearch();
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
difficulty.addEventListener("change", () => {
    cancelComputerSearch();
    persistSession();
    scheduleComputerMove();
});
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

restoreAutosave();
renderBoard();
renderHistory();
scheduleComputerMove();
