import { describe, expect, test } from "bun:test";
import { LIBRARY, getPattern } from "../src/patterns.js";
import { patternPopulation, trimPattern } from "../src/pattern.js";
import { Universe } from "../src/universe.js";

/** Renders the live cells of a universe as a set of coordinates offset to the bounding box. */
function normalized(universe: Universe): string {
  const bounds = universe.bounds();
  if (bounds === null) return "";
  const rows: string[] = [];
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    let row = "";
    for (let x = bounds.minX; x <= bounds.maxX; x++) row += universe.get(x, y) === 1 ? "O" : ".";
    rows.push(row);
  }
  return rows.join("/");
}

describe("pattern library", () => {
  test("every entry parses to a non-empty pattern", () => {
    for (const entry of LIBRARY) {
      const pattern = getPattern(entry.id);
      expect(patternPopulation(pattern)).toBeGreaterThan(0);
      expect(pattern.width).toBeGreaterThan(0);
      expect(pattern.height).toBeGreaterThan(0);
    }
  });

  test("still lifes and oscillators return to their start after one period", () => {
    for (const entry of LIBRARY) {
      if (entry.category !== "still-life" && entry.category !== "oscillator") continue;
      const period = entry.period;
      expect(period).toBeDefined();

      const universe = new Universe({ width: 60, height: 60, topology: "plane" });
      universe.stamp(getPattern(entry.id), 20, 20);
      const start = normalized(universe);
      universe.run(period as number);
      expect(`${entry.id}: ${normalized(universe)}`).toBe(`${entry.id}: ${start}`);
    }
  });

  test("oscillators do not repeat before their stated period", () => {
    for (const entry of LIBRARY) {
      if (entry.category !== "oscillator") continue;
      const universe = new Universe({ width: 60, height: 60, topology: "plane" });
      universe.stamp(getPattern(entry.id), 20, 20);
      const start = normalized(universe);
      for (let generation = 1; generation < (entry.period as number); generation++) {
        universe.step();
        expect(`${entry.id} at ${generation}: ${normalized(universe)}`).not.toBe(`${entry.id} at ${generation}: ${start}`);
      }
    }
  });

  test("spaceships translate by their stated displacement each period", () => {
    for (const entry of LIBRARY) {
      if (entry.category !== "spaceship") continue;
      const displacement = entry.displacement;
      expect(displacement).toBeDefined();

      const universe = new Universe({ width: 80, height: 80, topology: "plane" });
      universe.stamp(getPattern(entry.id), 35, 35);
      const shape = normalized(universe);
      const before = universe.bounds();
      universe.run(entry.period as number);
      const after = universe.bounds();

      expect(`${entry.id} shape: ${normalized(universe)}`).toBe(`${entry.id} shape: ${shape}`);
      expect({
        id: entry.id,
        x: (after as { minX: number }).minX - (before as { minX: number }).minX,
        y: (after as { minY: number }).minY - (before as { minY: number }).minY
      }).toEqual({ id: entry.id, x: (displacement as { x: number }).x, y: (displacement as { y: number }).y });
    }
  });

  test("the Gosper glider gun emits one glider every 30 generations", () => {
    const universe = new Universe({ width: 200, height: 200, topology: "plane" });
    const gun = getPattern("gosper-glider-gun");
    expect(patternPopulation(gun)).toBe(36);

    universe.stamp(gun, 5, 5);
    expect(universe.population).toBe(36);
    universe.run(30);
    expect(universe.population).toBe(36 + 5);
    universe.run(30);
    expect(universe.population).toBe(36 + 10);
  });

  test("Diehard dies at generation 130", () => {
    const universe = new Universe({ width: 100, height: 100, topology: "plane" });
    universe.stamp(getPattern("diehard"), 40, 40);
    universe.run(129);
    expect(universe.population).toBeGreaterThan(0);
    universe.step();
    expect(universe.population).toBe(0);
  });

  // The published figure is for an unbounded plane, so the board has to be wide
  // enough that no escaping glider has reached a wall by generation 1103.
  test("the R-pentomino settles at generation 1103 with 116 cells", () => {
    const universe = new Universe({ width: 620, height: 620, topology: "plane" });
    universe.stamp(getPattern("r-pentomino"), 310, 310);
    universe.run(1103);
    expect(universe.population).toBe(116);
  });

  test("trimPattern leaves the library's patterns unchanged", () => {
    for (const entry of LIBRARY) {
      const pattern = getPattern(entry.id);
      const trimmed = trimPattern(pattern);
      expect(`${entry.id}: ${trimmed.width}x${trimmed.height}`).toBe(`${entry.id}: ${pattern.width}x${pattern.height}`);
    }
  });
});
