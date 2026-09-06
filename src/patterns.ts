import { parseRLE } from "./formats/rle.js";
import type { Pattern } from "./pattern.js";

export type PatternCategory = "still-life" | "oscillator" | "spaceship" | "methuselah" | "gun";

export interface LibraryEntry {
  id: string;
  name: string;
  category: PatternCategory;
  rle: string;
  /** Generations after which an oscillator or spaceship repeats. */
  period?: number;
  /** Cells a spaceship moves each period. */
  displacement?: { x: number; y: number };
  note?: string;
}

/**
 * A small catalogue covering one of everything Life does, rather than a mirror
 * of LifeWiki. Each entry's `period` and `displacement` are asserted in the
 * tests, which is what keeps a mistyped RLE from shipping as a pattern that
 * merely looks plausible.
 */
export const LIBRARY: ReadonlyArray<LibraryEntry> = [
  { id: "block", name: "Block", category: "still-life", period: 1, rle: "2o$2o!" },
  { id: "beehive", name: "Beehive", category: "still-life", period: 1, rle: "b2o$o2bo$b2o!" },
  { id: "loaf", name: "Loaf", category: "still-life", period: 1, rle: "b2o$o2bo$bobo$2bo!" },
  { id: "boat", name: "Boat", category: "still-life", period: 1, rle: "2o$obo$bo!" },
  { id: "tub", name: "Tub", category: "still-life", period: 1, rle: "bo$obo$bo!" },
  { id: "ship", name: "Ship", category: "still-life", period: 1, rle: "2o$obo$b2o!" },

  { id: "blinker", name: "Blinker", category: "oscillator", period: 2, rle: "3o!" },
  { id: "toad", name: "Toad", category: "oscillator", period: 2, rle: "b3o$3o!" },
  { id: "beacon", name: "Beacon", category: "oscillator", period: 2, rle: "2o$2o$2b2o$2b2o!" },
  {
    id: "pulsar",
    name: "Pulsar",
    category: "oscillator",
    period: 3,
    note: "The most common period-3 oscillator, and the most symmetric thing Life produces by accident.",
    rle: "2b3o3b3o2b2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b2$2b3o3b3o2b$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!"
  },
  {
    id: "pentadecathlon",
    name: "Pentadecathlon",
    category: "oscillator",
    period: 15,
    rle: "2bo4bo2b$2ob4ob2o$2bo4bo!"
  },

  {
    id: "glider",
    name: "Glider",
    category: "spaceship",
    period: 4,
    displacement: { x: 1, y: 1 },
    note: "Five cells that walk diagonally forever. Everything else in Life is built out of hitting these together.",
    rle: "bob$2bo$3o!"
  },
  { id: "lwss", name: "Lightweight spaceship", category: "spaceship", period: 4, displacement: { x: -2, y: 0 }, rle: "bo2bo$o4b$o3bo$4o!" },
  { id: "mwss", name: "Middleweight spaceship", category: "spaceship", period: 4, displacement: { x: -2, y: 0 }, rle: "3bo2b$bo3bo$o5b$o4bo$5o!" },
  { id: "hwss", name: "Heavyweight spaceship", category: "spaceship", period: 4, displacement: { x: -2, y: 0 }, rle: "3b2o2b$bo4bo$o6b$o5bo$6o!" },

  {
    id: "r-pentomino",
    name: "R-pentomino",
    category: "methuselah",
    note: "Five cells that take 1103 generations to settle. Nobody predicted that from the rules.",
    rle: "b2o$2o$bo!"
  },
  {
    id: "acorn",
    name: "Acorn",
    category: "methuselah",
    note: "Seven cells, 5206 generations, 633 cells at rest.",
    rle: "bo5b$3bo3b$2o2b3o!"
  },
  { id: "diehard", name: "Diehard", category: "methuselah", note: "Seven cells that vanish completely at generation 130.", rle: "6bob$2o6b$bo3b3o!" },

  {
    id: "gosper-glider-gun",
    name: "Gosper glider gun",
    category: "gun",
    period: 30,
    note: "The pattern that proved Life grows without bound, and won Gosper the $50 Conway offered for it.",
    rle: "24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!"
  }
];

const byId = new Map(LIBRARY.map((entry) => [entry.id, entry]));

/** Parses a catalogue entry into a stampable pattern. Throws on an unknown id. */
export function getPattern(id: string): Pattern {
  const entry = byId.get(id);
  if (entry === undefined) throw new RangeError(`No pattern "${id}" in the library`);
  const pattern = parseRLE(entry.rle);
  return { ...pattern, name: entry.name, comments: entry.note === undefined ? [] : [entry.note] };
}

export function patternsByCategory(category: PatternCategory): ReadonlyArray<LibraryEntry> {
  return LIBRARY.filter((entry) => entry.category === category);
}
