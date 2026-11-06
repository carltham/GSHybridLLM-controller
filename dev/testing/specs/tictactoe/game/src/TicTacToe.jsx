import { useState } from "react";

export default function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(null));
  // TODO: whose turn it is, winner, draw, restart

  return (
    <main>
      <div role="status">{/* TODO: status text */}</div>
      {/* TODO: nine buttons, aria-label "Square 1" … "Square 9" */}
    </main>
  );
}
