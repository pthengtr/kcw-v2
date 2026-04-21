import type { KbStatusState } from "../types";

export function KbStatusBanner({
  created,
  saved,
  deleted,
  error,
}: KbStatusState) {
  if (error) {
    let message = "Something went wrong.";

    if (error === "create_failed") message = "Create failed.";
    else if (error === "update_failed") message = "Update failed.";
    else if (error === "delete_failed") message = "Delete failed.";
    else if (error === "invalid_id") message = "Invalid FAQ id.";
    else if (error === "invalid_delete_id") message = "Invalid delete id.";

    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {message}
      </div>
    );
  }

  if (created) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        FAQ created.
      </div>
    );
  }

  if (saved) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        FAQ saved.
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        FAQ deleted.
      </div>
    );
  }

  return null;
}
