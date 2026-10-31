# Architecture and decisions

## Agreed decisions (31 October 2026)

| Decision | Detail |
|---|---|
| Name | **PlayTinker** for now; will change |
| Business model | **Free for everyone.** No adverts, no selling data |
| Audience | **No minimum or maximum age.** Designed with children in mind, focused on better prompting; anyone can use it |
| Images | **ChatGPT** for image creation (team-side) |
| Building | **Claude** for building the platform; Claude also planned to power Pip and checks in-platform |
| Source code | **GitHub** |
| Hosting | **Fly.io** |
| Checks | **AI checks, and always outputs its reasoning:** verdict, justification, evidence, confidence, review flag, checker/version |
| Public games | **Allowed if a parent or guardian approves**, after passing the Creator's Check; can be withdrawn |
| Explaining the stack | A public **Build your own** page explains ChatGPT, Claude, GitHub and Fly.io |

## The concept today

```
Browser ──► Fly.io machine (Node 22 + Express)
             ├── pages/*  wrapped in layout.html
             ├── /public  static assets + games (sandboxed iframes)
             └── /api/prompt-check, /api/creators-check  (rule-based demo)
```

- **No database, no cookies, no analytics, no third-party requests.** Fonts are self-hosted.
- **Strict security headers:** CSP `default-src 'self'`, no inline scripts, frame-ancestors self.
- **Games are isolated:** `sandbox="allow-scripts"` without `allow-same-origin` gives each game an opaque origin.

## The check record (the key design decision)

Both demo endpoints return the same shape that Claude will return in production:

```json
{
  "kind": "creators-check",
  "checker": { "mode": "demo-rules", "engine": "...", "version": "0.1.0", "futureEngine": "Claude via server-side AI gateway" },
  "checkedAt": "2026-10-31T09:00:00.000Z",
  "score": 80,
  "result": "ready | needs-work",
  "criteria": [
    { "id": "ownership", "label": "Ownership", "status": "pass | work | missing",
      "justification": "Why this verdict was given", "evidence": ["quoted text"], "confidence": "high | medium | low" }
  ],
  "review": { "recommended": true, "reasons": ["Borderline result...", "Possible personal information..."] },
  "badgeEligible": false,
  "disclaimer": "Automated check..."
}
```

Review is recommended automatically when: any answer is too short to judge confidently, the score is borderline (55–74), or possible personal information is detected. In the real platform these records are stored against the project version, so parents, teachers and moderators can audit and overrule them.

## Next steps towards the real platform

1. **AI gateway:** add `lib/ai-gateway.js`, which calls the Claude API server-side with `ANTHROPIC_API_KEY` stored as a Fly secret (`fly secrets set ANTHROPIC_API_KEY=...`). Ask Claude for JSON matching the schema above, then validate it. Keep the rule-based checker as a fallback.
2. **PII filter before every AI call** (already exists in `lib/checks.js` as `piiFindings`). Extend it.
3. **Accounts:** parent-created child accounts (managed auth plus Fly Postgres), so public sharing approval can be real.
4. **Creator Studio:** CodeMirror editor, Pip chat, sandboxed preview on a **separate domain** for user-generated games, and version history.
5. **Moderation queue** for games that a parent has approved for public view.
6. **Privacy:** DPIA, UK GDPR and ICO Children's Code review, and legal and safeguarding advice before any real user data.

## Open questions

- Final name and domain
- Funding model to sustain a free service (grants, sponsorship, donations?)
- Approach to age assurance and parental consent, given there are no age limits
- Whether adults without children get a self-managed account
