import { parseFen, serializeFen } from "./fen.js";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const ROOK_CASTLING_RIGHTS = new Map([
    [0, ["r", "q"]],
    [7, ["r", "k"]],
    [56, ["R", "Q"]],
    [63, ["R", "K"]],
]);

function isWhitePiece(piece) {
    return piece !== "" && piece === piece.toUpperCase();
}

function squareName(index) {
    return `${String.fromCharCode(97 + (index % 8))}${8 - Math.floor(index / 8)}`;
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

export function applyMove(game, from, to) {
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

    const capturedPiece = getPieceAt(game, to);
    if (capturedPiece && isWhitePiece(piece) === isWhitePiece(capturedPiece)) {
        return { moved: false, reason: "own-piece" };
    }

    if (piece === "K") {
        game.castlingRights = game.castlingRights.replace(/[KQ]/g, "") || "-";
    } else if (piece === "k") {
        game.castlingRights = game.castlingRights.replace(/[kq]/g, "") || "-";
    }

    const movingRookRights = ROOK_CASTLING_RIGHTS.get(from);
    if (movingRookRights?.[0] === piece) {
        game.castlingRights = game.castlingRights.replace(movingRookRights[1], "") || "-";
    }

    const capturedRookRights = ROOK_CASTLING_RIGHTS.get(to);
    if (capturedRookRights?.[0] === capturedPiece) {
        game.castlingRights = game.castlingRights.replace(capturedRookRights[1], "") || "-";
    }

    const fromRow = Math.floor(from / 8);
    const toRow = Math.floor(to / 8);
    const isDoublePawnAdvance = (piece === "P" && fromRow === 6 && toRow === 4)
        || (piece === "p" && fromRow === 1 && toRow === 3);
    game.enPassantTarget = isDoublePawnAdvance ? squareName((from + to) / 2) : null;
    game.halfmoveClock = piece.toLowerCase() === "p" || capturedPiece
        ? 0
        : game.halfmoveClock + 1;

    if (!isWhitePiece(piece)) {
        game.fullmoveNumber += 1;
    }
    game.sideToMove = isWhitePiece(piece) ? "b" : "w";

    game.board[Math.floor(to / 8)][to % 8] = piece;
    game.board[fromRow][from % 8] = "";

    return { moved: true, piece, capturedPiece };
}
