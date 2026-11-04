const PIECES = new Set(["K", "Q", "R", "B", "N", "P", "k", "q", "r", "b", "n", "p"]);
const CASTLING_RIGHTS = new Set(["K", "Q", "k", "q"]);

function assertGameState(state) {
    // Validate every FEN field before serialization so malformed game state is never emitted.
    if (!state || !Array.isArray(state.board) || state.board.length !== 8) {
        throw new TypeError("FEN board must contain exactly 8 ranks.");
    }

    for (const rank of state.board) {
        if (!Array.isArray(rank) || rank.length !== 8) {
            throw new TypeError("Each FEN rank must contain exactly 8 squares.");
        }
        for (const piece of rank) {
            if (piece !== "" && !PIECES.has(piece)) {
                throw new TypeError(`Invalid FEN piece: ${piece}`);
            }
        }
    }

    if (state.sideToMove !== "w" && state.sideToMove !== "b") {
        throw new TypeError("FEN side to move must be 'w' or 'b'.");
    }

    if (
        typeof state.castlingRights !== "string"
        || (state.castlingRights !== "-"
            && (!/^(?!.*(.).*\1)[KQkq]+$/.test(state.castlingRights)
                || [...state.castlingRights].some((right) => !CASTLING_RIGHTS.has(right))))
    ) {
        throw new TypeError("Invalid FEN castling rights.");
    }

    if (
        state.enPassantTarget !== null
        && (typeof state.enPassantTarget !== "string"
            || !/^[a-h][36]$/.test(state.enPassantTarget))
    ) {
        throw new TypeError("Invalid FEN en-passant target.");
    }

    if (!Number.isSafeInteger(state.halfmoveClock) || state.halfmoveClock < 0) {
        throw new TypeError("FEN halfmove clock must be a non-negative integer.");
    }

    if (!Number.isSafeInteger(state.fullmoveNumber) || state.fullmoveNumber < 1) {
        throw new TypeError("FEN fullmove number must be a positive integer.");
    }
}

export function serializeFen(state) {
    assertGameState(state);

    // FEN writes each consecutive run of empty squares as one digit.
    const piecePlacement = state.board.map((rank) => {
        let emptyCount = 0;
        let fenRank = "";

        for (const piece of rank) {
            if (piece === "") {
                emptyCount += 1;
            } else {
                if (emptyCount > 0) {
                    fenRank += String(emptyCount);
                    emptyCount = 0;
                }
                fenRank += piece;
            }
        }

        return fenRank + (emptyCount > 0 ? String(emptyCount) : "");
    }).join("/");

    return [
        piecePlacement,
        state.sideToMove,
        state.castlingRights,
        state.enPassantTarget ?? "-",
        state.halfmoveClock,
        state.fullmoveNumber,
    ].join(" ");
}

export function parseFen(fen) {
    if (typeof fen !== "string") {
        throw new TypeError("FEN must be a string.");
    }

    // FEN has six whitespace-separated fields; parse placement separately
    // before validating the remaining fields as a complete game state.
    const fields = fen.trim().split(/\s+/);
    if (fields.length !== 6) {
        throw new TypeError("FEN must contain exactly 6 fields.");
    }

    const [placement, sideToMove, castlingRights, enPassant, halfmove, fullmove] = fields;
    const ranks = placement.split("/");
    if (ranks.length !== 8) {
        throw new TypeError("FEN piece placement must contain exactly 8 ranks.");
    }

    const board = ranks.map((rankText) => {
        // Expand empty-square counts so each board rank has one entry per square.
        const rank = [];
        for (const token of rankText) {
            if (/^[1-8]$/.test(token)) {
                for (let count = Number(token); count > 0; count -= 1) {
                    rank.push("");
                }
            } else if (PIECES.has(token)) {
                rank.push(token);
            } else {
                throw new TypeError(`Invalid FEN piece placement character: ${token}`);
            }
        }

        if (rank.length !== 8) {
            throw new TypeError("Each FEN rank must describe exactly 8 squares.");
        }
        return rank;
    });

    const state = {
        board,
        sideToMove,
        castlingRights,
        enPassantTarget: enPassant === "-" ? null : enPassant,
        halfmoveClock: Number(halfmove),
        fullmoveNumber: Number(fullmove),
    };
    assertGameState(state);
    if (!/^(0|[1-9]\d*)$/.test(halfmove) || !/^[1-9]\d*$/.test(fullmove)) {
        throw new TypeError("FEN clocks must be valid non-negative/positive integers.");
    }

    return state;
}
