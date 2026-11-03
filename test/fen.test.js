import assert from "node:assert/strict";
import test from "node:test";
import { parseFen, serializeFen } from "../src/fen.js";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

test("parses and serializes the starting position", () => {
    const state = parseFen(STARTING_FEN);

    assert.equal(state.board.length, 8);
    assert.equal(state.board[0].join(""), "rnbqkbnr");
    assert.equal(state.board[7].join(""), "RNBQKBNR");
    assert.equal(state.sideToMove, "w");
    assert.equal(state.castlingRights, "KQkq");
    assert.equal(state.enPassantTarget, null);
    assert.equal(state.halfmoveClock, 0);
    assert.equal(state.fullmoveNumber, 1);
    assert.equal(serializeFen(state), STARTING_FEN);
});

test("round-trips FEN containing an en-passant target and non-default clocks", () => {
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq e6 3 4";

    assert.equal(serializeFen(parseFen(fen)), fen);
});

test("rejects malformed FEN", async (t) => {
    const invalidFens = [
        "8/8/8/8/8/8/8/8 w - - 0",
        "8/8/8/8/8/8/8/7 w - - 0 1",
        "8/8/8/8/8/8/8/9 w - - 0 1",
        "8/8/8/8/8/8/8/7X w - - 0 1",
        "8/8/8/8/8/8/8/8 x - - 0 1",
        "8/8/8/8/8/8/8/8 w KK - 0 1",
        "8/8/8/8/8/8/8/8 w - e4 0 1",
        "8/8/8/8/8/8/8/8 w - - -1 1",
        "8/8/8/8/8/8/8/8 w - - 0 0",
    ];

    for (const fen of invalidFens) {
        await t.test(fen, () => {
            assert.throws(() => parseFen(fen), TypeError);
        });
    }
});
