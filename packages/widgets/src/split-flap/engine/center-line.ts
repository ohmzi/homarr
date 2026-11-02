// Horizontal placement of one line of flaps on a board of a given width. Cells are
// already folded to drum characters (see charset.textToCells), one per flap.

const ellipsis = [".", ".", "."];

// A line wider than the board is cut from the middle, the way a departure board keeps
// the end of a long destination.
const fitLine = (cells: string[], columns: number): string[] => {
  if (cells.length <= columns) return cells;
  if (columns <= ellipsis.length) return cells.slice(0, columns);
  const keep = columns - ellipsis.length;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return [...cells.slice(0, head), ...ellipsis, ...(tail > 0 ? cells.slice(cells.length - tail) : [])];
};

/** The line as exactly `columns` flaps, centred, padded with blanks. */
export const centreLine = (cells: string[], columns: number): string => {
  const fitted = fitLine(cells, columns);
  const left = Math.floor((columns - fitted.length) / 2);
  return " ".repeat(left) + fitted.join("") + " ".repeat(columns - fitted.length - left);
};
