import { createGame } from "./game.js";
import { searchBestMove } from "./search.js";

self.addEventListener("message", (event) => {
    const {
        type,
        requestId,
        fen,
        positionHistory,
        limits,
    } = event.data ?? {};
    if (type !== "search") {
        return;
    }

    try {
        const game = createGame(fen);
        if (
            positionHistory !== undefined
            && (!Array.isArray(positionHistory)
                || positionHistory.some((key) => typeof key !== "string"))
        ) {
            throw new TypeError("Search position history must be an array of position keys.");
        }
        if (positionHistory?.length) {
            game.positionHistory = [...positionHistory];
        }
        const result = searchBestMove(game, {
            ...limits,
            onIterationComplete: (iteration) => {
                self.postMessage({ type: "progress", requestId, iteration });
            },
        });
        self.postMessage({ type: "result", requestId, result });
    } catch (error) {
        self.postMessage({
            type: "error",
            requestId,
            message: error instanceof Error ? error.message : String(error),
        });
    }
});
