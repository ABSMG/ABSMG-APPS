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
  AgentRequest,
  AgentAIContext,
} from "./src/agent/agentController";

dotenv.config();

/* =========================================================
   APP
========================================================= */

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

/* =========================================================
   PERFORMANCE SETTINGS
========================================================= */

const AI_TIMEOUT_MS = 30000;

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
   GEMINI CLIENT
========================================================= */

let aiClient:
  | GoogleGenAI
  | null = null;

function getAI():
  | GoogleGenAI
  | null {
  if (aiClient) {
    return aiClient;
  }

  const apiKey =
    String(
      process.env.GEMINI_API_KEY || ""
    ).trim();

  const isPlaceholder =
    !apiKey ||
    /^(YOUR_|MY_|PASTE_|CHANGE_ME)/i.test(
      apiKey
    );

  if (isPlaceholder) {
    console.error(
      "[Nodysom AI] GEMINI_API_KEY is missing or still a placeholder."
    );

    return null;
  }

  try {
    aiClient =
      new GoogleGenAI({
        apiKey,
      });

    console.log(
      "[Nodysom AI] Gemini client initialized."
    );

    return aiClient;

  } catch (error) {

    console.error(
      "[Nodysom AI] Failed to initialize Gemini client:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    aiClient = null;

    return null;
  }
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
) {
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
    request.userProfile;

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
   GEMINI FUNCTION DECLARATIONS
========================================================= */

const GEMINI_AGENT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "calculator",

        description:
          "Safely evaluates a mathematical expression. Use this for arithmetic calculations, percentages, parentheses, addition, subtraction, multiplication, division, and modulo.",

        parameters: {
          type: "object",

          properties: {
            input: {
              type: "string",

              description:
                "The mathematical expression to calculate. Example: 25 * 4 + 10",
            },
          },

          required: [
            "input",
          ],
        },
      },

      {
        name: "time",

        description:
          "Returns the current date and time.",

        parameters: {
          type: "object",

          properties: {},
        },
      },

      {
        name: "text_stats",

        description:
          "Calculates basic statistics for text, including word count and character count.",

        parameters: {
          type: "object",

          properties: {
            input: {
              type: "string",

              description:
                "The text that should be analyzed.",
            },
          },

          required: [
            "input",
          ],
        },
      },
    ],
  },
];

/* =========================================================
   AGENT AI ANSWER
   GEMINI + NATIVE FUNCTION CALLING
========================================================= */

async function generateAgentAnswer(
  request: AgentRequest,
  toolResult?: string,
  context?: AgentAIContext
) {
  const ai = getAI();

  /* -------------------------------------------------------
     OFFLINE MODE
  ------------------------------------------------------- */

  if (!ai) {
    return {
      reply: toolResult
        ? `Tool result: ${toolResult}`
        : `I received your request: "${cleanText(
            request.message,
            MAX_MESSAGE_LENGTH
          )}". Gemini is not connected yet.`,

      detectedAction:
        null,

      newMemory:
        null,

      toolCall:
        null,

      toolCallId:
        null,

      modelContent:
        null,
    };
  }

  const message =
    cleanText(
      request.message,
      MAX_MESSAGE_LENGTH
    );

  const {
    historyText,
    memoryText,
    profileText,
  } =
    buildAgentContext(
      request
    );

  /* -------------------------------------------------------
     SYSTEM INSTRUCTION
  ------------------------------------------------------- */

  const systemInstruction = `
You are Nodysom AI.

You are a general-purpose universal AI agent.

You are NOT limited to:

- scholarships
- jobs
- education
- productivity

You can help with many legitimate general tasks.

==================================================
CORE AGENT BEHAVIOR
==================================================

Your job is to:

1. Understand the user's request.
2. Decide whether a tool is needed.
3. Request the correct tool when needed.
4. Use the returned tool result.
5. Continue reasoning when another step is required.
6. Give a useful final answer.
7. Never invent tool results.
8. Never claim an action happened when it did not.
9. Respect the user's preferred language.
10. State uncertainty when appropriate.

==================================================
AVAILABLE FUNCTION TOOLS
==================================================

calculator

Use calculator for mathematical calculations.

Examples:

"What is 25 * 40?"

"Calculate 15% of 800."

"(20 + 5) * 4"

Do not invent mathematical results.

--------------------------------------------------

time

Use time when the user asks for the current
date or current time.

--------------------------------------------------

text_stats

Use text_stats when the user asks for:

- word count
- character count
- text statistics

==================================================
SMART ACTIONS
==================================================

If the user asks Nodysom to:

- create
- add
- schedule
- remind
- plan
- organize

something, create a detectedAction proposal.

The detectedAction is ONLY a proposal.

The frontend must ask the user for confirmation.

Never claim the action has already been added.

==================================================
MEMORY
==================================================

Only create newMemory when the user explicitly
shares a useful personal fact, preference, goal,
habit, or other information that Nodysom should
remember.

Do not create memories from ordinary questions.

==================================================
LANGUAGE
==================================================

Respect the user's preferred language.

If the user writes in Swahili, respond in Swahili
unless another language is requested.

==================================================
FINAL RESPONSE FORMAT
==================================================

When you are ready to answer without requesting
another tool, return ONLY valid JSON.

Required format:

{
  "reply": "natural response to the user",
  "detectedAction": null,
  "newMemory": null
}

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

  try {

    /* =====================================================
       FIRST / NORMAL GEMINI REQUEST
    ===================================================== */

    let contents: any[];

    if (
      toolResult &&
      context?.modelContent &&
      context?.toolCallId &&
      context?.toolName
    ) {

      /* ===================================================
         NATIVE FUNCTION RESPONSE
      =================================================== */

      contents = [
        {
          role: "user",

          parts: [
            {
              text: message,
            },
          ],
        },

        context.modelContent,

        {
          role: "user",

          parts: [
            {
              functionResponse: {
                id:
                  context.toolCallId,

                name:
                  context.toolName,

                response: {
                  result:
                    toolResult,
                },
              },
            },
          ],
        },
      ];

    } else {

      contents = [
        {
          role: "user",

          parts: [
            {
              text: message,
            },
          ],
        },
      ];
    }

    /* =====================================================
       CALL GEMINI
    ===================================================== */

    const response =
      await withTimeout(
        ai.models.generateContent({
          model:
            "gemini-3.8-flash",

          contents,

          config: {
            systemInstruction,

            tools:
              GEMINI_AGENT_TOOLS,
          },
        })
      );

    /* =====================================================
       CHECK FUNCTION CALL
    ===================================================== */

    const functionCalls =
      response.functionCalls || [];

    if (
      Array.isArray(functionCalls) &&
      functionCalls.length > 0
    ) {

      const call =
        functionCalls[0];

      const functionName =
        cleanText(
          call?.name,
          100
        );

      const args =
        call?.args &&
        typeof call.args ===
          "object"
          ? call.args as Record<
              string,
              unknown
            >
          : {};

      let input = "";

      if (
        typeof args.input ===
        "string"
      ) {
        input =
          args.input;
      }

      if (
        functionName ===
          "time" &&
        !input
      ) {
        input =
          "current";
      }

      if (!input) {
        input =
          JSON.stringify(
            args
          );
      }

      const allowedTools = [
        "calculator",
        "time",
        "text_stats",
      ];

      if (
        !allowedTools.includes(
          functionName
        )
      ) {
        return {
          reply:
            `Gemini requested an unavailable tool: ${functionName}`,

          detectedAction:
            null,

          newMemory:
            null,

          toolCall:
            null,

          toolCallId:
            null,

          modelContent:
            null,
        };
      }

      const modelContent =
        response
          .candidates?.[0]
          ?.content || null;

      const toolCallId =
        cleanText(
          (call as any)?.id,
          200
        );

      return {
        reply:
          "",

        detectedAction:
          null,

        newMemory:
          null,

        toolCall: {
          tool:
            functionName as
              | "calculator"
              | "time"
              | "text_stats",

          input,
        },

        toolCallId:
          toolCallId || null,

        modelContent,
      };
    }

    /* =====================================================
       NORMAL FINAL RESPONSE
    ===================================================== */

    const raw =
      response.text?.trim() ||
      "";

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

        toolCallId:
          null,

        modelContent:
          null,
      };
    }

    let parsed:
      any;

    try {

      parsed =
        JSON.parse(raw);

    } catch {

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

        parsed =
          JSON.parse(
            cleaned
          );

      } catch {

        return {
          reply:
            cleanText(
              raw,
              10000
            ),

          detectedAction:
            null,

          newMemory:
            null,

          toolCall:
            null,

          toolCallId:
            null,

          modelContent:
            null,
        };
      }
    }

    const reply =
      cleanText(
        parsed?.reply,
        10000
      ) ||
      "I am here to help.";

    let detectedAction =
      null;

    if (
      parsed?.detectedAction &&
      typeof parsed.detectedAction ===
        "object"
    ) {

      const action =
        parsed.detectedAction;

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
        parsed?.newMemory,
        MAX_MEMORY_LENGTH
      ) ||
      null;

    return {
      reply,

      detectedAction,

      newMemory,

      toolCall:
        null,

      toolCallId:
        null,

      modelContent:
        null,
    };

  } catch (error: any) {

    console.error(
      "[Nodysom AI] Gemini request error:",
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

        toolCallId:
          null,

        modelContent:
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

      toolCallId:
        null,

      modelContent:
        null,
    };
  }
}

/* =========================================================
   HEALTH CHECK + SAFE GEMINI DIAGNOSTICS
========================================================= */

app.get(
  "/api/health",
  (
    _req,
    res
  ) => {

    const rawKey =
      String(
        process.env.GEMINI_API_KEY || ""
      );

    const trimmedKey =
      rawKey.trim();

    const placeholderDetected =
      !trimmedKey ||
      /^(YOUR_|MY_|PASTE_|CHANGE_ME)/i.test(
        trimmedKey
      );

    const hasGeminiKey =
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
        "Google Gemini",

      model:
        "gemini-3.8-flash",

      hasGeminiKey,

      geminiDiagnostics: {

        environmentVariableExists:
          rawKey.length > 0,

        trimmedValueExists:
          trimmedKey.length > 0,

        keyLength:
          trimmedKey.length,

        placeholderDetected,

        usableKeyDetected:
          hasGeminiKey,

      },

      agent: {

        enabled:
          true,

        endpoint:
          "/api/agent",

        architecture:
          "Gemini Native Function Calling + Agent Controller",

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
        AgentRequest = {

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
          ).map(
            (
              content
            ) => ({
              content,
            })
          ),
      };

      const result =
        await runAgent(

          agentRequest,

          async (
            request,
            toolResult,
            context
          ) => {

            return generateAgentAnswer(
              request,
              toolResult,
              context
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
        AgentRequest = {

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
          ).map(
            (
              content
            ) => ({
              content,
            })
          ),
      };

      const result =
        await runAgent(

          agentRequest,

          async (
            request,
            toolResult,
            context
          ) => {

            return generateAgentAnswer(
              request,
              toolResult,
              context
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
   SIMPLE SEARCH COMPATIBILITY ENDPOINT
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

      const ai =
        getAI();

      if (!ai) {

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

      const response =
        await withTimeout(
          ai.models.generateContent({

            model:
              "gemini-3.8-flash",

            contents:
              `User search request:

${query}

Respond in ${language}.

Give a concise answer.

Clearly distinguish known information
from uncertainty.

Do not invent sources.`,

            config: {
              responseMimeType:
                "text/plain",
            },

          })
        );

      return res.json({

        summary:
          response.text?.trim() ||
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

      const ai =
        getAI();

      if (!ai) {

        return res.status(503).json({
          error:
            "Translation AI is not connected.",
        });

      }

      const prompt = `
Translate the following text accurately.

Source language: ${sourceLanguage}
Target language: ${targetLanguage}

Return ONLY valid JSON with exactly these fields:

{
  "translatedText": "translation",
  "phoneticGuide": "optional pronunciation guide, or empty string",
  "notes": "brief useful translation note, or empty string"
}

Do not wrap the JSON in markdown fences.

Preserve the original meaning, names, numbers,
formatting, and tone.

Text:

${text}
`;

      const response =
        await withTimeout(
          ai.models.generateContent({

            model:
              "gemini-3.8-flash",

            contents:
              prompt,

            config: {
              responseMimeType:
                "application/json",
            },

          })
        );

      const raw =
        response.text?.trim() ||
        "";

      let parsed: {
        translatedText?: unknown;
        phoneticGuide?: unknown;
        notes?: unknown;
      };

      try {

        parsed =
          JSON.parse(raw);

      } catch {

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

        parsed =
          JSON.parse(
            cleaned
          );
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

      const ai =
        getAI();

      if (!ai) {

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

      const schedulePrompt = `
Create a practical daily schedule for the user.

Date: ${date}

User request:
${prompt}

Return ONLY valid JSON in exactly this shape:

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

- Create 3 to 12 useful schedule items.
- Use 24-hour HH:MM time.
- Keep titles short and actionable.
- durationMinutes must be a positive integer when included.
- Do not invent appointments or commitments.
- Respect explicit times in the user's request.
- If the user gives no times, choose sensible times.
- Avoid overlapping items.
- Include breaks when appropriate.
- Keep notes short.
- Return JSON only.
- Do not use markdown.
`;

      const response =
        await withTimeout(
          ai.models.generateContent({

            model:
              "gemini-3.8-flash",

            contents:
              schedulePrompt,

            config: {
              responseMimeType:
                "application/json",
            },

          })
        );

      const raw =
        response.text?.trim() ||
        "";

      let parsed:
        any;

      try {

        parsed =
          JSON.parse(raw);

      } catch {

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

        parsed =
          JSON.parse(
            cleaned
          );
      }

      const sourceSchedule =
        Array.isArray(
          parsed?.schedule
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
        String(
          process.env.GEMINI_API_KEY || ""
        ).trim();

      const runtimeKeyUsable =
        runtimeKey.length > 0 &&
        !/^(YOUR_|MY_|PASTE_|CHANGE_ME)/i.test(
          runtimeKey
        );

      console.log(
        `[Nodysom AI] Gemini key available: ${runtimeKeyUsable}`
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
