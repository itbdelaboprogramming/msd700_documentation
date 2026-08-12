---
search: false
---

# Contributing

<RoleBadge role="developer" />

Two different things live under "contributing" here: working on the **MSD700 product** (`ros-web-ui`, `msd700_robot`, `msd700_noetic`, `ROS-dashboard-next-ts`), and working on **this documentation site**. They're covered separately below.

## Product development workflow

The safe way to test a server-side change is the `server_dev` Compose profile: a separate database,
separate ports, and a separate MQTT broker from production, so nothing you do here can touch a real
operator's session:

```bash
cd ros-web-ui
docker compose --profile server_dev up -d --build
```

The dev stack follows a project-wide port scheme, offset from production so both can run at once:

| Service | Prod | Dev |
| --- | --- | --- |
| ROS master | `11311` | `11312` |
| rosbridge | `9090` | `9091` |
| MQTT (HiveMQ, TLS) | `8883` | `8884` |
| MySQL | `3307` | `3308` |
| Backend API | `5000` | `5001` |
| Dashboard | `3000` | `3100` |

A robot points itself at the dev peer with `--dev` (`./scripts/docker-manager.sh up --dev` from
`msd700_noetic`, or `--dev` to `run_msd.sh` directly). This only changes which cloud it enrols
against and talks MQTT to; it does **not** touch the robot's own local service ports, which stay the
same in both cases (every unit runs its own stack regardless of which cloud it peers with).

::: warning
Don't run `server_prod` and `server_dev` on the same host casually; see the note in
[Prerequisites](/setup/prerequisites#for-the-msd700-server-cloud-dashboard-side).
:::

For robot-side development, `msd700_noetic`'s `src/` is bind-mounted into the container, so editing
a launch file, a Python node, or a script under `src/` takes effect on the next `up`, no rebuild
needed. A rebuild (`docker-manager.sh build`) is only required when a *dependency* or the base image
changes.

### Adding a new backend endpoint

`backend_node` under `ros-web-ui/source/dependencies/ROS-dashboard-backend/scripts/` is where
`/api/*`, `/user/*`, `/unit/*` and `/local/*` live; `admin_api.js`, `enroll_api.js`, and `sync_api.js`
are separate Express routers mounted at `/admin/api`, `/enroll`, and `/sync` respectively. See
[API Reference](/development/api-reference) for what already exists before adding something that
overlaps it.

## Working on this documentation site

### Local development

```bash
npm install
npm run docs:dev       # dev server with hot reload, http://localhost:5700/itbdelabo/docs/
npm run docs:build     # production build -> docs/.vitepress/dist
npm run docs:preview   # serve the production build on port 4700
```

::: warning
The site is served under the base path `/itbdelabo/docs/` (see `base` in [`docs/.vitepress/config.mts`](https://github.com/itbdelaboprogramming/msd700_documentation/blob/main/docs/.vitepress/config.mts)) to match the Apache `ProxyPass`/`Alias` path in production. Local URLs include this prefix too.
:::

### Adding a page

1. Add a `.md` file under `docs/getting-started/`, `docs/setup/`, or `docs/development/` depending on the audience.
2. Add it to the matching `sidebar` entry in `docs/.vitepress/config.mts` so it's navigable.
3. Cross-link it from the relevant section's `index.md` (use the `<LinkCards>` / `<LinkCard>` components already used on those pages) and from any related pages.

### Custom components

This site extends VitePress's default theme (`docs/.vitepress/theme/`) with two global components, usable directly in any `.md` file:

- `<RoleBadge role="user | technician | developer" />` - marks which audience a page is for.
- `<LinkCards>` / `<LinkCard title="…" details="…" link="…" icon="…" />` - a card grid for section landing pages.

### The Documentation section is access-gated in production

Every page under `/development/` requires an HTTP login when served from `msd.nglobal.jp`. See
[Repository Structure](/development/repository-structure#how-the-docs-site-is-deployed) for how the
site is served, and ask an existing maintainer for the credentials if you don't have them yet. This
only applies to the deployed site: `npm run docs:dev` and `docs:preview` run locally with no gate.
New pages under `docs/development/` should keep the `search: false` front-matter line already
present on the others in that section, so their content doesn't end up embedded in the public search
index bundle that ships to every visitor regardless of the login gate.

### Commit conventions

Commits in this repo loosely follow `type: short summary` (e.g. `fix: …`, `chore: …`). Keep the summary in the imperative mood and under ~70 characters.

### Deployment

Deployment is automatic: pushing to `main` triggers a webhook that rebuilds and swaps in the new site. See [Repository Structure](/development/repository-structure) for the full pipeline.

## Related

- [Repository Structure](/development/repository-structure)
- [Architecture](/development/architecture)
