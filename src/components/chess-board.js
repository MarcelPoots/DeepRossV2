export const pieceNames = {
    K: "king",
    Q: "queen",
    R: "rook",
    B: "bishop",
    N: "knight",
    P: "pawn",
    k: "king",
    q: "queen",
    r: "rook",
    b: "bishop",
    n: "knight",
    p: "pawn",
};

export const pieceSymbols = {
    K: "♔",
    Q: "♕",
    R: "♖",
    B: "♗",
    N: "♘",
    P: "♙",
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
};

const whitePieces = new Set(["K", "Q", "R", "B", "N", "P"]);

export function squareName(index) {
    const row = Math.floor(index / 8);
    const column = index % 8;
    return `${String.fromCharCode(97 + column)}${8 - row}`;
}

export function describePiece(piece) {
    return `${whitePieces.has(piece) ? "White" : "Black"} ${pieceNames[piece]}`;
}

class ChessBoard extends HTMLElement {
    constructor() {
        super();
        this._position = [];
        this._selectedSquare = null;
        this._interactionEnabled = true;
        this.drag = null;
        this.suppressClick = false;

        this.handleClick = this.handleClick.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handlePointerCancel = this.clearDrag.bind(this);
    }

    connectedCallback() {
        this.classList.add("chessboard");
        this.setAttribute("role", "group");
        this.setAttribute("aria-label", "Chessboard");
        this.addEventListener("click", this.handleClick, { capture: true });
        this.addEventListener("pointerdown", this.handlePointerDown);
        window.addEventListener("pointermove", this.handlePointerMove);
        window.addEventListener("pointerup", this.handlePointerUp);
        window.addEventListener("pointercancel", this.handlePointerCancel);
        this.render();
    }

    disconnectedCallback() {
        this.clearDrag();
        this.removeEventListener("click", this.handleClick, { capture: true });
        this.removeEventListener("pointerdown", this.handlePointerDown);
        window.removeEventListener("pointermove", this.handlePointerMove);
        window.removeEventListener("pointerup", this.handlePointerUp);
        window.removeEventListener("pointercancel", this.handlePointerCancel);
    }

    set position(value) {
        this._position = value;
        this.render();
    }

    set selectedSquare(value) {
        this._selectedSquare = value;
        this.render();
    }

    set interactionEnabled(value) {
        this._interactionEnabled = Boolean(value);
    }

    render(focusIndex = null) {
        if (!this.isConnected || this._position.length !== 8) {
            return;
        }

        const squares = document.createDocumentFragment();
        this._position.forEach((rank, row) => {
            rank.forEach((piece, column) => {
                const index = row * 8 + column;
                const square = document.createElement("button");
                const isLightSquare = (row + column) % 2 === 0;

                square.type = "button";
                square.className = `square ${isLightSquare ? "square--light" : "square--dark"}`;
                square.dataset.square = String(index);
                if (piece) {
                    const pieceElement = document.createElement("span");
                    pieceElement.className = "piece";
                    pieceElement.textContent = pieceSymbols[piece];
                    pieceElement.setAttribute("aria-hidden", "true");
                    square.append(pieceElement);
                }
                square.setAttribute(
                    "aria-label",
                    `${squareName(index)}${piece ? `, ${describePiece(piece)}` : ", empty"}`,
                );
                square.setAttribute("aria-pressed", String(this._selectedSquare === index));

                if (column === 0) {
                    const rankLabel = document.createElement("span");
                    rankLabel.className = "square-coordinate square-coordinate--rank";
                    if (row === 7) {
                        rankLabel.classList.add("square-coordinate--rank-bottom");
                    }
                    rankLabel.textContent = String(8 - row);
                    rankLabel.setAttribute("aria-hidden", "true");
                    square.append(rankLabel);
                }

                if (row === 7) {
                    const fileLabel = document.createElement("span");
                    fileLabel.className = "square-coordinate square-coordinate--file";
                    fileLabel.textContent = String.fromCharCode(65 + column);
                    fileLabel.setAttribute("aria-hidden", "true");
                    square.append(fileLabel);
                }

                if (this._selectedSquare === index) {
                    square.classList.add("square--selected");
                }
                squares.append(square);
            });
        });

        this.replaceChildren(squares);
        if (focusIndex !== null) {
            this.querySelector(`[data-square="${focusIndex}"]`)?.focus({ preventScroll: true });
        }
    }

    handleClick(event) {
        if (this.suppressClick) {
            this.suppressClick = false;
            event.stopImmediatePropagation();
            return;
        }

        const square = event.target.closest("button[data-square]");
        if (square) {
            this.dispatchEvent(new CustomEvent("square-select", {
                bubbles: true,
                detail: { index: Number(square.dataset.square) },
            }));
        }
    }

    handlePointerDown(event) {
        const square = event.target.closest("button[data-square]");
        if (!square || event.button !== 0 || !event.isPrimary || !this._interactionEnabled) {
            return;
        }

        const from = Number(square.dataset.square);
        const piece = this._position[Math.floor(from / 8)]?.[from % 8];
        if (!piece) {
            return;
        }

        event.preventDefault();
        this.drag = {
            from,
            piece,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            active: false,
            ghost: null,
        };
    }

    handlePointerMove(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) {
            return;
        }

        // Ignore tiny pointer motion so a normal click is not mistaken for a drag.
        if (!this.drag.active && Math.hypot(
            event.clientX - this.drag.startX,
            event.clientY - this.drag.startY,
        ) > 5) {
            this.drag.active = true;
            this._selectedSquare = this.drag.from;
            this.dispatchEvent(new CustomEvent("square-select", {
                bubbles: true,
                detail: { index: this.drag.from },
            }));
            this.render();
            this.querySelector(`[data-square="${this.drag.from}"]`)?.classList.add("square--dragging");

            const ghost = document.createElement("span");
            ghost.className = "piece-drag-ghost";
            ghost.textContent = pieceSymbols[this.drag.piece];
            document.body.append(ghost);
            this.drag.ghost = ghost;
        }

        if (this.drag.active) {
            this.drag.ghost.style.left = `${event.clientX}px`;
            this.drag.ghost.style.top = `${event.clientY}px`;
        }
    }

    handlePointerUp(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId) {
            return;
        }

        if (!this.drag.active) {
            this.clearDrag();
            return;
        }

        const destination = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest("button[data-square]");
        const from = this.drag.from;
        const to = destination && this.contains(destination)
            ? Number(destination.dataset.square)
            : null;

        // Clear drag visuals before rerendering, and consume the generated click
        // so the same gesture cannot also select a square.
        this.clearDrag();
        this.suppressClick = true;
        window.setTimeout(() => {
            this.suppressClick = false;
        }, 0);

        if (to === null) {
            this._selectedSquare = null;
            this.render();
            this.dispatchEvent(new CustomEvent("move-cancelled", { bubbles: true }));
            return;
        }

        this.dispatchEvent(new CustomEvent("piece-move", {
            bubbles: true,
            detail: { from, to },
        }));
    }

    clearDrag() {
        document.querySelector(".piece-drag-ghost")?.remove();
        if (this.drag) {
            this.querySelector(`[data-square="${this.drag.from}"]`)?.classList.remove("square--dragging");
        }
        this.drag = null;
    }
}

customElements.define("chess-board", ChessBoard);
