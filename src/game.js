import { parseFen, serializeFen } from "./fen.js";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PROMOTIONS = {
    w: ["Q", "R", "B", "N"],
    b: ["q", "r", "b", "n"],
};
const ROOK_CASTLING_RIGHTS = new Map([
    [0, ["r", "q"]],
    [7, ["r", "k"]],
    [56, ["R", "Q"]],
    [63, ["R", "K"]],
]);
const KNIGHT_STEPS = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING_STEPS = [
    [-1, -1], [-1, 0], [-1, 1], [0, -1],
    [0, 1], [1, -1], [1, 0], [1, 1],
];
const BISHOP_DIRECTIONS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRECTIONS = [[-1, 0], [0, -1], [0, 1], [1, 0]];

function isWhitePiece(piece) {
    return piece !== "" && piece === piece.toUpperCase();
}

function isEnemyPiece(piece, white) {
    return piece !== "" && isWhitePiece(piece) !== white;
}

function squareName(index) {
    return `${String.fromCharCode(97 + (index % 8))}${8 - Math.floor(index / 8)}`;
}

function indexAt(row, column) {
    return row * 8 + column;
}

function addMove(moves, from, to, promotion = null, flags = {}) {
    moves.push({ from, to, promotion, ...flags });
}

function addPawnMove(moves, from, to, white, flags = {}) {
    const promotionRow = white ? 0 : 7;
    if (Math.floor(to / 8) === promotionRow) {
        for (const promotion of PROMOTIONS[white ? "w" : "b"]) {
            addMove(moves, from, to, promotion, flags);
        }
    } else {
        addMove(moves, from, to, null, flags);
    }
}

function addLeaperMoves(game, moves, from, white, steps) {
    const row = Math.floor(from / 8);
    const column = from % 8;
    for (const [rowDelta, columnDelta] of steps) {
        const targetRow = row + rowDelta;
        const targetColumn = column + columnDelta;
        if (targetRow < 0 || targetRow > 7 || targetColumn < 0 || targetColumn > 7) {
            continue;
        }
        const to = indexAt(targetRow, targetColumn);
        const target = game.board[targetRow][targetColumn];
        if (!target || (isEnemyPiece(target, white) && target.toLowerCase() !== "k")) {
            addMove(moves, from, to);
        }
    }
}

function addSlidingMoves(game, moves, from, white, directions) {
    const row = Math.floor(from / 8);
    const column = from % 8;
    for (const [rowDelta, columnDelta] of directions) {
        let targetRow = row + rowDelta;
        let targetColumn = column + columnDelta;
        while (targetRow >= 0 && targetRow < 8 && targetColumn >= 0 && targetColumn < 8) {
            const to = indexAt(targetRow, targetColumn);
            const target = game.board[targetRow][targetColumn];
            if (!target) {
                addMove(moves, from, to);
            } else {
                if (isEnemyPiece(target, white) && target.toLowerCase() !== "k") {
                    addMove(moves, from, to);
                }
                break;
            }
            targetRow += rowDelta;
            targetColumn += columnDelta;
        }
    }
}

export function createGame(fen = STARTING_FEN) {
    return parseFen(fen);
}

export function getPieceAt(game, index) {
    if (!Number.isInteger(index) || index < 0 || index >= 64) {
        return "";
    }

    return game.board[Math.floor(index / 8)][index % 8];
}

export function getGameFen(game) {
    return serializeFen(game);
}

export function isSquareAttacked(game, square, byWhite) {
    const row = Math.floor(square / 8);
    const column = square % 8;

    // Pawns, knights, and kings attack at fixed offsets; sliding pieces are
    // checked along rays below, stopping as soon as another piece blocks the ray.
    const pawn = byWhite ? "P" : "p";
    const pawnRow = row + (byWhite ? 1 : -1);
    for (const pawnColumn of [column - 1, column + 1]) {
        if (
            pawnRow >= 0 && pawnRow < 8 && pawnColumn >= 0 && pawnColumn < 8
            && game.board[pawnRow][pawnColumn] === pawn
        ) {
            return true;
        }
    }

    const knight = byWhite ? "N" : "n";
    for (const [rowDelta, columnDelta] of KNIGHT_STEPS) {
        const targetRow = row + rowDelta;
        const targetColumn = column + columnDelta;
        if (
            targetRow >= 0 && targetRow < 8 && targetColumn >= 0 && targetColumn < 8
            && game.board[targetRow][targetColumn] === knight
        ) {
            return true;
        }
    }

    const king = byWhite ? "K" : "k";
    for (const [rowDelta, columnDelta] of KING_STEPS) {
        const targetRow = row + rowDelta;
        const targetColumn = column + columnDelta;
        if (
            targetRow >= 0 && targetRow < 8 && targetColumn >= 0 && targetColumn < 8
            && game.board[targetRow][targetColumn] === king
        ) {
            return true;
        }
    }

    for (const [directions, pieces] of [
        [BISHOP_DIRECTIONS, byWhite ? ["B", "Q"] : ["b", "q"]],
        [ROOK_DIRECTIONS, byWhite ? ["R", "Q"] : ["r", "q"]],
    ]) {
        for (const [rowDelta, columnDelta] of directions) {
            let targetRow = row + rowDelta;
            let targetColumn = column + columnDelta;
            while (targetRow >= 0 && targetRow < 8 && targetColumn >= 0 && targetColumn < 8) {
                const piece = game.board[targetRow][targetColumn];
                if (piece) {
                    if (pieces.includes(piece)) {
                        return true;
                    }
                    break;
                }
                targetRow += rowDelta;
                targetColumn += columnDelta;
            }
        }
    }

    return false;
}

export function isKingInCheck(game, white = game.sideToMove === "w") {
    const king = white ? "K" : "k";
    for (let row = 0; row < 8; row += 1) {
        const column = game.board[row].indexOf(king);
        if (column !== -1) {
            return isSquareAttacked(game, indexAt(row, column), !white);
        }
    }
    return true;
}

function addPawnMoves(game, moves, from, white) {
    const row = Math.floor(from / 8);
    const column = from % 8;
    const direction = white ? -1 : 1;
    const startRow = white ? 6 : 1;
    const oneStepRow = row + direction;

    if (oneStepRow >= 0 && oneStepRow < 8 && !game.board[oneStepRow][column]) {
        addPawnMove(moves, from, indexAt(oneStepRow, column), white);
        const twoStepRow = row + direction * 2;
        if (row === startRow && !game.board[twoStepRow][column]) {
            addPawnMove(moves, from, indexAt(twoStepRow, column), white, { doublePawn: true });
        }
    }

    for (const targetColumn of [column - 1, column + 1]) {
        if (targetColumn < 0 || targetColumn > 7 || oneStepRow < 0 || oneStepRow > 7) {
            continue;
        }
        const target = game.board[oneStepRow][targetColumn];
        const to = indexAt(oneStepRow, targetColumn);
        if (isEnemyPiece(target, white) && target.toLowerCase() !== "k") {
            addPawnMove(moves, from, to, white);
        } else if (game.enPassantTarget === squareName(to)) {
            // The FEN target marks the landing square; the pawn being captured is beside the mover.
            const capturedPawn = game.board[row][targetColumn];
            if (capturedPawn === (white ? "p" : "P")) {
                addPawnMove(moves, from, to, white, { enPassant: true });
            }
        }
    }
}

function addCastlingMoves(game, moves, white) {
    const row = white ? 7 : 0;
    const king = white ? "K" : "k";
    const rook = white ? "R" : "r";
    const kingSide = white ? "K" : "k";
    const queenSide = white ? "Q" : "q";
    const base = row * 8;

    // Castling needs the right, the rook, a clear path, and a king that does
    // not start on or cross an attacked square.
    if (
        game.board[row][4] !== king
        || isSquareAttacked(game, base + 4, !white)
    ) {
        return;
    }

    if (
        game.castlingRights.includes(kingSide)
        && game.board[row][7] === rook
        && !game.board[row][5] && !game.board[row][6]
        && !isSquareAttacked(game, base + 5, !white)
        && !isSquareAttacked(game, base + 6, !white)
    ) {
        addMove(moves, base + 4, base + 6, null, { castle: "king" });
    }

    if (
        game.castlingRights.includes(queenSide)
        && game.board[row][0] === rook
        && !game.board[row][1] && !game.board[row][2] && !game.board[row][3]
        && !isSquareAttacked(game, base + 3, !white)
        && !isSquareAttacked(game, base + 2, !white)
    ) {
        addMove(moves, base + 4, base + 2, null, { castle: "queen" });
    }
}

function generatePseudoLegalMoves(game) {
    const moves = [];
    const white = game.sideToMove === "w";

    // Generate movement candidates only for the side whose turn it is.
    for (let from = 0; from < 64; from += 1) {
        const piece = getPieceAt(game, from);
        if (!piece || isWhitePiece(piece) !== white) {
            continue;
        }

        switch (piece.toLowerCase()) {
            case "p":
                addPawnMoves(game, moves, from, white);
                break;
            case "n":
                addLeaperMoves(game, moves, from, white, KNIGHT_STEPS);
                break;
            case "b":
                addSlidingMoves(game, moves, from, white, BISHOP_DIRECTIONS);
                break;
            case "r":
                addSlidingMoves(game, moves, from, white, ROOK_DIRECTIONS);
                break;
            case "q":
                addSlidingMoves(game, moves, from, white, [
                    ...BISHOP_DIRECTIONS,
                    ...ROOK_DIRECTIONS,
                ]);
                break;
            case "k":
                addLeaperMoves(game, moves, from, white, KING_STEPS);
                break;
            default:
                break;
        }
    }

    addCastlingMoves(game, moves, white);
    return moves;
}

function applyUnchecked(game, move) {
    const piece = getPieceAt(game, move.from);
    const capturedPiece = getPieceAt(game, move.to);
    const fromRow = Math.floor(move.from / 8);
    const fromColumn = move.from % 8;
    const toRow = Math.floor(move.to / 8);
    const toColumn = move.to % 8;
    const white = isWhitePiece(piece);
    const isPawn = piece.toLowerCase() === "p";

    // A king/rook move or a rook capture can permanently remove castling rights.
    if (piece === "K") {
        game.castlingRights = game.castlingRights.replace(/[KQ]/g, "");
    } else if (piece === "k") {
        game.castlingRights = game.castlingRights.replace(/[kq]/g, "");
    }

    const movingRookRights = ROOK_CASTLING_RIGHTS.get(move.from);
    if (movingRookRights?.[0] === piece) {
        game.castlingRights = game.castlingRights.replace(movingRookRights[1], "");
    }
    const capturedRookRights = ROOK_CASTLING_RIGHTS.get(move.to);
    if (capturedRookRights?.[0] === capturedPiece) {
        game.castlingRights = game.castlingRights.replace(capturedRookRights[1], "");
    }
    game.castlingRights ||= "-";

    if (move.enPassant) {
        game.board[fromRow][toColumn] = "";
    }

    // Apply the move and its special rook movement; callers provide a legal move.
    game.board[toRow][toColumn] = move.promotion ?? piece;
    game.board[fromRow][fromColumn] = "";

    if (move.castle === "king") {
        game.board[toRow][5] = game.board[toRow][7];
        game.board[toRow][7] = "";
    } else if (move.castle === "queen") {
        game.board[toRow][3] = game.board[toRow][0];
        game.board[toRow][0] = "";
    }

    game.enPassantTarget = move.doublePawn ? squareName((move.from + move.to) / 2) : null;
    game.halfmoveClock = isPawn || capturedPiece || move.enPassant ? 0 : game.halfmoveClock + 1;
    if (!white) {
        game.fullmoveNumber += 1;
    }
    game.sideToMove = white ? "b" : "w";
}

function cloneGame(game) {
    return {
        ...game,
        board: game.board.map((rank) => [...rank]),
    };
}

export function generateLegalMoves(game) {
    const white = game.sideToMove === "w";
    return generatePseudoLegalMoves(game).filter((move) => {
        // Test each candidate on a copy so illegal moves never change the live game.
        const candidate = cloneGame(game);
        applyUnchecked(candidate, move);
        return !isKingInCheck(candidate, white);
    });
}

export function chooseRandomLegalMove(game, random = Math.random) {
    const legalMoves = generateLegalMoves(game);
    if (legalMoves.length === 0) {
        return null;
    }

    const randomValue = random();
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
        throw new RangeError("Random source must return a number in [0, 1).");
    }
    return legalMoves[Math.floor(randomValue * legalMoves.length)];
}

export function applyMove(game, from, to, promotion = null) {
    if (
        !Number.isInteger(from) || from < 0 || from >= 64
        || !Number.isInteger(to) || to < 0 || to >= 64
    ) {
        return { moved: false, reason: "invalid-square" };
    }

    if (from === to) {
        return { moved: false, reason: "same-square" };
    }

    const piece = getPieceAt(game, from);
    if (!piece) {
        return { moved: false, reason: "empty-source" };
    }
    if (isWhitePiece(piece) !== (game.sideToMove === "w")) {
        return { moved: false, reason: "wrong-side" };
    }
    const target = getPieceAt(game, to);
    if (target && !isEnemyPiece(target, isWhitePiece(piece))) {
        return { moved: false, reason: "own-piece" };
    }

    // Match the requested squares against legal moves before changing game state.
    const candidateMoves = generateLegalMoves(game).filter(
        (move) => move.from === from && move.to === to,
    );
    if (candidateMoves.length === 0) {
        return { moved: false, reason: "illegal-move" };
    }

    if (promotion && !candidateMoves.some((candidate) => candidate.promotion === promotion)) {
        return { moved: false, reason: "illegal-promotion" };
    }
    // If no promotion was chosen, use the standard default: a queen.
    const move = candidateMoves.find((candidate) => candidate.promotion === promotion)
        ?? candidateMoves.find((candidate) => candidate.promotion === (game.sideToMove === "w" ? "Q" : "q"))
        ?? candidateMoves[0];
    const capturedPiece = getPieceAt(game, to);
    applyUnchecked(game, move);
    return { moved: true, piece, capturedPiece, promotion: move.promotion };
}

export function perft(game, depth) {
    if (!Number.isInteger(depth) || depth < 0) {
        throw new RangeError("Perft depth must be a non-negative integer.");
    }
    if (depth === 0) {
        return 1;
    }

    // Count reachable positions by recursively playing each move on its own copy.
    let nodes = 0;
    for (const move of generateLegalMoves(game)) {
        const child = cloneGame(game);
        applyUnchecked(child, move);
        nodes += perft(child, depth - 1);
    }
    return nodes;
}
