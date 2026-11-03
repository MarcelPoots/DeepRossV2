import assert from "node:assert/strict";
import test from "node:test";
import { applyMove, createGame, getGameFen, getPieceAt } from "../src/game.js";

test("creates independent games at the starting position", () => {
    const firstGame = createGame();
    const secondGame = createGame();

    assert.equal(getGameFen(firstGame), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    assert.equal(getPieceAt(firstGame, 60), "K");
    assert.equal(getPieceAt(firstGame, 64), "");
    assert.notEqual(firstGame.board, secondGame.board);
    assert.notEqual(firstGame.board[0], secondGame.board[0]);
});

test("applies a move and updates the position metadata", () => {
    const game = createGame();

    assert.deepEqual(applyMove(game, 52, 36), {
        moved: true,
        piece: "P",
        capturedPiece: "",
    });
    assert.equal(getGameFen(game), "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
});

test("rejects moves without changing state", () => {
    const game = createGame();
    const initialFen = getGameFen(game);

    assert.deepEqual(applyMove(game, 52, 52), { moved: false, reason: "same-square" });
    assert.deepEqual(applyMove(game, 44, 36), { moved: false, reason: "empty-source" });
    assert.deepEqual(applyMove(game, 52, 60), { moved: false, reason: "own-piece" });
    assert.deepEqual(applyMove(game, -1, 44), { moved: false, reason: "invalid-square" });
    assert.equal(getGameFen(game), initialFen);
});

test("updates castling rights and move counters as pieces move", () => {
    const game = createGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");

    applyMove(game, 60, 52);
    assert.equal(game.castlingRights, "kq");
    applyMove(game, 4, 12);
    assert.equal(getGameFen(game), "r6r/4k3/8/8/8/8/4K3/R6R w - - 2 2");
});

test("resetting by creating a new game leaves the old game unchanged", () => {
    const oldGame = createGame();
    applyMove(oldGame, 52, 36);

    const resetGame = createGame();

    assert.equal(getGameFen(resetGame), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    assert.equal(getGameFen(oldGame), "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
});
