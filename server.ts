import express, {
  Request,
  Response,
} from "express";

import path from "path";
import dotenv from "dotenv";

import {
  createServer as createViteServer,
} from "vite";

import {
  runAgent,
  type AgentRequest,
  type AgentAIAnswer,
} from "./src/agent/agentController";

dotenv.config();

/* =========================================================
   APP
========================================================= */

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

/* =========================================================
   AI CONFIGURATION
========================================================= */

const AI_TIMEOUT_MS = 30000;

const EXPLABS_BASE_URL =
  String(
    process.env.EXPLABS_BASE_URL ||
      "https://api.experientiallabs.ai/v1"
  )
    .trim()
    .replace(/\/+$/, "");

const EXPLABS_MODEL =
  String(
    process.env.EXPLABS_MODEL ||
      "gpt-5.6-luna"
  ).trim();

/* =========================================================
   PERFORMANCE SETTINGS
========================================================= */

const MAX_MESSAGE_LENGTH = 4000;

const MAX_HISTORY_MESSAGES = 6;

const MAX_HISTORY_ITEM_LENGTH = 1200;

const MAX_MEMORY_ITEMS = 10;

const MAX_MEMORY_LENGTH = 500;

const MAX_REQUESTS_PER_WINDOW = 60;

const RATE_LIMIT_WINDOW_MS =
  60 * 1000;

/* =========================================================
   BODY PARSER
========================================================= */

app.use(
  express.json({
    limit: "1mb",
  })
);

/* =========================================================
   RATE LIMITING
========================================================= */

const rateLimitMap = new Map<
  string,
  {
    count: number;
    resetTime: number;
  }
>();

function checkRateLimit(
  req: Request,
  res: Response,
  next: () => void
) {
  const ip =
    req.ip || "global-client";

  const now = Date.now();

  const entry =
    rateLimitMap.get(ip);

  if (
    !entry ||
    now > entry.resetTime
  ) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime:
        now +
        RATE_LIMIT_WINDOW_MS,
    });

    return next();
  }

  if (
    entry.count >=
    MAX_REQUESTS_PER_WINDOW
  ) {
    return res.status(429).json({
      error:
        "Rate limit reached. Please wait a moment before trying again.",
    });
  }

  entry.count++;

  return next();
}

app.use(
  [
    "/api/ai",
    "/api/agent",
  ],
  checkRateLimit
);

/* =========================================================
   EXPERIENTIAL LABS CONFIG
========================================================= */

function getExplabsKey(): string {
  return String(
    process.env.EXPLABS_API_KEY || ""
  ).trim();
}

function isPlaceholderKey(
  apiKey: string
): boolean {
  return (
    !apiKey ||
    /^(YOUR_|MY_|PASTE_|CHANGE_ME)/i.test(
      apiKey
    )
  );
}

function hasExplabsKey(): boolean {
  const key =
    getExplabsKey();

  return (
    key.length > 0 &&
    !isPlaceholderKey(key)
  );
}

/* =========================================================
   GENERIC JSON TYPES
========================================================= */

type JsonRecord =
  Record<string, unknown>;

interface ChatMessage {
  role:
    | "system"
    | "user"
    | "assistant";

  content: string;
}

/* =========================================================
   HELPERS
========================================================= */

function cleanText(
  value: unknown,
  maxLength: number
): string {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function safeJsonStringify(
  value: unknown
): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

/* =========================================================
   TIMEOUT
========================================================= */

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = AI_TIMEOUT_MS
): Promise<T> {
  let timeoutId:
    | ReturnType<typeof setTimeout>
    | undefined;

  const timeoutPromise =
    new Promise<never>(
      (_, reject) => {
        timeoutId =
          setTimeout(() => {
            reject(
              new Error(
                "AI request timed out. Please try again."
              )
            );
          }, timeoutMs);
      }
    );

  try {
    return await Promise.race([
      promise,
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/* =========================================================
   HISTORY
========================================================= */

function normalizeHistory(
  history: unknown
) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item: any) => ({
      role:
        item?.role === "user"
          ? "User"
          : "Nodysom AI",

      content: cleanText(
        item?.content,
        MAX_HISTORY_ITEM_LENGTH
      ),
    }))
    .filter(
      (item) =>
        Boolean(item.content)
    );
}

/* =========================================================
   MEMORIES
========================================================= */

function normalizeMemories(
  memories: unknown
): string[] {
  if (!Array.isArray(memories)) {
    return [];
  }

  return memories
    .slice(0, MAX_MEMORY_ITEMS)
    .map((item: any) =>
      cleanText(
        typeof item === "string"
          ? item
          : item?.content,
        MAX_MEMORY_LENGTH
      )
    )
    .filter(Boolean);
}

/* =========================================================
   AGENT CONTEXT
========================================================= */

function buildAgentContext(
  request: AgentRequest
) {
  const history =
    normalizeHistory(
      request.history
    );

  const memories =
    normalizeMemories(
      request.memories
    );

  const profile =
    (request as any).userProfile;

  const historyText =
    history.length > 0
      ? history
          .map(
            (item: any) =>
              `${item.role}: ${item.content}`
          )
          .join("\n")
      : "No previous conversation.";

  const memoryText =
    memories.length > 0
      ? memories.join("; ")
      : "No stored memories.";

  const profileText =
    profile
      ? `
Name: ${cleanText(
          profile.name ||
            "User",
          100
        )}

Preferred language: ${cleanText(
  profile.preferredLanguage ||
    "en",
  30
)}

Goals: ${cleanText(
  profile.goals ||
    "general productivity",
  500
)}
`
      : "No profile information.";

  return {
    historyText,
    memoryText,
    profileText,
  };
}

/* =========================================================
   EXPERIENTIAL LABS CHAT COMPLETIONS
========================================================= */

interface ExplabsResponse {
  id?: string;

  object?: string;

  model?: string;

  choices?: Array<{
    index?: number;

    message?: {
      role?: string;
      content?: string | null;
    };

    finish_reason?: string | null;
  }>;

  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };

  provider?: string;

  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

async function callExplabs(
  messages: ChatMessage[],
  options?: {
    json?: boolean;
    maxTokens?: number;
  }
): Promise<ExplabsResponse> {
  const apiKey =
    getExplabsKey();

  if (!apiKey) {
    throw new Error(
      "EXPLABS_API_KEY is not configured."
    );
  }

  if (isPlaceholderKey(apiKey)) {
    throw new Error(
      "EXPLABS_API_KEY is still a placeholder."
    );
  }

  const body: JsonRecord = {
    model:
      EXPLABS_MODEL,

    messages,

    max_tokens:
      options?.maxTokens || 4096,
  };

  if (options?.json) {
    body.response_format = {
      type: "json_object",
    };
  }

  const response =
    await withTimeout(
      fetch(
        `${EXPLABS_BASE_URL}/chat/completions`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(body),
        }
      )
    );

  const raw =
    await response.text();

  let data:
    | ExplabsResponse
    | null = null;

  try {
    data =
      JSON.parse(raw);
  } catch {
    data = null;
  }

  if (!response.ok) {
    const apiMessage =
      data?.error?.message ||
      raw ||
      `Experiential Labs request failed with HTTP ${response.status}.`;

    throw new Error(
      `Experiential Labs API error (${response.status}): ${cleanText(
        apiMessage,
        1000
      )}`
    );
  }

  if (!data) {
    throw new Error(
      "Experiential Labs returned invalid JSON."
    );
  }

  return data;
}

/* =========================================================
   EXTRACT MODEL TEXT
========================================================= */

function extractResponseText(
  response: ExplabsResponse
): string {
  return cleanText(
    response.choices?.[0]?.message?.content,
    30000
  );
}

/* =========================================================
   PARSE MODEL JSON
========================================================= */

function parseModelJson(
  raw: string
): JsonRecord | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed as JsonRecord;
    }
  } catch {
    // Continue below.
  }

  const cleaned =
    raw
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  try {
    const parsed =
      JSON.parse(cleaned);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed as JsonRecord;
    }
  } catch {
    return null;
  }

  return null;
}

/* =========================================================
   AGENT SYSTEM PROMPT
========================================================= */

function buildAgentSystemInstruction(
  request: AgentRequest,
  toolResult?: string
): string {
  const {
    historyText,
    memoryText,
    profileText,
  } =
    buildAgentContext(
      request
    );

  return `
You are Nodysom AI.

You are a general-purpose AI assistant and agent.

You can help with legitimate tasks including:

- education
- scholarships
- jobs
- productivity
- planning
- writing
- translation
- mathematics
- coding
- research
- explanations
- general questions

==================================================
IMPORTANT AGENT RULE
==================================================

You have three local tools:

1. calculator
2. time
3. text_stats

You MUST NOT pretend to execute a tool.

When a tool is needed, return a JSON tool request.

Format:

{
  "reply": "",
  "detectedAction": null,
  "newMemory": null,
  "toolCall": {
    "tool": "calculator",
    "input": "25 * 40"
  }
}

Allowed tool names:

calculator
time
text_stats

For calculator:

{
  "tool": "calculator",
  "input": "25 * 40"
}

For time:

{
  "tool": "time",
  "input": "current"
}

For text_stats:

{
  "tool": "text_stats",
  "input": "text to analyze"
}

==================================================
TOOL RESULT
==================================================

If a tool result is provided below, use it.

Never invent a tool result.

Tool result:

${toolResult || "No tool result available."}

==================================================
FINAL RESPONSE
==================================================

If no tool is needed, return ONLY valid JSON:

{
  "reply": "natural answer",
  "detectedAction": null,
  "newMemory": null,
  "toolCall": null
}

==================================================
SMART ACTIONS
==================================================

If the user asks to:

- create
- add
- schedule
- remind
- plan
- organize

something, you may create a detectedAction proposal.

A detectedAction is ONLY a proposal.

Never claim that an action has already been saved,
scheduled, created, or completed.

Use:

{
  "type": "TASK",
  "title": "Example task",
  "date": "2026-09-20",
  "time": "10:00",
  "category": "General",
  "amount": null
}

Allowed action types:

TASK
REMINDER
SCHEDULE
BUDGET

==================================================
MEMORY
==================================================

Only create newMemory when the user explicitly
shares a useful personal fact, preference, goal,
habit, or other information that should reasonably
be remembered.

Do not create memories from ordinary questions.

==================================================
LANGUAGE
==================================================

Respect the user's preferred language.

If the user writes in Swahili, respond in Swahili
unless another language is requested.

==================================================
USER PROFILE
==================================================

${profileText}

==================================================
MEMORIES
==================================================

${memoryText}

==================================================
RECENT CONVERSATION
==================================================

${historyText}
`;
}

/* =========================================================
   AGENT AI ANSWER
   EXPERIENTIAL LABS JSON PROTOCOL
========================================================= */

async function generateAgentAnswer(
  request: AgentRequest,
  toolResult?: string
): Promise<AgentAIAnswer> {
  const message =
    cleanText(
      request.message,
      MAX_MESSAGE_LENGTH
    );

  /* -------------------------------------------------------
     OFFLINE MODE
  ------------------------------------------------------- */

  if (!hasExplabsKey()) {
    return {
      reply: toolResult
        ? `Tool result: ${toolResult}`
        : `I received your request: "${message}". Experiential Labs is not connected yet.`,

      detectedAction:
        null,

      newMemory:
        null,

      toolCall:
        null,
    };
  }

  const systemInstruction =
    buildAgentSystemInstruction(
      request,
      toolResult
    );

  const messages:
    ChatMessage[] = [
      {
        role: "system",

        content:
          systemInstruction,
      },

      {
        role: "user",

        content:
          message,
      },
    ];

  if (toolResult) {
    messages.push({
      role: "user",

      content:
        `
A local tool was executed.

Use this tool result to answer the user's original request.

TOOL RESULT:
${toolResult}

Return the final answer as valid JSON.
If another local tool is required, return a toolCall instead.
`,
    });
  }

  try {
    const response =
      await callExplabs(
        messages,
        {
          json: true,
          maxTokens: 4096,
        }
      );

    const raw =
      extractResponseText(
        response
      );

    if (!raw) {
      return {
        reply:
          "I could not generate a response.",

        detectedAction:
          null,

        newMemory:
          null,

        toolCall:
          null,
      };
    }

    const parsed =
      parseModelJson(raw);

    /* -----------------------------------------------------
       FALLBACK IF MODEL RETURNS PLAIN TEXT
    ----------------------------------------------------- */

    if (!parsed) {
      return {
        reply:
          raw,

        detectedAction:
          null,

        newMemory:
          null,

        toolCall:
          null,
      };
    }

    /* -----------------------------------------------------
       TOOL REQUEST
    ----------------------------------------------------- */

    const toolCall =
      parsed.toolCall;

    if (
      toolCall &&
      typeof toolCall ===
        "object" &&
      !Array.isArray(toolCall)
    ) {
      const requestedTool =
        cleanText(
          (toolCall as any).tool,
          100
        );

      const input =
        cleanText(
          (toolCall as any).input,
          MAX_MESSAGE_LENGTH
        );

      const allowedTools = [
        "calculator",
        "time",
        "text_stats",
      ];

      if (
        allowedTools.includes(
          requestedTool
        )
      ) {
        return {
          reply:
            "",

          detectedAction:
            null,

          newMemory:
            null,

          toolCall: {
            tool:
              requestedTool as
                | "calculator"
                | "time"
                | "text_stats",

            input:
              input ||
              "current",
          },
        };
      }
    }

    /* -----------------------------------------------------
       NORMAL RESPONSE
    ----------------------------------------------------- */

    const reply =
      cleanText(
        parsed.reply,
        10000
      ) ||
      "I am here to help.";

    /* -----------------------------------------------------
       DETECTED ACTION
    ----------------------------------------------------- */

    let detectedAction:
      any = null;

    if (
      parsed.detectedAction &&
      typeof parsed.detectedAction ===
        "object" &&
      !Array.isArray(
        parsed.detectedAction
      )
    ) {
      const action =
        parsed.detectedAction as any;

      const allowedTypes = [
        "TASK",
        "REMINDER",
        "SCHEDULE",
        "BUDGET",
      ];

      const title =
        cleanText(
          action.title,
          200
        );

      if (
        allowedTypes.includes(
          action.type
        ) &&
        title
      ) {
        detectedAction = {
          type:
            action.type,

          title,

          date:
            cleanText(
              action.date,
              30
            ) ||
            undefined,

          time:
            cleanText(
              action.time,
              30
            ) ||
            undefined,

          category:
            cleanText(
              action.category,
              80
            ) ||
            "General",

          amount:
            Number.isFinite(
              Number(
                action.amount
              )
            )
              ? Number(
                  action.amount
                )
              : undefined,

          confirmedRequired:
            true,
        };
      }
    }

    const newMemory =
      cleanText(
        parsed.newMemory,
        MAX_MEMORY_LENGTH
      ) ||
      null;

    return {
      reply,

      detectedAction,

      newMemory,

      toolCall:
        null,
    };

  } catch (error: any) {
    console.error(
      "[Nodysom AI] Experiential Labs request error:",
      error instanceof Error
        ? error.message
        : error
    );

    if (toolResult) {
      return {
        reply:
          `Tool result: ${toolResult}`,

        detectedAction:
          null,

        newMemory:
          null,

        toolCall:
          null,
      };
    }

    return {
      reply:
        "Nodysom AI could not connect to the AI model right now. Please try again.",

      detectedAction:
        null,

      newMemory:
        null,

      toolCall:
        null,
    };
  }
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (
    _req,
    res
  ) => {
    const rawKey =
      getExplabsKey();

    const trimmedKey =
      rawKey.trim();

    const placeholderDetected =
      isPlaceholderKey(
        trimmedKey
      );

    const hasApiKey =
      trimmedKey.length > 0 &&
      !placeholderDetected;

    res.json({
      status:
        "ok",

      appName:
        "Nodysom AI",

      tagline:
        "Plan Your Day. Live Smarter.",

      aiProvider:
        "Experiential Labs",

      baseUrl:
        EXPLABS_BASE_URL,

      model:
        EXPLABS_MODEL,

      hasExplabsKey:
        hasApiKey,

      explabsDiagnostics: {
        environmentVariableExists:
          rawKey.length > 0,

        trimmedValueExists:
          trimmedKey.length > 0,

        keyLength:
          trimmedKey.length,

        placeholderDetected,

        usableKeyDetected:
          hasApiKey,
      },

      agent: {
        enabled:
          true,

        endpoint:
          "/api/agent",

        architecture:
          "Experiential Labs JSON Agent Protocol + Local Tool Controller",

        tools: [
          "calculator",
          "time",
          "text_stats",
        ],
      },
    });
  }
);

/* =========================================================
   UNIVERSAL AI AGENT
========================================================= */

app.post(
  "/api/agent",
  async (
    req,
    res
  ) => {
    const startedAt =
      Date.now();

    try {
      const body =
        req.body || {};

      const message =
        cleanText(
          body.message,
          MAX_MESSAGE_LENGTH
        );

      if (!message) {
        return res.status(400).json({
          error:
            "Agent message is required.",
        });
      }

      const agentRequest:
        AgentRequest =
        {
          message,

          history:
            normalizeHistory(
              body.history
            ),

          userProfile:
            body.userProfile
              ? {
                  name:
                    cleanText(
                      body
                        .userProfile
                        ?.name,
                      100
                    ),

                  preferredLanguage:
                    cleanText(
                      body
                        .userProfile
                        ?.preferredLanguage,
                      30
                    ),

                  goals:
                    cleanText(
                      body
                        .userProfile
                        ?.goals,
                      500
                    ),
                }
              : undefined,

          memories:
            normalizeMemories(
              body.memories
            ),
        };

      const result =
        await runAgent(
          agentRequest,

          async (
            request,
            toolResult
          ) => {
            return generateAgentAnswer(
              request,
              toolResult
            );
          }
        );

      const latency =
        Date.now() -
        startedAt;

      console.log(
        `[Nodysom Agent] ${latency}ms | tool=${result.tool || "none"} | steps=${result.steps || 0}`
      );

      return res.json({
        ...result,
        latency,
      });

    } catch (error: any) {
      const latency =
        Date.now() -
        startedAt;

      console.error(
        `[Nodysom Agent] Error after ${latency}ms:`,
        error instanceof Error
          ? error.message
          : error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Agent request failed.",

        reply:
          "Nodysom AI could not process that request right now. Please try again.",

        usedTool:
          false,

        detectedAction:
          null,

        newMemory:
          null,

        latency,
      });
    }
  }
);

/* =========================================================
   LEGACY AI ASSISTANT
========================================================= */

app.post(
  "/api/ai/assistant",
  async (
    req,
    res
  ) => {
    try {
      const body =
        req.body || {};

      const message =
        cleanText(
          body.message,
          MAX_MESSAGE_LENGTH
        );

      if (!message) {
        return res.status(400).json({
          error:
            "Message is required.",
        });
      }

      const agentRequest:
        AgentRequest =
        {
          message,

          history:
            normalizeHistory(
              body.history
            ),

          userProfile:
            body.userProfile
              ? {
                  name:
                    cleanText(
                      body
                        .userProfile
                        ?.name,
                      100
                    ),

                  preferredLanguage:
                    cleanText(
                      body
                        .userProfile
                        ?.preferredLanguage,
                      30
                    ),

                  goals:
                    cleanText(
                      body
                        .userProfile
                        ?.goals,
                      500
                    ),
                }
              : undefined,

          memories:
            normalizeMemories(
              body.memories
            ),
        };

      const result =
        await runAgent(
          agentRequest,

          async (
            request,
            toolResult
          ) => {
            return generateAgentAnswer(
              request,
              toolResult
            );
          }
        );

      return res.json({
        reply:
          result.reply,

        usedTool:
          result.usedTool,

        tool:
          result.tool ||
          null,

        toolResult:
          result.toolResult ||
          null,

        detectedAction:
          result.detectedAction ||
          null,

        newMemory:
          result.newMemory ||
          null,

        steps:
          result.steps ||
          0,

        toolsUsed:
          result.toolsUsed ||
          [],
      });

    } catch (error: any) {
      console.error(
        "[Nodysom Assistant] Error:",
        error instanceof Error
          ? error.message
          : error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Failed to process request.",

        reply:
          "Nodysom AI could not process that request right now.",

        detectedAction:
          null,

        newMemory:
          null,
      });
    }
  }
);

/* =========================================================
   SIMPLE SEARCH
========================================================= */

app.post(
  "/api/ai/search",
  async (
    req,
    res
  ) => {
    try {
      const query =
        cleanText(
          req.body?.query,
          1500
        );

      if (!query) {
        return res.status(400).json({
          error:
            "Query is required.",
        });
      }

      const language =
        cleanText(
          req.body?.language ||
            "en",
          30
        );

      if (!hasExplabsKey()) {
        return res.json({
          summary:
            `Search request received: "${query}"`,

          verifiedFacts:
            [],

          estimates:
            [],

          uncertainties: [
            "AI search service is not connected.",
          ],

          sources:
            [],

          suggestedActions:
            [],
        });
      }

      const messages:
        ChatMessage[] = [
          {
            role:
              "system",

            content:
              `
You are Nodysom AI search assistant.

Answer the user's search request clearly.

Language:
${language}

Rules:

- Do not invent sources.
- Clearly distinguish known information
  from uncertainty.
- If you cannot verify something, say so.
- Do not fabricate URLs.
- Return a useful concise answer.
`,
          },

          {
            role:
              "user",

            content:
              query,
          },
        ];

      const response =
        await callExplabs(
          messages,
          {
            json: false,
            maxTokens: 3000,
          }
        );

      const summary =
        extractResponseText(
          response
        );

      return res.json({
        summary:
          summary ||
          "No result available.",

        verifiedFacts:
          [],

        estimates:
          [],

        uncertainties:
          [],

        sources:
          [],

        suggestedActions:
          [],
      });

    } catch (error: any) {
      console.error(
        "[Nodysom Search] Error:",
        error instanceof Error
          ? error.message
          : error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Search failed.",
      });
    }
  }
);

/* =========================================================
   AI TRANSLATION
========================================================= */

app.post(
  "/api/ai/translate",
  async (
    req,
    res
  ) => {
    try {
      const text =
        cleanText(
          req.body?.text,
          5000
        );

      const targetLanguage =
        cleanText(
          req.body?.targetLanguage ||
            "en",
          50
        );

      const sourceLanguage =
        cleanText(
          req.body?.sourceLanguage ||
            "auto",
          50
        );

      if (!text) {
        return res.status(400).json({
          error:
            "Text is required.",
        });
      }

      if (!hasExplabsKey()) {
        return res.status(503).json({
          error:
            "Translation AI is not connected.",
        });
      }

      const messages:
        ChatMessage[] = [
          {
            role:
              "system",

            content:
              `
You are a professional translation engine.

Translate the user's text accurately.

Source language:
${sourceLanguage}

Target language:
${targetLanguage}

Return ONLY valid JSON:

{
  "translatedText": "translation",
  "phoneticGuide": "",
  "notes": ""
}

Rules:

- Preserve meaning.
- Preserve names.
- Preserve numbers.
- Preserve tone.
- Do not add information.
- phoneticGuide may be empty.
- notes may be empty.
- Do not use markdown.
`,
          },

          {
            role:
              "user",

            content:
              text,
          },
        ];

      const response =
        await callExplabs(
          messages,
          {
            json: true,
            maxTokens: 2500,
          }
        );

      const raw =
        extractResponseText(
          response
        );

      const parsed =
        parseModelJson(
          raw
        );

      if (!parsed) {
        return res.status(502).json({
          error:
            "Translation model returned invalid JSON.",
        });
      }

      const translatedText =
        cleanText(
          parsed.translatedText,
          10000
        );

      if (!translatedText) {
        return res.status(502).json({
          error:
            "Translation model returned no translated text.",
        });
      }

      return res.json({
        translatedText,

        phoneticGuide:
          cleanText(
            parsed.phoneticGuide,
            2000
          ),

        notes:
          cleanText(
            parsed.notes,
            2000
          ),

        sourceLanguage,

        targetLanguage,
      });

    } catch (error: any) {
      console.error(
        "[Nodysom Translation] Error:",
        error instanceof Error
          ? error.message
          : error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Translation failed.",
      });
    }
  }
);

/* =========================================================
   AI SMART SCHEDULE
========================================================= */

app.post(
  "/api/ai/smart-schedule",
  async (
    req,
    res
  ) => {
    try {
      const prompt =
        cleanText(
          req.body?.prompt,
          1500
        );

      const date =
        cleanText(
          req.body?.date ||
            new Date()
              .toISOString()
              .split("T")[0],
          30
        );

      if (!prompt) {
        return res.status(400).json({
          error:
            "Schedule prompt is required.",
        });
      }

      if (!hasExplabsKey()) {
        return res.json({
          schedule: [
            {
              time:
                "08:00",

              title:
                "Start your day",

              category:
                "General",

              durationMinutes:
                30,

              notes:
                "AI is offline. This is a basic fallback schedule.",
            },

            {
              time:
                "10:00",

              title:
                "Work on your main priority",

              category:
                "Priority",

              durationMinutes:
                60,

              notes:
                "",
            },

            {
              time:
                "14:00",

              title:
                "Review tasks and continue",

              category:
                "Productivity",

              durationMinutes:
                60,

              notes:
                "",
            },

            {
              time:
                "18:00",

              title:
                "Review the day",

              category:
                "Planning",

              durationMinutes:
                30,

              notes:
                "",
            },
          ],

          date,

          offline:
            true,
        });
      }

      const messages:
        ChatMessage[] = [
          {
            role:
              "system",

            content:
              `
You are Nodysom AI Smart Schedule.

Create a practical daily schedule.

Return ONLY valid JSON:

{
  "schedule": [
    {
      "time": "08:00",
      "title": "Task title",
      "category": "Category",
      "durationMinutes": 60,
      "notes": "Optional short note"
    }
  ]
}

Rules:

- Create 3 to 12 items.
- Use 24-hour HH:MM.
- Avoid overlapping items.
- Respect explicit times.
- Do not invent appointments.
- Use sensible times when none are given.
- Include breaks when useful.
- durationMinutes must be a positive integer.
- Keep notes short.
- JSON only.
`,
          },

          {
            role:
              "user",

            content:
              `
Date:
${date}

User request:
${prompt}
`,
          },
        ];

      const response =
        await callExplabs(
          messages,
          {
            json: true,
            maxTokens: 3000,
          }
        );

      const raw =
        extractResponseText(
          response
        );

      const parsed =
        parseModelJson(
          raw
        );

      if (!parsed) {
        return res.status(502).json({
          error:
            "The AI returned invalid schedule JSON.",

          schedule:
            [],
        });
      }

      const sourceSchedule =
        Array.isArray(
          parsed.schedule
        )
          ? parsed.schedule
          : [];

      const schedule =
        sourceSchedule
          .slice(0, 12)
          .map(
            (item: any) => ({
              time:
                cleanText(
                  item?.time,
                  10
                ),

              title:
                cleanText(
                  item?.title,
                  160
                ),

              category:
                cleanText(
                  item?.category,
                  60
                ) ||
                "General",

              durationMinutes:
                Number.isFinite(
                  Number(
                    item?.durationMinutes
                  )
                )
                  ? Math.max(
                      1,
                      Math.round(
                        Number(
                          item.durationMinutes
                        )
                      )
                    )
                  : undefined,

              notes:
                cleanText(
                  item?.notes,
                  300
                ),
            })
          )
          .filter(
            (item: any) =>
              /^([01]\d|2[0-3]):[0-5]\d$/.test(
                item.time
              ) &&
              Boolean(
                item.title
              )
          );

      if (
        schedule.length ===
        0
      ) {
        return res.status(502).json({
          error:
            "The AI returned an invalid schedule.",

          schedule:
            [],
        });
      }

      return res.json({
        schedule,

        date,

        offline:
          false,
      });

    } catch (error: any) {
      console.error(
        "[Nodysom Smart Schedule] Error:",
        error instanceof Error
          ? error.message
          : error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Smart schedule generation failed.",

        schedule:
          [],
      });
    }
  }
);

/* =========================================================
   VITE / PRODUCTION SERVER
========================================================= */

async function startServer() {
  const isProduction =
    process.env.NODE_ENV ===
    "production";

  if (!isProduction) {
    const vite =
      await createViteServer({
        server: {
          middlewareMode:
            true,
        },

        appType:
          "spa",
      });

    app.use(
      vite.middlewares
    );

  } else {
    const distPath =
      path.resolve(
        process.cwd(),
        "dist"
      );

    app.use(
      express.static(
        distPath
      )
    );

    app.get(
      "*",
      (
        _req,
        res
      ) => {
        res.sendFile(
          path.join(
            distPath,
            "index.html"
          )
        );
      }
    );
  }

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `Nodysom AI running on port ${PORT}`
      );

      const runtimeKey =
        getExplabsKey();

      const runtimeKeyUsable =
        runtimeKey.length > 0 &&
        !isPlaceholderKey(
          runtimeKey
        );

      console.log(
        `[Nodysom AI] Experiential Labs key available: ${runtimeKeyUsable}`
      );

      console.log(
        `[Nodysom AI] Experiential Labs base URL: ${EXPLABS_BASE_URL}`
      );

      console.log(
        `[Nodysom AI] Experiential Labs model: ${EXPLABS_MODEL}`
      );
    }
  );
}

startServer().catch(
  (error) => {
    console.error(
      "Failed to start Nodysom AI:",
      error instanceof Error
        ? error.message
        : error
    );

    process.exit(1);
  }
);
