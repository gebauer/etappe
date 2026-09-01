---
name: reload
description: Restart the running Etappe dev servers — Vite on :5173 and/or PocketBase on :8090 — by killing the old process and starting a fresh one in the background. Use when asked to reload, restart, bounce or bring back the dev server, or after a change Vite's HMR cannot pick up (vite.config, tailwind config, new dependency, .env, pb_hooks or pb_migrations).
---

# Reload the Etappe dev servers

Kill what's listening on the dev ports and start it again in the background.
Default to restarting **both** unless the user names one:

- "reload the frontend" / "restart vite" → :5173 only
- "reload pocketbase" / "restart the backend" → :8090 only

## Node ≥18.18

Every Bash call that runs npm needs a node satisfying `package.json`'s
`engines` (`>=18.18`) — the default `node` varies by machine. Prefix with:

```
export NVM_DIR="$HOME/.nvm"; \. "$NVM_DIR/nvm.sh"; nvm use --lts >/dev/null
```

`--lts`, not a pinned version — a specific version number fails outright if
that exact one was never installed via nvm on this machine.

## Steps

1. **Kill the listeners** for the ports you're restarting. This also cleans up
   an orphan holding the port after a crashed run:

   ```
   fuser -k 5173/tcp 2>/dev/null; fuser -k 8090/tcp 2>/dev/null; sleep 1
   ```

   Use only the ports in scope. Also stop the matching Claude Code background
   job with TaskStop if one is tracked from an earlier `/dev` — otherwise you
   accumulate dead job entries.

2. **Restart**, each with the Bash tool's `run_in_background: true`, from the
   repo root:
   - backend: `npm run pb`
   - frontend: `npm run dev`

   If both are coming back, start PocketBase first — Vite proxies `/api` and
   `/_` to it.

3. **Wait for ready**, don't assume:
   - `curl -sf http://127.0.0.1:8090/api/health`
   - `curl -sf http://127.0.0.1:5173`

   Poll a few times with a short sleep rather than one immediate check.

4. **Report** in one or two lines: what was restarted and the URL
   (http://localhost:5173). If a server logged an error on the way up, show
   that instead of claiming success.

## Notes

- A plain source edit under `src/` does not need this — Vite's HMR handles it.
  Reach for a reload for `vite.config.ts`, `tailwind.config.js`,
  `postcss.config.js`, an `npm install`, or a changed `.env`.
- PocketBase watches `pb_hooks/` and restarts itself on change, so a hook edit
  usually needs no reload; a migration or a `pb_data/` reset does.
- If the port is free and nothing was running, this is just a start — say so
  rather than reporting a restart.
- Never run the servers in the foreground; they must survive across turns.
