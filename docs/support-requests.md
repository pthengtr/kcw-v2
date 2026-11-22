# Support requests

Staff open `/support` in kcw-v2, pick an exact **kcw-api service** or **kcw-v2 page**, describe the bug/improvement, and optionally attach images/PDFs.

## Flow

1. Ticket row in `public.support_tickets` (`pending`).
2. HQ `kcw-support-worker` claims it, downloads attachments to `.support-attachments/{id}/`, runs local `agent -p --force` in a git worktree of the matching repo.
3. Worker pushes a branch, `gh pr create`, `gh pr merge --squash`.
4. Status → `waiting`. Requester closes (`done`) or reopens with a comment.

## Worker (HQ only)

```bash
systemctl --user enable --now kcw-support-worker.service
# unit: projects/kcw-api/scripts/systemd/kcw-support-worker.service
# → ~/.config/systemd/user/kcw-support-worker.service
```

Needs in `kcw-api/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, DB engine vars, `CURSOR_API_KEY`, and `gh` auth for GitHub.
