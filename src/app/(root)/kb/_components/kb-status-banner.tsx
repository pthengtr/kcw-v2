import type { KbStatusState } from "../types";

export function KbStatusBanner({
  created,
  saved,
  deleted,
  image_uploaded,
  image_deleted,
  error,
}: KbStatusState) {
  if (error) {
    let message = "Something went wrong.";

    if (error === "create_failed") message = "Create failed.";
    else if (error === "update_failed") message = "Update failed.";
    else if (error === "delete_failed") message = "Delete failed.";
    else if (error === "invalid_id") message = "Invalid FAQ id.";
    else if (error === "invalid_delete_id") message = "Invalid delete id.";
    else if (error === "no_images_selected") message = "No images selected.";
    else if (error === "invalid_image_type")
      message = "Only image files are allowed.";
    else if (error === "image_upload_failed") message = "Image upload failed.";
    else if (error === "image_delete_failed") message = "Image delete failed.";
    else if (error === "invalid_image_delete")
      message = "Invalid image delete request.";

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

  if (image_uploaded) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        Image uploaded.
      </div>
    );
  }

  if (image_deleted) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        Image deleted.
      </div>
    );
  }

  return null;
}
