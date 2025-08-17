// migrate-reminder-images-to-uuid.mjs
// Migrate from:
//   pictures/public/reminder_bill/<safeImageId>_<random>.<ext>
//   pictures/public/reminder_payment/<safeImageId>_<random>.<ext>
// To:
//   pictures/public/reminder_bill/<reminder_uuid>/<image_uuid>
//   pictures/public/reminder_payment/<reminder_uuid>/<image_uuid>
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

// helper: strip extension
function baseName(nameOnly) {
  const dot = nameOnly.lastIndexOf(".");
  return dot >= 0 ? nameOnly.slice(0, dot) : nameOnly;
}

// helper: extract legacy <safeImageId> = everything before the LAST underscore
function extractLegacyPrefix(nameOnly) {
  const base = baseName(nameOnly);
  const lastUnderscore = base.lastIndexOf("_");
  return lastUnderscore > 0 ? base.slice(0, lastUnderscore) : base;
}

// ---- env ----
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
const DRY_RUN = String(process.env.DRY_RUN || "false").toLowerCase() === "true";
const REMOVE_OLD =
  String(process.env.REMOVE_OLD || "false").toLowerCase() === "true";

// ---- storage layout ----
const BUCKET = "pictures";
const SRC_DIRS = ["public/reminder_bill", "public/reminder_payment"];
const DIR_KIND = {
  "public/reminder_bill": "BILL",
  "public/reminder_payment": "PAYMENT",
};

// ---- legacy helpers (must match your app) ----
const imageRegex = /[^A-Za-z0-9ก-ฮ]/g;
const thaiConsonantMap = {
  ก: "k",
  ข: "kh",
  ฃ: "kh",
  ค: "kh",
  ฅ: "kh",
  ฆ: "kh",
  ง: "ng",
  จ: "ch",
  ฉ: "ch",
  ช: "ch",
  ซ: "s",
  ฌ: "ch",
  ญ: "y",
  ฎ: "d",
  ฏ: "t",
  ฐ: "th",
  ฑ: "th",
  ฒ: "th",
  ณ: "n",
  ด: "d",
  ต: "t",
  ถ: "th",
  ท: "th",
  ธ: "th",
  น: "n",
  บ: "b",
  ป: "p",
  ผ: "ph",
  ฝ: "f",
  พ: "ph",
  ฟ: "f",
  ภ: "ph",
  ม: "m",
  ย: "y",
  ร: "r",
  ล: "l",
  ว: "w",
  ศ: "s",
  ษ: "s",
  ส: "s",
  ห: "h",
  ฬ: "l",
  อ: "o",
  ฮ: "h",
};
const thaiConsonantRegex = new RegExp(
  `[${Object.keys(thaiConsonantMap).join("")}]`,
  "g"
);
const sanitizeId = (s) => (s ?? "").toString().replace(imageRegex, "");
const transliterateThaiConsonants = (t) =>
  t.replace(thaiConsonantRegex, (ch) => thaiConsonantMap[ch] || ch);
const legacyPrefix = (supplier_code, note_id) =>
  transliterateThaiConsonants(
    `${sanitizeId(String(supplier_code))}_${sanitizeId(String(note_id))}`
  );

// ---- supabase client ----
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// list all files in a folder (non-recursive) => full keys: "<dir>/<name>"
async function listAll(dir) {
  const out = [];
  let from = 0;
  const chunk = 1000;
  while (true) {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .list(dir, { limit: chunk, offset: from });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const o of data) {
      if (o.name) out.push(`${dir}/${o.name}`);
    }
    if (data.length < chunk) break;
    from += chunk;
  }
  return out;
}

async function main() {
  console.log(`Bucket: ${BUCKET}
  SRC_DIRS: ${SRC_DIRS.join(", ")}
  DRY_RUN=${DRY_RUN} REMOVE_OLD=${REMOVE_OLD}`);

  // 1) load reminders
  const { data: reminders, error: rErr } = await sb
    .from("payment_reminder")
    .select("reminder_uuid, supplier_code, note_id");
  if (rErr) throw rErr;

  // map legacy prefix -> reminder row
  const prefixToReminder = new Map();
  for (const r of reminders || []) {
    prefixToReminder.set(legacyPrefix(r.supplier_code, r.note_id), r);
  }

  // 2) already migrated legacy keys (so we can re-run safely)
  const existingLegacy = new Set();
  {
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await sb
        .from("payment_reminder_image")
        .select("legacy_key")
        .order("legacy_key", { ascending: true })
        .range(from, from + step - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data)
        if (row.legacy_key) existingLegacy.add(row.legacy_key);
      if (data.length < step) break;
      from += step;
    }
  }

  // 3) collect legacy objects
  const legacyObjs = [];
  for (const dir of SRC_DIRS) {
    const keys = await listAll(dir);
    for (const key of keys) {
      const nameOnly = key.slice(dir.length + 1);
      const prefix = extractLegacyPrefix(nameOnly) || "";
      if (!prefix) continue;
      legacyObjs.push({ dir, key, nameOnly, prefix, kind: DIR_KIND[dir] });
    }
  }

  // 4) migrate
  let copied = 0,
    inserted = 0,
    removed = 0,
    skippedNoReminder = 0,
    skippedAlready = 0;

  for (const obj of legacyObjs) {
    if (existingLegacy.has(obj.key)) {
      skippedAlready++;
      continue;
    }

    const reminder = prefixToReminder.get(obj.prefix);

    if (!reminder) {
      skippedNoReminder++;
      continue;
    }

    const image_uuid = crypto.randomUUID();
    const newKey = `${obj.dir}/${reminder.reminder_uuid}/${image_uuid}`; // no extension by request

    if (!DRY_RUN) {
      // copy
      const { error: copyErr } = await sb.storage
        .from(BUCKET)
        .copy(obj.key, newKey);
      if (copyErr) {
        console.error(
          "COPY failed",
          obj.key,
          "→",
          `${BUCKET}/${newKey}`,
          copyErr
        );
        continue;
      }
      copied++;

      // db record
      const { error: insErr } = await sb.from("payment_reminder_image").insert({
        reminder_uuid: reminder.reminder_uuid,
        image_uuid,
        storage_key: `${BUCKET}/${newKey}`, // store full path
        kind: obj.kind, // 'BILL' or 'PAYMENT'
        legacy_key: obj.key,
        legacy_prefix: obj.prefix,
      });
      if (insErr) {
        console.error("DB insert failed", insErr);
        continue;
      }
      inserted++;

      if (REMOVE_OLD) {
        const { error: rmErr } = await sb.storage
          .from(BUCKET)
          .remove([obj.key]);
        if (rmErr) console.error("REMOVE failed", obj.key, rmErr);
        else removed++;
      }
    }
  }

  console.log(`Done.
  Copied: ${copied}
  Inserted: ${inserted}
  Removed(old): ${removed}
  Skipped(already migrated): ${skippedAlready}
  Skipped(no matching reminder): ${skippedNoReminder}
  ${DRY_RUN ? "[DRY RUN]" : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
