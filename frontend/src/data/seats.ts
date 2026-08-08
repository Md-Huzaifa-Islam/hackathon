import type { Seat } from "@/types";

const ROWS = ["A", "B", "C", "D"];
const SEATS_PER_ROW = 8;

export const seats: Seat[] = ROWS.flatMap((row) =>
  Array.from({ length: SEATS_PER_ROW }, (_, i) => {
    const number = i + 1;
    return {
      id: `${row}${number}`,
      row,
      number,
      status: "AVAILABLE",
    } satisfies Seat;
  })
);
