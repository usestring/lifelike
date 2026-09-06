import { describe, expect, test } from "bun:test";
import { detectFormat, parseLife106, parsePattern, parsePlaintext, parseRLE, serializeLife106, serializePlaintext, serializeRLE } from "../src/formats/index.js";
import { LIBRARY, getPattern } from "../src/patterns.js";
import { PatternParseError, patternToRows, patternPopulation, patternFromRows } from "../src/pattern.js";

const GLIDER_RLE = `#N Glider
#C The smallest spaceship.
x = 3, y = 3, rule = B3/S23
bob$2bo$3o!
`;

describe("RLE", () => {
  test("reads header, metadata and body", () => {
    const pattern = parseRLE(GLIDER_RLE);
    expect(pattern.name).toBe("Glider");
    expect(pattern.rule).toBe("B3/S23");
    expect(pattern.comments).toEqual(["The smallest spaceship."]);
    expect(patternToRows(pattern)).toEqual([".O.", "..O", "OOO"]);
  });

  test("expands run counts", () => {
    const pattern = parseRLE("x = 5, y = 2\n5o$2b3o!");
    expect(patternToRows(pattern)).toEqual(["OOOOO", "..OOO"]);
  });

  test("collapses blank rows with a run count on $", () => {
    const pattern = parseRLE("x = 3, y = 4\no2b3$2bo!");
    expect(patternToRows(pattern)).toEqual(["O..", "...", "...", "..O"]);
  });

  test("prefers the body over an under-reporting header", () => {
    const pattern = parseRLE("x = 2, y = 1\n5o!");
    expect(pattern.width).toBe(5);
  });

  test("rejects junk in the body", () => {
    expect(() => parseRLE("x = 3, y = 1\nbo?o!")).toThrow(PatternParseError);
  });

  test("round-trips every library pattern", () => {
    for (const entry of LIBRARY) {
      const original = getPattern(entry.id);
      const reparsed = parseRLE(serializeRLE(original));
      expect(`${entry.id}: ${patternToRows(reparsed).join("/")}`).toBe(`${entry.id}: ${patternToRows(original).join("/")}`);
    }
  });

  test("wraps long bodies without splitting a run", () => {
    const wide = patternFromRows([".".repeat(400) + "O"]);
    const text = serializeRLE(wide);
    for (const line of text.split("\n")) expect(line.length).toBeLessThanOrEqual(70);
    expect(patternPopulation(parseRLE(text))).toBe(1);
  });

  test("writes the rule it was given", () => {
    expect(serializeRLE(getPattern("block"), { rule: "B36/S23" })).toContain("rule = B36/S23");
  });
});

describe("plaintext", () => {
  const CELLS = `!Name: Toad
!A period 2 oscillator.
.OOO
OOO.
`;

  test("reads name, comments and rows", () => {
    const pattern = parsePlaintext(CELLS);
    expect(pattern.name).toBe("Toad");
    expect(pattern.comments).toEqual(["A period 2 oscillator."]);
    expect(patternToRows(pattern)).toEqual([".OOO", "OOO."]);
  });

  test("round-trips", () => {
    const original = getPattern("pulsar");
    expect(patternToRows(parsePlaintext(serializePlaintext(original)))).toEqual(patternToRows(original));
  });
});

describe("Life 1.06", () => {
  test("normalises signed coordinates to the pattern's own corner", () => {
    const pattern = parseLife106("#Life 1.06\n-1 -1\n0 0\n1 1\n");
    expect(patternToRows(pattern)).toEqual(["O..", ".O.", "..O"]);
  });

  test("rejects a malformed coordinate line", () => {
    expect(() => parseLife106("#Life 1.06\n3 4 5\n")).toThrow(PatternParseError);
  });

  test("round-trips", () => {
    const original = getPattern("acorn");
    expect(patternToRows(parseLife106(serializeLife106(original)))).toEqual(patternToRows(original));
  });
});

describe("detectFormat", () => {
  test("recognises each supported format", () => {
    expect(detectFormat(GLIDER_RLE)).toBe("rle");
    expect(detectFormat("!Name: Block\nOO\nOO\n")).toBe("plaintext");
    expect(detectFormat("#Life 1.06\n0 0\n")).toBe("life106");
  });

  test("parsePattern dispatches without being told", () => {
    expect(patternPopulation(parsePattern(GLIDER_RLE))).toBe(5);
    expect(patternPopulation(parsePattern("#Life 1.06\n0 0\n1 0\n"))).toBe(2);
  });

  test("refuses to guess at something that is not a pattern", () => {
    expect(() => detectFormat("<html><body>404</body></html>")).toThrow(PatternParseError);
  });
});
