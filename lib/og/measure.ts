/**
 * Line breaking for next/og. Left to break lines itself, next/og widens some
 * word spaces in Geist; a line set with non-breaking spaces comes out right.
 * So lines are broken here, from the font's own advance widths, and each one
 * is drawn as a single run.
 */

const TRAILING_PUNCTUATION = /[,.;:]$/;

/** Glyph ids are 16-bit and the cmap's deltas wrap around. */
const wrap16 = (n: number) => ((n % 65_536) + 65_536) % 65_536;

export interface Metrics {
  unitsPerEm: number;
  advance: (char: string) => number;
}

/** Reads advance widths from a TrueType font (cmap format 4 and hmtx). */
export function readMetrics(buffer: Buffer): Metrics {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength
  );
  const tables = new Map<string, number>();
  const count = view.getUint16(4);
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(
      view.getUint8(at),
      view.getUint8(at + 1),
      view.getUint8(at + 2),
      view.getUint8(at + 3)
    );
    tables.set(tag, view.getUint32(at + 8));
  }
  const table = (tag: string) => {
    const at = tables.get(tag);
    if (at === undefined) {
      throw new Error(`Font has no ${tag} table`);
    }
    return at;
  };

  const unitsPerEm = view.getUint16(table("head") + 18);
  const hmetrics = view.getUint16(table("hhea") + 34);
  const hmtx = table("hmtx");
  const glyphAdvance = (glyph: number) =>
    view.getUint16(hmtx + 4 * Math.min(glyph, hmetrics - 1));

  // The Unicode BMP subtable (platform 3, encoding 1), in format 4.
  const cmap = table("cmap");
  let sub = -1;
  for (let i = 0; i < view.getUint16(cmap + 2); i++) {
    const at = cmap + 4 + i * 8;
    if (view.getUint16(at) === 3 && view.getUint16(at + 2) === 1) {
      sub = cmap + view.getUint32(at + 4);
    }
  }
  if (sub < 0 || view.getUint16(sub) !== 4) {
    throw new Error("Font has no format 4 Unicode cmap");
  }
  const segments = view.getUint16(sub + 6) / 2;
  const ends = sub + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;

  const glyphFor = (code: number) => {
    for (let s = 0; s < segments; s++) {
      if (code > view.getUint16(ends + s * 2)) {
        continue;
      }
      const start = view.getUint16(starts + s * 2);
      if (code < start) {
        return 0;
      }
      const delta = view.getInt16(deltas + s * 2);
      const rangeAt = ranges + s * 2;
      const range = view.getUint16(rangeAt);
      if (range === 0) {
        return wrap16(code + delta);
      }
      const glyph = view.getUint16(rangeAt + range + (code - start) * 2);
      return glyph === 0 ? 0 : wrap16(glyph + delta);
    }
    return 0;
  };

  const cache = new Map<string, number>();
  return {
    unitsPerEm,
    advance: (char) => {
      let width = cache.get(char);
      if (width === undefined) {
        width = glyphAdvance(glyphFor(char.codePointAt(0) ?? 0));
        cache.set(char, width);
      }
      return width;
    },
  };
}

export interface WrapOptions {
  size: number;
  maxWidth: number;
  /** Tracking in em, as CSS letter-spacing. */
  tracking?: number;
  maxLines?: number;
}

/** Greedy line breaks at spaces; the last allowed line ends in an ellipsis. */
export function wrap(
  text: string,
  metrics: Metrics,
  {
    size,
    maxWidth,
    tracking = 0,
    maxLines = Number.POSITIVE_INFINITY,
  }: WrapOptions
) {
  const measure = (s: string) => {
    let units = 0;
    for (const char of s) {
      units += metrics.advance(char);
    }
    return (units / metrics.unitsPerEm + tracking * [...s].length) * size;
  };
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  if (lines.length <= maxLines) {
    return lines;
  }
  const kept = lines.slice(0, maxLines);
  let last = kept.at(-1) ?? "";
  while (last.includes(" ") && measure(`${last}…`) > maxWidth) {
    last = last.slice(0, last.lastIndexOf(" "));
  }
  kept[kept.length - 1] = `${last.replace(TRAILING_PUNCTUATION, "")}…`;
  return kept;
}
