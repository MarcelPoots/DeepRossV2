export function enablePieceDragAndDrop(board, { getPieceAt, movePiece, setSelectedSquare, renderBoard, setStatus }) {
    let drag = null;
    let suppressClick = false;

    function clearDrag() {
        document.querySelector(".piece-drag-ghost")?.remove();
        if (drag) {
            board.querySelector(`[data-square="${drag.from}"]`)?.classList.remove("square--dragging");
        }
        drag = null;
    }

    function updateDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        // Ignore tiny pointer motion so a normal click is not mistaken for a drag.
        if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) {
            drag.active = true;
            setSelectedSquare(drag.from);
            renderBoard();
            board.querySelector(`[data-square="${drag.from}"]`)?.classList.add("square--dragging");

            const ghost = document.createElement("span");
            ghost.className = "piece-drag-ghost";
            ghost.textContent = drag.piece;
            document.body.append(ghost);
            drag.ghost = ghost;
        }

        if (drag.active) {
            drag.ghost.style.left = `${event.clientX}px`;
            drag.ghost.style.top = `${event.clientY}px`;
        }
    }

    board.addEventListener("pointerdown", (event) => {
        const square = event.target.closest("button[data-square]");
        if (!square || event.button !== 0 || !event.isPrimary) {
            return;
        }

        const from = Number(square.dataset.square);
        const piece = getPieceAt(from);
        if (!piece) {
            return;
        }

        event.preventDefault();
        drag = {
            from,
            piece,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            active: false,
            ghost: null,
        };
    });

    window.addEventListener("pointermove", updateDrag);

    window.addEventListener("pointerup", (event) => {
        if (!drag || event.pointerId !== drag.pointerId) {
            return;
        }

        if (!drag.active) {
            clearDrag();
            return;
        }

        const destination = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest("button[data-square]");
        const from = drag.from;
        const to = destination && board.contains(destination) ? Number(destination.dataset.square) : null;

        // Clear drag visuals before rerendering, and consume the generated click
        // so the same gesture cannot also select a square.
        clearDrag();
        suppressClick = true;
        window.setTimeout(() => {
            suppressClick = false;
        }, 0);

        if (to === null) {
            setSelectedSquare(null);
            renderBoard();
            setStatus("Move cancelled.");
            return;
        }

        movePiece(from, to);
    });

    window.addEventListener("pointercancel", clearDrag);

    board.addEventListener("click", (event) => {
        if (suppressClick) {
            suppressClick = false;
            event.stopImmediatePropagation();
        }
    }, { capture: true });
}
