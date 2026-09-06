import { describe, expect, test } from "bun:test";
import { NAMED_RULES, RuleParseError, formatRule, parseRule } from "../src/rule.js";

describe("parseRule", () => {
  test("reads B/S notation", () => {
    expect(formatRule(parseRule("B3/S23"))).toBe("B3/S23");
    expect(formatRule(parseRule("b36s23"))).toBe("B36/S23");
  });

  test("reads S/B notation", () => {
    expect(formatRule(parseRule("S23/B3"))).toBe("B3/S23");
  });

  test("reads Golly's slash form as survival first", () => {
    expect(formatRule(parseRule("23/3"))).toBe("B3/S23");
    expect(formatRule(parseRule("125/36"))).toBe("B36/S125");
  });

  test("accepts an empty half", () => {
    expect(formatRule(parseRule("B2/S"))).toBe("B2/S");
  });

  test("rejects nonsense rather than guessing", () => {
    expect(() => parseRule("")).toThrow(RuleParseError);
    expect(() => parseRule("B9/S23")).toThrow(RuleParseError);
    expect(() => parseRule("B33/S23")).toThrow(RuleParseError);
    expect(() => parseRule("alive")).toThrow(RuleParseError);
  });

  test("every named rule parses and round-trips", () => {
    for (const named of NAMED_RULES) {
      expect(formatRule(parseRule(named.rule))).toBe(formatRule(parseRule(formatRule(parseRule(named.rule)))));
    }
  });
});
