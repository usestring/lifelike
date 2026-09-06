import { PatternParseError, type Pattern } from "../pattern.js";
import { formatRule, type Rule } from "../rule.js";

const HEADER = /^\s*x\s*=\s*(-?\d+)\s*,\s*y\s*=\s*(-?\d+)\s*(?:,\s*rule\s*=\s*([^,\s]+))?/i;

/**
 * Parses RLE, the format LifeWiki and Golly exchange patterns in.
 *
 * The `x`/`y` header is treated as advisory: files in the wild under-report it,
 * and a pattern that silently loses its right-hand columns is worse than one
 * that comes back a few cells wider than its header claimed.
 */
export function parseRLE(text: string): Pattern {
  const comments: string[] = [];
  let name: string | undefined;
  let author: string | undefined;
  let rule: string | undefined;
  let headerWidth = 0;
  let headerHeight = 0;
  let body = "";

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;

    if (line.startsWith("#")) {
      const tag = line[1];
      const value = line.slice(2).trim();
      if (tag === "N") name = value;
      else if (tag === "O") author = value;
      else if (tag === "r") rule = value;
      else if (tag === "C" || tag === "c") comments.push(value);
      continue;
    }

    const header = HEADER.exec(line);
    if (header && body === "") {
      headerWidth = Number(header[1]);
      headerHeight = Number(header[2]);
      if (header[3] !== undefined) rule = header[3];
      continue;
    }

    body += line;
  }

  if (body === "") throw new PatternParseError("RLE", "no cell data found");

  const live: Array<[number, number]> = [];
  let x = 0;
  let y = 0;
  let count = 0;
  let width = headerWidth;
  let height = 0;
  let terminated = false;

  for (const ch of body) {
    if (ch >= "0" && ch <= "9") {
      count = count * 10 + (ch.charCodeAt(0) - 48);
      continue;
    }

    const run = count === 0 ? 1 : count;
    count = 0;

    if (ch === "b" || ch === ".") {
      x += run;
    } else if (ch === "$") {
      y += run;
      x = 0;
    } else if (ch === "!") {
      terminated = true;
      break;
    } else if (/[A-Za-z]/.test(ch)) {
      for (let i = 0; i < run; i++) live.push([x + i, y]);
      x += run;
      height = Math.max(height, y + 1);
    } else if (/\s/.test(ch)) {
      continue;
    } else {
      throw new PatternParseError("RLE", `unexpected character "${ch}"`);
    }

    width = Math.max(width, x);
  }

  if (!terminated && live.length === 0) throw new PatternParseError("RLE", "no live cells and no terminating !");

  height = Math.max(height, headerHeight);
  const cells = new Uint8Array(width * height);
  for (const [cx, cy] of live) cells[cy * width + cx] = 1;

  return { name, author, rule, comments, width, height, cells };
}

interface SerializeOptions {
  name?: string;
  rule?: Rule | string;
  comments?: ReadonlyArray<string>;
  /** Column to wrap the body at. Golly writes 70. */
  wrap?: number;
}

function encodeRow(pattern: Pattern, y: number): string {
  let out = "";
  let x = 0;
  while (x < pattern.width) {
    const value = pattern.cells[y * pattern.width + x];
    let run = 1;
    while (x + run < pattern.width && pattern.cells[y * pattern.width + x + run] === value) run++;
    // A row's trailing dead cells are implied by the row break.
    if (!(value === 0 && x + run >= pattern.width)) {
      out += (run > 1 ? String(run) : "") + (value === 1 ? "o" : "b");
    }
    x += run;
  }
  return out;
}

export function serializeRLE(pattern: Pattern, options: SerializeOptions = {}): string {
  const rule = options.rule ?? pattern.rule;
  const ruleText = rule === undefined ? "B3/S23" : typeof rule === "string" ? rule : formatRule(rule);

  const lines: string[] = [];
  const name = options.name ?? pattern.name;
  if (name !== undefined) lines.push(`#N ${name}`);
  for (const comment of options.comments ?? pattern.comments) lines.push(`#C ${comment}`);
  lines.push(`x = ${pattern.width}, y = ${pattern.height}, rule = ${ruleText}`);

  let body = "";
  let lastEmitted = -1;
  for (let y = 0; y < pattern.height; y++) {
    const row = encodeRow(pattern, y);
    if (row === "") continue;
    if (lastEmitted >= 0) {
      const breaks = y - lastEmitted;
      body += (breaks > 1 ? String(breaks) : "") + "$";
    }
    body += row;
    lastEmitted = y;
  }
  body += "!";

  const wrap = options.wrap ?? 70;
  let line = "";
  for (const token of body.match(/\d*[a-zA-Z$!]/g) ?? []) {
    if (line.length + token.length > wrap) {
      lines.push(line);
      line = "";
    }
    line += token;
  }
  if (line !== "") lines.push(line);

  return lines.join("\n") + "\n";
}
