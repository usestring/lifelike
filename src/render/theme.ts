/**
 * Colours for one rendering of a board. `alive` is a ramp indexed by how long a
 * cell has been alive, which is what makes a still life read as settled and a
 * spaceship as moving; `trail` fades cells that have just died.
 */
export interface Theme {
  id: string;
  name: string;
  background: string;
  grid: string;
  alive: ReadonlyArray<string>;
  trail: ReadonlyArray<string>;
}

export const THEMES: ReadonlyArray<Theme> = [
  {
    id: "cobalt",
    name: "Cobalt",
    background: "#05070d",
    grid: "#0d1421",
    alive: ["#7cc4ff", "#4a9eff", "#2f7fe6", "#1f63c4", "#164b9c"],
    trail: ["#123055", "#0d2340", "#09182b"]
  },
  {
    id: "mono",
    name: "Mono",
    background: "#0a0a0a",
    grid: "#161616",
    alive: ["#ffffff", "#d4d4d4", "#a3a3a3", "#7a7a7a", "#5c5c5c"],
    trail: ["#333333", "#242424", "#171717"]
  },
  {
    id: "paper",
    name: "Paper",
    background: "#faf9f5",
    grid: "#e8e5dd",
    alive: ["#1a1a1a", "#3d3a34", "#5c574d", "#7a7366", "#968d7c"],
    trail: ["#d8d4c8", "#e5e2da", "#f0eee7"]
  },
  {
    id: "ember",
    name: "Ember",
    background: "#0d0603",
    grid: "#1c0e06",
    alive: ["#fff2c4", "#ffcc55", "#ff9a2e", "#f2611d", "#c9350f"],
    trail: ["#5c1c07", "#3d1305", "#210a03"]
  }
];

export function getTheme(id: string): Theme {
  const theme = THEMES.find((candidate) => candidate.id === id);
  if (theme === undefined) throw new RangeError(`No theme "${id}"`);
  return theme;
}
