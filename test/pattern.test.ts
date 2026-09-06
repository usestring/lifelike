import { describe, expect, test } from "bun:test";
import { flipPattern, patternFromRows, patternToRows, rotatePattern, trimPattern } from "../src/pattern.js";
import { getPattern } from "../src/patterns.js";

describe("pattern transforms", () => {
  const glider = getPattern("glider");

  test("four quarter turns are the identity", () => {
    expect(patternToRows(rotatePattern(glider, 4))).toEqual(patternToRows(glider));
  });

  test("a quarter turn moves the top-left to the top-right", () => {
    const pattern = patternFromRows(["O.", "..", ".."]);
    expect(patternToRows(rotatePattern(pattern, 1))).toEqual(["..O", "..."]);
  });

  test("negative turns rotate the other way", () => {
    expect(patternToRows(rotatePattern(glider, -1))).toEqual(patternToRows(rotatePattern(glider, 3)));
  });

  test("flipping twice is the identity", () => {
    expect(patternToRows(flipPattern(flipPattern(glider, "horizontal"), "horizontal"))).toEqual(patternToRows(glider));
    expect(patternToRows(flipPattern(flipPattern(glider, "vertical"), "vertical"))).toEqual(patternToRows(glider));
  });

  test("ragged rows are padded to the widest", () => {
    const pattern = patternFromRows(["O", "OOO"]);
    expect(pattern.width).toBe(3);
    expect(patternToRows(pattern)).toEqual(["O..", "OOO"]);
  });

  test("trim removes dead borders", () => {
    const padded = patternFromRows(["....", ".OO.", ".OO.", "...."]);
    const trimmed = trimPattern(padded);
    expect(trimmed.width).toBe(2);
    expect(trimmed.height).toBe(2);
    expect(patternToRows(trimmed)).toEqual(["OO", "OO"]);
  });

  test("trimming an empty pattern yields nothing rather than throwing", () => {
    expect(trimPattern(patternFromRows(["..", ".."])).width).toBe(0);
  });
});
