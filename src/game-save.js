import {
    applyMove,
    createGame,
    getGameOutcome,
    getGameFen,
} from "./game.js";

const SAVE_FORMAT = "deep-ross-save";
const SAVE_VERSION = 1;
const MAX_SAVE_LENGTH = 2_000_000;
const MAX_TIMELINE_LENGTH = 10_000;
const DIFFICULTIES = new Set(["quick", "standard", "strong"]);

/**
 * Validate and restore a versioned save by replaying every move from its root.
 * Replaying rebuilds repetition history and rejects edits that produce illegal
 * or inconsistent positions instead of trusting imported state blindly.
 */
export function parseGameSave(serialized) {
    if (typeof serialized !== "string" || serialized.length > MAX_SAVE_LENGTH) {
        throw new RangeError("The save file is invalid or too large.");
    }

    let data;
    try {
        data = JSON.parse(serialized);
    } catch (error) {
        throw new SyntaxError(`The save file is not valid JSON: ${error.message}`);
    }

    if (
        !data || typeof data !== "object"
        || data.format !== SAVE_FORMAT
        || data.version !== SAVE_VERSION
    ) {
        throw new TypeError("This is not a supported Deep Ross save file.");
    }
    if (data.humanSide !== "w" && data.humanSide !== "b") {
        throw new TypeError("The save file has an invalid player side.");
    }
    if (!DIFFICULTIES.has(data.difficulty)) {
        throw new TypeError("The save file has an invalid difficulty.");
    }
    if (
        !Array.isArray(data.timeline)
        || data.timeline.length === 0
        || data.timeline.length > MAX_TIMELINE_LENGTH
    ) {
        throw new TypeError("The save file has an invalid move history.");
    }
    if (
        !Number.isInteger(data.currentIndex)
        || data.currentIndex < 0
        || data.currentIndex >= data.timeline.length
    ) {
        throw new TypeError("The save file has an invalid history position.");
    }

    const root = data.timeline[0];
    if (!root || typeof root.fen !== "string" || root.move !== null) {
        throw new TypeError("The save file has an invalid starting position.");
    }
    let game = createGame(root.fen);
    const timeline = [{
        fen: getGameFen(game),
        positionHistory: [...game.positionHistory],
        sideToMove: game.sideToMove,
        move: null,
    }];
    if (timeline[0].fen !== root.fen) {
        throw new TypeError("The save file's starting position is not canonical FEN.");
    }

    for (let index = 1; index < data.timeline.length; index += 1) {
        const entry = data.timeline[index];
        const move = entry?.move;
        if (
            !entry || typeof entry.fen !== "string"
            || !move || !Number.isInteger(move.from) || !Number.isInteger(move.to)
            || ![null, "Q", "R", "B", "N", "q", "r", "b", "n"].includes(move.promotion)
        ) {
            throw new TypeError(`The save file has an invalid move at ply ${index}.`);
        }

        if (getGameOutcome(game)) {
            throw new TypeError(`The save file continues after the game ended at ply ${index - 1}.`);
        }
        const result = applyMove(game, move.from, move.to, move.promotion);
        if (!result.moved || getGameFen(game) !== entry.fen) {
            throw new TypeError(`The save file contains an illegal or inconsistent move at ply ${index}.`);
        }
        timeline.push({
            fen: entry.fen,
            positionHistory: [...game.positionHistory],
            sideToMove: game.sideToMove,
            move: { from: move.from, to: move.to, promotion: move.promotion },
        });
    }

    return {
        timeline,
        currentIndex: data.currentIndex,
        humanSide: data.humanSide,
        difficulty: data.difficulty,
    };
}

export function serializeGameSave({ timeline, currentIndex, humanSide, difficulty }) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
        throw new TypeError("Cannot save a game without a starting position.");
    }
    const data = {
        format: SAVE_FORMAT,
        version: SAVE_VERSION,
        savedAt: new Date().toISOString(),
        humanSide,
        difficulty,
        currentIndex,
        timeline: timeline.map(({ fen, move }) => ({ fen, move })),
    };
    const serialized = JSON.stringify(data, null, 2);
    if (serialized.length > MAX_SAVE_LENGTH) {
        throw new RangeError("The game history is too large to save.");
    }
    return serialized;
}
