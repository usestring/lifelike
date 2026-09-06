import type { Universe } from "../universe.js";
import { THEMES, type Theme } from "./theme.js";

export interface RendererOptions {
  theme?: Theme;
  /** Pixels per cell. Fractional zoom is supported and is what smooth zooming needs. */
  zoom?: number;
  cellShape?: "square" | "circle";
  /** Draw grid lines once cells are at least this many pixels across. */
  gridThreshold?: number;
  /** Fade cells that have just died, using the theme's trail ramp. */
  showTrails?: boolean;
}

export interface Viewport {
  /** Cell coordinate at the canvas's left edge. Fractional during a pan. */
  x: number;
  /** Cell coordinate at the canvas's top edge. */
  y: number;
  zoom: number;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 64;

/**
 * Draws a `Universe` onto a 2D canvas with an independent camera.
 *
 * Cells are batched into one path per colour before filling. A board of any
 * interesting size has far more cells than colours, and the per-call state
 * changes — not the fills — are what cost a frame.
 */
export class CanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  theme: Theme;
  cellShape: "square" | "circle";
  gridThreshold: number;
  showTrails: boolean;
  viewport: Viewport;

  private readonly context: CanvasRenderingContext2D;
  private decay = new Uint8Array(0);
  private lastGeneration = -1;
  private lastCells = new Uint8Array(0);

  constructor(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas does not support a 2D context");
    this.canvas = canvas;
    this.context = context;
    this.theme = options.theme ?? THEMES[0];
    this.cellShape = options.cellShape ?? "square";
    this.gridThreshold = options.gridThreshold ?? 10;
    this.showTrails = options.showTrails ?? true;
    this.viewport = { x: 0, y: 0, zoom: options.zoom ?? 8 };
  }

  /** CSS pixel size of the canvas, which is what the viewport maths works in. */
  private get displaySize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      width: rect.width || this.canvas.width,
      height: rect.height || this.canvas.height
    };
  }

  private syncBackingStore(): { width: number; height: number; ratio: number } {
    const { width, height } = this.displaySize;
    const ratio = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
    const backingWidth = Math.round(width * ratio);
    const backingHeight = Math.round(height * ratio);
    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
    }
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height, ratio };
  }

  /** Cell under a pointer, in cell coordinates. Outside the grid it returns fractional-free values that may be out of range. */
  cellAt(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.floor((clientX - rect.left) / this.viewport.zoom + this.viewport.x),
      y: Math.floor((clientY - rect.top) / this.viewport.zoom + this.viewport.y)
    };
  }

  panBy(deltaXPixels: number, deltaYPixels: number): void {
    this.viewport.x -= deltaXPixels / this.viewport.zoom;
    this.viewport.y -= deltaYPixels / this.viewport.zoom;
  }

  /** Zooms about a point in client coordinates, so the cell under the cursor stays put. */
  zoomAt(factor: number, clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    const anchorX = offsetX / this.viewport.zoom + this.viewport.x;
    const anchorY = offsetY / this.viewport.zoom + this.viewport.y;

    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.viewport.zoom * factor));
    this.viewport.zoom = zoom;
    this.viewport.x = anchorX - offsetX / zoom;
    this.viewport.y = anchorY - offsetY / zoom;
  }

  /** Frames the whole grid. */
  fit(universe: Universe, padding = 2): void {
    const { width, height } = this.displaySize;
    const zoom = Math.min(width / (universe.width + padding * 2), height / (universe.height + padding * 2));
    this.viewport.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    this.viewport.x = universe.width / 2 - width / (2 * this.viewport.zoom);
    this.viewport.y = universe.height / 2 - height / (2 * this.viewport.zoom);
  }

  /** Frames the live cells, or the whole grid when there are none. */
  fitPattern(universe: Universe, padding = 4): void {
    const bounds = universe.bounds();
    if (bounds === null) {
      this.fit(universe, padding);
      return;
    }
    const { width, height } = this.displaySize;
    const cellsWide = bounds.maxX - bounds.minX + 1 + padding * 2;
    const cellsTall = bounds.maxY - bounds.minY + 1 + padding * 2;
    const zoom = Math.min(width / cellsWide, height / cellsTall);
    this.viewport.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    this.viewport.x = (bounds.minX + bounds.maxX + 1) / 2 - width / (2 * this.viewport.zoom);
    this.viewport.y = (bounds.minY + bounds.maxY + 1) / 2 - height / (2 * this.viewport.zoom);
  }

  private updateTrails(universe: Universe): void {
    if (this.decay.length !== universe.cells.length) {
      this.decay = new Uint8Array(universe.cells.length);
      this.lastCells = new Uint8Array(universe.cells.length);
      this.lastCells.set(universe.cells);
      this.lastGeneration = universe.generation;
      return;
    }
    if (universe.generation === this.lastGeneration) return;

    const depth = this.theme.trail.length;
    for (let i = 0; i < universe.cells.length; i++) {
      if (universe.cells[i] === 1) this.decay[i] = 0;
      else if (this.lastCells[i] === 1) this.decay[i] = depth;
      else if (this.decay[i] > 0) this.decay[i]--;
    }
    this.lastCells.set(universe.cells);
    this.lastGeneration = universe.generation;
  }

  private fillCells(cellIndices: number[], universe: Universe, colour: string, zoom: number): void {
    if (cellIndices.length === 0) return;
    const context = this.context;
    context.fillStyle = colour;
    context.beginPath();

    const size = Math.max(1, zoom - (zoom >= this.gridThreshold ? 1 : 0));
    for (const index of cellIndices) {
      const cellX = index % universe.width;
      const cellY = (index - cellX) / universe.width;
      const screenX = (cellX - this.viewport.x) * zoom;
      const screenY = (cellY - this.viewport.y) * zoom;
      if (this.cellShape === "circle" && zoom >= 4) {
        const radius = size / 2;
        context.moveTo(screenX + size, screenY + radius);
        context.arc(screenX + radius, screenY + radius, radius, 0, Math.PI * 2);
      } else {
        context.rect(screenX, screenY, size, size);
      }
    }
    context.fill();
  }

  draw(universe: Universe): void {
    const { width, height } = this.syncBackingStore();
    const context = this.context;
    const zoom = this.viewport.zoom;

    context.fillStyle = this.theme.background;
    context.fillRect(0, 0, width, height);

    if (this.showTrails) this.updateTrails(universe);

    const firstX = Math.max(0, Math.floor(this.viewport.x));
    const firstY = Math.max(0, Math.floor(this.viewport.y));
    const lastX = Math.min(universe.width - 1, Math.ceil(this.viewport.x + width / zoom));
    const lastY = Math.min(universe.height - 1, Math.ceil(this.viewport.y + height / zoom));

    if (zoom >= this.gridThreshold) {
      context.strokeStyle = this.theme.grid;
      context.lineWidth = 1;
      context.beginPath();
      for (let x = firstX; x <= lastX + 1; x++) {
        const screenX = Math.round((x - this.viewport.x) * zoom) + 0.5;
        context.moveTo(screenX, 0);
        context.lineTo(screenX, height);
      }
      for (let y = firstY; y <= lastY + 1; y++) {
        const screenY = Math.round((y - this.viewport.y) * zoom) + 0.5;
        context.moveTo(0, screenY);
        context.lineTo(width, screenY);
      }
      context.stroke();
    }

    const aliveBuckets: number[][] = this.theme.alive.map(() => []);
    const trailBuckets: number[][] = this.theme.trail.map(() => []);
    const ramp = this.theme.alive.length;

    for (let y = firstY; y <= lastY; y++) {
      const row = y * universe.width;
      for (let x = firstX; x <= lastX; x++) {
        const index = row + x;
        if (universe.cells[index] === 1) {
          const age = universe.ages[index];
          aliveBuckets[Math.min(ramp - 1, age === 0 ? 0 : age - 1)].push(index);
        } else if (this.showTrails && this.decay[index] > 0) {
          trailBuckets[this.theme.trail.length - this.decay[index]].push(index);
        }
      }
    }

    for (let i = 0; i < trailBuckets.length; i++) this.fillCells(trailBuckets[i], universe, this.theme.trail[i], zoom);
    for (let i = 0; i < aliveBuckets.length; i++) this.fillCells(aliveBuckets[i], universe, this.theme.alive[i], zoom);
  }
}
