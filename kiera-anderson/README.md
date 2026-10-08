# Kiera Anderson — demo storefront

A static, dependency-free website for **Kiera Anderson**, a *fictional* children's
clothing brand. Built as a front-end design exercise: there is no backend, no
payment processing and no way to place an order. Every product, price, review,
policy and person on the site is invented, and the site says so on every page.

## What's here

| File | Purpose |
| --- | --- |
| `index.html` | Home — hero, collection highlights, brand story, reviews, newsletter |
| `shop.html` | Collection grid with category / age filters and sorting |
| `product.html` | Product detail, driven by `?id=<product-id>` |
| `about.html` | Brand story, materials, timeline, size chart, repairs, contact |
| `404.html` | Not-found page |
| `assets/styles.css` | All styling — hand-written, no framework |
| `assets/sprite.js` | SVG garment symbols, re-coloured per colourway via CSS custom properties |
| `assets/data.js` | The 12-piece catalogue and the (invented) reviews |
| `assets/app.js` | Nav, bag drawer, filters, sorting, product page |

## Design notes

- **No images.** Every illustration is inline SVG, so the whole site is a few
  tens of kilobytes and nothing 404s. Garments are drawn once as `<symbol>`s and
  tinted per colourway through `--gm` / `--ga` / `--gl` custom properties, which
  cascade into `<use>` shadow content.
- **No build step and no dependencies.** Open `index.html` and it works. The only
  external request is the Google Fonts stylesheet (Fraunces + DM Sans).
- **The bag is local.** Items are kept in `localStorage` under `ka-bag-v1`, wrapped
  in `try`/`catch` so private windows and blocked site data degrade quietly. The
  checkout button deliberately does nothing.
- **Relative links throughout**, so the site works at any base path — at the root
  of a domain or under a GitHub Pages project subpath.
- Accessibility: skip link, visible focus rings, `aria-pressed` on the colour and
  size pickers, labelled SVGs, `prefers-reduced-motion` honoured.

## Running it locally

```sh
cd kiera-anderson
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publishing

`.github/workflows/kiera-anderson-pages.yml` in the repository root uploads this
folder to GitHub Pages on pushes to the default branch, and can also be run
manually from the Actions tab.
