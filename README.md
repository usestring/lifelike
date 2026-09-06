# lifelike

Life-like cellular automata in TypeScript. Any B/S rule, the pattern formats everyone actually
exchanges, and a canvas renderer that pans and zooms.

The engine has no DOM dependency, so it runs in a worker, in Node, or in a test. The renderer is a
separate import that takes a `Universe` and a canvas and stays out of the simulation's way.

## Install

```
bun add @usestring/lifelike
```

## Stepping a universe

```ts
import { Universe, getPattern } from "@usestring/lifelike";

const universe = new Universe({ width: 200, height: 200, topology: "plane" });
universe.stamp(getPattern("gosper-glider-gun"), 20, 20);

universe.run(120);
console.log(universe.generation, universe.population); // 120 56
```

`Universe` keeps two `Uint8Array`s: cell state and cell age. Age counts generations a cell has been
alive and saturates at 255, which is what lets a renderer colour by age without wrapping back to the
start of a ramp. `stepBack` works if you ask for history:

```ts
const u = new Universe({ width: 64, height: 64, historyLimit: 100 });
u.run(50);
u.stepBack(); // generation 49
```

History costs `width * height` bytes per stored generation, so it is off by default.

Topology is `"torus"` (edges wrap) or `"plane"` (everything outside the grid is permanently dead).
A torus is the right default for a screensaver and the wrong one for measuring a methuselah, since
escaping gliders come back and collide with their own debris.

## Rules

Rules parse from B/S notation, Golly's survival-first slash form, or either order:

```ts
import { parseRule, formatRule, NAMED_RULES } from "@usestring/lifelike";

parseRule("B36/S23");  // HighLife
parseRule("23/3");     // the same rule, Golly's form
formatRule(parseRule("S23/B3")); // "B3/S23"
```

`NAMED_RULES` has eleven of them with a line each on what they do: Conway's Life, HighLife,
Day & Night, Seeds, Replicator, Life without Death, Diamoeba, Maze, Coral, 2x2, Anneal.

You can change a rule mid-run. The universe does not care.

```ts
universe.rule = parseRule("B36/S23");
```

## Pattern formats

RLE, plaintext `.cells`, and Life 1.06 all parse and serialize. `parsePattern` sniffs the format:

```ts
import { parsePattern, serializeRLE, detectFormat } from "@usestring/lifelike";

const text = await Bun.file("acorn.rle").text();
detectFormat(text); // "rle" | "plaintext" | "life106"

const pattern = parsePattern(text);
serializeRLE(pattern, { name: "Acorn", rule: "B3/S23" });
```

The RLE parser treats the header's `x`/`y` as advisory and takes extents from the body, because
plenty of files in circulation have headers that disagree with their own contents.

## Pattern library

Nineteen patterns covering one of everything Life does — still lifes, oscillators, the four common
spaceships, three methuselahs, and the Gosper gun.

```ts
import { LIBRARY, getPattern, patternsByCategory } from "@usestring/lifelike";

patternsByCategory("spaceship"); // glider, lwss, mwss, hwss
getPattern("r-pentomino");
```

Every entry records its period and, for spaceships, its per-period displacement. The tests assert
those against a real run, which is what stops a mistyped RLE from shipping as a pattern that only
looks plausible.

## Rendering

```ts
import { CanvasRenderer, getTheme } from "@usestring/lifelike";

const renderer = new CanvasRenderer(canvas, {
  theme: getTheme("cobalt"),
  showTrails: true
});

renderer.fit(universe);
renderer.draw(universe);
```

Cells are batched into one path per colour before filling, since a board of any interesting size has
far more cells than colours and the per-call state changes are what cost the frame. Zoom is
fractional from 0.5 to 64 pixels per cell, `zoomAt` anchors the cell under the cursor so wheel-zoom
does not drift, and `cellAt` converts a mouse position back to a cell for drawing.

Four themes ship: cobalt, mono, paper, ember. Each carries a colour ramp indexed by cell age and a
second ramp for death trails.

## Demo

```
bun run demo
open demo/index.html
```

Play, step, step back, a speed slider, the pattern and rule pickers, drag to draw, shift-drag to
pan, wheel to zoom, and a Copy RLE button.

## Roadmap

v0.1 is the base: the two-state Moore neighbourhood, done properly. The list below is roughly the
order things get built, and is shaped by what LifeViewer does that this does not yet.

- Generations rules (`B/S/C`), where cells decay through states instead of dying outright
- Larger than Life and HROT, for neighbourhoods wider than one cell
- Hexagonal and triangular neighbourhoods
- More bounded topologies: Klein bottle, cross-surface, fixed-size with reflecting edges
- apgcode parsing, and identification of the objects a soup settles into
- Waypoint scripting, so a pattern file can drive the camera
- Annotations: labels and arrows anchored to cells
- HashLife, for the patterns where a dense grid is the wrong data structure

## Development

```
bun install
bun test          # 51 tests
bun run typecheck
bun run build
```

Tests check the engine against results published elsewhere rather than against itself. The
R-pentomino has to reach exactly 116 cells at generation 1103, the Gosper gun has to go 36 to 41 to
46 at generations 0, 30 and 60, and Diehard has to die at generation 130 exactly.

## License

MIT. Copyright (c) 2026 Relativity Labs Inc.
