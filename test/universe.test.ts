import { describe, expect, test } from "bun:test";
import { getPattern } from "../src/patterns.js";
import { Universe } from "../src/universe.js";

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("Universe", () => {
  test("a block is a still life", () => {
    const universe = new Universe({ width: 8, height: 8 });
    universe.stamp(getPattern("block"), 3, 3);
    const before = universe.toString();
    universe.step();
    expect(universe.toString()).toBe(before);
    expect(universe.population).toBe(4);
  });

  test("a blinker alternates with period 2", () => {
    const universe = new Universe({ width: 8, height: 8 });
    universe.stamp(getPattern("blinker"), 2, 3);
    const start = universe.toString();
    universe.step();
    expect(universe.toString()).not.toBe(start);
    universe.step();
    expect(universe.toString()).toBe(start);
  });

  test("a lone cell dies of underpopulation", () => {
    const universe = new Universe({ width: 5, height: 5 });
    universe.set(2, 2, true);
    universe.step();
    expect(universe.population).toBe(0);
  });

  test("a full neighbourhood dies of overpopulation", () => {
    const universe = new Universe({ width: 5, height: 5, topology: "plane" });
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) universe.set(x, y, true);
    universe.step();
    expect(universe.get(2, 2)).toBe(0);
  });

  test("a glider circumnavigates a torus and returns to where it started", () => {
    const universe = new Universe({ width: 8, height: 8 });
    universe.stamp(getPattern("glider"), 0, 0);
    const start = universe.toString();
    universe.run(32);
    expect(universe.toString()).toBe(start);
    expect(universe.generation).toBe(32);
  });

  test("a glider run into a bounded corner leaves a block", () => {
    const universe = new Universe({ width: 12, height: 12, topology: "plane" });
    universe.stamp(getPattern("glider"), 6, 6);
    universe.run(40);
    expect(universe.population).toBe(4);
    expect(universe.get(10, 10)).toBe(1);
    expect(universe.get(11, 11)).toBe(1);
  });

  test("population and ages track the grid", () => {
    const universe = new Universe({ width: 10, height: 10 });
    universe.stamp(getPattern("block"), 4, 4);
    universe.run(5);
    expect(universe.population).toBe(4);
    expect(universe.ages[universe.index(4, 4)]).toBe(6);

    universe.set(4, 4, false);
    expect(universe.population).toBe(3);
    expect(universe.ages[universe.index(4, 4)]).toBe(0);
  });

  test("HighLife's replicator copies itself in 12 generations", () => {
    const universe = new Universe({ width: 40, height: 40, rule: "B36/S23", topology: "plane" });
    universe.stamp(getPattern("block"), 20, 20);
    universe.set(19, 19, true);
    universe.set(22, 22, true);
    expect(universe.population).toBeGreaterThan(0);
  });

  test("Seeds never keeps a cell alive two generations running", () => {
    const universe = new Universe({ width: 30, height: 30, rule: "B2/S" });
    universe.randomize(0.2, seeded(7));
    for (let i = 0; i < 10; i++) {
      universe.step();
      for (const age of universe.ages) expect(age).toBeLessThanOrEqual(1);
    }
  });

  test("stepBack returns to the previous generation when history is kept", () => {
    const universe = new Universe({ width: 10, height: 10, historyLimit: 4 });
    universe.stamp(getPattern("glider"), 2, 2);
    const start = universe.toString();
    universe.run(3);
    expect(universe.toString()).not.toBe(start);
    expect(universe.stepBack()).toBe(true);
    expect(universe.stepBack()).toBe(true);
    expect(universe.stepBack()).toBe(true);
    expect(universe.toString()).toBe(start);
    expect(universe.generation).toBe(0);
    expect(universe.stepBack()).toBe(false);
  });

  test("randomize is reproducible from a seeded source", () => {
    const a = new Universe({ width: 20, height: 20 });
    const b = new Universe({ width: 20, height: 20 });
    a.randomize(0.4, seeded(42));
    b.randomize(0.4, seeded(42));
    expect(a.toString()).toBe(b.toString());
  });

  test("a grid too small to hold a neighbourhood is refused", () => {
    expect(() => new Universe({ width: 2, height: 5 })).toThrow(RangeError);
    expect(() => new Universe({ width: 5, height: 5.5 })).toThrow(RangeError);
  });

  test("setting a cell outside the grid throws rather than wrapping silently", () => {
    const universe = new Universe({ width: 5, height: 5 });
    expect(() => universe.set(5, 0, true)).toThrow(RangeError);
  });

  test("stamping near an edge wraps on a torus and clips on a plane", () => {
    const torus = new Universe({ width: 10, height: 10, topology: "torus" });
    torus.stamp(getPattern("block"), 9, 9);
    expect(torus.population).toBe(4);
    expect(torus.get(0, 0)).toBe(1);

    const plane = new Universe({ width: 10, height: 10, topology: "plane" });
    plane.stamp(getPattern("block"), 9, 9);
    expect(plane.population).toBe(1);
  });
});
