# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
One working illusionist who already owns a Substitution Trunk and a levitation. He is hunting for more large stage illusions (crated, Henning and Copperfield scale) at prices well under the market. He checks the radar from a desk between other work. He opens a listing only when it is worth a second look.

## Product Purpose
The radar sweeps marketplaces and dealer sites for genuine stage illusions and throws out pocket tricks, plans-only listings and optical-illusion posters. It prices each find against observed market comps, so a real deal stands out. Success is that a screaming deal on a proper illusion is seen, judged and acted on before someone else buys it.

## Positioning
- A purpose-built stage-illusion lexicon and classifier (verdicts: grail, confirmed, likely, plans, maybe), checked by TypeSafe Jev.
- Deals are scored against real asking-price comps of the same class of object, never a guessed MSRP.
- Generic marketplace alerts can't do either of these.

## Operating Context
- The local server (`npm start`, localhost:7777) runs the Quick Scan and Deep Sweep with live progress over SSE.
- A static snapshot is published to GitHub Pages (`docs/`, `data.json`). That copy can't scan, and saves and hides stay in localStorage.
- A launchd job scans every 4 hours. Jarvis emails him about a screaming deal if it costs $1000 or less, passes a photo-quality gate, and isn't a sub trunk or a levitation.

## Capabilities and Constraints
- **Sources:** eBay, magicauction.com, Illusion Warehouse, Daytona Magic, Facebook "Used Magic Illusions", Craigslist, Alibaba, AliExpress, The Magic Café and Potter & Potter.
- **Blocked sources:** a source can come back ok, empty, error or blocked. A blocked source gives a manual URL.
- **Listing data:** a title, a photo (sometimes missing or broken), a price (sometimes missing), the source and a verdict. A listing may also carry matched illusions, builders, provenance, a deal {pct, ref, basis, provisional} and these flags: new, price cut, auction, lead, not re-seen.
- **Actions:** save, hide and open the listing.
- **Filters:** verdict, source, for sale only, hide non-illusions, deals only, saved, price range, text search, sort and list/gallery view.

## Brand Commitments
The name is "The Grand Illusion Radar".

## Evidence on Hand
- Real listing data is in `data/` and in the `docs/data.json` snapshot.
- Listing photos are hotlinked from their sources.
- There are no testimonials, customers or claims beyond the data.

## Product Principles
1. The deal is the headline. Price against comps leads, and its basis is always visible.
2. Be honest about uncertainty: provisional auction bids, small comp counts, blocked sources and "not re-seen" all show.
3. Photos sell illusions, and a janky prop should look janky.
4. Act fast: save, hide or open in one click.
