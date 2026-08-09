# Contributing

<RoleBadge role="developer" />

How to work on this documentation site locally.

## Local development

```bash
npm install
npm run docs:dev       # dev server with hot reload, http://localhost:5700/itbdelabo/docs/
npm run docs:build     # production build -> docs/.vitepress/dist
npm run docs:preview   # serve the production build on port 4700
```

::: warning
The site is served under the base path `/itbdelabo/docs/` (see `base` in [`docs/.vitepress/config.mts`](https://github.com/itbdelaboprogramming/msd700_documentation/blob/main/docs/.vitepress/config.mts)) to match the Apache `ProxyPass` path in production. Local URLs include this prefix too.
:::

## Adding a page

1. Add a `.md` file under `docs/getting-started/`, `docs/setup/`, or `docs/development/` depending on the audience.
2. Add it to the matching `sidebar` entry in `docs/.vitepress/config.mts` so it's navigable.
3. Cross-link it from the relevant section's `index.md` (use the `<LinkCards>` / `<LinkCard>` components already used on those pages) and from any related pages.

## Custom components

This site extends VitePress's default theme (`docs/.vitepress/theme/`) with two global components, usable directly in any `.md` file:

- `<RoleBadge role="user | technician | developer" />` - marks which audience a page is for.
- `<LinkCards>` / `<LinkCard title="…" details="…" link="…" icon="…" />` - a card grid for section landing pages.

## Commit conventions

Commits in this repo loosely follow `type: short summary` (e.g. `fix: …`, `chore: …`). Keep the summary in the imperative mood and under ~70 characters.

## Deployment

Deployment is automatic: pushing to `main` triggers a webhook that rebuilds and swaps in the new site. See [Repository Structure](/development/repository-structure) for the full pipeline.

## Related

- [Repository Structure](/development/repository-structure)
- [Architecture](/development/architecture)
