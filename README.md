# gustavodev.pt

Source of [gustavodev.pt](https://gustavodev.pt), my portfolio: a short introduction, experience, and a page for each project.

Plain HTML and one stylesheet, with no build step. Vercel serves it with clean URLs (`vercel.json`), so `marmita/index.html` is `/marmita`.

```
home.html           portfolio (served at /; `vercel.json` sends marmita.gustavodev.pt to `marmita/`)
marmita/            project pages
subagent-city/
toque/
myanimal/
assets/             stylesheet, favicon and project images
eu/                 private portal on eu.gustavodev.pt (sign-in required, see middleware.js)
```

Public pages are the portfolio and the project pages; anyone can read them. Private pages live in `eu/`
and are served on eu.gustavodev.pt, where `middleware.js` sends anyone without a signed-in session to
`/entrar`. A project can have both: gustavodev.pt/toque presents Toque, eu.gustavodev.pt/toque shows my
own Toque data, read from Toque's API through the `/toque-api` rewrite with the portal session.

To preview locally, serve the folder with any static server, for example `python3 -m http.server`.
