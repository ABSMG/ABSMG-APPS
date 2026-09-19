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
  Type,
} from "@google/genai";

import {
  runAgent,
  AgentRequest,
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

const MAX_MESSAGE_LENGTH = 2000;

const MAX_HISTORY_MESSAGES = 4;

const MAX_HISTORY_ITEM_LENGTH = 1200;

const MAX_MEMORY_ITEMS = 6;

const MAX_MEMORY_LENGTH = 500;

const MAX_QUERY_LENGTH = 1500;

const MAX_TOPIC_LENGTH = 500;

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

const RATE_LIMIT_WINDOW_MS =
  60 * 1000;

const MAX_REQUESTS_PER_WINDOW = 60;

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

  next();
}

/*
 * Apply rate limiting to all AI/Agent APIs.
 */
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
    process.env.GEMINI_API_KEY;

  if (
    !apiKey ||
    apiKey === "MY_GEMINI_API_KEY"
  ) {
    return null;
  }

  aiClient =
    new GoogleGenAI({
      apiKey,
    });

  return aiClient;
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
   AI TIMEOUT
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
   JSON PARSER
========================================================= */

function parseAIJson(
  text: string
): any {
  const cleaned = text
    .trim()
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
    return JSON.parse(
      cleaned
    );
  } catch {
    return {};
  }
}

/* =========================================================
   NORMALIZE HISTORY
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
   NORMALIZE MEMORIES
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
        item?.content,
        MAX_MEMORY_LENGTH
      )
    )
    .filter(Boolean);
}

/* =========================================================
   BUILD AGENT CONTEXT
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
   AGENT AI ANSWER
========================================================= */

async function generateAgentAnswer(
  request: AgentRequest,
  toolResult?: string
): Promise<string> {
  const ai = getAI();

  /*
   * Offline fallback.
   */
  if (!ai) {
    if (toolResult) {
      return `The tool result is: ${toolResult}`;
    }

    return `I heard: "${cleanText(
      request.message,
      MAX_MESSAGE_LENGTH
    )}". Connect a Gemini API key to enable full AI reasoning.`;
  }

  const message = cleanText(
    request.message,
    MAX_MESSAGE_LENGTH
  );

  const {
    historyText,
    memoryText,
    profileText,
  } = buildAgentContext(
    request
  );

  const toolContext = toolResult
    ? `
==================================================
TOOL RESULT
==================================================

A tool was executed for this request.

Tool result:
${toolResult}

IMPORTANT:
- Treat the tool result as authoritative for the calculation/action it performed.
- Do not invent a different result.
- Explain the result naturally.
`
    : "";

  const systemInstruction = `
You are Nodysom AI, a general-purpose AI agent.

You are NOT specialized only for scholarships,
jobs, education, productivity or one particular
industry.

You are a UNIVERSAL GENERAL AI AGENT.

Your job is to:
1. Understand the user's intent.
2. Use available tool results when provided.
3. Reason about the task.
4. Give an accurate and useful answer.
5. Be concise when the question is simple.
6. Give step-by-step help when the task requires it.
7. Never claim that you performed an action that you did not perform.
8. Never invent tool results.
9. Respect the user's preferred language when possible.

USER PROFILE:
${profileText}

MEMORIES:
${memoryText}

RECENT CONVERSATION:
${historyText}

${toolContext}
`;

  const response =
    await withTimeout(
      ai.models.generateContent({
        model:
          "gemini-3.8-flash",

        contents: [
          {
            role: "user",

            parts: [
              {
                text: message,
              },
            ],
          },
        ],

        config: {
          systemInstruction,

          responseMimeType:
            "text/plain",
        },
      })
    );

  const answer =
    response.text
      ?.trim();

  if (!answer) {
    return "I am here to help.";
  }

  return answer;
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      status: "ok",

      appName:
        "Nodysom AI",

      tagline:
        "Plan Your Day. Live Smarter.",

      hasGeminiKey: Boolean(
        process.env.GEMINI_API_KEY &&
          process.env.GEMINI_API_KEY !==
            "MY_GEMINI_API_KEY"
      ),

      agent: {
        enabled: true,

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
  async (req, res) => {
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

      /*
       * Build a clean AgentRequest.
       */
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
            (content) => ({
              content,
            })
          ),
      };

      /*
       * Run:
       *
       * Understand
       *    ↓
       * Plan
       *    ↓
       * Tool
       *    ↓
       * Verify
       *    ↓
       * Gemini
       *    ↓
       * Answer
       */
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
        `[Nodysom AI Agent] ${latency}ms | tool=${result.tool || "none"}`
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
        `[Nodysom AI Agent] Error after ${latency}ms:`,
        error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Agent request failed.",

        reply:
          "Nodysom AI could not process that request right now. Please try again.",

        usedTool: false,

        latency,
      });
    }
  }
);

/* =========================================================
   1. AI ASSISTANT
   EXISTING COMPATIBILITY ENDPOINT
========================================================= */

app.post(
  "/api/ai/assistant",
  async (req, res) => {
    const startedAt =
      Date.now();

    try {
      const {
        message,
        history = [],
        userProfile,
        memories = [],
      } = req.body;

      const userMessage =
        cleanText(
          message,
          MAX_MESSAGE_LENGTH
        );

      if (!userMessage) {
        return res.status(400).json({
          error:
            "Message is required",
        });
      }

      const ai = getAI();

      /* =====================================================
         OFFLINE FALLBACK
      ===================================================== */

      if (!ai) {
        return res.json({
          reply:
            `I heard: "${userMessage}". Connect a Gemini API key to enable full AI reasoning.`,

          detectedAction:
            parseFallbackAction(
              userMessage
            ),

          newMemory: null,
        });
      }

      /* =====================================================
         HISTORY
      ===================================================== */

      const recentHistory =
        normalizeHistory(
          history
        );

      /* =====================================================
         MEMORIES
      ===================================================== */

      const recentMemories =
        normalizeMemories(
          memories
        );

      const memoryContext =
        recentMemories.length > 0
          ? `Known user facts: ${recentMemories.join(
              "; "
            )}`
          : "";

      /* =====================================================
         PROFILE
      ===================================================== */

      const profileContext =
        userProfile
          ? `
User name: ${cleanText(
              userProfile.name ||
                "User",
              100
            )}

Language: ${cleanText(
              userProfile
                .preferredLanguage ||
                "en",
              30
            )}

Goals: ${cleanText(
              userProfile.goals ||
                "general productivity",
              500
            )}
`
          : "";

      /* =====================================================
         HISTORY TEXT
      ===================================================== */

      const historyText =
        recentHistory.length > 0
          ? recentHistory
              .map(
                (item: any) =>
                  `${item.role}: ${item.content}`
              )
              .join("\n")
          : "No previous conversation.";

      /* =====================================================
         SYSTEM INSTRUCTION
      ===================================================== */

      const systemInstruction = `
You are Nodysom AI, a fast everyday AI assistant.

Be helpful, direct, accurate, concise and actionable.

${profileContext}

${memoryContext}

Rules:
1. Answer the user's request directly.
2. Detect TASK, REMINDER, SCHEDULE or BUDGET actions when appropriate.
3. If there is no action, use detectedAction type NONE.
4. Suggest a memory only for important lasting user facts or preferences.
5. Return valid JSON only.
`;

      /* =====================================================
         GEMINI
      ===================================================== */

      const response =
        await withTimeout(
          ai.models.generateContent({
            model:
              "gemini-3.8-flash",

            contents: [
              {
                role: "user",

                parts: [
                  {
                    text: `Recent conversation:
${historyText}

Current request:
${userMessage}`,
                  },
                ],
              },
            ],

            config: {
              systemInstruction,

              responseMimeType:
                "application/json",

              responseSchema: {
                type: Type.OBJECT,

                properties: {
                  reply: {
                    type: Type.STRING,
                  },

                  detectedAction: {
                    type: Type.OBJECT,

                    properties: {
                      type: {
                        type: Type.STRING,

                        description:
                          "TASK, REMINDER, SCHEDULE, BUDGET, or NONE",
                      },

                      title: {
                        type: Type.STRING,
                      },

                      date: {
                        type: Type.STRING,
                      },

                      time: {
                        type: Type.STRING,
                      },

                      category: {
                        type: Type.STRING,
                      },

                      amount: {
                        type: Type.NUMBER,
                      },

                      confirmedRequired: {
                        type:
                          Type.BOOLEAN,
                      },
                    },
                  },

                  newMemory: {
                    type: Type.STRING,
                  },
                },

                required: [
                  "reply",
                ],
              },
            },
          })
        );

      const parsed =
        parseAIJson(
          response.text ||
            "{}"
        );

      const latency =
        Date.now() -
        startedAt;

      console.log(
        `[Nodysom AI Assistant] ${latency}ms`
      );

      return res.json({
        reply:
          typeof parsed.reply ===
            "string" &&
          parsed.reply.trim()
            ? parsed.reply.trim()
            : "I am here to help.",

        detectedAction:
          parsed
            .detectedAction
            ?.type &&
          parsed
            .detectedAction
            .type !== "NONE"
            ? parsed.detectedAction
            : null,

        newMemory:
          typeof parsed.newMemory ===
            "string" &&
          parsed.newMemory.trim()
            ? parsed.newMemory.trim()
            : null,

        latency,
      });
    } catch (error: any) {
      const latency =
        Date.now() -
        startedAt;

      console.error(
        `[Nodysom AI Assistant] Error after ${latency}ms:`,
        error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Failed to process request",

        reply:
          "Nodysom AI could not process that right now. Please try again.",

        latency,
      });
    }
  }
);

/* =========================================================
   2. UNIVERSAL SEARCH
========================================================= */

app.post(
  "/api/ai/search",
  async (req, res) => {
    try {
      const {
        query,
        language = "en",
      } = req.body;

      const searchQuery =
        cleanText(
          query,
          MAX_QUERY_LENGTH
        );

      if (!searchQuery) {
        return res.status(400).json({
          error:
            "Query is required",
        });
      }

      const ai = getAI();

      if (!ai) {
        return res.json({
          summary:
            `Search results for: "${searchQuery}".`,

          verifiedFacts: [
            "Nodysom AI provides fast AI-powered assistance.",
          ],

          estimates: [
            "Processing time depends on network and AI availability.",
          ],

          uncertainties: [
            "Cloud connection unavailable.",
          ],

          sources: [],

          suggestedActions: [
            "Explore local features",
            "Add a task to your planner",
          ],
        });
      }

      const safeLanguage =
        cleanText(
          language,
          30
        );

      const systemInstruction = `
You are Nodysom AI Universal Search.

Respond in ${safeLanguage}.

Give concise and useful answers.

Separate:
- Verified facts
- Estimates
- Uncertainties

Never invent information.

Provide useful reputable reference domains when appropriate.
`;

      const response =
        await withTimeout(
          ai.models.generateContent({
            model:
              "gemini-3.8-flash",

            contents:
              `Search Query: "${searchQuery}"`,

            config: {
              systemInstruction,

              responseMimeType:
                "application/json",

              responseSchema: {
                type: Type.OBJECT,

                properties: {
                  summary
