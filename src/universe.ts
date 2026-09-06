import { LIFE, parseRule, type Rule } from "./rule.js";
import type { Pattern } from "./pattern.js";

/**
 * How the grid's edges behave. A torus wraps, so a glider launched in any
 * direction returns; a plane treats everything outside the grid as permanently
 * dead, which is the closer approximation to an unbounded universe.
 */
export type Topology = "torus" | "plane";

export interface UniverseOptions {
  width: number;
  height: number;
  rule?: Rule | string;
  topology?: Topology;
  /**
   * How many past generations `stepBack` can return to. Each one costs
   * `width * height` bytes, so it is off unless a caller asks for it.
   */
  historyLimit?: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface StampOptions {
  /** Treat `x`,`y` as the pattern's centre rather than its top-left corner. */
  center?: boolean;
  /** Clear every cell the pattern covers, rather than only adding live ones. */
  replace?: boolean;
}

/** Ages saturate rather than wrap, so a renderer's colour ramp stays monotone. */
const MAX_AGE = 255;

function toRule(rule: Rule | string | undefined): Rule {
  if (rule === undefined) return LIFE;
  return typeof rule === "string" ? parseRule(rule) : rule;
}

/**
 * A fixed-size grid of cells that steps under a Life-like rule.
 *
 * The grid is dense: one byte per cell for state, one for age. That is the wrong
 * shape for the astronomically large patterns HashLife exists to run, and the
 * right one for a board somebody is drawing on and watching.
 */
export class Universe {
  readonly width: number;
  readonly height: number;
  rule: Rule;
  topology: Topology;

  /** One byte per cell, `1` live and `0` dead, in row-major order. */
  readonly cells: Uint8Array;
  /** Generations each live cell has been alive, saturating at 255. `0` when dead. */
  readonly ages: Uint8Array;

  generation = 0;
  population = 0;

  private readonly scratch: Uint8Array;
  private readonly scratchAges: Uint8Array;
  private readonly columnSums: Int32Array;
  private readonly history: Uint8Array[] = [];
  private readonly historyLimit: number;

  constructor(options: UniverseOptions) {
    const { width, height } = options;
    // Below 3, a torus wraps onto itself and a cell counts a neighbour twice.
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3) {
      throw new RangeError(`Universe must be at least 3x3 with integer sides, got ${width}x${height}`);
    }
    this.width = width;
    this.height = height;
    this.rule = toRule(options.rule);
    this.topology = options.topology ?? "torus";
    this.historyLimit = Math.max(0, options.historyLimit ?? 0);

    const size = width * height;
    this.cells = new Uint8Array(size);
    this.ages = new Uint8Array(size);
    this.scratch = new Uint8Array(size);
    this.scratchAges = new Uint8Array(size);
    this.columnSums = new Int32Array(width);
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  contains(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): number {
    return this.contains(x, y) ? this.cells[this.index(x, y)] : 0;
  }

  set(x: number, y: number, alive: boolean): void {
    if (!this.contains(x, y)) throw new RangeError(`Cell ${x},${y} is outside a ${this.width}x${this.height} universe`);
    const i = this.index(x, y);
    const was = this.cells[i];
    const now = alive ? 1 : 0;
    if (was === now) return;
    this.cells[i] = now;
    this.ages[i] = now;
    this.population += now === 1 ? 1 : -1;
  }

  toggle(x: number, y: number): void {
    this.set(x, y, this.get(x, y) === 0);
  }

  clear(): void {
    this.cells.fill(0);
    this.ages.fill(0);
    this.population = 0;
    this.generation = 0;
    this.history.length = 0;
  }

  /**
   * Fills the grid with noise. `random` is injectable so a caller can seed a
   * reproducible board — the tests and any pattern-of-the-day both need that.
   */
  randomize(density = 0.3, random: () => number = Math.random): void {
    let population = 0;
    for (let i = 0; i < this.cells.length; i++) {
      const alive = random() < density ? 1 : 0;
      this.cells[i] = alive;
      this.ages[i] = alive;
      population += alive;
    }
    this.population = population;
    this.generation = 0;
    this.history.length = 0;
  }

  /**
   * Advances one generation.
   *
   * Neighbour counts come from a rolling column sum: each column's three-row
   * total is computed once per row, then three adjacent totals are added and the
   * cell itself subtracted. That is 4 operations per cell instead of the 8 loads
   * the naive form does, and it is what keeps a 300x300 board inside a frame.
   */
  step(): void {
    if (this.historyLimit > 0) {
      this.history.push(this.cells.slice());
      if (this.history.length > this.historyLimit) this.history.shift();
    }

    const { width, height, cells, ages, scratch, scratchAges, columnSums, rule, topology } = this;
    const wraps = topology === "torus";
    const { birth, survival } = rule;
    let population = 0;

    for (let y = 0; y < height; y++) {
      const up = wraps ? (y - 1 + height) % height : y - 1;
      const down = wraps ? (y + 1) % height : y + 1;
      const rowUp = up >= 0 && up < height ? up * width : -1;
      const rowDown = down >= 0 && down < height ? down * width : -1;
      const row = y * width;

      for (let x = 0; x < width; x++) {
        let sum = cells[row + x];
        if (rowUp >= 0) sum += cells[rowUp + x];
        if (rowDown >= 0) sum += cells[rowDown + x];
        columnSums[x] = sum;
      }

      for (let x = 0; x < width; x++) {
        const leftIndex = wraps ? (x - 1 + width) % width : x - 1;
        const rightIndex = wraps ? (x + 1) % width : x + 1;
        const left = leftIndex >= 0 && leftIndex < width ? columnSums[leftIndex] : 0;
        const right = rightIndex >= 0 && rightIndex < width ? columnSums[rightIndex] : 0;

        const i = row + x;
        const alive = cells[i];
        const neighbours = left + columnSums[x] + right - alive;
        const next = alive === 1 ? (survival[neighbours] ? 1 : 0) : birth[neighbours] ? 1 : 0;

        scratch[i] = next;
        if (next === 1) {
          const age = alive === 1 ? ages[i] : 0;
          scratchAges[i] = age < MAX_AGE ? age + 1 : MAX_AGE;
          population++;
        } else {
          scratchAges[i] = 0;
        }
      }
    }

    cells.set(scratch);
    ages.set(scratchAges);
    this.population = population;
    this.generation++;
  }

  /** Advances `count` generations. */
  run(count: number): void {
    for (let i = 0; i < count; i++) this.step();
  }

  /**
   * Returns to the previous generation, or `false` when no history is retained.
   * Ages are not restored: they describe how long a cell has been alive going
   * forward, and reconstructing them would need the history we deliberately drop.
   */
  stepBack(): boolean {
    const previous = this.history.pop();
    if (previous === undefined) return false;
    this.cells.set(previous);
    let population = 0;
    for (let i = 0; i < this.cells.length; i++) {
      const alive = this.cells[i];
      this.ages[i] = alive;
      population += alive;
    }
    this.population = population;
    this.generation--;
    return true;
  }

  /** The smallest box containing every live cell, or `null` when empty. */
  bounds(): Bounds | null {
    const { width, height, cells } = this;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        if (cells[row + x] === 0) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return maxX < 0 ? null : { minX, minY, maxX, maxY };
  }

  /**
   * Draws a pattern onto the grid. Cells that fall outside wrap on a torus and
   * are dropped on a plane, so stamping near an edge does what a user dragging a
   * pattern there expects rather than throwing.
   */
  stamp(pattern: Pattern, x: number, y: number, options: StampOptions = {}): void {
    const originX = options.center ? x - (pattern.width >> 1) : x;
    const originY = options.center ? y - (pattern.height >> 1) : y;
    const wraps = this.topology === "torus";

    for (let py = 0; py < pattern.height; py++) {
      for (let px = 0; px < pattern.width; px++) {
        const alive = pattern.cells[py * pattern.width + px] === 1;
        if (!alive && !options.replace) continue;

        let tx = originX + px;
        let ty = originY + py;
        if (wraps) {
          tx = ((tx % this.width) + this.width) % this.width;
          ty = ((ty % this.height) + this.height) % this.height;
        } else if (!this.contains(tx, ty)) {
          continue;
        }
        this.set(tx, ty, alive);
      }
    }
  }

  /** Renders the grid as `.`/`O` rows, which is what test failures read best as. */
  toString(): string {
    const rows: string[] = [];
    for (let y = 0; y < this.height; y++) {
      let row = "";
      for (let x = 0; x < this.width; x++) row += this.cells[this.index(x, y)] === 1 ? "O" : ".";
      rows.push(row);
    }
    return rows.join("\n");
  }
}
