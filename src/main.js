const startingPosition = [
    ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
    ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
    ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"],
];

const board = document.querySelector("#chessboard");

startingPosition.forEach((rank, row) => {
    rank.forEach((piece, column) => {
        const square = document.createElement("span");
        const isLightSquare = (row + column) % 2 === 0;

        square.className = `square ${isLightSquare ? "square--light" : "square--dark"}`;
        square.textContent = piece;
        square.setAttribute("aria-hidden", "true");
        board.append(square);
    });
});