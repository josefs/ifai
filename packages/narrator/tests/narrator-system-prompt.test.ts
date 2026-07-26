import { describe, it, expect } from 'vitest';
import {
  buildNarratorSystem,
  NARRATOR_BASE,
  NARRATOR_LOOK_MOVE,
  NARRATOR_OTHER_EVENTS,
  NARRATOR_NPC_SPEECH,
  NARRATOR_NOTICED,
  NARRATOR_GAME_TIME,
} from '../src/llm/prompts.js';

// The build function only inspects `kind` (events) and `gameTime`
// (perception), so plain objects are enough for unit testing.
const perceptionNoTime = {} as { gameTime?: unknown };
const perceptionWithTime = { gameTime: { minutes: 5 } };

describe('buildNarratorSystem', () => {
  it('always includes the base section', () => {
    const s = buildNarratorSystem([], perceptionNoTime);
    expect(s).toContain(NARRATOR_BASE);
  });

  it('omits the room/exits section when there is no look/move', () => {
    const s = buildNarratorSystem([{ kind: 'took' }], perceptionNoTime);
    expect(s).not.toContain(NARRATOR_LOOK_MOVE);
    expect(s).not.toMatch(/EXITS/);
  });

  it('includes the room/exits section on a looked event', () => {
    const s = buildNarratorSystem([{ kind: 'looked' }], perceptionNoTime);
    expect(s).toContain(NARRATOR_LOOK_MOVE);
  });

  it('includes the room/exits section on a moved event', () => {
    const s = buildNarratorSystem([{ kind: 'moved' }], perceptionNoTime);
    expect(s).toContain(NARRATOR_LOOK_MOVE);
  });

  it('omits the NPC speech section when no dialogue events are present', () => {
    const s = buildNarratorSystem([{ kind: 'looked' }], perceptionNoTime);
    expect(s).not.toContain(NARRATOR_NPC_SPEECH);
  });

  it('includes the NPC speech section when addressed is present', () => {
    const s = buildNarratorSystem([{ kind: 'addressed' }], perceptionNoTime);
    expect(s).toContain(NARRATOR_NPC_SPEECH);
  });

  it('includes the NPC speech section when npcSpoke is present', () => {
    const s = buildNarratorSystem([{ kind: 'npcSpoke' }], perceptionNoTime);
    expect(s).toContain(NARRATOR_NPC_SPEECH);
  });

  it('includes the noticed-event section only when noticed is present', () => {
    expect(buildNarratorSystem([{ kind: 'took' }], perceptionNoTime))
      .not.toContain(NARRATOR_NOTICED);
    expect(buildNarratorSystem([{ kind: 'noticed' }], perceptionNoTime))
      .toContain(NARRATOR_NOTICED);
  });

  it('omits the game-time section when perception has no gameTime', () => {
    const s = buildNarratorSystem([{ kind: 'looked' }], perceptionNoTime);
    expect(s).not.toContain(NARRATOR_GAME_TIME);
    expect(s).not.toMatch(/GAME TIME/);
  });

  it('includes the game-time section when perception has gameTime', () => {
    const s = buildNarratorSystem([{ kind: 'looked' }], perceptionWithTime);
    expect(s).toContain(NARRATOR_GAME_TIME);
  });

  it('includes other-events section for non-look/move events only', () => {
    expect(buildNarratorSystem([{ kind: 'looked' }], perceptionNoTime))
      .not.toContain(NARRATOR_OTHER_EVENTS);
    expect(buildNarratorSystem([{ kind: 'took' }], perceptionNoTime))
      .toContain(NARRATOR_OTHER_EVENTS);
    expect(buildNarratorSystem([{ kind: 'failed' }], perceptionNoTime))
      .toContain(NARRATOR_OTHER_EVENTS);
  });

  it('does not double-count dialogue events as "other"', () => {
    // addressed + npcSpoke alone shouldn't trigger NARRATOR_OTHER_EVENTS —
    // they have their own dedicated section.
    const s = buildNarratorSystem(
      [{ kind: 'addressed' }, { kind: 'npcSpoke' }],
      perceptionNoTime,
    );
    expect(s).not.toContain(NARRATOR_OTHER_EVENTS);
    expect(s).toContain(NARRATOR_NPC_SPEECH);
  });

  it('is shorter than the full prompt for a single-event turn', () => {
    const fullish = buildNarratorSystem(
      [{ kind: 'looked' }, { kind: 'addressed' }, { kind: 'npcSpoke' },
       { kind: 'noticed' }, { kind: 'took' }],
      perceptionWithTime,
    );
    const minimal = buildNarratorSystem([{ kind: 'took' }], perceptionNoTime);
    expect(minimal.length).toBeLessThan(fullish.length);
  });
});
