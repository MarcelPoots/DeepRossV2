import assert from "node:assert/strict";
import test from "node:test";
import {
    applyMove,
    createGame,
    generateLegalMoves,
    getGameFen,
    getPieceAt,
    isKingInCheck,
    perft,
} from "../src/game.js";

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
        promotion: null,
    });
    assert.equal(getGameFen(game), "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
});

test("rejects moves without changing state", () => {
    const game = createGame();
    const initialFen = getGameFen(game);

    assert.deepEqual(applyMove(game, 52, 52), { moved: false, reason: "same-square" });
    assert.deepEqual(applyMove(game, 44, 36), { moved: false, reason: "empty-source" });
    assert.deepEqual(applyMove(game, 52, 60), { moved: false, reason: "own-piece" });
    assert.deepEqual(applyMove(game, 4, 12), { moved: false, reason: "wrong-side" });
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

test("generates 20 legal moves from the starting position", () => {
    assert.equal(generateLegalMoves(createGame()).length, 20);
});

test("matches starting-position perft counts through depth 3", () => {
    const game = createGame();

    assert.deepEqual([1, 2, 3].map((depth) => perft(game, depth)), [20, 400, 8902]);
    assert.equal(getGameFen(game), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
});

test("matches standard endgame perft counts through depth 3", () => {
    const game = createGame("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1");

    assert.deepEqual([1, 2, 3].map((depth) => perft(game, depth)), [14, 191, 2812]);
});

test("matches standard castling and promotion perft counts through depth 3", () => {
    const game = createGame(
        "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    );

    assert.deepEqual([1, 2, 3].map((depth) => perft(game, depth)), [6, 264, 9467]);
});

test("rejects moves that leave the king in check", () => {
    const game = createGame("4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1");

    assert.equal(isKingInCheck(game, true), false);
    assert.equal(
        generateLegalMoves(game).some((move) => move.from === 52 && move.to === 51),
        false,
    );
    assert.deepEqual(applyMove(game, 52, 51), { moved: false, reason: "illegal-move" });
});

test("allows castling and moves the rook to its castled square", () => {
    const game = createGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");

    assert.equal(
        generateLegalMoves(game).some((move) => move.from === 60 && move.to === 62),
        true,
    );
    assert.deepEqual(applyMove(game, 60, 62), {
        moved: true,
        piece: "K",
        capturedPiece: "",
        promotion: null,
    });
    assert.equal(getGameFen(game), "r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1");
});

test("does not allow castling through an attacked square", () => {
    const game = createGame("4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    const moves = generateLegalMoves(game);

    assert.equal(moves.some((move) => move.from === 60 && move.to === 62), false);
    assert.equal(moves.some((move) => move.from === 60 && move.to === 58), true);
});

test("supports en passant and removes the captured pawn", () => {
    const game = createGame("4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1");
    const move = generateLegalMoves(game).find(
        (candidate) => candidate.from === 35 && candidate.to === 44,
    );

    assert.equal(move?.enPassant, true);
    assert.equal(applyMove(game, 35, 44).moved, true);
    assert.equal(getGameFen(game), "4k3/8/8/8/8/4p3/8/4K3 w - - 0 2");
});

test("rejects en passant when it would expose the king to check", () => {
    const game = createGame("8/8/8/8/k2pP2R/8/8/4K3 b - e3 0 1");

    assert.equal(
        generateLegalMoves(game).some(
            (move) => move.from === 35 && move.to === 44 && move.enPassant,
        ),
        false,
    );
});

test("generates all promotion choices and applies underpromotion", () => {
    const game = createGame("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    const promotions = generateLegalMoves(game)
        .filter((move) => move.from === 8 && move.to === 0)
        .map((move) => move.promotion);

    assert.deepEqual(promotions, ["Q", "R", "B", "N"]);
    assert.deepEqual(applyMove(game, 8, 0, "N"), {
        moved: true,
        piece: "P",
        capturedPiece: "",
        promotion: "N",
    });
    assert.equal(getGameFen(game), "N3k3/8/8/8/8/8/8/4K3 b - - 0 1");
});
