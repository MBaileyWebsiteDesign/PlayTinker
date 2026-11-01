# PlayTinker: concept website

> **Working name.** PlayTinker will be renamed. This is a concept preview, not a launched product.

A free place to **play** original browser games, **create** your own with AI as a helper, and **master** real software skills. It's designed with children in mind, especially for getting better at prompting, but it's open to any age.

**The child is the creator. AI is the tool. Learning is the product.**

## What's in this concept

| Page | What it shows |
|---|---|
| `/` | Vision, three pillars, Creator's Check, promises |
| `/play` | Game library with two working games. Each has **Play**, **Inspect** (real code and explanations) and **Remix** (change settings live) |
| `/create` | How creating works, plus a working **Prompt Builder** demo with an explained check report |
| `/studio` | The **Creator Studio**: make and test a real game (see below) |
| `/academy` | The seven levels, XP, and a working **Creator's Check** demo |
| `/build-your-own` | How to build your own projects with **ChatGPT** (images), **Claude** (building), **GitHub** (files) and **Fly.io** (hosting) |
| `/parents` | Free, all ages, parent controls, public sharing with permission, classroom ideas, FAQ |
| `/safety` | Privacy and safety commitments, honest AI use, sandboxing |
| `/about` | Why it exists, status, how to help |

## Run it locally

```bash
npm install
npm run dev        # http://localhost:8080 (auto-reloads)
npm test           # 26 tests using Node's built-in test runner
```

Requires Node 20 or later. No AI keys or database are needed for the concept.

## Creator Studio (`/studio`)

Pick a starter (Catcher, Runner, Gem Dash or Blank), then make it your own:

- **Chat with Pip.** Every message gets a prompt score and a tip. Pip's changes are saved as a version automatically.
- **Code view** with Pip's lines highlighted in lilac and your own in orange. You can edit it directly (`Ctrl+Enter` runs, `Ctrl+S` saves).
- **Safe preview** at phone, phone sideways, tablet and desktop sizes, plus full screen.
- **Automatic tests** on every Run, in a hidden second sandbox: runs without errors, draws, animates, keyboard, touch, and stays inside the sandbox.
- **Checks**: the game check record (code + sandbox results + your test plan) with reasoning and a review flag.
- **Test plan**: starter tests, Pip's ideas and your own, each marked Works or Broken.
- **Versions**: see what changed and go back to any version.
- **Technical view**: console, `index.html` view, full check JSON and **Export** (ZIP ready for GitHub Pages).

Projects are saved in the browser (localStorage) only. Nothing is uploaded.

### Turning on AI mode for Pip

Without a key, Pip runs in **practice mode**: it changes the Settings block, explains each section, helps with error messages and suggests tests. To let Pip write real code with Claude, set the key as a Fly secret (never in the code):

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-... --app playtinker-concept-staging
fly secrets set ANTHROPIC_API_KEY=sk-ant-... --app playtinker-concept
```

Optional: `PIP_MODEL` (default `claude-sonnet-5-5`) and `PIP_RATE_LIMIT` (requests per 10 minutes per visitor, default 30). Messages that look like they contain personal information are never sent to the AI.

## Branches and deployment

| Branch | Purpose | Deploys to |
|---|---|---|
| `staging` | Work in progress. Test changes here first | Fly app `playtinker-concept-staging` (`fly.staging.toml`) |
| `main` | Live site. Only merge from `staging` once checked | Fly app `playtinker-concept` (`fly.toml`) |

Workflow: branch from `staging`, open a pull request into `staging`, check the staging site, then open a pull request from `staging` into `main`.

### One-time Fly.io setup

1. Install flyctl and sign in: `fly auth login`.
2. Create both apps (names must be unique on Fly; if taken, change `app` in both toml files):
   ```bash
   fly apps create playtinker-concept
   fly apps create playtinker-concept-staging
   ```
3. Create a token that can deploy both apps and add it in GitHub (*Settings → Secrets and variables → Actions*) as `FLY_API_TOKEN`:
   ```bash
   fly tokens create org -x 999999h
   ```
   Copy the whole output, including the `FlyV1 ` prefix.
4. Push to `staging` or `main`. `.github/workflows/fly-deploy.yml` runs the tests, then deploys to the matching app.

Manual deploys: `fly deploy` (production) or `fly deploy --config fly.staging.toml` (staging).

Both apps run in London (`lhr`) on one small shared machine that stops when idle, which keeps costs minimal. Check Fly.io's current pricing and set a spending limit.

## Project structure

```
server.js            Express server: layout, security headers, demo API
layout.html          Shared header/footer
pages/               One HTML fragment per page
lib/checks.js        Prompt Builder and Creator's Check logic (explainable output)
lib/pip.js           Pip: Claude gateway (when ANTHROPIC_API_KEY is set) + PII filter + rate limit
lib/pip-demo.js      Pip practice mode (rule-based, same response shape)
lib/game-check.js    Automatic game checks for the Studio
lib/studio-templates.js, templates/   Starter games
sandbox/runner.html  Safe preview runner (strict CSP, loop guard, automatic tests)
public/js/studio/    Studio front end (editor, versions, zip export)
public/css, js       Styles and small browser scripts (no frameworks)
public/games/        Each game = index.html + game.js; games.json = library metadata
public/img           Artwork (made with ChatGPT), optimised to WebP
public/fonts         Self-hosted Fredoka, Nunito Sans, JetBrains Mono (no Google calls)
test/                Automated tests
Dockerfile, fly.toml Fly.io packaging and config
docs/                Architecture and decisions
```

## Adding a game

1. Create `public/games/<id>/index.html` and `game.js` (copy an existing game).
2. Read remixable settings from `URLSearchParams` at the top of `game.js`.
3. Add an entry to `public/games/games.json` with `params` (Remix sliders) and `explain` (Inspect notes).

Games load in `<iframe sandbox="allow-scripts">`, so they can't access the site, cookies or accounts.

See `docs/ARCHITECTURE.md` for how the real platform will grow from here.
