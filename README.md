# GenesisX — Everything Built So Far

## Status at a glance

| Piece | Status | Deployable now? |
|---|---|---|
| `backend/` | Phase 1+2 complete — real API, database schema, auth, 2FA | **Yes** — deploy to Railway, works standalone |
| `admin-tool/` | UI complete, still running on in-memory demo data | Looks done, but not wired to `backend/` yet |
| `client-dashboard/` | UI complete, still running on generated demo data | Looks done, but not wired to `backend/` yet |
| `landing-page/` | Complete, your real license/entity details included | Yes, but see cautions below before it goes public |

**The short version:** the backend is the only piece that's a real, working system right
now. The two dashboards are polished UI shells — every click updates local browser
state that disappears on refresh, and nothing they do reaches the database yet. That
wiring is Phase 3, not done yet.

## backend/

Deploy this to Railway now if you want — it's self-contained and doesn't depend on
the frontends. Full instructions are in `backend/README.md`: add a Postgres plugin,
set `JWT_SECRET` and `ALLOWED_ORIGIN`, run migrations, seed your Owner account, enroll
2FA. Once deployed you can test it directly with curl/Postman even with no UI
attached — the API documentation is in that README too.

## admin-tool/dashboard.jsx

Single React file. Client accounts, deposits/withdrawals (tx-hash required,
pending→processed two-step), trade logging, live BTC price, reconciliation check.
Runs standalone as a demo — refresh the page and all data resets. Phase 3 will replace
the in-memory state with real calls to `backend/`.

## client-dashboard/client-dashboard.jsx

Single React file. Real-time balance, 1W/1M/3M/6M/1Y historical performance view
(actual trade P&L, not a promised rate), equity chart, live BTC price. Currently shows
generated demo trade history, not real data. Same Phase 3 wiring needed.

## landing-page/index.html

Public marketing page. Contains the entity name, NYDFS license number, fee structure,
and contact details exactly as you provided them — **not independently verified**.
Risk disclosure section is placeholder text, clearly marked in the page itself,
pending your lawyer's review. See the cautions list below before this goes live
anywhere public.

## Before any of this touches real clients or money

1. Verify "GenesisX" and license 464945549 yourself on NYDFS's public registry.
2. Get the placeholder risk disclosure replaced with lawyer-reviewed language.
3. Reconsider the personal Gmail + residential address on the public landing page.
4. Finish Phase 3 (wire the UIs to the real backend) before trusting any balance shown
   on screen — right now both dashboards can show numbers that were never saved
   anywhere.
5. Fixed-term deposits, advertised/guaranteed APR, and withdrawal lock-ups are
   deliberately not built anywhere in this project. That combination is what turned
   Celsius, BlockFi, and Voyager into regulatory and criminal cases — it needs a
   securities lawyer's sign-off on the specific structure before it's built, not a
   backend decision.

## What's left (Phase 3+)

- Wire `admin-tool` and `client-dashboard` to call the real `backend/` API instead of
  local state
- Client self-service password reset
- Exportable statements (PDF/CSV) per client
- Automatic wallet-balance pull for reconciliation (currently manual entry)
- Rate limiting beyond login, automated backups, deployment hardening
