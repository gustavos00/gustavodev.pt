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
```

To preview locally, serve the folder with any static server, for example `python3 -m http.server`.
