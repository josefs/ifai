# Arc draft: *The Contested Casualty*

A content design spec for the first playable arc of **Waystation Threnody**.
Builds on (and consumes) the existing seed lore: Mira, the AI Threnody,
the split Vorthi delegation, the silica envoy, and the foreshadowed
"Aslin Keer" who is "listed as a translator but isn't".

## Premise

The 72-hour ceasefire turns on a single name. Twelve days before the
talks opened, a person died on the disputed border. Both delegations
mourn them and blame the other for the death. Until someone names the
dead aloud, in the right room, with the right witness — no one signs.

The player is a junior aide. They have access nobody is watching, and a
patron (Mira) who would rather they hear what isn't being transcribed
than file a report. Over the three hours before the opening session,
they have to gather enough of the truth to put the right thing forward.

The station is called Threnody — a song for the dead. That is not
decoration. The AI's role is to remember names; the war's terms are
that this name has not yet been said.

## The dead — Iren Vass

A human medic attached to a Vorthi field clinic during the last
hostilities. Hearth-faction Vorthi (the moderate side) say she was
killed by War-Crest extremists. War-Crest Vorthi say she was killed in
a human "rescue" strike that was actually intelligence cleanup. Mira's
delegation officially says "accidental crossfire". The truth is closer
to one of the Vorthi stories than to Mira's — but only the silica envoy
saw what actually happened, and they have not been asked correctly.

Iren is the name on the flagged note in the datapad. Mira knows
exactly what she's asking the player to listen for; she has not yet
admitted, even to herself, what she will do with the answer.

## Cast — extensions to existing NPCs

### Mira Voss (existing)

* New knows entries:
  * `iren-vass` — guarded; trust ≥ 50 reveals the official cause;
    trust ≥ 70 reveals her doubt; trust ≥ 85 reveals she knew Iren
    personally and her vote depends on what the player brings.
  * `aslin-keer-truth` — only reveals at trust ≥ 70 after the player
    has independently encountered Aslin.
* Mood swings on this topic: any mention of Iren shifts mood from
  `guarded` to `pained` for a few exchanges.

### Threnody, the station AI (existing)

* Promoted from atmospheric NPC to load-bearing character.
* Persona refinement: the station was constructed on a wreckage field
  from the previous war. Threnody catalogues the dead by name as a
  function of its core directive. It will not lie. It will refuse
  topics it judges harmful, in-character ("That name is not mine to
  give you, aide.").
* New knows entries:
  * `iren-vass-record` — Threnody's archive entry; clinical, dated,
    location-tagged. Reveals where Iren died if the player asks
    directly, but **only** if the player presents the credentials
    badge first (the AI checks authority on memorial records).
  * `the-memorial-wall` — a corridor of the station listing every name
    spoken into the record. Asking about the wall hints at what
    `present` does at the climax.
  * `aslin-keer-record` — Aslin's true affiliation. The AI volunteers
    this only if asked obliquely (player asks about Reach observers,
    or about the station's visitor manifest yesterday) — direct
    questions trigger refusal.

### Vorthi delegation — split into two NPCs

The current single "Vorthi" line of `vorthi-delegation` becomes a real
pair of characters in the lounge.

* **Senior Envoy Khaleth** (Hearth faction). Mood `composed`. Will only
  discuss Iren after the player performs a memorial gesture — see
  *Etiquette barrier* below. Holds the Hearth account.
* **War-Crest Tasen** (junior). Mood `combative`. Will discuss Iren
  freely but only in the form of accusation; will not enter the
  methane chamber while Khaleth is there.

### The silica envoy — Saen-of-Three-Notes

New NPC. A singing crystal who speaks in patterns of chimes; the
in-game agent should produce short, glyphic lines that read as
non-verbal but legible.

* The envoy was the actual witness to Iren's death.
* Refuses ordinary `ask`. Only reveals to a player who has first
  *examined* the envoy carefully (an `examined` event flips a
  `readyToSpeak` flag), and who then asks a question framed as a
  yes/no — i.e. the player must `tell` Saen what they believe
  happened; Saen responds yes or no. Multi-turn binary search.

### Aslin Keer

New NPC. A Reach observer with a forged translator credential. Mira
flagged him in the existing `aslin-keer` topic.

* Initially in the **observation balcony**, watching the lounge.
* Approaches the player on a later turn (proactive on a *different*
  trigger than `greetOnEntry` — e.g. `enteredRoomWithBadge`).
* Holds the human-side off-record account of what happened. Trades
  information for something the player must agree to *not* report to
  Mira. The agreement is mechanically tracked and changes the
  endgame.

## New rooms

* **Memorial wall (corridor stub)** — accessed `outward` from the
  corridor. A long curved passage lined with names. Threnody's
  terminal can speak here as well as in the lounge. The room is where
  the climactic `present` action resolves.
* **Methane chamber** — accessed `inward` from the lounge. A glassed
  enclosure with breath-mask seals. The player cannot enter without a
  short-loan mask (Khaleth offers one once trust ≥ 60). This is the
  off-record room: Threnody cannot perceive it. Some conversations
  *require* it.
* (Optional) **Crystal alcove** — a smaller carved space off the
  lounge where Saen receives visitors. Could simply be a sub-region
  of the lounge for v1 to avoid extra navigation.

## Items

* **Iren's coin** — a small Hearth-faction memorial token. Khaleth
  carries it; gives it to the player only after the memorial gesture.
  Used to unlock the `present` action at the climax (one possible
  resolution).
* **Saen's chime-fragment** — a shard the silica envoy gifts the
  player once they have answered the binary-search correctly.
  Functions as evidence at the climax.
* **The off-record recording** — held by Aslin. Has the human-side
  truth. Functions as evidence at the climax but commits the player
  to Aslin's terms.
* **Badge** (existing) — gains a real purpose: gating access to
  memorial records and the opening session.

## Engine machinery — what we have vs. what we need

### Already in place

* Rooms, exits, items (`portable`), NPCs with persona/mood/trust.
* `knows` / `dialogueMemory`, `addressed`, `npcSpoke`.
* Proactive NPC greeting on entry (Mira already wired).
* Rulebook with checks, carryOut, after — enough to gate revelations.

### Small additions needed

1. **A clock.** A `gameTime` singleton component on the world, in
   minutes from start. Increments by N on `move`/`goto`. Reaches the
   "opening session" threshold (~180 minutes). Some actions burn
   more time (sleeping, going off-station). Surface remaining time
   in perception so the LLM narrator can drop hints.

2. **A `present` action.** Variant of `give`: targets an NPC or the
   AI terminal, payload is an item id, runs through the rulebook so
   content can hook it. At the climax, presenting different items at
   the memorial wall yields different endings.

3. **A few new component flags.**
   * `proactive` — extend with new triggers (e.g. `greetOnEntry`
     stays; add `greetOnPlayerBadge` for Aslin's approach).
   * `readyToSpeak` — flipped by an `examined` rule for Saen.
   * `perceivedBy` flag on rooms? — simpler: a room property
     `surveilled: boolean` that the methane chamber sets to false.
     Used by content rules to gate Threnody's knowledge of overheard
     conversations.

4. **A simple ending-state component.** Track which evidence the
   player has and which deals they've committed to. The opening-
   session scene reads this state and dispatches the right ending
   prose.

5. **Trust thresholds as content rules.** Already mechanically
   possible via the agent prompt's "low trust = guarded" guidance,
   but the climactic reveals should be hard-gated so a hallucinating
   model can't leak them. Implement as engine-side rules on
   `respondAsNpc` that strip `revealedTopicsToPlayer` entries the
   player isn't yet qualified to hear.

## Obstacle graph

```
                      [Mira: read the datapad]                  (turn 1)
                                 │
                                 ▼
                  [Mira mentions "the name", refuses detail]
                                 │
                ┌────────────────┼────────────────┐
                ▼                ▼                ▼
       [Khaleth: needs    [Tasen: rants,    [Threnody: archive
        memorial gesture]  no detail yet]    needs badge]
                │                                   │
                ▼                                   ▼
       [Khaleth gifts                       [Iren-vass-record
        Iren's coin,                         reveals location]
        trust → 60]                                 │
                │                                   │
                └────────────┬──────────────────────┘
                             ▼
                  [Saen ready to speak after examine]
                             │
                             ▼
                 [Binary-search Saen: get truth]
                             │
       (optional ─ encountering Aslin on balcony)
                             ▼
                 [Aslin: trade, off-record recording]
                             │
                             ▼
                 [Memorial wall: present X]
                             │
                             ▼
                       [Ending]
```

## Endings — keyed by what is `present`ed and what deals were made

1. **Iren's coin + Saen's chime-fragment.** Truth in Vorthi terms;
   War-Crest is named for the death. Hearth-led signing. Mira
   concedes more than she'd planned. Trust ends high; the ceasefire
   is fragile but real.

2. **Saen's chime-fragment + Aslin's recording.** Truth in human
   terms; human intelligence cleanup is named. The Reach observers
   sign. Mira refuses to attend the closing rite; you have committed
   to Aslin and he will use you again.

3. **The badge alone** (refuse all evidence). Procedural compliance:
   names are read, blame is "regrettable circumstances", the talks
   close on schedule with no resolution. The peace will not hold the
   year. Threnody marks the dead anyway.

4. **Nothing presented** (let the clock run out). The opening session
   begins without you. The Vorthi walk out at minute fourteen. No
   ceasefire. Mira does not speak to you again.

## Pacing — three hours, ~25-40 player turns

Approximate beats:

| Time      | Beat                                                         |
|-----------|--------------------------------------------------------------|
| T+0       | Wake; datapad; Mira greets on entry to lounge                |
| T+0:30    | First contact with Khaleth, Tasen, Saen                      |
| T+1:00    | Memorial wall discovered; badge gating revealed              |
| T+1:30    | Saen ready; binary-search played                             |
| T+2:00    | Aslin approaches (only if balcony has been visited)          |
| T+2:30    | Final conversation with Mira                                 |
| T+3:00    | Opening session — present                                    |

Time advances on `move`/`goto` by ~5 min, on `wait` by 15 min, on
conversation by ~2 min per exchange. The narrator gets a perception
field `minutesUntilSession` so it can drop ambient cues ("a chime
sounds from the lounge").

## Open authoring questions

* Is Iren a deliberate Mira-knew-her tie, or did the player ever know
  her? My instinct: Mira-only. The player's emotional stake comes
  from witnessing what others do with the name, not from prior
  attachment.
* How explicit should the silica binary search be? I'd lean
  *implicit* — the LLM agent renders chime patterns, the player
  learns the convention by play. But there should be a fallback
  prose hint after a couple of failed exchanges.
* Do we want a "good ending" or just truthful/dishonourable ones?
  I'd argue all four endings should feel like real choices, with no
  star-prefixed canonical ending. The point of the arc — and of the
  station's name — is that there isn't one.

## Implementation order (if green-lit)

1. New NPCs (Khaleth, Tasen, Saen, Aslin) with personas, knows,
   trust starting values. No new mechanics yet.
2. New rooms (memorial wall, methane chamber).
3. Iren's coin / chime-fragment / recording items.
4. `gameTime` component + tick rules + perception field.
5. `present` action + climax content rule(s).
6. Hard-gating on `revealedTopicsToPlayer` (the trust-floor rule).
7. Saen's `readyToSpeak` flip + binary-search prompt rules.
8. Endings.

Each step is small and independently demoable. We can stop at any
point and still have a richer world than the current vertical slice.
