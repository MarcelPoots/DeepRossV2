import {
    createGameAfterMove,
    getDrawReason,
    generateLegalMoves,
    getPieceAt,
    isKingInCheck,
} from "./game.js";

const PIECE_VALUES = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 0,
};
const MATE_SCORE = 100_000;

class SearchStopped extends Error {}

function isWhitePiece(piece) {
    return piece === piece.toUpperCase();
}

export function evaluatePosition(game) {
    // Modest square bonuses reward development/center control without eclipsing material.
    let score = 0;
    const hasQueens = game.board.flat().some(
        (piece) => piece.toLowerCase() === "q",
    );
    let whiteBishops = 0;
    let blackBishops = 0;
    for (let square = 0; square < 64; square += 1) {
        const piece = getPieceAt(game, square);
        if (!piece) {
            continue;
        }

        const white = isWhitePiece(piece);
        const kind = piece.toLowerCase();
        const row = Math.floor(square / 8);
        const column = square % 8;
        const advancement = white ? 6 - row : row - 1;
        const centrality = 7 - Math.abs(3.5 - row) - Math.abs(3.5 - column);
        let positional = 0;

        if (kind === "p") {
            positional = advancement * 8 + centrality * 3;
        } else if (kind === "n" || kind === "b") {
            positional = centrality * (kind === "n" ? 14 : 8);
        } else if (kind === "r") {
            positional = (white ? row === 1 : row === 6) ? 18 : centrality * 2;
        } else if (kind === "q") {
            positional = centrality * 3;
        } else if (kind === "k") {
            positional = centrality * (hasQueens ? -10 : 10);
        }

        score += (white ? 1 : -1) * (PIECE_VALUES[kind] + positional);
        if (kind === "b") {
            if (white) {
                whiteBishops += 1;
            } else {
                blackBishops += 1;
            }
        }
    }
    if (whiteBishops >= 2) score += 25;
    if (blackBishops >= 2) score -= 25;

    return game.sideToMove === "w" ? score : -score;
}

// Search promising tactical moves first so alpha-beta can prune weaker branches
// sooner; victim value rewards valuable captures, while promotion value favors upgrades.
function moveOrderingScore(game, move) {
    const movingPiece = getPieceAt(game, move.from).toLowerCase();
    const capturedPiece = move.enPassant
        ? "p"
        : getPieceAt(game, move.to).toLowerCase();
    const captureScore = capturedPiece
        ? 10_000 + PIECE_VALUES[capturedPiece] - PIECE_VALUES[movingPiece] / 100
        : 0;
    const promotionScore = move.promotion
        ? 20_000 + PIECE_VALUES[move.promotion.toLowerCase()]
        : 0;

    return captureScore + promotionScore;
}

function moveKey(move) {
    return `${move.from}-${move.to}-${move.promotion ?? ""}`;
}

// Quiet moves neither capture nor promote, so they can be stored as cutoff
// heuristics without mixing them with position-specific tactical moves.
function isQuietMove(game, move) {
    return !move.promotion
        && !move.enPassant
        && getPieceAt(game, move.to) === "";
}

// Move ordering changes search efficiency, not the set of moves or their scores.
// The previous iteration's move, killer moves, and history scores help find
// useful alpha-beta cutoffs early; the original index makes ties deterministic.
function orderMoves(game, moves, ply = 0, heuristics, preferredMove = null) {
    return moves
        .map((move, index) => {
            const key = moveKey(move);
            const killers = heuristics?.killers.get(ply) ?? [];
            const killerBonus = isQuietMove(game, move) && killers.includes(key)
                ? 5_000 - killers.indexOf(key) * 100
                : 0;
            const historyBonus = heuristics?.history.get(
                `${game.sideToMove}:${move.from}:${move.to}`,
            ) ?? 0;
            const principalVariationBonus = preferredMove && key === moveKey(preferredMove)
                ? 30_000
                : 0;
            return {
                move,
                index,
                score: moveOrderingScore(game, move)
                    + killerBonus
                    + historyBonus
                    + principalVariationBonus,
            };
        })
        .sort((first, second) => second.score - first.score || first.index - second.index)
        .map(({ move }) => move);
}

// A quiet beta-cutoff refutes the remaining moves at this node. Remember it
// for the same search ply and increase its history score, weighted by depth.
function recordQuietCutoff(game, move, depth, ply, heuristics) {
    if (!isQuietMove(game, move)) {
        return;
    }

    const key = moveKey(move);
    const killers = heuristics.killers.get(ply) ?? [];
    if (!killers.includes(key)) {
        heuristics.killers.set(ply, [key, ...killers].slice(0, 2));
    }
    const historyKey = `${game.sideToMove}:${move.from}:${move.to}`;
    heuristics.history.set(
        historyKey,
        Math.min(1_000_000, (heuristics.history.get(historyKey) ?? 0) + depth * depth),
    );
}

// Negamax keeps all scores relative to the player to move; a beta cutoff means
// the opponent already has a response that makes this branch unnecessary.
function checkSearchLimits(stats, limits) {
    if (
        (limits.maxNodes !== undefined && stats.nodes >= limits.maxNodes)
        || (limits.deadline !== undefined && performance.now() >= limits.deadline)
        || limits.shouldCancel?.()
    ) {
        throw new SearchStopped();
    }
}

function negamax(game, depth, alpha, beta, ply, stats, limits) {
    checkSearchLimits(stats, limits);
    stats.nodes += 1;
    const legalMoves = generateLegalMoves(game);

    // Detect mate and stalemate before static evaluation, including at the horizon.
    if (legalMoves.length === 0) {
        return isKingInCheck(game)
            ? -MATE_SCORE + ply
            : 0;
    }
    if (getDrawReason(game)) {
        return 0;
    }
    if (depth === 0) {
        return quiescence(
            game,
            alpha,
            beta,
            ply,
            stats,
            limits,
            limits.quiescenceDepth,
        );
    }

    let bestScore = -Infinity;
    for (const move of orderMoves(game, legalMoves, ply, stats.heuristics)) {
        const child = createGameAfterMove(game, move);
        const score = -negamax(
            child,
            depth - 1,
            -beta,
            -alpha,
            ply + 1,
            stats,
            limits,
        );
        bestScore = Math.max(bestScore, score);
        alpha = Math.max(alpha, score);
        if (alpha >= beta) {
            recordQuietCutoff(game, move, depth, ply, stats.heuristics);
            break;
        }
    }

    return bestScore;
}

// Extend leaf positions through forcing captures and promotions to avoid
// evaluating in the middle of an exchange. In check, search every evasion:
// standing pat would incorrectly assume the checked side can pass its turn.
function quiescence(game, alpha, beta, ply, stats, limits, remainingDepth) {
    checkSearchLimits(stats, limits);
    stats.nodes += 1;
    const inCheck = isKingInCheck(game);
    const legalMoves = generateLegalMoves(game);
    if (legalMoves.length === 0) {
        return inCheck ? -MATE_SCORE + ply : 0;
    }
    if (getDrawReason(game)) {
        return 0;
    }

    const standPat = evaluatePosition(game);
    if (!inCheck) {
        if (standPat >= beta) {
            return standPat;
        }
        alpha = Math.max(alpha, standPat);
        if (remainingDepth === 0) {
            return standPat;
        }
    } else if (remainingDepth === 0) {
        return standPat;
    }

    // Stand pat is invalid in check, so search every legal evasion there.
    const noisyMoves = inCheck
        ? legalMoves
        : legalMoves.filter((move) => (
            move.promotion
            || move.enPassant
            || getPieceAt(game, move.to) !== ""
        ));
    let bestScore = inCheck ? -Infinity : standPat;
    for (const move of orderMoves(game, noisyMoves, ply, stats.heuristics)) {
        const score = -quiescence(
            createGameAfterMove(game, move),
            -beta,
            -alpha,
            ply + 1,
            stats,
            limits,
            remainingDepth - 1,
        );
        bestScore = Math.max(bestScore, score);
        alpha = Math.max(alpha, score);
        if (alpha >= beta) {
            break;
        }
    }
    return bestScore;
}

/**
 * Search a position using iterative-deepening negamax alpha-beta.
 * Scores are centipawns from the root side-to-move perspective; mate scores
 * favor faster wins and slower losses. If a limit interrupts an iteration,
 * the result remains the best move from the last fully completed depth.
 */
export function searchBestMove(game, {
    depth = 2,
    quiescenceDepth = 8,
    maxNodes,
    timeLimitMs,
    shouldCancel,
    onIterationComplete,
} = {}) {
    if (!Number.isInteger(depth) || depth < 1) {
        throw new RangeError("Search depth must be a positive integer.");
    }
    if (!Number.isInteger(quiescenceDepth) || quiescenceDepth < 0) {
        throw new RangeError("Quiescence depth must be a non-negative integer.");
    }
    if (maxNodes !== undefined && (!Number.isSafeInteger(maxNodes) || maxNodes < 1)) {
        throw new RangeError("Maximum node count must be a positive integer.");
    }
    if (timeLimitMs !== undefined && (!Number.isFinite(timeLimitMs) || timeLimitMs <= 0)) {
        throw new RangeError("Time limit must be a positive number of milliseconds.");
    }
    if (shouldCancel !== undefined && typeof shouldCancel !== "function") {
        throw new TypeError("Search cancellation check must be a function.");
    }
    if (onIterationComplete !== undefined && typeof onIterationComplete !== "function") {
        throw new TypeError("Iteration callback must be a function.");
    }

    const legalMoves = generateLegalMoves(game);
    const stats = {
        nodes: 0,
        heuristics: { killers: new Map(), history: new Map() },
    };
    if (legalMoves.length === 0) {
        return {
            move: null,
            score: isKingInCheck(game) ? -MATE_SCORE : 0,
            completedDepth: 0,
            nodes: 0,
            stopped: false,
        };
    }
    if (getDrawReason(game)) {
        return {
            move: null,
            score: 0,
            completedDepth: 0,
            nodes: 0,
            stopped: false,
        };
    }

    const limits = {
        maxNodes,
        deadline: timeLimitMs === undefined ? undefined : performance.now() + timeLimitMs,
        shouldCancel,
        quiescenceDepth,
    };
    const result = {
        move: legalMoves[0],
        score: evaluatePosition(game),
        completedDepth: 0,
        nodes: 0,
        stopped: false,
    };

    let principalVariationMove = null;
    for (let currentDepth = 1; currentDepth <= depth; currentDepth += 1) {
        let iterationMove = null;
        let iterationScore = -Infinity;
        let alpha = -Infinity;
        const beta = Infinity;

        try {
            checkSearchLimits(stats, limits);
            stats.nodes += 1;
            for (const move of orderMoves(
                game,
                legalMoves,
                0,
                stats.heuristics,
                principalVariationMove,
            )) {
                const child = createGameAfterMove(game, move);
                const score = -negamax(
                    child,
                    currentDepth - 1,
                    -beta,
                    -alpha,
                    1,
                    stats,
                    limits,
                );
                if (score > iterationScore) {
                    iterationScore = score;
                    iterationMove = move;
                }
                alpha = Math.max(alpha, score);
            }
        } catch (error) {
            if (!(error instanceof SearchStopped)) {
                throw error;
            }
            result.stopped = true;
            break;
        }

        result.move = iterationMove;
        result.score = iterationScore;
        result.completedDepth = currentDepth;
        result.nodes = stats.nodes;
        principalVariationMove = iterationMove;
        onIterationComplete?.({ ...result });
    }

    return { ...result, nodes: stats.nodes };
}
