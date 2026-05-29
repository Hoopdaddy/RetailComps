# Tractor Supply Cart and Checkout PM Workbench

A local-first competitive monitoring workspace for a Tractor Supply product manager tracking retailer cart and checkout experiences.

## What It Does

- Tracks priority retailers across cart and checkout.
- Saves screenshots in browser storage for period-over-period review.
- Compares screenshots visually when a new capture is added.
- Maintains an editable feature matrix for cart and checkout capabilities.
- Exports and imports workspace data as JSON.

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
