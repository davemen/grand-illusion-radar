#!/usr/bin/env python3
"""Stdin/stdout bridge from lib/jev.mjs (Node) to jev_client.ask (Python).

Every Jev call is required to go through ~/.claude/skills/jev-savings/scripts/jev_client.py
(key from Keychain, secret redaction, PHI refusal, fail-open, decision log, state-hash cache) —
this repo does not reimplement any of that in JS. This script is a thin line-oriented bridge:
Node spawns it once per scan and pipes one JSON request per line on stdin, one JSON response
per line on stdout, so a single Python process interpreter start is amortized across a whole
scan's worth of listings instead of paid per listing.

Request  (one line): {"state": {...}}
Response (one line): {"answers": {...}, "input_tokens": N, "cost_usd": N, "latency_ms": N}
                  or: {"error": "..."}   (jev.mjs treats this the same as a Node-side failure: fail open)

Usage: jev-bridge.py CONFIG_PATH SITE
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
JEV_SAVINGS_SCRIPTS = os.path.expanduser("~/.claude/skills/jev-savings/scripts")
sys.path.insert(0, JEV_SAVINGS_SCRIPTS)
import jev_client  # noqa: E402


def main(argv):
    if len(argv) != 2:
        print(json.dumps({"error": "usage: jev-bridge.py CONFIG_PATH SITE"}), flush=True)
        return 2
    cfg_path, site_name = argv
    with open(cfg_path) as f:
        cfg = json.load(f)
    site = cfg["sites"][site_name]
    questions = site["questions"]
    model = cfg.get("model")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        t0 = time.time()
        try:
            req = json.loads(line)
            res = jev_client.ask(req["state"], questions, site="shadow:" + site_name, model=model)
            if res is None:
                print(json.dumps({"error": "jev_client returned null (see decisions.jsonl)"}), flush=True)
                continue
            usage = res.get("usage") or {}
            input_tokens = usage.get("input_tokens", 0)
            out = {
                "answers": res.get("answers"),
                "input_tokens": input_tokens,
                "cost_usd": round(input_tokens * jev_client.PRICE_PER_M_INPUT / 1e6, 10),
                "latency_ms": round((time.time() - t0) * 1000),
            }
            print(json.dumps(out), flush=True)
        except jev_client.PHIRefused as e:
            print(json.dumps({"error": "phi_refused: " + str(e)}), flush=True)
        except Exception as e:  # keep the bridge alive; jev.mjs fails this one call open
            print(json.dumps({"error": "%s: %s" % (type(e).__name__, e)}), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
