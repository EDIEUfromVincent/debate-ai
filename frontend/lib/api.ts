const API_BASE = "";

export interface PrepChatRequest {
  topic: string;
  turns: [string, string][];
  student_input: string;
}

export interface PrepResult {
  topic: string;
  stance: string;
  grounds: string[];
  sources: string[];
  skipped: boolean;
}

export interface PrepChatResponse {
  ai_response: string;
  done: boolean;
  result: PrepResult | null;
}

export async function prepChat(req: PrepChatRequest): Promise<PrepChatResponse> {
  const res = await fetch(`${API_BASE}/api/prep/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}
