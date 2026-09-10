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
  "buildCommand":   "npm --workspace=@omr/shared run build && npm --workspace=@omr/game-engine run build && npm --workspace=@omr/game run build",
  "installCommand": "npm install --workspaces --include-workspace-root",
  "outputDirectory": "apps/game/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

1. **installCommand** — installs every workspace (`apps/*` and `packages/*`)
   with hoisting disabled, so each app's `node_modules/@omr/*` becomes a
   proper symlink to the matching package in `packages/`. This is what makes
   `import { … } from '@omr/shared'` work in the game.
2. **buildCommand** — three `npm --workspace=<name> run build` calls chained
   with `&&`. Every step is **workspace-explicit**, so it works regardless
   of what the current working directory is:
   - `npm --workspace=@omr/shared run build` — builds shared types
   - `npm --workspace=@omr/game-engine run build` — builds game engine
   - `npm --workspace=@omr/game run build` — typechecks + Vite builds the
     game. The Vite memory bump (`NODE_OPTIONS='--max-old-space-size=4096'`)
     is baked into `apps/game/package.json`'s `build` script so the cross-
     platform inline env-var approach (which doesn't survive
     `npm --workspace=` indirection) doesn't matter.
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
`buildCommand` in `vercel.json` runs the shared builds first
exactly to avoid this. If you override the build command in the
Vercel UI, make sure the shared packages still build first.

### "Missing script: build:shared" with `workspace @omr/game@0.1.0`

After `npm install --workspaces`, npm's CLI interprets `npm run`
relative to whichever workspace you're "in" — and a bare
`npm run build:shared` then looks for the script in
`apps/game/package.json`, where it doesn't exist. The fix is to
**always target a workspace explicitly** when running root-level
scripts from a chain:

```bash
# ❌ fails — npm looks inside the current workspace
npm run build:shared

# ✅ works — npm jumps to the named workspace
npm --workspace=@omr/shared run build
npm --workspace=@omr/game-engine run build
```

This is what `vercel.json` does.

### "cd: apps/game: No such file or directory" mid-build

When Vercel runs `npm --workspace=@omr/X run build`, it then
executes the build inside `packages/X/`. A subsequent
`cd apps/game` in the same `&&`-chained command **fails** because
the relative path resolves against `packages/X/`, not the repo
root. The fix is to never chain a `cd` after a
`npm --workspace=` invocation — invoke the next workspace directly:

```bash
# ❌ fails — cwd is now packages/shared, apps/game doesn't exist
npm --workspace=@omr/shared run build && cd apps/game && npm run build

# ✅ works — every step is workspace-explicit
npm --workspace=@omr/shared run build && \
  npm --workspace=@omr/game-engine run build && \
  npm --workspace=@omr/game run build
```

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
