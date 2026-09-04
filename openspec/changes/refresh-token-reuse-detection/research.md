# Research: refresh-token-reuse-detection

> Hybrid artifact store: this FILE is authoritative. Engram mirror at topic key
> `sdd/refresh-token-reuse-detection/research`. Companion to `exploration.md`.
> Research lane selected by the maintainer after exploration; completion was
> mandatory before `sdd-propose`.

## Summary of Findings

1. **RFC 9700 requires *some* form of relationship retention, but not a format or duration.**
   §4.14.2 says rotation must retain "information about the relationship" between old and new
   tokens — but never specifies how long, or as what data shape. All four of our options (a–d) are
   compliant implementations of this MUST, as long as *something* survives long enough to make
   detection possible.
2. **The RFC's own revocation requirement on detected reuse is narrower than what real vendors do.**
   RFC 9700 §4.14.2 says the server "will revoke the active refresh token" — singular, current
   token — not explicitly "the whole family" or "all sessions". Auth0, Okta and Salesforce all go
   further than the spec's floor.
3. **A real "fifth option" exists in production code, but it does not fully sidestep retention.**
   The Doorkeeper Ruby OAuth gem implements grant-level reuse detection via a
   `previous_refresh_token` pointer column, but it still keeps revoked token rows present (not
   deleted) to make the check work — it optimises *cascade revocation*, not retention itself.
4. **Every major vendor checked (Auth0, Okta, AWS Cognito) ships a grace/overlap window
   specifically to avoid the false-positive problem we are worried about** — and none of this is
   spec-mandated; it is vendor invention responding to real production race conditions.
5. **Okta's documented default grace window is 30 seconds** — the same number we already use.
   Auth0's default is undocumented publicly. Cognito's is configurable up to 60s, disabled (0s) by
   default.
6. **A secondary source (Lucid TechBlog) explicitly recommends "no more than 60 seconds or so"**
   for the grace window and names five vendors (Auth0, Okta, Fitbit, Slack, Lucid) as already
   implementing one — but nobody publishes a false-positive *rate*.
7. **Revocation scope on detection is consistently "the grant" or "tokens since that
   authentication", not "every session of the user everywhere".** Okta explicitly scopes to "all
   access tokens issued since the user authenticated" — one authentication event, not the account's
   other logins in other apps.
8. **No spec or vendor documentation was found stating that the reuse-detection response must be
   indistinguishable from an ordinary invalid-token error.** RFC 6749's generic `invalid_grant`
   error code happens to cover invalid/expired/revoked/mismatched cases together, which is
   suggestive but not a stated security requirement anywhere found.

## Lane 1 — RFC 9700 and the OAuth specs

**RFC 9700 (OAuth 2.0 Security Best Current Practice), §2.2.2:**

> "Refresh tokens for public clients MUST be sender-constrained or use refresh token rotation as
> described in Section 4.14." [1]

This is a MUST, but scoped to public clients only. RFC 6749 already required confidential-client
refresh tokens to be bound to the issuing client.

**RFC 9700, §4.14.2 ("Recommendations") — the single most load-bearing passage for this research:**

> "Authorization servers MUST utilize one of these methods to detect refresh token replay by
> malicious actors for public clients:
> - Sender-constrained refresh tokens...
> - Refresh token rotation: the authorization server issues a new refresh token with every access
>   token refresh response. **The previous refresh token is invalidated, but information about the
>   relationship is retained by the authorization server.** If a refresh token is compromised and
>   subsequently used by both the attacker and the legitimate client, one of them will present an
>   invalidated refresh token, which will inform the authorization server of the breach. The
>   authorization server cannot determine which party submitted the invalid refresh token, but
>   **it will revoke the active refresh token.**" [1]

Two things worth isolating precisely:

- The **retention requirement is functional, not temporal or structural.** The spec never says
  "retain rows", "retain for N days", or "retain a tombstone". It says relationship information
  must be retained — full stop. That is genuinely permissive of options (a), (b), (c) and (d)
  alike, provided each preserves *enough* relationship information for a reuse check to succeed.
  Notably, **option (b) capped at N=1, or a sufficiently aggressive reap under option (d), risks
  non-compliance** if the evidence is gone before a plausible attacker replay window closes. The
  RFC does not set that threshold, so this is a judgment call, not a spec violation either way.
- The **revocation scope the spec actually requires is narrower than most vendors implement.**
  "It will revoke the active refresh token" (singular) is the floor. Nothing in this text obligates
  revoking the whole family, cascading to already-issued access tokens, or logging out other
  sessions. Vendors that do more (Auth0, Okta, Salesforce — see Lanes 3, 4, 6) are exceeding the
  spec, not merely satisfying it.
- **No grace-period, leeway or race-condition language appears anywhere in RFC 9700's rotation
  text.** This was searched for specifically and none was found. The 30-second grace window this
  project already runs is not derived from the spec.

Also from RFC 9700, §4.2.4 (authorization codes — the sibling replay-detection mechanism in the
same document):

> "when an attempt is made to redeem a code twice, the authorization server SHOULD revoke all
> tokens issued previously based on that code" [1]

This is a SHOULD, and it is *stronger* than the refresh-token MUST above ("revoke all tokens" vs.
"revoke the active refresh token"). Worth noting because it shows the spec authors were willing to
write broader revocation language when they wanted to, and chose not to for refresh token reuse.

**RFC 6749, §5.2 — the `invalid_grant` error definition** (confirmed identically across two
independent fetches, high confidence):

> "The provided authorization grant (e.g., authorization code, resource owner credentials) or
> refresh token is invalid, expired, revoked, does not match the redirection URI used in the
> authorization request, or was issued to another client." [2]

Relevant to Lane 7: the baseline spec vocabulary already collapses "invalid", "expired" and
"revoked" into one shared error code, by original design — not stated as a security countermeasure,
just a single generic code.

**RFC 6749, §10.4 — flagged as low-confidence, do not treat as verbatim.** Two independent fetches
of this section returned materially different "verbatim" text. This is an inconsistency in the
research tooling's extraction, not a claim about the RFC itself. Both attempts agreed
directionally: refresh tokens must be protected against disclosure and are bound to the client.
**Independently verify §10.4's exact text before citing it as authoritative in the design doc.**

**RFC 6819 (OAuth 2.0 Threat Model), §5.2.2.3 "Refresh Token Rotation":**

> "Refresh tokens can automatically be replaced in order to detect unauthorized token usage by
> another party" [3]

This frames rotation purely as a *detection* mechanism, consistent with RFC 9700's later
formalisation. RFC 6819 also documents refresh-token theft vectors (§4.1.2 — compromised web
servers, native-client file-system access, device cloning) and countermeasures: binding to client
ID (§5.2.2.2), revocation capability (§5.2.2.4), device identification (§5.2.2.5). No
retention-duration or grace-window language was found here either.

## Lane 2 — Family/grant-level pointer tracking (the possible fifth option)

This is real, but more modest than the framing hoped for.

**Doorkeeper** (Ruby OAuth provider gem, used by GitLab among others) implements exactly the
mechanism described in the brief: a `previous_refresh_token` column.

> "Doorkeeper supports automatic refresh token reuse detection in the presence of a
> `previous_refresh_token` column in the `oauth_access_tokens` table", and "if a revoked refresh
> token is used, any 'related' access and refresh tokens are also revoked." [4][5]

**The important nuance:** this is a pointer *added alongside* row retention, not a substitute for
it. Doorkeeper does not delete the old row on rotation — it revokes it (sets `revoked_at`) and
keeps it present; the `previous_refresh_token` pointer is what lets the reuse check walk backward
through revoked-but-retained rows to find "related" tokens to cascade-revoke. **This directly
contradicts the hoped-for framing** that grant/family-level pointer tracking sidesteps the
retention tradeoff. In the one concrete, code-level implementation found, the pointer is an
*addition to* retention, used to make cascade revocation efficient. GitLab's own tracking issue for
enabling this feature independently confirms Doorkeeper's mechanism but adds no further
implementation detail. [5]

**django-oauth-toolkit** implements a comparable pattern via `REFRESH_TOKEN_REUSE_PROTECTION`
combined with `ROTATE_REFRESH_TOKEN`:

> "the server will check if a previously, already revoked refresh token is used a second time, and
> if it detects a reuse, it will automatically revoke all related refresh tokens." [6]

Same shape: revoked tokens are kept (marked revoked, not deleted) so the "already revoked" check is
possible at all.

**Duende IdentityServer** ships an explicit alternative to per-token retention: consumption
tracking via a single `ConsumedTime` timestamp field per token, rather than deleting on use.

> The `DeleteOneTimeOnlyRefreshTokensOnUse` flag "controls if such tokens are immediately deleted or
> consumed"; when consumption is chosen, "the `ConsumedTime` property will be set when the token is
> used, and if a token is received that has already been consumed", a customisable
> `AcceptConsumedTokenAsync` hook fires — "the default implementation rejects all consumed
> tokens." [7][8]

This is functionally close to option (c) — a compact marker rather than full deletion — but
implemented as a flag *on the token row itself*, not a separate tombstone table. It is a middle
ground the brief's four options do not precisely name: **mark instead of delete, on the same row,
until the row's own natural expiry.**

**Conclusion on Lane 2:** no real-world implementation was found that detects reuse *purely* by
comparing against a single current-family pointer with zero historical retention. Every concrete
mechanism located (Doorkeeper, django-oauth-toolkit, Duende) still keeps *some* record of used
tokens — a pointer or a flag layered on top of retained-but-marked rows, not a replacement for
retention. This is evidence against the framing that a "fifth option" avoids the tradeoff; it is
better read as a variant of a (b)/(c) hybrid — mark-in-place rather than delete — than as an escape
from retention entirely.

`UNSOURCED — inference`: this pattern (mark-in-place with a `consumed_at`/`revoked_at` column, keep
the row until its own TTL) may be the most common real-world shape precisely because it requires no
separate structure and no explicit reap-timing decision — but no vendor document states this as a
deliberate design rationale; it is inference from the concrete implementations above.

## Lane 3 — Auth0

**Rotation Overlap Period / reuse interval:**

> "Enter Rotation Overlap Period (in seconds) for the refresh token to account for leeway time
> between request and response before triggering automatic reuse detection... to avoid concurrency
> issues when exchanging the rotating refresh token multiple times within a given timeframe." [9]

A documented default or maximum value for this setting could **not** be confirmed through Auth0's
own current docs or the support-center article checked. Community posts show operators configuring
values like 3s and 10s, which indicates the practical range in use but not Auth0's shipped default.
**Flag as an evidence gap** — do not treat "Auth0 defaults to 0s" as confirmed.

**On detected reuse:**

> "If a previously invalidated token is used, the entire set of refresh tokens issued since that
> invalidated token was issued will immediately be revoked along with the grant, requiring the user
> to re-authenticate." [9]

This revokes at **grant** scope — roughly one client/app's session — not literally every session
the user has anywhere. Same shape as Okta (Lanes 4 and 6).

**During the overlap window itself**, per a secondary source (DEV Community writeup, corroborated
independently by the Lucid post in Lane 5): only the single immediately-preceding token is exempted
from triggering detection — replaying the token *before* that one still trips it. [10]

**Retention/storage:** Auth0's public docs contain no statement about how long used tokens are
retained internally to make detection work. Gap.

## Lane 4 — Okta / Keycloak / Duende

**Okta** (primary source, directly fetched):

> Grace period "is configurable between 0-60 seconds... The default is 30 seconds." "After the
> refresh token is rotated, the previous token remains valid for the configured amount of time to
> allow clients to get the new token." [11]
>
> On reuse: "Okta immediately invalidates the most recently issued refresh token and all access
> tokens issued since the user authenticated." [11]

This is the closest match to our own 30-second grace window found anywhere in this research — it is
Okta's documented default, not merely a config example. Scope on detection is "since the user
authenticated": one authentication event/session, consistent with Auth0's grant-scoped revocation,
not a whole-account wipe.

Okta logs dedicated events on detection (`app.oauth2.as.token.detect_reuse` /
`app.oauth2.token.detect_reuse`) [11] — evidence that at least one vendor treats this as a distinct,
auditable security event class, separate from ordinary token-expiry errors internally, whatever the
client-facing response looks like (see Lane 7).

**Keycloak** (secondary sources — blog and GitHub discussion, not Keycloak's own reference docs):

> "When Revoke Refresh Token is enabled, Keycloak checks whether a token has already been
> consumed... When a stolen refresh token is reused, Keycloak detects this and invalidates the
> entire session." Configuration is via `Revoke Refresh Token` + `Refresh Token Max Reuse`
> (recommended value 0 for strict one-time use). [12][13]

Keycloak's scope on detection is described as "the entire session" — a *different* granularity from
Auth0/Okta's "the grant". Keycloak's session concept can span multiple clients under one SSO login,
so this is arguably broader in practice, though vendor terminology differs enough that a precise
apples-to-apples comparison is not possible from public docs alone. No explicit documented
grace/leeway window for Keycloak was found; treat as a gap.

**Duende IdentityServer** — see Lane 2 for the consumption-marking mechanism. On the
false-positive/theft tension specifically, Duende's docs are unusually candid that this is a genuine
open design choice left to the implementer:

> "Your customized implementation could instead add a grace period to allow recovery after network
> failures or could treat this as a replay attack and take steps to notify the user and/or revoke
> their access." [7]
>
> On revocation scope if you choose to treat it as theft: "you could revoke all access for that
> client/user combination, which could include deleting refresh tokens, revoking access tokens...,
> and ending the user's server side session." [7]

Duende is the only vendor in this research that explicitly frames grace-period vs. theft-response as
a **deliberate tradeoff the operator must choose**, rather than shipping one default and documenting
only that.

## Lane 5 — False positives and window sizing

This is the thinnest evidence lane in terms of primary or quantitative data, stated plainly rather
than padded.

- **No vendor or spec publishes a false-positive rate.** This was searched for specifically and
  nothing quantitative was found from any source.
- The clearest secondary-source treatment is the Lucid TechBlog post, which names the exact scenario
  in our brief (multiple tabs, concurrent refresh):

  > "The theft detection strategy described above causes a false positive if a legitimate client
  > refreshes a token multiple times... if the user has multiple tabs open at the same time, each
  > tab tries to request the data, each request invokes a refresh..., and whichever refresh happens
  > second then triggers the theft detection, revoking the app's access." [10]
  >
  > Recommended fix: "After a refresh token is used, for a short window of time, allow it to be used
  > again (and return the same new tokens as the first time it was used)... The window should be no
  > more than 60 seconds or so." [10]

  It names five vendors it says already do this: "Auth0, Okta, Fitbit, Slack, and Lucid" [10].
  Auth0 and Okta were independently confirmed in Lanes 3–4; Fitbit, Slack and Lucid's own
  implementation were not — treat those three as secondary-sourced only.
- **AWS Cognito** offers the same pattern with an explicit ceiling in its primary documentation:

  > "you can also configure a grace period for the original refresh token of up to 60 seconds." Via
  > API: `RetryGracePeriodSeconds`, disabled (0) by default. [14]

  **Correction recorded during research:** an intermediate web-search summary produced while
  researching this lane claimed Cognito's docs describe explicit reuse-*detection* semantics. On
  directly fetching Cognito's own page, **no such sentence exists there.** The primary doc describes
  the grace period and states that revoking a refresh token cascades to its issued access/ID tokens,
  but it does **not** publicly document an automatic "reuse triggers cascade revocation" behaviour
  the way Auth0/Okta/Salesforce do. Flagged as a genuine evidence gap for Cognito specifically, and
  as a caution about trusting search-summarised claims without a direct-fetch check. [14]
- **No source recommends tying detection to something other than time** — e.g. idempotency keys as a
  replacement mechanism rather than as an implementation detail of the grace window. The "idempotent
  replay window" approach *is* the industry's answer to this problem: window size, not a
  fundamentally different signal.
- The WorkOS piece on the client-side race condition is adjacent but answers a different question:
  it fixes the *client's* lost-update race with a version/fencing-token conditional write, and says
  outright that this "cannot prevent replay detection at the provider level, which only the
  provider's grace period can address." [15] Useful confirmation that client-side and server-side
  race mitigation are two separate problems — our grace window is the server-side half.

## Lane 6 — Revocation scope on detection

Consistent pattern across every vendor with documented behaviour: **scope is "the grant" / "the
session" / "tokens since that authentication" — not the user's entire account across every app and
device.**

| Vendor | Documented scope on detected reuse |
|---|---|
| Auth0 | "the entire set of refresh tokens issued since that invalidated token was issued... along with the grant" [9] |
| Okta | "the most recently issued refresh token and all access tokens issued since the user authenticated" [11] |
| Keycloak | "invalidates the entire session" [12] |
| Salesforce | "revoke the current refresh token and all associated access tokens, forcing a full re-authentication" [16] |
| Duende | operator-chosen; documented option is "all access for that client/user combination" [7] |

No source found argues explicitly for "log the user out of every device/app", and none explicitly
argues *against* it with a stated rationale either — the vendors simply, consistently, scope to the
compromised grant/session/family. This functions as the OWASP Cheat Sheet's informally-stated best
practice:

> "implement token family tracking by assigning a shared FamilyId to all tokens in a session chain;
> if a previously consumed (rotated) refresh token is used again, it's a theft signal — revoke all
> tokens in that family and force the user to log in again." [17] (secondary source — cheat sheet,
> not a normative spec)

**No source explicitly distinguishes "revoke the family" from "revoke the user's every session"** as
a named, debated design choice with arguments on each side, despite direct searching. What exists
instead is uniform practice (family/grant scope) without an explicit stated rationale for not going
broader. That absence of an argued-out tradeoff is itself worth reporting as a gap.

## Lane 7 — Response shape

**No spec or vendor documentation was found stating that the reuse-detection response should (or
should not) be indistinguishable from an ordinary invalid-token 401**, despite direct searches for
this specific question.

What can be reported, honestly labelled by source type:

- RFC 6749 §5.2's `invalid_grant` code is, by original design, shared across invalid/expired/
  revoked/mismatched cases [2] — a generic code that happens to make reuse-detected and
  merely-expired tokens look the same at the error-code level, if an implementer chooses not to add
  more information. Suggestive, not stated.
- A secondary source (Nango's blog, explaining Google's behaviour) offers a plausible security
  rationale but attributes it to implementer choice, not to a spec requirement:

  > "it's impossible to know exactly why a refresh token was revoked, and detailed error messages
  > could potentially expose security vulnerabilities by revealing which specific condition
  > failed." [18]
- Countervailing evidence: **Microsoft Entra ID does the opposite** — it embeds distinguishing
  `AADSTS` codes in `error_description` (e.g. AADSTS50173 for revoked, AADSTS70000 for invalid) [18],
  meaning at least one major vendor does not treat indistinguishability as important enough to avoid.
- Okta logs a distinct internal event (`detect_reuse`) [11] but nothing in Okta's public docs states
  whether the *client-facing HTTP response* differs from an ordinary invalid-grant error — the
  distinguishing signal, if any, appears to stay server-side in the audit log rather than surface to
  the client.

**Conclusion: genuinely unresolved in public evidence.** Reported as a gap rather than reasoned into
an answer.

## How the evidence maps onto our four options

| Option | What the evidence supports | What the evidence undermines |
|---|---|---|
| **(a) Stop reaping, keep rows until family expiry** | RFC 9700 §4.14.2's retention requirement is satisfied trivially — the most conservative reading of "information about the relationship is retained" [1]. Doorkeeper and django-oauth-toolkit both keep revoked rows present rather than deleting them, which is directionally this option [4][6]. | Nothing found argues this is required at family-expiry scale (~1440 rows) specifically — the spec sets no duration, so the worst-case row count is our own engineering judgment, not spec-driven. |
| **(b) Cap rows per family (keep newest N)** | Consistent with the RFC's functional (not durational) retention requirement, provided N spans plausible attacker replay latency. No vendor was found implementing an explicit numeric cap, but nothing contradicts it. | Auth0's documented behaviour implies detection must work even for tokens *older* than the immediately-previous one [9][10], meaning even N=2 must be enough to catch anything beyond the grace window. A cap set too low (N=1) risks silently losing the ability to detect reuse of anything two or more rotations back — which no vendor evidence endorses. |
| **(c) Tombstone / compact structure on reap** | Duende's `ConsumedTime`-marking pattern (mark instead of delete) is the closest documented real-world analog, though it marks in-place rather than writing to a separate structure [7]. Satisfies RFC 9700's functional retention requirement with minimal storage. | The Doorkeeper "fifth option" hoped to replace this outright still needs retained (marked) rows [4][5] — no evidence of a *pure* separate-tombstone-only design in production that fully decouples from row retention. |
| **(d) Decouple reap interval from grace interval (30s grace, reap later)** | Directly supported by the AWS Cognito and Okta pattern of a short, distinct grace/overlap window (30–60s) unrelated to how long the server otherwise retains token state [11][14]. The only option that cleanly separates "how long do races get absorbed" from "how long is evidence kept" — matching how real vendors parameterise their systems. | None of the evidence gathered argues against this option. |

## Contradictions with our framing

1. **The "fifth option" (grant-level pointer, no per-token retention) does not exist as cleanly as
   hoped.** The closest real-world implementation (Doorkeeper) still retains marked/revoked rows;
   the pointer is an efficiency layer for cascade revocation, not a retention-avoidance mechanism.
   Every real implementation found still keeps *some* record of used tokens.
2. **RFC 9700's actual MUST for revocation scope is narrower than the framing implied.** The spec
   only requires revoking "the active refresh token" on detected reuse — not the whole family, not
   all sessions. Family-wide revocation is a vendor convention (universally followed, but not
   spec-mandated), not a compliance requirement.
3. **Our own 30-second grace window is not spec-derived — and that is fine, but worth naming.** It
   happens to match Okta's documented default exactly.
4. **No evidence supports or contradicts the framing that reaping "destroys the evidence detection
   needs" as an inevitable architectural fact** — that is true only under current behaviour
   (immediate reap past the grace window) and is precisely what all four options exist to fix. The
   spec's silence on retention duration means this is entirely an implementation decision.

## Evidence gaps

- **Auth0's default Rotation Overlap Period value** is not confirmed in current public docs.
  Community-reported values (3s, 10s) are configuration examples, not documented defaults.
- **AWS Cognito's actual reuse-detection behaviour beyond the grace window** is not explicitly
  documented in the primary source fetched.
- **Keycloak's grace/leeway window**, if one exists, was not found in the sources checked (all
  secondary — Keycloak's own reference manual was not directly fetched).
- **No quantitative false-positive rate data exists in any source found**, from any vendor or
  independent study.
- **No source explicitly argues "family scope" vs. "every session"** as a named debate with stated
  tradeoffs on each side.
- **Response shape (Lane 7) is essentially unaddressed in public documentation** — the one data
  point available (Microsoft's granular AADSTS codes) argues against universal indistinguishability
  as an industry norm.
- **RFC 6749 §10.4's exact text is unreliable through the research tooling** — two independent fetch
  attempts returned materially different content; verify independently before citing.

## Sources

1. RFC 9700 — OAuth 2.0 Security Best Current Practice, IETF RFC Editor.
   https://www.rfc-editor.org/rfc/rfc9700.html — §2.2.2 and §4.14.2 normative text on rotation and
   reuse detection (Lanes 1, 2, 6); §4.2.4 for the authorization-code sibling precedent.
2. RFC 6749 — The OAuth 2.0 Authorization Framework, IETF RFC Editor.
   https://www.rfc-editor.org/rfc/rfc6749.html — §5.2 `invalid_grant` definition (Lanes 1, 7); and
   (low-confidence, flagged) §10.4.
3. RFC 6819 — OAuth 2.0 Threat Model and Security Considerations, IETF RFC Editor.
   https://www.rfc-editor.org/rfc/rfc6819.html — §5.2.2.3 rotation-as-detection framing and §4.1.2
   threat vectors (Lane 1).
4. Doorkeeper gem `previous_refresh_token` reuse detection (doorkeeper-gem/doorkeeper wiki, PR #575,
   issues #1787, #815, #1058) — Lane 2's concrete "fifth option" implementation.
5. GitLab issue #364111 — "Enable Automatic Reuse Detection in Doorkeeper."
   https://gitlab.com/gitlab-org/gitlab/-/issues/364111 — independent confirmation of the
   `previous_refresh_token` mechanism (Lane 2).
6. django-oauth-toolkit issue #1404 and settings documentation.
   https://github.com/django-oauth/django-oauth-toolkit/issues/1404 ;
   https://django-oauth-toolkit.readthedocs.io/en/latest/settings.html —
   `REFRESH_TOKEN_REUSE_PROTECTION` mechanism (Lane 2).
7. Duende Software Docs — Refresh Token Service.
   https://docs.duendesoftware.com/identityserver/reference/v8/services/refresh-token-service/ —
   `DeleteOneTimeOnlyRefreshTokensOnUse`, `ConsumedTime`, `AcceptConsumedTokenAsync` (Lanes 2, 4, 6).
8. Duende Software Blog — "Reusing Refresh Tokens by Default in IdentityServer."
   https://duendesoftware.com/blog/20240405-refresh-token-reuse — corroborating context for [7].
9. Auth0 Docs — "Configure Refresh Token Rotation."
   https://auth0.com/docs/secure/tokens/refresh-tokens/configure-refresh-token-rotation — Rotation
   Overlap Period and grant-scoped revocation (Lanes 3, 6).
10. Lucid TechBlog — "Avoiding false positives in OAuth 2.0 refresh token theft detection."
    https://lucid.co/techblog/2023/09/18/avoiding-false-positives-in-oauth-2-0-refresh-token-theft-detection
    — secondary source; false-positive mechanism, ≤60s window recommendation, vendor list (Lane 5).
11. Okta Developer Docs — "Refresh access tokens and rotate refresh tokens."
    https://developer.okta.com/docs/guides/refresh-tokens/main/ — 30s default grace window, 0–60s
    range, reuse-detection scope and event logging (Lanes 4, 5, 6, 7).
12. skycloak.io blog — "Keycloak Refresh Token Rotation: Setup and Best Practices."
    https://skycloak.io/blog/keycloak-refresh-token-rotation-guide/ — secondary source; Keycloak's
    `Revoke Refresh Token` / `Refresh Token Max Reuse` mechanism (Lanes 4, 6).
13. GitHub discussion — keycloak/keycloak #10937, "Refresh token rotation and multi-tabs."
    https://github.com/keycloak/keycloak/discussions/10937 — secondary corroboration for [12].
14. AWS Cognito Developer Guide — "Refresh tokens."
    https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-refresh-token.html
    — primary source; `RetryGracePeriodSeconds` (up to 60s, default disabled) and revocation cascade
    (Lanes 4, 5); also used to correct an earlier inaccurate synthesis.
15. WorkOS Blog — "OAuth token refresh has a race condition. Fix it with a conditional write, not a
    distributed lock." https://workos.com/blog/oauth-refresh-token-race-condition — secondary source;
    client-side fencing-token pattern and its explicit limits (Lane 5).
16. Salesforce Refresh Token Rotation (RTR), via https://github.com/airbytehq/airbyte/issues/80783
    and https://nango.dev/blog/salesforce-oauth-refresh-token-invalid-grant/ — secondary sources;
    Salesforce's revocation scope on reuse (Lane 6).
17. OWASP Cheat Sheet Series — "OAuth2 Cheat Sheet."
    https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html — secondary/quasi-normative
    source; family-tracking best-practice framing (Lanes 2, 6).
18. Nango Blog — "Google OAuth invalid grant" and "Microsoft OAuth refresh token invalid_grant".
    https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked/ ;
    https://nango.dev/blog/microsoft-oauth-refresh-token-invalid-grant/ — secondary sources; generic
    error-code rationale and the Microsoft AADSTS counterexample (Lane 7).
