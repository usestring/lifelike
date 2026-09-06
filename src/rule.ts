/**
 * A Life-like rule: for each possible count of live neighbours (0-8), whether a
 * dead cell is born and whether a live cell survives.
 */
export interface Rule {
  /** `birth[n]` is true when a dead cell with `n` live neighbours becomes live. */
  readonly birth: ReadonlyArray<boolean>;
  /** `survival[n]` is true when a live cell with `n` live neighbours stays live. */
  readonly survival: ReadonlyArray<boolean>;
}

export class RuleParseError extends Error {
  constructor(input: string, detail: string) {
    super(`Cannot parse rule "${input}": ${detail}`);
    this.name = "RuleParseError";
  }
}

function countsFromDigits(input: string, digits: string, label: string): boolean[] {
  const counts = new Array<boolean>(9).fill(false);
  for (const digit of digits) {
    const n = Number(digit);
    if (!Number.isInteger(n) || n < 0 || n > 8) {
      throw new RuleParseError(input, `${label} count "${digit}" is not a digit 0-8`);
    }
    if (counts[n]) throw new RuleParseError(input, `${label} count ${n} is repeated`);
    counts[n] = true;
  }
  return counts;
}

/**
 * Parses a Life-like rule string. Accepts B/S notation (`B3/S23`, `b3s23`), the
 * S/B ordering (`S23/B3`), and Golly's slash form (`23/3`), which is survival
 * first — the ordering that trips people up, so it is the one worth naming.
 */
export function parseRule(input: string): Rule {
  const compact = input.trim().replace(/\s+/g, "");
  if (compact === "") throw new RuleParseError(input, "empty");

  const bs = /^b(\d*)\/?s(\d*)$/i.exec(compact);
  if (bs) {
    return {
      birth: countsFromDigits(input, bs[1] ?? "", "birth"),
      survival: countsFromDigits(input, bs[2] ?? "", "survival")
    };
  }

  const sb = /^s(\d*)\/?b(\d*)$/i.exec(compact);
  if (sb) {
    return {
      survival: countsFromDigits(input, sb[1] ?? "", "survival"),
      birth: countsFromDigits(input, sb[2] ?? "", "birth")
    };
  }

  const slash = /^(\d*)\/(\d*)$/.exec(compact);
  if (slash) {
    return {
      survival: countsFromDigits(input, slash[1] ?? "", "survival"),
      birth: countsFromDigits(input, slash[2] ?? "", "birth")
    };
  }

  throw new RuleParseError(input, "expected B/S notation such as B3/S23");
}

/** Renders a rule in canonical B/S notation, the form RLE headers carry. */
export function formatRule(rule: Rule): string {
  const digits = (counts: ReadonlyArray<boolean>) =>
    counts.map((on, n) => (on ? String(n) : "")).join("");
  return `B${digits(rule.birth)}/S${digits(rule.survival)}`;
}

export function rulesEqual(a: Rule, b: Rule): boolean {
  return formatRule(a) === formatRule(b);
}

/**
 * Rules that have names in the literature, so a caller can offer a menu without
 * knowing the notation.
 */
export const NAMED_RULES: ReadonlyArray<{ name: string; rule: string; note: string }> = [
  { name: "Conway's Life", rule: "B3/S23", note: "The original. Chaotic growth from almost nothing." },
  { name: "HighLife", rule: "B36/S23", note: "Life plus a replicator that copies itself every 12 generations." },
  { name: "Day & Night", rule: "B3678/S34678", note: "Symmetric: live and dead cells obey the same law." },
  { name: "Seeds", rule: "B2/S", note: "Nothing survives. Everything is birth, so it explodes." },
  { name: "Replicator", rule: "B1357/S1357", note: "Every pattern copies itself, forever." },
  { name: "Life without Death", rule: "B3/S012345678", note: "Cells never die. Growth is monotone." },
  { name: "Diamoeba", rule: "B35678/S5678", note: "Large blobs with ragged, crawling edges." },
  { name: "Maze", rule: "B3/S12345", note: "Grows into corridors that look drawn by hand." },
  { name: "Coral", rule: "B3/S45678", note: "Slow accretion with a fractal boundary." },
  { name: "2x2", rule: "B36/S125", note: "Blocks behave like a coarser cellular automaton." },
  { name: "Anneal", rule: "B4678/S35678", note: "Majority vote. Noise settles into smooth domains." }
];

export const LIFE: Rule = parseRule("B3/S23");
