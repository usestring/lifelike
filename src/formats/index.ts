import { PatternParseError, type Pattern } from "../pattern.js";
import { parseLife106, serializeLife106 } from "./life106.js";
import { parsePlaintext, serializePlaintext } from "./plaintext.js";
import { parseRLE, serializeRLE } from "./rle.js";

export { parseRLE, serializeRLE } from "./rle.js";
export { parsePlaintext, serializePlaintext } from "./plaintext.js";
export { parseLife106, serializeLife106 } from "./life106.js";

export type PatternFormat = "rle" | "plaintext" | "life106";

export function detectFormat(text: string): PatternFormat {
  const trimmed = text.trimStart();
  if (/^#Life\s+1\.06/i.test(trimmed)) return "life106";
  if (trimmed.startsWith("!")) return "plaintext";
  if (/^\s*x\s*=\s*-?\d+\s*,/im.test(text) || /[bo$][\s\S]*!/.test(text)) return "rle";
  if (/^[.O\s]+$/m.test(trimmed)) return "plaintext";
  throw new PatternParseError("pattern", "format is not RLE, plaintext or Life 1.06");
}

/** Parses a pattern in whichever of the supported formats the text turns out to be. */
export function parsePattern(text: string, format: PatternFormat = detectFormat(text)): Pattern {
  switch (format) {
    case "rle":
      return parseRLE(text);
    case "plaintext":
      return parsePlaintext(text);
    case "life106":
      return parseLife106(text);
  }
}

export function serializePattern(pattern: Pattern, format: PatternFormat = "rle"): string {
  switch (format) {
    case "rle":
      return serializeRLE(pattern);
    case "plaintext":
      return serializePlaintext(pattern);
    case "life106":
      return serializeLife106(pattern);
  }
}
