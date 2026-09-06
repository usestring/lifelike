import { patternFromRows, patternToRows, type Pattern } from "../pattern.js";

/** Parses the plaintext `.cells` format: `!` comment lines, then `.`/`O` rows. */
export function parsePlaintext(text: string): Pattern {
  const comments: string[] = [];
  const rows: string[] = [];
  let name: string | undefined;

  for (const raw of text.split(/\r?\n/)) {
    if (raw.startsWith("!")) {
      const comment = raw.slice(1).trim();
      const named = /^Name:\s*(.+)$/i.exec(comment);
      if (named) name = named[1];
      else if (comment !== "") comments.push(comment);
      continue;
    }
    if (raw.trim() === "" && rows.length === 0) continue;
    rows.push(raw.replace(/\s+$/, ""));
  }

  while (rows.length > 0 && rows[rows.length - 1] === "") rows.pop();
  return patternFromRows(rows, { name, comments });
}

export function serializePlaintext(pattern: Pattern): string {
  const lines: string[] = [];
  if (pattern.name !== undefined) lines.push(`!Name: ${pattern.name}`);
  for (const comment of pattern.comments) lines.push(`!${comment}`);
  lines.push(...patternToRows(pattern));
  return lines.join("\n") + "\n";
}
