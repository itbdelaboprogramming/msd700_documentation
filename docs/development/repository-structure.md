# Repository Structure

<RoleBadge role="developer" />

## This repository (documentation site)

This repository (`msd700_documentation`) contains only the VitePress documentation site - it does not contain the MSD700 Server or Unit source code.

```
msd700_documentation/
├── docs/                        # VitePress site source
│   ├── .vitepress/
│   │   ├── config.mts           # site config: nav, sidebar, search, etc.
│   │   └── theme/                # custom theme (extends the default theme)
│   │       ├── index.ts          # registers global components
│   │       ├── custom.css        # site-wide style overrides
│   │       └── components/       # LinkCard(s), RoleBadge, etc.
│   ├── index.md                 # homepage
│   ├── getting-started/         # end-user docs
│   ├── setup/                   # technician / deployment docs
│   └── development/             # developer docs (this section)
├── scripts/
│   ├── deploy.sh                 # builds the site and swaps it into docs/.vitepress/dist
│   ├── webhook-listener.mjs      # GitHub webhook receiver that triggers deploy.sh on push to main
│   ├── apache-snippet.conf       # ProxyPass rules for the Apache front end
│   └── systemd/                  # systemd units for the preview server and webhook listener
├── package.json
└── package-lock.json
```

### How the docs site is deployed

::: details Deployment pipeline (click to expand)
1. A push to `main` triggers a GitHub webhook.
2. `scripts/webhook-listener.mjs` verifies the webhook signature (HMAC SHA-256) and, on a `push` event to `refs/heads/main`, spawns `scripts/deploy.sh`.
3. `deploy.sh`:
   - refuses to run if the working tree has local changes, or if a deploy is already in progress (via `flock`)
   - fetches and hard-resets to `origin/main`
   - runs `npm ci`
   - builds the site into a fresh `docs/.vitepress/dist_new` directory
   - atomically swaps it into `docs/.vitepress/dist` (a plain `mv`, so the running preview server picks up new content with no restart/downtime)
4. `docs/.vitepress/dist` is served by a long-running `vitepress preview` process (systemd unit `msd700-docs-preview`, port `4700`).
5. Apache proxies `/itbdelabo/docs` → `http://localhost:4700/itbdelabo/docs`, and `/services/msd700-webhook` → the webhook listener on `127.0.0.1:4701` (see `scripts/apache-snippet.conf`).
:::

::: warning
`vitepress preview` in this project's VitePress version (`2.0.0-alpha.19`) doesn't honor `vite.preview.port` from config - the port is set via `--port`/`--strictPort` CLI flags in `package.json`'s `docs:preview` script and in the systemd unit. Keep both in sync if the port ever changes.
:::

## MSD700 product codebase

::: info TODO
If the MSD700 Server and/or Unit firmware live in separate repositories, link them here and give a one-line summary of each.
:::

## Related

- [Contributing](/development/contributing) - local dev workflow
- [Architecture](/development/architecture)
