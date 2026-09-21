"""Call the configured AI provider for real, once, and check what came back.

    python scripts/live_ai_check.py

Everything else in the test suite intercepts HTTP, which proves the parse and
the filters but never that the endpoint, header and model name are right today.
This is the one script that puts a packet on the wire.

It checks the body, not the status code: a 200 carrying the wrong content-type,
an empty candidate list, or prose where JSON was asked for is a failure here.
Exits non-zero if the provider was not actually reached, so "it fell back to
mock" cannot read as a pass.
"""
from __future__ import annotations

import asyncio
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.core.config import settings  # noqa: E402

# Same reason as smoke_api.py: a verification run must not append to the
# operator's real analysis history.
_TMP = tempfile.TemporaryDirectory()
settings.database_path = str(Path(_TMP.name) / "live.db")

from backend.app.services.ai_service import AIService  # noqa: E402
from backend.app.services.analysis import summary  # noqa: E402
from backend.app.main import _demo_flows  # noqa: E402
from backend.app.services.analysis import analyse_flows  # noqa: E402
from backend.app.services.store import store  # noqa: E402


def main() -> None:
    if not settings.ai_api_key:
        print("AI_API_KEY is empty — nothing to verify. Set it in .env.")
        raise SystemExit(1)

    analyse_flows(_demo_flows())
    svc = AIService()
    print(f"provider={svc.provider}  model={settings.ai_model}")
    print(f"flows={len(store.flows)}  alerts={len(store.alerts)}  "
          f"incidents={len(store.incidents)}\n")

    failures: list[str] = []
    for name, coro in [
        ("explain", lambda: svc.explain(next(iter(store.alerts.values())),
                                        None)),
        ("ask", lambda: svc.ask("which host is the biggest risk, and why?",
                                summary(), list(store.alerts.values()))),
        ("report", lambda: svc.report(summary(), list(store.alerts.values()),
                                      list(store.incidents.values()))),
    ]:
        out = asyncio.run(coro())
        got = out.get("provider")
        ok = got == svc.provider
        print(f"{name}: provider={got} {'ok' if ok else 'FELL BACK'}")
        if not ok:
            # ai_service already printed the provider's own message; the summary
            # at the bottom repeats it once. No need for a third copy here.
            failures.append(f"{name}: {svc.last_error}")
            continue

        # A live 200 is not the check. The body is.
        text = json.dumps(out)
        if name == "report":
            missing = {"executive_summary", "key_observations", "priorities",
                       "caveats", "data_notice"} - set(out)
            if missing:
                failures.append(f"report: missing {sorted(missing)}")
            print(f"      {out['executive_summary'][:150]}")
            for p in out["priorities"][:3]:
                print(f"      - {p['target']}: {p['why'][:60]} -> {p['next_step'][:60]}")
        else:
            print(f"      {(out.get('summary') or out.get('answer') or '')[:150]}")

        # §46 / §66, on real model output rather than a fixture.
        for word in ("confirmed", "definitely", "proves"):
            if word in text.lower():
                failures.append(f"{name}: certainty language survived: {word!r}")
        for word in ("isolate", "quarantine", "block the"):
            if word in text.lower():
                failures.append(f"{name}: out-of-scope action survived: {word!r}")

    print()
    if failures:
        print(f"{len(failures)} problem(s):")
        for failure in failures:
            print(f"  - {failure}")
        raise SystemExit(1)
    print(f"live {svc.provider} verified on all three endpoints")


if __name__ == "__main__":
    main()
