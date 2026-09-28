# The Grand Illusion Radar

A live deal radar for **genuine stage illusions** — the large, crated, Henning &
Copperfield sort — not pocket tricks, card gimmicks or optical-illusion posters.

```bash
npm start          # → http://localhost:7777
```

Then hit **Quick Scan** (~3 min) or **Deep Sweep** (~9 min).

**Live snapshot:** https://davemen.github.io/grand-illusion-radar/

## Why the scanner stays local

The site is published, the *scanner* is not — and that is deliberate. eBay and
Craigslist block datacenter IPs and non-browser TLS fingerprints, so a scanner running
on Vercel or GitHub Actions finds nothing. It works precisely because it runs from a
home connection with real Chrome. So:

```bash
npm start            # scan locally, where the sources answer
npm run publish      # write docs/ (UI + data.json snapshot)
git commit -am "…" && git push     # GitHub Pages serves it
```

One frontend serves both: it calls the API when there is one, and falls back to the
published `data.json` on Pages (saves/hides then live in `localStorage`).

## What counts as a deal

A deal is scored against **observed market comps** — the median asking price of that
illusion across everything swept — falling back to a typical new price only when there
are fewer than 3 comps. This matters: an Abbott Chair Suspension reads as −89% against a
guessed $5,000 MSRP, but against 7 real asking prices it is −28%. The card always shows
which basis it used.

Guards that keep the list honest:

- **Purchasable only.** Forum threads are excluded; The Magic Café has no public
  classifieds forum (all 40 categories checked), so its discussion posts never appear
  as listings. Only explicit offers survive, flagged as leads.
- **A live auction's bid is not a price.** Auctions are detected and their deal score
  is cut by 30, because the current bid will climb.
- **Too good to be true.** A discount past 85% almost always means a small tabletop
  version matched a big illusion's name — a "see thru tip over *box*" against a full
  tip over *trunk*. Past that threshold we require a known builder or real evidence of
  scale before believing it.
- Deals are suppressed entirely when any negative matched, or below a $150 floor.

Sorted by **🔥 Screaming deals** by default; everything without a discount is tucked
below a fold you can expand.

**List / Gallery** toggles density. List is the default — uniform 40px rows, ~16 findings
per screen against the gallery's 10, with the thumbnail shrunk to a 54px chip. Gallery is
the browsing view when you want to see the props. The choice persists in `localStorage`.

---

## Why the naive version finds nothing

Searching marketplaces for "illusion" is close to useless. A live search for
`zig zag illusion` returns, in order: a **playing card** trick ($9.95), a **jumbo card**
trick ($40), and a set of **building plans** ($9.41). The actual Robert Harbin Zig Zag
Girl cabinet is buried far below, and most sites bury it behind an anti-bot wall.

So this tool solves three separate problems.

### 1. Getting in at all

| Source | Plain `curl` | What actually works |
|---|---|---|
| eBay | **403** | Real Chrome, **prime `ebay.com` homepage first for cookies**, then search |
| Craigslist | **403 blocked** | Real Chrome, 4 parallel tabs across 40 metros |
| Alibaba | **CAPTCHA** | Nothing reliable — see below |
| Magic Café / Potter | 200 | Plain `fetch` |

The blocks are TLS-fingerprint based, not IP based — these sites are fine with your
home connection, they just refuse `curl`'s handshake.

### 2. Searching the right places

The single biggest win is **eBay category `14014` — "Stage Illusion"**, eBay's own
pre-filtered category. Browsing it beats any keyword search. Beyond that the tool
sweeps a lexicon of ~18 named-illusion queries, 40 Craigslist metros, The Magic Café's
*Grand illusion* forum (where private sales get announced before they reach eBay), and
the Potter & Potter auction rooms.

### 3. Telling a real illusion from junk — `lib/lexicon.mjs`

Every listing is scored against:

- **~60 named illusions** (Zig Zag, Sub Trunk, Asrah, Broom Suspension, Table of Death…),
  each with a typical new price for discount maths.
- **25 builders**, weighted — Gaughan, Owen Magic Supreme, Steinmeyer and Thayer are
  *grail* tier; a signed prop from those shops is the real thing.
- **Provenance** — ex-Henning, ex-Copperfield, ex-Blackstone.
- **Physical scale** — "crated", "freight", "local pickup only", "fits a person", weights,
  dimensions in feet. Stage illusions are big and awkward, and the listings say so.
- **Negatives** — card tricks, DVDs, posters, wedding dresses, Funko figures, magazines,
  and false friends like the *Audible Illusion* preamp and *Goldwing Illusion Blue*.

Verdicts: `grail · confirmed · likely · plans · maybe · rejected`.

Two rules stop most false positives:

- **Topicality gate** — price and bulk alone can never qualify a listing. Without a
  magic-domain term or a named illusion/builder it is rejected, however expensive.
- **Word-boundary anchoring** — patterns compile as `\b(?:…)`. Without it `aga`
  matched inside "ma**ga**zine" and turned a lot of 1924 magazines into an Aga Levitation.

Discounts are suppressed whenever a negative matched, so a $75 *poster* of a sawing
illusion is never sold to you as "99% off".

---

## What each source is actually worth

Measured on a real deep sweep (2,974 raw listings):

| Source | Raw | Verdict |
|---|---|---|
| **eBay** | 2,484 | Volume leader — most raw listings, most noise to filter. |
| **Magic Auction** | 96 | Highest signal per listing. A dedicated used-illusion market: nearly half survive grading, and it publishes its own `its-a-steal-sale` and `reduced` categories. Everything is an auction, so prices are floors. |
| Craigslist | 433 | 40 metros; genuine finds are rare but they're the cheap ones. |
| The Magic Café | 101 | Leads, not listings — but this is where grails surface first. |
| AliExpress | 191 | Works, but ~all sub-$20 close-up props. Floating tables are the exception. |
| Potter & Potter | 7 | Auction events, incl. *Houdini Returns: The Centennial Auction*. |
| Alibaba | 0 | **CAPTCHA-blocked**, including supplier storefronts and from a clean browser profile. Manual link only. |
| Facebook | — | **Login-walled.** `facebook.com/usedmagicillusions` returns a "Log In" page with no posts to anyone unauthenticated. Manual link only. |

Alibaba answers the first request then locks out the search endpoint. Homepage priming
(the trick that beats eBay) does not help. Rather than build a CAPTCHA solver, the app
marks the source blocked and gives you a one-click link to run the search yourself.

---

## Layout

```
server.mjs           Express + SSE live scan progress
lib/
  lexicon.mjs        The canon: illusions, builders, scale signals, negatives
  classify.mjs       Scoring, verdicts, deal maths
  browser.mjs        Shared Chrome context, cookie priming, asset blocking
  engine.mjs         Runs sources, classifies, dedupes, merges
  store.mjs          Persistence, "new since last scan", price-drop tracking
  sources/           ebay · craigslist · alibaba · aliexpress · magiccafe · potter
tools/
  test-classify.mjs  Regression suite over known junk and known real illusions
  reclassify.mjs     Re-grade the stored corpus after a lexicon change — no re-scraping
```

`npm test` after any lexicon edit. `npm run reclassify` re-scores everything on disk
in milliseconds, so you can tune the vocabulary without hammering the sources.

## Tuning it

Add an illusion you care about to `ILLUSIONS` in `lib/lexicon.mjs` with its typical new
price and it immediately becomes searchable, scorable and deal-tracked. Add a builder to
`BUILDERS` at `grail` tier and anything they made jumps to the top of the page.

Data lives in `data/` (`listings.json`, `state.json`, `user.json` for saves/hides).
Nothing leaves your machine.

## Shadow-scoring listings with TypeSafe Jev (off by default)

`lib/jev.mjs` can score every graded listing with TypeSafe Jev — one request asking whether
it's a genuine full-size stage illusion, what kind of thing it is, and whether it's actually
purchasable — next to the classifier's own verdict, purely for offline comparison. It never
changes what a scan shows: it's off unless `JEV_SHADOW=1`, it fails open (a Jev error just
means no row gets logged), and it never does arithmetic on Jev's answer. Turning it on for a
real scan appends one JSONL row per listing to `data/jev-shadow.jsonl`.

The questions and criteria live in `jev.config.json`. To measure it offline against
what's already on disk, without scanning anything:

```bash
node tools/jev-export.mjs > shadow-inputs.jsonl
python3 ~/.claude/skills/jev-savings/scripts/shadow.py jev.config.json illusion_relevance shadow-inputs.jsonl
```

See `shadow/illusion_relevance/summary.json` for agreement and the reliability table, and
`shadow/illusion_relevance/labels.jsonl` for the hand-checked sample. `npm test` also runs
`tools/test-jev.mjs`, which checks the off-by-default contract and that only named fields
(title, description, price, source) ever leave the process.
