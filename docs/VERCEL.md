# Deploying ONE MORE RUN to Vercel

## TL;DR

This is an npm-workspaces monorepo. The Vercel project is configured at the
**repo root** with `vercel.json` pointing at `apps/game` for output.

```
vercel.json (root)     ──► installs all workspaces, builds shared first,
                          then apps/game, outputs to apps/game/dist.
```

## Vercel project settings

| Setting             | Value                                  |
| ------------------- | -------------------------------------- |
| Framework Preset    | **Vite** (auto-detected from `apps/game/vite.config.ts`) |
| Root Directory      | `.` (the repo root — leave empty)      |
| Build Command       | (overridden by `vercel.json`)          |
| Output Directory    | (overridden by `vercel.json`)          |
| Install Command     | (overridden by `vercel.json`)          |
| Node Version        | 20.x (default is fine)                 |

You don't need to change anything in the Vercel UI; just import the GitHub
repo and the `vercel.json` does the rest.

## What `vercel.json` does

```json
{
  "buildCommand":   "npm run build:shared && NODE_OPTIONS='--max-old-space-size=4096' npm run build --workspace=@omr/game",
  "installCommand": "npm install --workspaces --include-workspace-root",
  "outputDirectory": "apps/game/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

1. **installCommand** — installs every workspace (`apps/*` and `packages/*`)
   with hoisting disabled, so each app's `node_modules/@omr/*` becomes a
   proper symlink to the matching package in `packages/`. This is what makes
   `import { … } from '@omr/shared'` work in the game.
2. **buildCommand** — first builds `@omr/shared` and `@omr/game-engine`
   into their `dist/` folders (this is where the `.d.ts` files come from
   that the game typechecks against), then builds the game.
3. **outputDirectory** — Vite's default build output (`dist/`) lives in
   `apps/game/dist`.
4. **rewrites** — SPA fallback so client-side routes and direct-link
   refreshes work.

## Local reproduction

```bash
npm install                     # workspaces symlink
npm run build:shared            # builds @omr/shared, @omr/game-engine to dist/
npm run build --workspace=@omr/game   # typecheck + vite build
# → apps/game/dist/  (deployable to any static host)
```

## Common errors and fixes

### "Cannot find module '@omr/shared'"

The shared packages weren't built before the game was. The
`buildCommand` in `vercel.json` runs `npm run build:shared` first
exactly to avoid this. If you override the build command in the
Vercel UI, make sure the shared packages still build first.

### "JavaScript heap out of memory" during `vite build`

Vite is memory-hungry on large Phaser bundles. The
`NODE_OPTIONS='--max-old-space-size=4096'` in the build command
gives the Node process 4 GB. If you still hit this, split the
game into more lazy-loaded chunks via `import()`.

### Implicit-any errors in `GameScene.ts`

These only appear when `@omr/shared` / `@omr/game-engine` failed to
build and their `.d.ts` files are missing, so all imported types
become `any` and the strict `noImplicitAny` flag fires on every
downstream callback. Fix the upstream build first; the errors
disappear.

## Server

The reward server (`apps/server`) is **not** deployed to Vercel —
it's a long-running Node process with a private key and an in-memory
rate limiter. Deploy it to a host that supports persistent processes
(Railway, Fly.io, Render, your own box). Set `SERVER_URL` in
`apps/game/src/api/server.ts` (or via env at build time) to point
the client at it.

## Contracts

`contracts/` is Hardhat — purely for local development and testnet
deployment from your own machine. Never deploy from Vercel.
