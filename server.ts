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
  GoogleGenAI,
} from "@google/genai";

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
   GOOGLE GEMINI + OPENROUTER FALLBACK
========================================================= */

const AI_TIMEOUT_MS = 120000;

const GEMINI_MODEL =
  String(
    process.env.GEMINI_MODEL ||
      "gemini-3.8-flash"
  ).trim();

const OPENROUTER_MODEL =
  String(
    process.env.OPENROUTER_MODEL ||
      "openrouter/free"
  ).trim();

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

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
   AI KEYS
========================================================= */

function getGeminiKey(): string {
  return String(
    process.env.GEMINI_API_KEY || ""
  ).trim();
}

function getOpenRouterKey(): string {
  return String(
    process.env.OPENROUTER_API_KEY || ""
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

function hasGeminiKey(): boolean {
  const key =
    getGeminiKey();

  return (
    key.length > 0 &&
    !isPlaceholderKey(key)
  );
}

function hasOpenRouterKey(): boolean {
  const key =
    getOpenRouterKey();

  return (
    key.length > 0 &&
    !isPlaceholderKey(key)
  );
}

function hasAIProvider(): boolean {
  return (
    hasGeminiKey() ||
    hasOpenRouterKey()
  );
}

/* =========================================================
   GENERIC TYPES
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

interface GeminiResponse {
  text: string;
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
   GOOGLE GEMINI
========================================================= */

async function callGemini(
  messages: ChatMessage[],
  options?: {
    json?: boolean;
    maxTokens?: number;
  }
): Promise<GeminiResponse> {
  const apiKey =
    getGeminiKey();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  if (isPlaceholderKey(apiKey)) {
    throw new Error(
      "GEMINI_API_KEY is still a placeholder."
    );
  }

  const ai =
    new GoogleGenAI({
      apiKey,
    });

  const systemMessage =
    messages.find(
      (message) =>
        message.role === "system"
    );

  const nonSystemMessages =
    messages.filter(
      (message) =>
        message.role !== "system"
    );

  const conversationText =
    nonSystemMessages
      .map(
        (message) => {
          const role =
            message.role ===
            "assistant"
              ? "Assistant"
              : "User";

          return `${role}: ${message.content}`;
        }
      )
      .join("\n\n");

  const input =
    conversationText ||
    "Hello";

  const interactionRequest: any = {
    model:
      GEMINI_MODEL,

    input,

    generation_config: {
      max_output_tokens:
        options?.maxTokens || 4096,

      thinking_level:
        "low",
    },
  };

  if (
    systemMessage?.content
  ) {
    interactionRequest.system_instruction =
      systemMessage.content;
  }

  if (options?.json) {
    interactionRequest.response_format = {
      type: "text",

      mime_type:
        "application/json",
    };
  }

  const interaction =
    await withTimeout(
      ai.interactions.create(
        interactionRequest,
        {
          timeout:
            AI_TIMEOUT_MS,
        }
      )
    );

  const text =
    cleanText(
      interaction.output_text,
      30000
    );

  if (!text) {
    throw new Error(
      "Google Gemini returned an empty response."
    );
  }

  return {
    text,
  };
}

/* =========================================================
   OPENROUTER
========================================================= */

async function callOpenRouter(
  messages: ChatMessage[],
  options?: {
    json?: boolean;
    maxTokens?: number;
    tools?: unknown[];
  }
): Promise<GeminiResponse> {
  const apiKey =
    getOpenRouterKey();

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured."
    );
  }

  if (isPlaceholderKey(apiKey)) {
    throw new Error(
      "OPENROUTER_API_KEY is still a placeholder."
    );
  }

  const body: Record<string, unknown> = {
    model:
      OPENROUTER_MODEL,

    messages:
      messages.map(
        (message) => ({
          role:
            message.role,
          content:
            message.content,
        })
      ),

    max_tokens:
      options?.maxTokens || 4096,
  };

  if (
    options?.tools &&
    options.tools.length > 0
  ) {
    body.tools =
      options.tools;
  }

  if (options?.json) {
    body.response_format = {
      type: "json_object",
    };
  }

  const response =
    await withTimeout(
      fetch(
        OPENROUTER_URL,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "HTTP-Referer":
              String(
                process.env.APP_URL ||
                "https://absmg-apps.onrender.com"
              ),

            "X-Title":
              "Nodysom AI",

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(body),
        }
      ),
      AI_TIMEOUT_MS
    );

  const rawBody =
    await response.text();

  let data: any = null;

  try {
    data =
      JSON.parse(rawBody);
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      cleanText(
        data?.error?.message ||
        data?.message ||
        rawBody,
        1500
      );

    throw new Error(
      `OpenRouter API error (${response.status}): ${message}`
    );
  }

  const content =
    data?.choices?.[0]?.message?.content;

  let text = "";

  if (typeof content === "string") {
    text = content;
  } else if (
    Array.isArray(content)
  ) {
    text =
      content
        .map(
          (item: any) =>
            typeof item === "string"
              ? item
              : item?.text || ""
        )
        .join("\n");
  }

  text =
    cleanText(
      text,
      30000
    );

  if (!text) {
    throw new Error(
      "OpenRouter returned an empty response."
    );
  }

  return {
    text,
  };
}

/* =========================================================
   UNIFIED AI PROVIDER
========================================================= */

async function callAI(
  messages: ChatMessage[],
  options?: {
    json?: boolean;
    maxTokens?: number;
  }
): Promise<GeminiResponse> {
  let geminiError =
    "Gemini is unavailable.";

  /*
   * PRIMARY
   */

  if (hasGeminiKey()) {
    try {
      return await callGemini(
        messages,
        options
      );
    } catch (error) {
      geminiError =
        error instanceof Error
          ? error.message
          : String(error);

      console.warn(
        "[Nodysom AI] Gemini failed. Trying OpenRouter fallback.",
        geminiError
      );
    }
  } else {
    geminiError =
      "GEMINI_API_KEY is not configured.";
  }

  /*
   * FALLBACK
   */

  if (hasOpenRouterKey()) {
    try {
      return await callOpenRouter(
        messages,
        options
      );
    } catch (error) {
      const openRouterError =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        "[Nodysom AI] OpenRouter fallback failed:",
        openRouterError
      );

      throw new Error(
        `AI providers unavailable. Gemini: ${geminiError} OpenRouter: ${openRouterError}`
      );
    }
  }

  throw new Error(
    `No usable AI provider is configured. Gemini: ${geminiError}`
  );
}

/* =========================================================
   EXTRACT MODEL TEXT
========================================================= */

function extractResponseText(
  response: GeminiResponse
): string {
  return cleanText(
    response.text,
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
    // Continue.
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

  if (!hasAIProvider()) {
    return {
      reply: toolResult
        ? `Tool result: ${toolResult}`
        : `I received your request: "${message}". No AI provider is connected yet.`,

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
      await callAI(
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

    /* =====================================================
       TOOL REQUEST
    ===================================================== */

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

    /* =====================================================
       NORMAL RESPONSE
    ===================================================== */

    const reply =
      cleanText(
        parsed.reply,
        10000
      ) ||
      "I am here to help.";

    /* =====================================================
       DETECTED ACTION
    ===================================================== */

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
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "[Nodysom AI] AI provider request error:",
      errorMessage
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
        "Nodysom AI could not connect to an AI provider right now. Please try again.",

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
    const rawGeminiKey =
      getGeminiKey();

    const trimmedGeminiKey =
      rawGeminiKey.trim();

    const geminiPlaceholderDetected =
      isPlaceholderKey(
        trimmedGeminiKey
      );

    const hasUsableGeminiKey =
      trimmedGeminiKey.length > 0 &&
      !geminiPlaceholderDetected;

    const rawOpenRouterKey =
      getOpenRouterKey();

    const trimmedOpenRouterKey =
      rawOpenRouterKey.trim();

    const openRouterPlaceholderDetected =
      isPlaceholderKey(
        trimmedOpenRouterKey
      );

    const hasUsableOpenRouterKey =
      trimmedOpenRouterKey.length > 0 &&
      !openRouterPlaceholderDetected;

    res.json({
      status:
        "ok",

      appName:
        "Nodysom AI",

      tagline:
        "Plan Your Day. Live Smarter.",

      aiProvider:
        hasUsableGeminiKey
          ? "Google Gemini"
          : hasUsableOpenRouterKey
            ? "OpenRouter"
            : "Not configured",

      fallbackProvider:
        "OpenRouter",

      api:
        "Gemini Interactions API + OpenRouter",

      model:
        GEMINI_MODEL,

      fallbackModel:
        OPENROUTER_MODEL,

      hasGeminiKey:
        hasUsableGeminiKey,

      hasOpenRouterKey:
        hasUsableOpenRouterKey,

      search:
        {
          enabled:
            hasUsableGeminiKey ||
            hasUsableOpenRouterKey,

          primary:
            "Gemini Google Search",

          fallback:
            "OpenRouter Web Search",

          endpoint:
            "/api/ai/search",
        },

      geminiDiagnostics: {
        environmentVariableExists:
          rawGeminiKey.length > 0,

        trimmedValueExists:
          trimmedGeminiKey.length > 0,

        keyLength:
          trimmedGeminiKey.length,

        placeholderDetected:
          geminiPlaceholderDetected,

        usableKeyDetected:
          hasUsableGeminiKey,
      },

      openRouterDiagnostics: {
        environmentVariableExists:
          rawOpenRouterKey.length > 0,

        trimmedValueExists:
          trimmedOpenRouterKey.length > 0,

        keyLength:
          trimmedOpenRouterKey.length,

        placeholderDetected:
          openRouterPlaceholderDetected,

        usableKeyDetected:
          hasUsableOpenRouterKey,
      },

      agent: {
        enabled:
          true,

        endpoint:
          "/api/agent",

        architecture:
          "Gemini + OpenRouter Fallback + JSON Agent Protocol + Local Tool Controller",

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
   SEARCH TYPES
========================================================= */

interface SearchSource {
  title: string;
  url: string;
}

interface SearchResultPayload {
  query: string;
  summary: string;
  verifiedFacts: string[];
  estimates: string[];
  uncertainties: string[];
  sources: SearchSource[];
  suggestedActions: string[];
  provider?: string;
  latency?: number;
}

/* =========================================================
   SEARCH URL VALIDATION
========================================================= */

function isValidHttpUrl(
  value: unknown
): boolean {
  try {
    const url =
      new URL(
        String(value || "")
      );

    return (
      url.protocol ===
        "http:" ||
      url.protocol ===
        "https:"
    );
  } catch {
    return false;
  }
}

/* =========================================================
   SEARCH SOURCE EXTRACTION
========================================================= */

function extractUrlsFromValue(
  value: unknown,
  found: Map<string, SearchSource>,
  depth = 0
): void {
  if (
    depth > 7 ||
    value === null ||
    value === undefined
  ) {
    return;
  }

  if (
    found.size >= 15
  ) {
    return;
  }

  if (
    typeof value === "string"
  ) {
    const urlMatches =
      value.match(
        /https?:\/\/[^\s"'<>\\]+/g
      ) || [];

    for (
      const rawUrl of urlMatches
    ) {
      const cleanedUrl =
        rawUrl
          .replace(
            /[),.;]+$/,
            ""
          )
          .trim();

      if (
        isValidHttpUrl(
          cleanedUrl
        )
      ) {
        if (
          !found.has(
            cleanedUrl
          )
        ) {
          found.set(
            cleanedUrl,
            {
              title:
                cleanedUrl,
              url:
                cleanedUrl,
            }
          );
        }
      }
    }

    return;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of value
    ) {
      extractUrlsFromValue(
        item,
        found,
        depth + 1
      );

      if (
        found.size >= 15
      ) {
        break;
      }
    }

    return;
  }

  if (
    typeof value ===
    "object"
  ) {
    const object =
      value as Record<
        string,
        unknown
      >;

    const possibleUrl =
      object.url ||
      object.uri ||
      object.link ||
      object.href;

    const possibleTitle =
      object.title ||
      object.name ||
      object.text ||
      object.source;

    if (
      isValidHttpUrl(
        possibleUrl
      )
    ) {
      const url =
        String(
          possibleUrl
        ).trim();

      const title =
        cleanText(
          possibleTitle ||
            url,
          300
        );

      if (
        !found.has(url)
      ) {
        found.set(
          url,
          {
            title,
            url,
          }
        );
      }
    }

    for (
      const [key, child] of
      Object.entries(object)
    ) {
      /*
       * Avoid treating huge metadata fields
       * as sources unless they actually contain URLs.
       */
      if (
        key === "apiKey" ||
        key === "authorization" ||
        key === "headers"
      ) {
        continue;
      }

      extractUrlsFromValue(
        child,
        found,
        depth + 1
      );

      if (
        found.size >= 15
      ) {
        break;
      }
    }
  }
}

function extractSearchSources(
  value: unknown
): SearchSource[] {
  const found =
    new Map<
      string,
      SearchSource
    >();

  extractUrlsFromValue(
    value,
    found
  );

  return Array.from(
    found.values()
  ).slice(0, 10);
}

/* =========================================================
   GEMINI WEB SEARCH
========================================================= */

async function callGeminiSearch(
  query: string,
  language: string
): Promise<{
  summary: string;
  sources: SearchSource[];
}> {
  const apiKey =
    getGeminiKey();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  if (
    isPlaceholderKey(apiKey)
  ) {
    throw new Error(
      "GEMINI_API_KEY is still a placeholder."
    );
  }

  const ai =
    new GoogleGenAI({
      apiKey,
    });

  const searchPrompt = `
You are Nodysom AI's live web search assistant.

Search the web for the user's query and provide
an accurate, useful answer.

USER QUERY:
${query}

LANGUAGE:
${language}

Instructions:

1. Use Google Search to verify current information.
2. Prefer official and authoritative sources.
3. For current facts, use recent sources where possible.
4. Do not invent facts, websites, citations, or URLs.
5. Clearly mention uncertainty when reliable information
   cannot be verified.
6. Answer in the requested language.
7. Keep the answer useful and reasonably concise.
8. Include the important facts directly in the answer.
`;

  const interaction =
    await withTimeout(
      ai.interactions.create(
        {
          model:
            GEMINI_MODEL,

          input:
            searchPrompt,

          tools: [
            {
              type:
                "google_search",
            },
          ],

          generation_config: {
            max_output_tokens:
              4000,

            thinking_level:
              "low",
          },
        } as any,
        {
          timeout:
            AI_TIMEOUT_MS,
        }
      )
    );

  const summary =
    cleanText(
      interaction.output_text,
      30000
    );

  if (!summary) {
    throw new Error(
      "Gemini web search returned an empty response."
    );
  }

  /*
   * Search citations can appear in different parts
   * of the Interactions API response. Search the
   * response recursively for URLs.
   */

  const sources =
    extractSearchSources(
      interaction
    );

  return {
    summary,
    sources,
  };
}

/* =========================================================
   OPENROUTER WEB SEARCH
========================================================= */

async function callOpenRouterSearch(
  query: string,
  language: string
): Promise<{
  summary: string;
  sources: SearchSource[];
}> {
  const apiKey =
    getOpenRouterKey();

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured."
    );
  }

  if (
    isPlaceholderKey(apiKey)
  ) {
    throw new Error(
      "OPENROUTER_API_KEY is still a placeholder."
    );
  }

  const messages:
    ChatMessage[] = [
      {
        role:
          "system",

        content:
          `
You are Nodysom AI's live web search assistant.

Use the web search tool to research the user's
query before answering.

Language:
${language}

Rules:

- Search the web.
- Prefer official and authoritative sources.
- Do not invent facts.
- Do not invent URLs.
- Distinguish verified information from uncertainty.
- Give a concise but useful answer.
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
    await callOpenRouter(
      messages,
      {
        json: false,

        maxTokens:
          4000,

        tools: [
          {
            type:
              "openrouter:web_search",
          },
        ],
      }
    );

  const summary =
    extractResponseText(
      response
    );

  if (!summary) {
    throw new Error(
      "OpenRouter web search returned an empty response."
    );
  }

  /*
   * OpenRouter citations can be present in the
   * model response/annotations. Since callOpenRouter
   * intentionally returns only text, attempt to
   * recover URLs directly from the generated result.
   */

  const sources =
    extractSearchSources(
      summary
    );

  return {
    summary,
    sources,
  };
}

/* =========================================================
   BUILD SEARCH RESULT
========================================================= */

function buildSearchResult(
  query: string,
  summary: string,
  sources: SearchSource[],
  provider: string,
  latency: number
): SearchResultPayload {
  const verifiedFacts =
    summary
      .split(/\n+/)
      .map(
        (line) =>
          line
            .replace(
              /^[-*•]\s*/,
              ""
            )
            .replace(
              /^\d+[.)]\s*/,
              ""
            )
            .trim()
      )
      .filter(
        (line) =>
          line.length > 30 &&
          line.length < 600
      )
      .slice(0, 8);

  return {
    query,

    summary:
      summary ||
      "No result available.",

    verifiedFacts,

    estimates: [],

    uncertainties: [],

    sources,

    suggestedActions: [],

    provider,

    latency,
  };
}

/* =========================================================
   REAL AI WEB SEARCH
========================================================= */

app.post(
  "/api/ai/search",
  async (
    req,
    res
  ) => {
    const startedAt =
      Date.now();

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

      /*
       * ================================================
       * GEMINI GOOGLE SEARCH PRIMARY
       * ================================================
       */

      if (hasGeminiKey()) {
        try {
          console.log(
            "[Nodysom Search] Trying Gemini Google Search..."
          );

          const result =
            await callGeminiSearch(
              query,
              language
            );

          const latency =
            Date.now() -
            startedAt;

          console.log(
            `[Nodysom Search] Gemini web search succeeded in ${latency}ms with ${result.sources.length} sources.`
          );

          return res.json(
            buildSearchResult(
              query,
              result.summary,
              result.sources,
              "Google Gemini + Google Search",
              latency
            )
          );

        } catch (geminiError) {
          console.warn(
            "[Nodysom Search] Gemini web search failed. Trying OpenRouter.",
            geminiError instanceof Error
              ? geminiError.message
              : geminiError
          );
        }
      }

      /*
       * ================================================
       * OPENROUTER WEB SEARCH FALLBACK
       * ================================================
       */

      if (hasOpenRouterKey()) {
        try {
          console.log(
            "[Nodysom Search] Trying OpenRouter Web Search..."
          );

          const result =
            await callOpenRouterSearch(
              query,
              language
            );

          const latency =
            Date.now() -
            startedAt;

          console.log(
            `[Nodysom Search] OpenRouter web search succeeded in ${latency}ms with ${result.sources.length} sources.`
          );

          return res.json(
            buildSearchResult(
              query,
              result.summary,
              result.sources,
              "OpenRouter Web Search",
              latency
            )
          );

        } catch (openRouterError) {
          console.error(
            "[Nodysom Search] OpenRouter web search failed:",
            openRouterError instanceof Error
              ? openRouterError.message
              : openRouterError
          );

          return res.status(503).json({
            error:
              "Live web search is temporarily unavailable.",

            details:
              openRouterError instanceof Error
                ? openRouterError.message
                : String(
                    openRouterError
                  ),

            query,

            sources:
              [],

            suggestedActions:
              [],
          });
        }
      }

      /*
       * ================================================
       * NO SEARCH PROVIDER
       * ================================================
       */

      return res.status(503).json({
        error:
          "No AI search provider is configured.",

        query,

        summary:
          "Connect Gemini or OpenRouter to enable live web search.",

        verifiedFacts:
          [],

        estimates:
          [],

        uncertainties: [
          "No live search provider is configured.",
        ],

        sources:
          [],

        suggestedActions:
          [
            "Configure GEMINI_API_KEY.",
            "Configure OPENROUTER_API_KEY.",
          ],
      });

    } catch (error: any) {
      const latency =
        Date.now() -
        startedAt;

      console.error(
        `[Nodysom Search] Error after ${latency}ms:`,
        error instanceof Error
          ? error.message
          : error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Search failed.",

        query:
          cleanText(
            req.body?.query,
            1500
          ),

        sources:
          [],

        latency,
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

      if (!hasAIProvider()) {
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
        await callAI(
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

      if (!hasAIProvider()) {
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
        await callAI(
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

      const runtimeGeminiKey =
        getGeminiKey();

      const runtimeOpenRouterKey =
        getOpenRouterKey();

      const geminiUsable =
        runtimeGeminiKey.length > 0 &&
        !isPlaceholderKey(
          runtimeGeminiKey
        );

      const openRouterUsable =
        runtimeOpenRouterKey.length > 0 &&
        !isPlaceholderKey(
          runtimeOpenRouterKey
        );

      console.log(
        `[Nodysom AI] Gemini available: ${geminiUsable}`
      );

      console.log(
        `[Nodysom AI] OpenRouter available: ${openRouterUsable}`
      );

      console.log(
        `[Nodysom AI] Gemini model: ${GEMINI_MODEL}`
      );

      console.log(
        `[Nodysom AI] OpenRouter model: ${OPENROUTER_MODEL}`
      );

      console.log(
        `[Nodysom AI] AI request timeout: ${AI_TIMEOUT_MS}ms`
      );

      console.log(
        `[Nodysom Search] Primary: Gemini Google Search`
      );

      console.log(
        `[Nodysom Search] Fallback: OpenRouter Web Search`
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
