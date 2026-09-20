export type TigerPayCashCommand = {
  id: string;
  command: string;
  status: string;
  error: string | null;
  snapshot_id?: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function queueTigerPayCashCommand(input: {
  command: "refresh" | "close";
  shop?: string;
  date?: string;
  signal?: AbortSignal;
}): Promise<TigerPayCashCommand> {
  const res = await fetch("/api/bank/tiger-pay/cash-command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      command: input.command,
      shop: input.shop ?? "1",
      date: input.date,
    }),
    signal: input.signal,
  });
  if (!res.ok) {
    throw new Error("Unable to queue hopper command");
  }
  const json = (await res.json()) as { command: TigerPayCashCommand };
  const queued = json.command;
  if (!queued?.id) {
    throw new Error("Unable to queue hopper command");
  }

  for (let i = 0; i < 20; i += 1) {
    await sleep(1500);
    if (input.signal?.aborted) {
      return { ...queued, status: "cancelled", error: "cancelled" };
    }
    const poll = await fetch(`/api/bank/tiger-pay/cash-command/${queued.id}`, {
      cache: "no-store",
      signal: input.signal,
    });
    if (!poll.ok) continue;
    const body = (await poll.json()) as { command: TigerPayCashCommand };
    const current = body.command;
    if (current?.status === "done" || current?.status === "failed") {
      return current;
    }
  }

  return {
    ...queued,
    status: "timeout",
    error: "รอเครื่องนานเกินไป — ลองรีเฟรชหน้าอีกครั้ง",
  };
}
