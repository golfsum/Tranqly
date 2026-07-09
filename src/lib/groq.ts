const GROQ_API_BASE = "https://api.groq.com/openai/v1";

export type AiFeatureSource =
  | "daily_insight"
  | "reflection_classifier"
  | "weekly_summary"
  | "monthly_summary"
  | "long_term_pattern"
  | "prompt_selection"
  | "tag_detection"
  | "image_reflection";

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqJsonSchema {
  name: string;
  schema: unknown;
}

interface GroqChatOptions {
  messages: GroqMessage[];
  schema: GroqJsonSchema;
  maxTokens: number;
  feature: AiFeatureSource;
  userPlan?: "free" | "plus";
}

export interface GroqUsageMeta {
  model: string;
  fallbackModelsTried: string[];
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  feature: AiFeatureSource;
  userPlan: "free" | "plus";
}

const MODEL_PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  "openai/gpt-oss-20b": {
    input: Number(process.env.GROQ_GPT_OSS_20B_INPUT_PER_1M_USD ?? 0.075),
    output: Number(process.env.GROQ_GPT_OSS_20B_OUTPUT_PER_1M_USD ?? 0.3),
  },
  "openai/gpt-oss-120b": {
    input: Number(process.env.GROQ_GPT_OSS_120B_INPUT_PER_1M_USD ?? 0.15),
    output: Number(process.env.GROQ_GPT_OSS_120B_OUTPUT_PER_1M_USD ?? 0.6),
  },
};

export function modelForFeature(
  feature: AiFeatureSource,
  userPlan: "free" | "plus" = "free"
) {
  if (
    userPlan === "plus" &&
    ["weekly_summary", "monthly_summary", "long_term_pattern"].includes(feature)
  ) {
    return process.env.GROQ_DEEP_MODEL || "openai/gpt-oss-120b";
  }
  if (feature === "image_reflection") {
    return process.env.GROQ_IMAGE_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  }
  return process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-20b";
}

function fallbackModels(primary: string, feature: AiFeatureSource) {
  if (["weekly_summary", "monthly_summary", "long_term_pattern"].includes(feature)) {
    return [primary, primary, process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-20b"];
  }
  return [primary, primary];
}

function estimateCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing = MODEL_PRICING_USD_PER_1M[model] ?? { input: 0, output: 0 };
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

export async function groqJsonChatWithUsage<T>({
  messages,
  schema,
  maxTokens,
  feature,
  userPlan = "free",
}: GroqChatOptions): Promise<{ parsed: T; usage: GroqUsageMeta }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const primaryModel = modelForFeature(feature, userPlan);
  const models = fallbackModels(primaryModel, feature);
  const tried: string[] = [];
  let lastError: unknown;

  for (const model of models) {
    tried.push(model);
    try {
      const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            ...messages,
            {
              role: "system",
              content:
                `Return only valid JSON that matches this schema: ${JSON.stringify(
                  schema.schema
                )}`,
            } satisfies GroqMessage,
          ],
          max_tokens: maxTokens,
          temperature: 0.4,
          response_format: {
            type: "json_object",
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Groq chat failed: ${res.status} ${body}`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Groq chat returned no content");
      }
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;
      return {
        parsed: JSON.parse(content) as T,
        usage: {
          model,
          fallbackModelsTried: tried.slice(0, -1),
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCost: estimateCost(model, inputTokens, outputTokens),
          feature,
          userPlan,
        },
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Groq chat failed");
}

export async function groqJsonChat<T>(options: GroqChatOptions): Promise<T> {
  const result = await groqJsonChatWithUsage<T>(options);
  return result.parsed;
}

export async function groqTranscribe(file: File | Blob, signal?: AbortSignal): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const form = new FormData();
  form.append("file", file, file instanceof File ? file.name : "daily-check-in.webm");
  form.append(
    "model",
    process.env.GROQ_TRANSCRIPTION_MODEL || "distil-whisper-large-v3-en"
  );
  form.append("response_format", "json");

  const res = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
    signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq transcription failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { text?: string };
  return data.text?.trim() ?? "";
}
