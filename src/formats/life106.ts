import { PatternParseError, type Pattern } from "../pattern.js";

/**
 * Parses Life 1.06: a header line then one `x y` pair per live cell. Coordinates
 * are signed and unbounded, so the pattern is normalised to its own top-left.
 */
export function parseLife106(text: string): Pattern {
  const coordinates: Array<[number, number]> = [];
  const comments: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("#")) {
      if (!/^#Life\s+1\.06/i.test(line)) comments.push(line.replace(/^#\w?\s*/, ""));
      continue;
    }
    const pair = /^(-?\d+)\s+(-?\d+)$/.exec(line);
    if (!pair) throw new PatternParseError("Life 1.06", `expected "x y", got "${line}"`);
    coordinates.push([Number(pair[1]), Number(pair[2])]);
  }

  if (coordinates.length === 0) return { comments, width: 0, height: 0, cells: new Uint8Array(0) };

  const xs = coordinates.map(([x]) => x);
  const ys = coordinates.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX + 1;
  const height = Math.max(...ys) - minY + 1;

  const cells = new Uint8Array(width * height);
  for (const [x, y] of coordinates) cells[(y - minY) * width + (x - minX)] = 1;
  return { comments, width, height, cells };
}

export function serializeLife106(pattern: Pattern): string {
  const lines = ["#Life 1.06"];
  for (let y = 0; y < pattern.height; y++) {
    for (let x = 0; x < pattern.width; x++) {
      if (pattern.cells[y * pattern.width + x] === 1) lines.push(`${x} ${y}`);
    }
  }
  return lines.join("\n") + "\n";
}
