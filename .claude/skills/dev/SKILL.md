---
name: dev
description: Start the Etappe local dev environment — the PocketBase backend (npm run pb) and the Vite frontend (npm run dev), both in the background — then report the URLs. Use when asked to start or run the dev server, bring up the app, or serve Etappe locally.
---

# Start the Etappe dev server

Bring up both processes and report the URLs. They must run together: PocketBase
serves the API, hooks and migrations on :8090; Vite serves the SPA on :5173 and
proxies `/api` and `/_` through to PocketBase, so the app runs same-origin.

## Steps

1. **Node 20.** `npm run dev` needs Node 20 — the machine default is CCP4's
   Node 16 and will not work. Prefix every Bash call in this skill with:

   ```
   export NVM_DIR="$HOME/.nvm"; \. "$NVM_DIR/nvm.sh"; nvm use 20 >/dev/null
   ```

   (The PocketBase binary is Node-independent, but keep the prefix for
   consistency.)

2. **Ensure the binary exists.** If `./bin/pocketbase` is missing, run
   `npm run pb:setup` before starting anything.

3. **Don't double-start.** Check each port and start only what's down:
   - backend up? `curl -sf http://127.0.0.1:8090/api/health`
   - frontend up? `curl -sf http://127.0.0.1:5173`

4. **Start the backend** with the Bash tool's `run_in_background: true`:
   `npm run pb` — then wait for `http://127.0.0.1:8090/api/health` to return 200.

5. **Start the frontend** with `run_in_background: true`:
   `npm run dev` — then wait for `http://127.0.0.1:5173` to answer.

6. **Report** to the user, concisely:
   - App: http://localhost:5173
   - PocketBase admin: http://127.0.0.1:8090/_/
   - Both run in the background; to stop them, kill the background jobs (or
     Ctrl-C if they were started in a terminal).

## Notes

- Always use `run_in_background: true` for the two servers so they survive
  across turns. Do not block the foreground waiting on them.
- Create an admin for the PocketBase UI with (the `--dir` is essential — the
  CLI defaults to `bin/pb_data`, but the server uses `pb_data`, so without it
  the admin lands in the wrong database and login fails):
  `./bin/pocketbase superuser upsert <email> <password> --dir=pb_data`
- Register a normal account on the app's own login screen — that flow creates
  the owner trip_members row via `pb_hooks/membership.pb.js`.
- `pb_data/` is local and gitignored; delete it to reset all local data, then
  the servers re-run migrations on next start.
