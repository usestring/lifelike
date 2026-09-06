import { CanvasRenderer } from "../src/render/canvas.js";
import { LIBRARY, getPattern } from "../src/patterns.js";
import { NAMED_RULES, formatRule, parseRule } from "../src/rule.js";
import { THEMES } from "../src/render/theme.js";
import { Universe, type Topology } from "../src/universe.js";
import { serializeRLE } from "../src/formats/rle.js";
import { patternFromRows } from "../src/pattern.js";

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing #${id}`);
  return found as T;
};

const canvas = element<HTMLCanvasElement>("canvas");
const board = element("board");

const universe = new Universe({ width: 240, height: 160, historyLimit: 120 });
const renderer = new CanvasRenderer(canvas, { zoom: 6, showTrails: true });

const populate = () => {
  const patterns = element<HTMLSelectElement>("pattern");
  for (const entry of LIBRARY) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.name;
    patterns.append(option);
  }
  patterns.value = "gosper-glider-gun";

  const named = element<HTMLSelectElement>("named");
  for (const rule of NAMED_RULES) {
    const option = document.createElement("option");
    option.value = rule.rule;
    option.textContent = rule.name;
    option.title = rule.note;
    named.append(option);
  }

  const themes = element<HTMLSelectElement>("theme");
  for (const theme of THEMES) {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    themes.append(option);
  }
};

let running = false;
let generationsPerSecond = 15;
let lastStep = 0;

const readout = () => {
  element("generation").textContent = String(universe.generation);
  element("population").textContent = String(universe.population);
};

const frame = (now: number) => {
  if (running && now - lastStep >= 1000 / generationsPerSecond) {
    universe.step();
    lastStep = now;
    readout();
  }
  renderer.draw(universe);
  requestAnimationFrame(frame);
};

const loadPattern = (id: string) => {
  universe.clear();
  const pattern = getPattern(id);
  universe.stamp(pattern, Math.floor(universe.width / 2), Math.floor(universe.height / 2), { center: true });
  renderer.fitPattern(universe, 12);
  readout();
};

const setRule = (text: string) => {
  const input = element<HTMLInputElement>("rule");
  try {
    universe.rule = parseRule(text);
    const canonical = formatRule(universe.rule);
    input.style.borderColor = "";
    const named = element<HTMLSelectElement>("named");
    const match = NAMED_RULES.find((rule) => formatRule(parseRule(rule.rule)) === canonical);
    named.value = match === undefined ? "" : match.rule;
  } catch {
    input.style.borderColor = "#f85149";
  }
};

populate();
loadPattern("gosper-glider-gun");
requestAnimationFrame(frame);

element("play").addEventListener("click", (event) => {
  running = !running;
  (event.currentTarget as HTMLButtonElement).textContent = running ? "Pause" : "Play";
});
element("step").addEventListener("click", () => {
  universe.step();
  readout();
});
element("back").addEventListener("click", () => {
  universe.stepBack();
  readout();
});
element("random").addEventListener("click", () => {
  universe.randomize(0.28);
  renderer.fit(universe);
  readout();
});
element("clear").addEventListener("click", () => {
  universe.clear();
  readout();
});
element("fit").addEventListener("click", () => renderer.fitPattern(universe, 8));
element("copy").addEventListener("click", async () => {
  const bounds = universe.bounds();
  if (bounds === null) return;
  const rows: string[] = [];
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    let row = "";
    for (let x = bounds.minX; x <= bounds.maxX; x++) row += universe.get(x, y) === 1 ? "O" : ".";
    rows.push(row);
  }
  await navigator.clipboard.writeText(serializeRLE(patternFromRows(rows), { rule: universe.rule }));
});

element<HTMLSelectElement>("pattern").addEventListener("change", (event) =>
  loadPattern((event.currentTarget as HTMLSelectElement).value)
);
element<HTMLSelectElement>("named").addEventListener("change", (event) => {
  const rule = (event.currentTarget as HTMLSelectElement).value;
  element<HTMLInputElement>("rule").value = rule;
  setRule(rule);
});
element<HTMLInputElement>("rule").addEventListener("input", (event) => setRule((event.currentTarget as HTMLInputElement).value));
element<HTMLSelectElement>("topology").addEventListener("change", (event) => {
  universe.topology = (event.currentTarget as HTMLSelectElement).value as Topology;
});
element<HTMLSelectElement>("theme").addEventListener("change", (event) => {
  const id = (event.currentTarget as HTMLSelectElement).value;
  const theme = THEMES.find((candidate) => candidate.id === id);
  if (theme !== undefined) renderer.theme = theme;
});
element<HTMLInputElement>("speed").addEventListener("input", (event) => {
  generationsPerSecond = Number((event.currentTarget as HTMLInputElement).value);
});

interface Drag {
  pointerId: number;
  mode: "draw" | "pan";
  value: boolean;
  lastX: number;
  lastY: number;
}
let drag: Drag | null = null;

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  const pan = event.shiftKey || event.button === 1 || event.button === 2;
  if (pan) {
    drag = { pointerId: event.pointerId, mode: "pan", value: false, lastX: event.clientX, lastY: event.clientY };
    return;
  }
  const cell = renderer.cellAt(event.clientX, event.clientY);
  if (!universe.contains(cell.x, cell.y)) return;
  const value = universe.get(cell.x, cell.y) === 0;
  universe.set(cell.x, cell.y, value);
  drag = { pointerId: event.pointerId, mode: "draw", value, lastX: event.clientX, lastY: event.clientY };
  readout();
});

canvas.addEventListener("pointermove", (event) => {
  if (drag === null || drag.pointerId !== event.pointerId) return;
  if (drag.mode === "pan") {
    renderer.panBy(event.clientX - drag.lastX, event.clientY - drag.lastY);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    return;
  }
  const cell = renderer.cellAt(event.clientX, event.clientY);
  if (universe.contains(cell.x, cell.y)) {
    universe.set(cell.x, cell.y, drag.value);
    readout();
  }
});

const endDrag = () => {
  drag = null;
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  renderer.zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
}, { passive: false });

new ResizeObserver(() => renderer.draw(universe)).observe(board);
