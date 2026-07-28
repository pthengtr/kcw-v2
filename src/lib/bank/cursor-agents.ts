export type CursorAgentLaunchResult = {
  agentId: string;
  agentUrl: string;
  runId: string;
  status: string;
};

export type CursorAgentRunStatus = {
  id: string;
  agentId: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  durationMs?: number | null;
  result?: string | null;
};

const TERMINAL_RUN_STATUSES = new Set([
  "FINISHED",
  "ERROR",
  "CANCELLED",
  "EXPIRED",
]);

export function isCursorRunTerminal(status: string): boolean {
  return TERMINAL_RUN_STATUSES.has(status.toUpperCase());
}

function requireCursorApiKey(apiKey?: string): string {
  const key = apiKey ?? process.env.CURSOR_API_KEY;
  if (!key) {
    throw new Error("Missing CURSOR_API_KEY");
  }
  return key;
}

export async function launchCursorCloudAgent(params: {
  promptText: string;
  name?: string;
  apiKey?: string;
  repoUrl?: string;
  startingRef?: string;
}): Promise<CursorAgentLaunchResult> {
  const apiKey = requireCursorApiKey(params.apiKey);

  const repoUrl =
    params.repoUrl ??
    process.env.CURSOR_AGENT_REPO_URL ??
    "https://github.com/pthengtr/kcw-v2";
  const startingRef =
    params.startingRef ?? process.env.CURSOR_AGENT_STARTING_REF ?? "master";

  const res = await fetch("https://api.cursor.com/v1/agents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      prompt: { text: params.promptText },
      repos: [{ url: repoUrl, startingRef }],
      autoCreatePR: false,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Cursor Agents API failed (${res.status})${detail ? `: ${detail}` : ""}`
    );
  }

  const data = (await res.json()) as {
    agent?: { id?: string; url?: string };
    run?: { id?: string; status?: string };
  };

  const agentId = data.agent?.id;
  const agentUrl = data.agent?.url;
  const runId = data.run?.id;
  if (!agentId || !agentUrl || !runId) {
    throw new Error("Cursor Agents API returned an incomplete response");
  }

  return {
    agentId,
    agentUrl,
    runId,
    status: data.run?.status ?? "CREATING",
  };
}

export async function getCursorAgentRun(params: {
  agentId: string;
  runId: string;
  apiKey?: string;
}): Promise<CursorAgentRunStatus> {
  const apiKey = requireCursorApiKey(params.apiKey);
  const res = await fetch(
    `https://api.cursor.com/v1/agents/${encodeURIComponent(params.agentId)}/runs/${encodeURIComponent(params.runId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Cursor Agents status failed (${res.status})${detail ? `: ${detail}` : ""}`
    );
  }

  const data = (await res.json()) as {
    id?: string;
    agentId?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    durationMs?: number | null;
    result?: string | null;
  };

  if (!data.id || !data.agentId || !data.status) {
    throw new Error("Cursor Agents status returned an incomplete response");
  }

  return {
    id: data.id,
    agentId: data.agentId,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    durationMs: data.durationMs,
    result: data.result,
  };
}
