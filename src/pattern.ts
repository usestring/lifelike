/**
 * A rectangle of cells with no position of its own — what every pattern format
 * parses into and what `Universe.stamp` draws.
 */
export interface Pattern {
  name?: string;
  author?: string;
  /** Rule the pattern was authored for, in whatever notation its file used. */
  rule?: string;
  comments: string[];
  width: number;
  height: number;
  /** One byte per cell, `1` live, in row-major order. */
  cells: Uint8Array;
}

export interface PatternInit {
  name?: string;
  author?: string;
  rule?: string;
  comments?: string[];
}

export class PatternParseError extends Error {
  constructor(format: string, detail: string) {
    super(`Invalid ${format}: ${detail}`);
    this.name = "PatternParseError";
  }
}

/**
 * Builds a pattern from rows of string art. Any character in `live` is a live
 * cell; rows may be ragged and are padded to the widest.
 */
export function patternFromRows(rows: ReadonlyArray<string>, init: PatternInit = {}, live = "O#*o"): Pattern {
  const height = rows.length;
  const width = rows.reduce((widest, row) => Math.max(widest, row.length), 0);
  const cells = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      if (live.includes(row[x])) cells[y * width + x] = 1;
    }
  }
  return { ...init, comments: init.comments ?? [], width, height, cells };
}

export function patternToRows(pattern: Pattern, liveChar = "O", deadChar = "."): string[] {
  const rows: string[] = [];
  for (let y = 0; y < pattern.height; y++) {
    let row = "";
    for (let x = 0; x < pattern.width; x++) row += pattern.cells[y * pattern.width + x] === 1 ? liveChar : deadChar;
    rows.push(row);
  }
  return rows;
}

export function patternPopulation(pattern: Pattern): number {
  let population = 0;
  for (const cell of pattern.cells) population += cell;
  return population;
}

/** Crops away fully dead border rows and columns. */
export function trimPattern(pattern: Pattern): Pattern {
  let minX = pattern.width;
  let minY = pattern.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < pattern.height; y++) {
    for (let x = 0; x < pattern.width; x++) {
      if (pattern.cells[y * pattern.width + x] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { ...pattern, width: 0, height: 0, cells: new Uint8Array(0) };

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const cells = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells[y * width + x] = pattern.cells[(y + minY) * pattern.width + (x + minX)];
    }
  }
  return { ...pattern, width, height, cells };
}

/** Rotates clockwise by `quarterTurns` right angles. Negative turns rotate the other way. */
export function rotatePattern(pattern: Pattern, quarterTurns: number): Pattern {
  const turns = ((quarterTurns % 4) + 4) % 4;
  let current = pattern;
  for (let turn = 0; turn < turns; turn++) {
    const width = current.height;
    const height = current.width;
    const cells = new Uint8Array(width * height);
    for (let y = 0; y < current.height; y++) {
      for (let x = 0; x < current.width; x++) {
        cells[x * width + (current.height - 1 - y)] = current.cells[y * current.width + x];
      }
    }
    current = { ...current, width, height, cells };
  }
  return current;
}

export function flipPattern(pattern: Pattern, axis: "horizontal" | "vertical"): Pattern {
  const cells = new Uint8Array(pattern.width * pattern.height);
  for (let y = 0; y < pattern.height; y++) {
    for (let x = 0; x < pattern.width; x++) {
      const sx = axis === "horizontal" ? pattern.width - 1 - x : x;
      const sy = axis === "vertical" ? pattern.height - 1 - y : y;
      cells[y * pattern.width + x] = pattern.cells[sy * pattern.width + sx];
    }
  }
  return { ...pattern, cells };
}
