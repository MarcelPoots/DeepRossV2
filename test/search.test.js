import assert from "node:assert/strict";
import test from "node:test";
import {
    applyMove,
    createGame,
    createGameAfterMove,
    generateLegalMoves,
    isKingInCheck,
} from "../src/game.js";
import { evaluatePosition, searchBestMove } from "../src/search.js";

function minimax(game, depth, ply = 0) {
    const moves = generateLegalMoves(game);
    if (moves.length === 0) {
        return isKingInCheck(game) ? -100_000 + ply : 0;
    }
    if (depth === 0) {
        return evaluatePosition(game);
    }
    return Math.max(...moves.map((move) => (
        -minimax(createGameAfterMove(game, move), depth - 1, ply + 1)
    )));
}

test("search returns a legal move, stable result, and preserves its root position", () => {
    const game = createGame();
    const originalFen = JSON.stringify(game);
    const first = searchBestMove(game, { depth: 2 });
    const second = searchBestMove(game, { depth: 2 });

    assert.ok(generateLegalMoves(game).some(
        (move) => move.from === first.move.from
            && move.to === first.move.to
            && move.promotion === first.move.promotion,
    ));
    assert.deepEqual(first, second);
    assert.equal(first.completedDepth, 2);
    assert.ok(first.nodes > 1);
    assert.equal(JSON.stringify(game), originalFen);
});

test("search finds a mate in one and prefers faster mate scores", () => {
    const game = createGame("7k/6Q1/6K1/8/8/8/8/8 w - - 0 1");
    const result = searchBestMove(game, { depth: 2 });

    assert.ok(result.move);
    assert.equal(result.score, 99_999);
    const child = createGameAfterMove(
        game,
        generateLegalMoves(game).find((move) => (
            move.from === result.move.from
            && move.to === result.move.to
            && move.promotion === result.move.promotion
        )),
    );
    assert.equal(generateLegalMoves(child).length, 0);
    assert.equal(isKingInCheck(child), true);
});

test("search scores stalemate as a draw", () => {
    const game = createGame("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");

    assert.deepEqual(searchBestMove(game, { depth: 2 }), {
        move: null,
        score: 0,
        completedDepth: 0,
        nodes: 0,
        stopped: false,
    });
});

test("search prefers winning a hanging queen", () => {
    const game = createGame("4k3/8/8/4q3/4R3/8/8/4K3 w - - 0 1");
    const result = searchBestMove(game, { depth: 1 });

    assert.deepEqual(
        { from: result.move.from, to: result.move.to },
        { from: 36, to: 28 },
    );
});

test("positional evaluation rewards central pawn development", () => {
    const initial = createGame();
    const central = createGameAfterMove(
        initial,
        generateLegalMoves(initial).find((move) => move.from === 52 && move.to === 36),
    );
    const flank = createGameAfterMove(
        initial,
        generateLegalMoves(initial).find((move) => move.from === 48 && move.to === 40),
    );

    assert.ok(evaluatePosition(central) < evaluatePosition(flank));
});

test("search treats a threefold-repetition root as a draw", () => {
    const game = createGame();
    for (const [from, to] of [
        [62, 45], [6, 21], [45, 62], [21, 6],
        [62, 45], [6, 21], [45, 62], [21, 6],
    ]) {
        applyMove(game, from, to);
    }

    assert.deepEqual(searchBestMove(game, { depth: 3 }), {
        move: null,
        score: 0,
        completedDepth: 0,
        nodes: 0,
        stopped: false,
    });
});

test("search treats the fifty-move rule as a draw", () => {
    const game = createGame("4k3/8/8/8/8/8/8/R3K3 w - - 100 51");

    assert.equal(searchBestMove(game, { depth: 2 }).move, null);
});

test("alpha-beta agrees with unpruned minimax on a shallow position", () => {
    const game = createGame("4k3/8/8/8/3p4/4P3/8/4K3 w - - 0 1");
    const result = searchBestMove(game, { depth: 3, quiescenceDepth: 0 });

    assert.equal(result.score, minimax(game, 3));
});

test("iterative deepening reports only fully completed depths", () => {
    const game = createGame();
    const completedIterations = [];
    const shallowResult = searchBestMove(game, {
        depth: 1,
        onIterationComplete: (iteration) => completedIterations.push(iteration),
    });
    const interruptedResult = searchBestMove(game, {
        depth: 4,
        maxNodes: shallowResult.nodes + 1,
        onIterationComplete: (iteration) => completedIterations.push(iteration),
    });

    assert.equal(completedIterations[0].completedDepth, 1);
    assert.equal(interruptedResult.completedDepth, 1);
    assert.equal(interruptedResult.stopped, true);
    assert.equal(interruptedResult.move.from, shallowResult.move.from);
    assert.equal(interruptedResult.move.to, shallowResult.move.to);
    assert.ok(generateLegalMoves(game).some(
        (move) => move.from === interruptedResult.move.from
            && move.to === interruptedResult.move.to,
    ));
});

test("cancellation before a completed iteration still returns a legal fallback", () => {
    const game = createGame();
    let checks = 0;
    const result = searchBestMove(game, {
        depth: 3,
        shouldCancel: () => {
            checks += 1;
            return checks > 1;
        },
    });

    assert.equal(result.completedDepth, 0);
    assert.equal(result.stopped, true);
    assert.ok(generateLegalMoves(game).some(
        (move) => move.from === result.move.from && move.to === result.move.to,
    ));
});

test("rejects invalid search depths", () => {
    assert.throws(() => searchBestMove(createGame(), { depth: 0 }), RangeError);
    assert.throws(() => searchBestMove(createGame(), { depth: 1.5 }), RangeError);
    assert.throws(() => searchBestMove(createGame(), { maxNodes: 0 }), RangeError);
    assert.throws(() => searchBestMove(createGame(), { timeLimitMs: 0 }), RangeError);
    assert.throws(() => searchBestMove(createGame(), { quiescenceDepth: -1 }), RangeError);
});
