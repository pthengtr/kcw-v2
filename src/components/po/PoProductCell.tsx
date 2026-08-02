export default function PoProductCell({
  descr,
  mcode,
  detail,
}: {
  descr?: string | null;
  mcode?: string | null;
  /** PODET DETAIL field (alias for descr) */
  detail?: string | null;
}) {
  const d = (descr ?? detail)?.trim() || "";
  const m = mcode?.trim() || "";
  if (!d && !m) return <>—</>;
  return (
    <span className="line-clamp-2 break-words">
      {d || "—"}
      {m ? (
        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
          {m}
        </span>
      ) : null}
    </span>
  );
}
