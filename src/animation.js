export function animateMove(board, from, to, updateBoard, piece) {
    const sourceSquare = board.querySelector(`[data-square="${from}"]`);
    const destinationSquare = board.querySelector(`[data-square="${to}"]`);
    const sourcePiece = sourceSquare?.querySelector(".piece");
    const sourceRect = sourcePiece?.getBoundingClientRect();
    const destinationRect = destinationSquare?.getBoundingClientRect();

    // Save the old square positions before rendering the new board so the
    // destination piece can animate from the square it just left.
    updateBoard();

    if (
        !sourceRect
        || !destinationRect
        || (typeof window.matchMedia === "function"
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
        return;
    }

    const destinationPiece = board
        .querySelector(`[data-square="${to}"]`)
        ?.querySelector(".piece");
    if (!destinationPiece || typeof destinationPiece.animate !== "function") {
        return;
    }

    const sourceCenterX = sourceRect.left + sourceRect.width / 2;
    const sourceCenterY = sourceRect.top + sourceRect.height / 2;
    const destinationCenterX = destinationRect.left + destinationRect.width / 2;
    const destinationCenterY = destinationRect.top + destinationRect.height / 2;
    const offsetX = sourceCenterX - destinationCenterX;
    const offsetY = sourceCenterY - destinationCenterY;

    const keyframes = [{ transform: `translate(${offsetX}px, ${offsetY}px)` }];
    if (piece?.toLowerCase() === "n") {
        // Knights travel in an L shape, so add a waypoint at the end of the long leg.
        const sourceRow = Math.floor(from / 8);
        const sourceColumn = from % 8;
        const destinationRow = Math.floor(to / 8);
        const destinationColumn = to % 8;
        const waypointX = Math.abs(destinationColumn - sourceColumn) === 2
            ? destinationCenterX
            : sourceCenterX;
        const waypointY = Math.abs(destinationRow - sourceRow) === 2
            ? destinationCenterY
            : sourceCenterY;
        const longLeg = Math.max(Math.abs(offsetX), Math.abs(offsetY));
        const shortLeg = Math.min(Math.abs(offsetX), Math.abs(offsetY));

        keyframes.push({
            transform: `translate(${waypointX - destinationCenterX}px, ${waypointY - destinationCenterY}px)`,
            offset: longLeg / (longLeg + shortLeg),
        });
    }
    keyframes.push({ transform: "translate(0, 0)" });

    destinationPiece.animate(keyframes, { duration: 1000, easing: "ease-in-out" });
}
