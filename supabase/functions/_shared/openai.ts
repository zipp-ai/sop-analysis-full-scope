const AZURE_ENDPOINT = Deno.env.get("AZURE_OPENAI_ENDPOINT")!;
const AZURE_API_KEY = Deno.env.get("AZURE_OPENAI_API_KEY")!;
const CHAT_DEPLOYMENT = Deno.env.get("AZURE_OPENAI_DEPLOYMENT")!;
const EMBEDDING_DEPLOYMENT = Deno.env.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")!;
const API_VERSION = "2024-02-01";

function embeddingUrl(): string {
  return `${AZURE_ENDPOINT}/openai/deployments/${EMBEDDING_DEPLOYMENT}/embeddings?api-version=${API_VERSION}`;
}

function chatUrl(): string {
  return `${AZURE_ENDPOINT}/openai/deployments/${CHAT_DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(embeddingUrl(), {
    method: "POST",
    headers: {
      "api-key": AZURE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text.slice(0, 8000),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Azure embedding error: ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const trimmed = texts.map((t) => t.slice(0, 8000));
  const response = await fetch(embeddingUrl(), {
    method: "POST",
    headers: {
      "api-key": AZURE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: trimmed,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Azure embedding error: ${err}`);
  }

  const data = await response.json();
  return data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding);
}

export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch(chatUrl(), {
    method: "POST",
    headers: {
      "api-key": AZURE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Azure chat error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function chatCompletionJSON(
  systemPrompt: string,
  userPrompt: string
): Promise<any> {
  const response = await fetch(chatUrl(), {
    method: "POST",
    headers: {
      "api-key": AZURE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Azure chat error: ${err}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}
