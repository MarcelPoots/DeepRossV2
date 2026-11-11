import assert from "node:assert/strict";
import test from "node:test";
import { applyMove, createGame, getGameFen } from "../src/game.js";
import { parseGameSave, serializeGameSave } from "../src/game-save.js";

function makeTimeline() {
    const game = createGame();
    const timeline = [{
        fen: getGameFen(game),
        move: null,
        positionHistory: [...game.positionHistory],
        sideToMove: game.sideToMove,
    }];
    for (const [from, to] of [[62, 45], [6, 21], [45, 62]]) {
        assert.equal(applyMove(game, from, to).moved, true);
        timeline.push({
            fen: getGameFen(game),
            move: { from, to, promotion: null },
            positionHistory: [...game.positionHistory],
            sideToMove: game.sideToMove,
        });
    }
    return timeline;
}

test("saves and restores a replayable game history and settings", () => {
    const saved = parseGameSave(serializeGameSave({
        timeline: makeTimeline(),
        currentIndex: 2,
        humanSide: "b",
        difficulty: "strong",
    }));

    assert.equal(saved.timeline.length, 4);
    assert.equal(saved.currentIndex, 2);
    assert.equal(saved.humanSide, "b");
    assert.equal(saved.difficulty, "strong");
    assert.equal(saved.timeline[2].fen, makeTimeline()[2].fen);
    assert.equal(saved.timeline[2].positionHistory.length, 3);
});

test("rejects malformed, unsupported, or illegal game saves", () => {
    assert.throws(() => parseGameSave("{"), /valid JSON/);
    assert.throws(() => parseGameSave(JSON.stringify({
        format: "other",
        version: 1,
    })), /supported/);

    const invalidMove = makeTimeline().map(({ fen, move }) => ({ fen, move }));
    invalidMove[1] = { fen: invalidMove[1].fen, move: { from: 52, to: 60, promotion: null } };
    assert.throws(() => parseGameSave(JSON.stringify({
        format: "deep-ross-save",
        version: 1,
        humanSide: "w",
        difficulty: "standard",
        currentIndex: 0,
        timeline: invalidMove,
    })), /illegal or inconsistent/);

    assert.throws(() => parseGameSave(JSON.stringify({
        format: "deep-ross-save",
        version: 1,
        humanSide: "w",
        difficulty: "standard",
        currentIndex: 0,
        timeline: [
            { fen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", move: null },
            { fen: "7k/6Q1/6K1/8/8/8/8/8 w - - 1 2", move: { from: 7, to: 6, promotion: null } },
        ],
    })), /continues after the game ended/);
});

test("rejects oversized saves and invalid selected history positions", () => {
    assert.throws(() => parseGameSave(" ".repeat(2_000_001)), /too large/);
    assert.throws(() => parseGameSave(serializeGameSave({
        timeline: makeTimeline(),
        currentIndex: 4,
        humanSide: "w",
        difficulty: "standard",
    })), /history position/);
});
