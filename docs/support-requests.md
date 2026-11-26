# Support requests

Staff open `/support` in kcw-v2 and choose a **kind**:

| Kind | What happens |
|------|----------------|
| `bug` / `improvement` | Pick an exact **kcw-api service** (incl. **LINE แชทบอท**), **kcw-v2 page**, or BI report; describe the change, optionally attach images/PDFs. HQ agent opens a PR and merges; status → `waiting`. |
| `data_query` | Ask a data question. Pick an **HQ data** domain (Supabase / KSS / kss-pc PARTS9 / kcw-analytic GDrive, or all). HQ agent investigates and posts an `answered` event; status → `waiting` (no PR). |

## Flow (code tickets)

1. Ticket row in `public.support_tickets` (`pending`).
2. HQ `kcw-support-worker` claims it, downloads attachments to `.support-attachments/{id}/`, runs local `agent -p --force` in a git worktree of the matching repo.
3. Worker pushes a branch, `gh pr create`, `gh pr merge --squash`.
4. Status → `waiting`. Requester closes (`done`) or reopens with a comment.

## Flow (data_query)

1. Same ticket table; `kind = data_query`, `target_source = hq-data`.
2. Worker runs local `agent` from `SUPPORT_DATA_QUERY_CWD` (default `~/projects/kcw-analytic`) with a read-oriented prompt covering:
   - Supabase (kcw)
   - HQ KSS PARTS9
   - SYP kss-pc PARTS9
   - `/home/hqadmin/mnt/gdrive/KCW-Data/kcw_analytics`
3. Agent stdout is stored as `support_ticket_events.event_type = answered`.
4. Status → `waiting` for the requester to close or reopen.

## Worker (HQ only)

```bash
systemctl --user enable --now kcw-support-worker.service
# unit: projects/kcw-api/scripts/systemd/kcw-support-worker.service
# → ~/.config/systemd/user/kcw-support-worker.service
```

Needs in `kcw-api/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, DB engine vars, `CURSOR_API_KEY`, and `gh` auth for GitHub (code tickets). Optional: `SUPPORT_DATA_QUERY_CWD`.

### Hang / stuck `running` prevention

Tickets only get claimed from `pending`. If the worker is killed mid-ticket (deploy bounce, SIGTERM), the row used to sit in `running` forever.

Guards now in place:

1. **Startup reclaim** — on boot, every leftover `running` ticket is moved back to `pending` (`requeued` event).
2. **Stale reclaim** — poll loop also requeues `running` older than `SUPPORT_STALE_RUNNING_MINUTES` (default ~50m, above agent timeout).
3. **Graceful stop** — SIGTERM/SIGINT requeues the in-flight ticket before exit.
4. **Deploy** — `hq-linux-deploy.sh` no longer restarts the support worker by default. Use `RESTART_SUPPORT_WORKER=1` only when support-worker code itself changed.
