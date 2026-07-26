/**
 * Streaming-friendly word wrapper for the CLI.
 *
 * The narrator writes prose to stdout either as a single complete string
 * (deterministic mode) or token-by-token (LLM mode). In both cases the
 * raw text has no embedded line breaks beyond paragraph boundaries, so the
 * terminal soft-wraps at the column boundary — which often falls in the
 * middle of a word.
 *
 * `createWrappingWriter` wraps an output sink and breaks lines at
 * whitespace at the requested width. Partial words are buffered until a
 * whitespace boundary arrives, so streaming chunks never split a word.
 *
 * Limitations (deliberate):
 *  - Runs of whitespace are collapsed to a single space.
 *  - A word longer than the wrap width is emitted on its own line; we
 *    refuse to break it mid-word.
 *  - No ANSI / escape-sequence handling — we don't emit any.
 */

export interface WrappingWriter {
  write(chunk: string): void;
  flush(): void;
  reset(): void;
}

/** Detect a sensible wrap width, honouring `IFAI_WRAP` and the terminal. */
export function detectWidth(): number {
  const env = parseInt(process.env.IFAI_WRAP ?? '', 10);
  if (Number.isFinite(env) && env > 20) return env;
  const cols = process.stdout.columns;
  if (typeof cols === 'number' && cols > 20) return Math.min(cols, 100);
  return 80;
}

/** Wrap a complete string in one shot. */
export function wrapText(text: string, width: number): string {
  let out = '';
  const w = createWrappingWriter(width, s => { out += s; });
  w.write(text);
  w.flush();
  return out;
}

export function createWrappingWriter(
  width: number,
  out: (s: string) => void,
): WrappingWriter {
  let col = 0;
  let buf = '';                // partial word (no whitespace seen yet)
  let pendingSpace = false;    // a single space waiting before the next word

  function emitWord(word: string): void {
    if (word.length === 0) return;
    if (col === 0) {
      out(word);
      col = word.length;
      pendingSpace = false;
      return;
    }
    const sep = pendingSpace ? 1 : 0;
    if (col + sep + word.length > width) {
      out('\n' + word);
      col = word.length;
    } else {
      out((pendingSpace ? ' ' : '') + word);
      col += sep + word.length;
    }
    pendingSpace = false;
  }

  function emitNewline(): void {
    out('\n');
    col = 0;
    pendingSpace = false;
  }

  return {
    write(chunk: string): void {
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i]!;
        if (ch === '\n') {
          if (buf.length > 0) { emitWord(buf); buf = ''; }
          emitNewline();
        } else if (ch === ' ' || ch === '\t') {
          if (buf.length > 0) { emitWord(buf); buf = ''; }
          // Collapse whitespace runs; ignore leading whitespace at line start.
          if (col > 0) pendingSpace = true;
        } else {
          buf += ch;
        }
      }
    },
    flush(): void {
      if (buf.length > 0) { emitWord(buf); buf = ''; }
    },
    reset(): void {
      if (buf.length > 0) { emitWord(buf); buf = ''; }
      col = 0;
      pendingSpace = false;
    },
  };
}
