import { AsyncLocalStorage } from "node:async_hooks";
const outcomes = new AsyncLocalStorage<{ failed: boolean }>();
/** Only called by the Auth.js signOut event after Auth.js CSRF validation. */
export function markLogoutFailure(): void { const outcome = outcomes.getStore(); if (outcome) outcome.failed = true; }
/** Auth.js catches event errors; discard its cookie-clearing response on failed persistence. */
export function confirmLogoutResponse(run: () => Promise<Response>): Promise<Response> {
  return outcomes.run({ failed: false }, async () => {
    const response = await run();
    if (outcomes.getStore()?.failed) return Response.json({ error: { code: "session_revocation_unavailable" } }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return response;
  });
}
