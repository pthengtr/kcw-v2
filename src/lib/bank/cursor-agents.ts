export type CursorAgentLaunchResult = {
  agentId: string;
  agentUrl: string;
  runId: string;
  status: string;
};

export async function launchCursorCloudAgent(params: {
  promptText: string;
  name?: string;
  apiKey?: string;
  repoUrl?: string;
  startingRef?: string;
}): Promise<CursorAgentLaunchResult> {
  const apiKey = params.apiKey ?? process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error("Missing CURSOR_API_KEY");
  }

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
