import "server-only";

type OpenAIEmbeddingResponse = {
  data?: Array<{
    embedding: number[];
  }>;
  error?: {
    message?: string;
  };
};

type BuildKbEmbeddingInputArgs = {
  title?: string | null;
  keywords?: string | null;
  content?: string | null;
  related?: string | null;
};

export function buildKbEmbeddingInput({
  title,
  keywords,
  content,
  related,
}: BuildKbEmbeddingInputArgs): string {
  return [
    title?.trim() ? `Title: ${title.trim()}` : "",
    keywords?.trim() ? `Keywords: ${keywords.trim()}` : "",
    content?.trim() ? `Content: ${content.trim()}` : "",
    related?.trim() ? `Related: ${related.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function toPgVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export async function generateKbEmbedding(input: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.KB_EMBEDDING_MODEL;
  const dimensionsRaw = process.env.KB_EMBEDDING_DIMENSIONS;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  if (!model) {
    throw new Error("Missing KB_EMBEDDING_MODEL");
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Cannot generate embedding for empty input");
  }

  const body: Record<string, unknown> = {
    model,
    input: trimmed,
  };

  if (dimensionsRaw) {
    const dimensions = Number(dimensionsRaw);
    if (!Number.isFinite(dimensions) || dimensions <= 0) {
      throw new Error("KB_EMBEDDING_DIMENSIONS must be a positive number");
    }
    body.dimensions = dimensions;
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await response.json()) as OpenAIEmbeddingResponse;

  if (!response.ok) {
    throw new Error(
      json?.error?.message ||
        `Embedding request failed with status ${response.status}`,
    );
  }

  const embedding = json.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Embedding response did not contain a vector");
  }

  return embedding;
}
