#!/usr/bin/env python3
"""SCREAMING DEAL alerts: email Dave from Jarvis when the radar finds one.

Reads data/listings.json (the last scan), applies the rules in alerts.config.json in code,
then runs the quality gate on what survives: one Haiku vision call writes a factual
description of the photo, and TypeSafe Jev (jev.config.json, site alert_quality) decides
whether it is professional-grade and a real photo. Code sends the mail; a Jev answer alone
never does (jev-savings rule 7).

Every candidate is recorded in data/alerts.json so nothing is mailed twice and nothing is
re-judged unless its price or photo changes. A gate error fails CLOSED: the listing is held
and retried next run, never mailed ungated.

Secrets and the recipient come from ~/Jarvis/config.json at run time, never from this repo.

Usage: alert.py [--dry-run] [--id LISTING_ID]
"""
import base64
import json
import os
import re
import smtplib
import ssl
import sys
import time
import urllib.error
import urllib.request
from email.message import EmailMessage
from html import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
LEDGER = os.path.join(DATA, "alerts.json")
JARVIS_CONFIG = os.path.expanduser("~/Jarvis/config.json")
VISION_MODEL = "claude-haiku-5-5"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")

sys.path.insert(0, os.path.expanduser("~/.claude/skills/jev-savings/scripts"))
import jev_client  # noqa: E402


def load(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save_ledger(ledger):
    tmp = LEDGER + ".tmp"
    with open(tmp, "w") as f:
        json.dump(ledger, f, indent=2)
    os.replace(tmp, LEDGER)


def money(n):
    return "${:,.0f}".format(n)


# ---- code gates -----------------------------------------------------------------------

def why_not(x, rules):
    """The first rule this listing fails, or None when it is a candidate."""
    price = x.get("price") or 0
    deal = x.get("deal") or {}
    if x.get("stale"):
        return "not seen in the last scan"
    if not (0 < price <= rules["max_price"]):
        return "price"
    if rules.get("firm_price_only") and x.get("priceIsFirm") is False:
        return "live auction, current bid is not the price"
    if x.get("verdict") not in rules["verdicts"]:
        return "verdict " + str(x.get("verdict"))
    if (x.get("jev") or {}).get("band") not in (None, "stage"):
        return "jev band " + x["jev"]["band"]
    if (deal.get("score") or 0) < rules["min_deal_score"] or (deal.get("pct") or 0) < rules["min_pct_off"]:
        return "not a screaming deal"
    names = {i.get("name") for i in x.get("illusions") or []}
    hit = names & set(rules["exclude_illusions"])
    if hit:
        return "excluded: " + ", ".join(sorted(hit))
    if not x.get("image"):
        return "no photo to judge"
    return None


# ---- quality gate ---------------------------------------------------------------------

def big_image(url):
    # eBay search thumbnails are s-l140..s-l500; the same path serves the full-size photo.
    return re.sub(r"/s-l\d+\.", "/s-l1600.", url) if "ebayimg.com" in url else url


def fetch_image(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read(5_000_000)
        ctype = (r.headers.get("Content-Type") or "image/jpeg").split(";")[0].strip()
    if ctype not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        ctype = "image/jpeg"
    return data, ctype


VISION_PROMPT = """This is the main photo from a used stage-illusion listing titled: {title}

Describe what the photo shows in 4 to 6 plain, factual sentences, for someone deciding whether
the prop is worth buying. Cover: what the object is and how much of it is visible; materials
and finish (hardwood, plywood, aluminium, laminate, paint, fabric, plastic) and how cleanly it
is made (edges, joins, hardware, lettering); signs of who built it (professional builder,
hobbyist, toy or party-store grade); condition (damage, wear, missing parts, peeling, stains);
and the photo itself (a real photo of this item, or a stock image, render, drawing, or show
photo; lighting and sharpness). Describe only; do not recommend or rate."""


def describe_photo(x, api_key, workspace_id):
    img, ctype = fetch_image(big_image(x["image"]))
    body = {
        "model": VISION_MODEL,
        "max_tokens": 400,
        "messages": [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": ctype,
                                         "data": base64.b64encode(img).decode()}},
            {"type": "text", "text": VISION_PROMPT.format(title=x["title"])},
        ]}],
    }
    headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    if workspace_id:
        headers["anthropic-workspace-id"] = workspace_id
    req = urllib.request.Request("https://api.anthropic.com/v1/messages",
                                 data=json.dumps(body).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            res = json.load(r)
    except urllib.error.HTTPError as e:
        # Keep the API's own reason (a usage cap, a bad image) in the ledger, not just "400".
        raise RuntimeError("vision %s: %s" % (e.code, e.read()[:300].decode("utf-8", "replace")))
    return "".join(b.get("text", "") for b in res.get("content", []) if b.get("type") == "text").strip()


def judge(x, site, model):
    """Jev answers for the quality questions, or None on any failure."""
    state = {
        "title": x["title"],
        "price": x.get("priceText") or money(x["price"]),
        "source": x.get("sourceLabel") or x.get("source") or "",
        "photo_description": x["_photo"],
    }
    res = jev_client.ask(state, site["questions"], site="live:alert_quality", model=model)
    if not res or not res.get("answers"):
        return None
    a = res["answers"]
    return {k: (a.get(k) or {}).get("noul") for k in site["questions"]}


# ---- email ----------------------------------------------------------------------------

def jarvis_account(cfg):
    for a in (cfg.get("mail") or {}).get("accounts") or []:
        if a.get("is_jarvis"):
            return a
    raise RuntimeError("no is_jarvis mail account in ~/Jarvis/config.json")


def build_email(x, judged, sender, to):
    deal = x["deal"]
    first = (x.get("illusions") or [{}])[0].get("name") or "Stage illusion"
    subject = "SCREAMING DEAL: {} for {} ({}% under {})".format(
        first, money(x["price"]), round(deal["pct"]), money(deal["ref"]))
    basis = ("the median of {} comparable listings".format(deal.get("comps"))
             if deal.get("basis") == "comps" else "the typical new price")
    builders = ", ".join(b["name"] for b in x.get("builders") or [])
    lines = [
        x["title"], "",
        "{} on {}, {}% under {} ({}).".format(money(x["price"]), x.get("sourceLabel", ""), round(deal["pct"]),
                                             money(deal["ref"]), basis),
    ]
    if builders:
        lines.append("Builder: " + builders)
    lines += ["", "What the photo shows: " + x["_photo"], "",
              "Quality gate: professional grade {:.0%}, real photo {:.0%}.".format(
                  judged["professional_grade"], judged["real_photo"]),
              "", x["url"], "", "Jarvis, via the Grand Illusion Radar"]
    text = "\n".join(lines)

    img = escape(big_image(x["image"]))
    url = escape(x["url"])
    src = escape(x.get("sourceLabel", ""))
    extra = (" · " + escape(builders)) if builders else ""
    html = f"""<div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#1b1712">
<p style="font:600 11px/1 -apple-system,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#a3741c;margin:0 0 10px">Screaming deal</p>
<h1 style="font-size:24px;line-height:1.2;margin:0 0 14px">{escape(x['title'])}</h1>
<a href="{url}"><img src="{img}" alt="" style="width:100%;border-radius:6px;display:block"></a>
<p style="font-size:30px;margin:18px 0 2px"><b>{money(x['price'])}</b>
<span style="font-size:15px;color:#6b5f50">&nbsp;{round(deal['pct'])}% under {money(deal['ref'])}</span></p>
<p style="font:14px/1.5 -apple-system,sans-serif;color:#6b5f50;margin:0 0 16px">{src} · against {escape(basis)}{extra}</p>
<p style="font:15px/1.55 -apple-system,sans-serif;margin:0 0 16px">{escape(x['_photo'])}</p>
<p style="font:12px/1.5 -apple-system,sans-serif;color:#8a7d6c;margin:0 0 22px">Quality gate: professional grade {judged['professional_grade']:.0%} · real photo {judged['real_photo']:.0%}</p>
<a href="{url}" style="display:inline-block;background:#1b1712;color:#f4e7c8;text-decoration:none;font:600 15px -apple-system,sans-serif;padding:12px 22px;border-radius:999px">Open the listing</a>
<p style="font:12px -apple-system,sans-serif;color:#8a7d6c;margin-top:28px">Jarvis, via the Grand Illusion Radar</p></div>"""

    msg = EmailMessage()
    msg["From"] = "Jarvis <%s>" % sender
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


def send(msg, account):
    host = account.get("smtp_host") or (account.get("host") or "smtp.gmail.com").replace("imap", "smtp")
    with smtplib.SMTP(host, int(account.get("smtp_port", 587)), timeout=30) as s:
        s.starttls(context=ssl.create_default_context())
        s.login(account["user"], (account.get("app_password") or "").replace(" ", ""))
        s.send_message(msg)


# ---- main -----------------------------------------------------------------------------

def main(argv):
    dry = "--dry-run" in argv
    only = argv[argv.index("--id") + 1] if "--id" in argv else None
    rules = load(os.path.join(ROOT, "alerts.config.json"), None)
    jcfg = load(os.path.join(ROOT, "jev.config.json"), None)
    site, model = jcfg["sites"]["alert_quality"], jcfg.get("model")
    th = site["thresholds"]
    listings = load(os.path.join(DATA, "listings.json"), [])
    ledger = load(LEDGER, {})

    cands = []
    for x in listings:
        if only and x.get("id") != only:
            continue
        if why_not(x, rules):
            continue
        prev = ledger.get(x["id"])
        if prev and prev.get("status") in ("sent", "rejected") \
                and prev.get("price") == x["price"] and prev.get("image") == x["image"]:
            continue
        cands.append(x)
    print(f"{len(listings)} listings, {len(cands)} candidate(s)")
    if not cands:
        return 0

    jarvis = load(JARVIS_CONFIG, {})
    brain = jarvis.get("brain") or {}
    api_key = brain.get("api_key") or ""
    if not api_key.startswith("sk-ant"):
        print("no Anthropic key in Jarvis config; holding all candidates")
        return 1
    account = jarvis_account(jarvis)
    to = (jarvis.get("mail") or {}).get("owner")
    if not to:
        print("no mail.owner in Jarvis config; holding all candidates")
        return 1

    for x in cands:
        entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "title": x["title"], "price": x["price"],
                 "image": x["image"], "url": x["url"], "deal_score": x["deal"]["score"]}
        try:
            x["_photo"] = describe_photo(x, api_key, brain.get("workspace_id"))
            judged = judge(x, site, model)
            if judged is None or None in judged.values():
                raise RuntimeError("jev returned no answer")
        except Exception as e:  # fail closed: hold, retry next run
            entry.update(status="held", reason=str(e)[:200])
            print("HELD  ", x["title"][:70], "|", entry["reason"])
            ledger[x["id"]] = entry
            continue
        entry.update(photo=x["_photo"], p=judged)
        ok = (judged["professional_grade"] >= th["send_min_professional_grade"]
              and judged["real_photo"] >= th["send_min_real_photo"])
        if not ok:
            entry.update(status="rejected", reason="quality gate")
            print("REJECT", x["title"][:70], judged)
        elif dry:
            print("WOULD SEND", x["title"][:70], judged)
            continue
        else:
            send(build_email(x, judged, account["user"], to), account)
            entry.update(status="sent")
            print("SENT  ", x["title"][:70], judged)
        ledger[x["id"]] = entry
    save_ledger(ledger)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
