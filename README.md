# ScreenLit (working)

Base: `SL31.4_FREEZE_20260207_234059` (this folder is a working copy derived from that freeze).
Reference: the atomic placeholder build is called **atomic** (zip: `ScreenLit_ATOMIC_01_FREEZE_<timestamp>.zip`).

## What ScreenLit is
ScreenLit is a private taste instrument.
- Not a review site, not social, not a feed.
- No persuasion. No identity narration. No “you are X.”
- “Don’t know” is valid. Revision is allowed.
- Stability > novelty. Behavioral invariants > feature count.

## Canonical surfaces
### Index
- Tagline: **Rate what you know.**
- Fixed 3×3 grid (slot-locality: only the acted-on tile changes).
- Stars: hover previews, click commits (gold only on click-commit).
- Triad: − = No, ○ = Don’t know, + = Add.

### Discover
- 3-slot conveyor: left (history), center (active), right (next).
- Only center accepts input.
- Inferred stars are gray/near-black (never gold).
- Any experimental controls must never crash the page.

## Animation + color constraints
- Animation: opacity fades only. No transforms, no sliding, no layout shifts.
- Color: gold is reserved exclusively for click-committed ratings.
- Everything else is grayscale. Links are gray and not underlined.

## Single-origin rule (important)
Always run via a local server (never `file://`) to avoid split storage origins.

## How to run (ironclad)
Start:
- `./tools/sl up`
- `./tools/sl open`

Stop:
- `./tools/sl down`

## Verification (“contamination firewall”)
After any change:
- `./tools/sl doctor`

Doctor checks:
- Required files exist
- HTML references expected scripts
- Scans for contamination markers (terminal output pasted into JS/HTML)
- JS syntax check (if `node` exists)
- Catalog ID duplicates

## Freezing stable states
When it works and feels right:
- `./tools/sl freeze`

Treat freeze zips as read-only. Work only in the working folder.

