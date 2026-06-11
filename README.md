# Hoop's Cart and Checkout PM Workbench

A local-first competitive monitoring workspace for a Tractor Supply product manager tracking retailer cart and checkout experiences.

## What It Does

- Tracks priority retailers across cart and checkout.
- Saves screenshots to a GitHub-backed library when the Vercel API is configured, with browser storage as a fallback.
- Compares screenshots visually when a new capture is added.
- Maintains an editable feature matrix for cart and checkout capabilities.
- Maintains lightweight screenshot metadata so the browser does not fill up as the library grows.

## Run Locally

```bash
npm start
```

Then open:

```text
http://localhost:4174/#cart-checkout
```

The app is static HTML, CSS, and JavaScript with a small local Node server.
Seed benchmark screenshots are embedded as lightweight visuals so the repo works without external assets.

## Screenshot Library Setup

The production site uses `api/screenshots.js` to save pasted screenshots into this GitHub repo:

```text
screenshots/<retailer>/<surface>/<device>/<period>-<timestamp>.jpg
data/screenshot-library.json
```

Set these Vercel environment variables:

```text
RETAILCOMPS_GITHUB_TOKEN=<fine-grained GitHub token with Contents read/write on this repo>
RETAILCOMPS_GITHUB_REPOSITORY=Hoopdaddy/RetailComps
RETAILCOMPS_GITHUB_BRANCH=main
```

Only the Vercel API sees the token. The browser sends the compressed screenshot to `/api/screenshots`; the API commits the image and metadata to GitHub.
