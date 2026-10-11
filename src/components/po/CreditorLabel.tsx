"use client";

import type { MouseEvent } from "react";

import { creditorIdentity } from "@/lib/po/creditor";

export default function CreditorLabel({
  code,
  name,
  onCodeClick,
}: {
  code: string | null;
  name: string | null;
  onCodeClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const identity = creditorIdentity({ code, name });
  if (!identity.code && !identity.name) return <>—</>;

  const codeNode = identity.code ? (
    onCodeClick ? (
      <button
        type="button"
        className="font-mono text-left text-primary underline-offset-2 hover:underline"
        onClick={onCodeClick}
      >
        {identity.code}
      </button>
    ) : (
      <span className="font-mono">{identity.code}</span>
    )
  ) : null;

  if (!identity.name) return codeNode;

  return (
    <span className="block min-w-0 text-left">
      <span className="block">{identity.name}</span>
      {codeNode ? <span className="mt-0.5 block text-xs text-muted-foreground">{codeNode}</span> : null}
    </span>
  );
}
