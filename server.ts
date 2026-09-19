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
        item?.content,
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
   AGENT AI ANSWER
========================================================= */

async function generateAgentAnswer(
  request: AgentRequest,
  toolResult?: string
): Promise<string> {
  const ai = getAI();

  /* -------------------------------------------------------
     OFFLINE MODE
  ------------------------------------------------------- */

  if (!ai) {
    if (toolResult) {
      return (
        `Tool result: ${toolResult}`
      );
    }

    return (
      `I received your request: "${cleanText(
        request.message,
        MAX_MESSAGE_LENGTH
      )}". Gemini is not connected yet.`
    );
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

  const toolContext =
    toolResult
      ? `
TOOL RESULT:

${toolResult}

Use this result as authoritative.
Do not invent a different result.
`
      : "";

  const systemInstruction = `
You are Nodysom AI.

You are a general-purpose universal AI agent.

You are NOT limited to:
- scholarships
- jobs
- education
- productivity

You can help with many legitimate general tasks.

Your responsibilities:

1. Understand the user's request.
2. Use available tool results.
3. Reason carefully.
4. Give accurate answers.
5. Be concise for simple questions.
6. Give step-by-step guidance when useful.
7. Never claim an action was completed when it was not.
8. Never invent tool results.
9. Respect the user's preferred language.
10. Clearly state uncertainty when information is uncertain.

USER PROFILE:
${profileText}

MEMORIES:
${memoryText}

RECENT CONVERSATION:
${historyText}

${toolContext}
`;

  try {
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
      response.text?.trim();

    if (!answer) {
      return (
        "I am here to help."
      );
    }

    return answer;
  } catch (error: any) {
    console.error(
      "[Nodysom AI] Gemini error:",
      error
    );

    if (toolResult) {
      return (
        `Tool result: ${toolResult}`
      );
    }

    return (
      "Nodysom AI could not connect to the AI model right now. Please try again."
    );
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
    res.json({
      status: "ok",

      appName:
        "Nodysom AI",

      tagline:
        "Plan Your Day. Live Smarter.",

      aiProvider:
        "Google Gemini",

      hasGeminiKey:
        Boolean(
          process.env.GEMINI_API_KEY &&
            process.env.GEMINI_API_KEY !==
              "MY_GEMINI_API_KEY"
        ),

      agent: {
        enabled: true,

        endpoint:
          "/api/agent",

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

      /*
       * AGENT LOOP
       *
       * Understand
       *      ↓
       * Plan
       *      ↓
       * Choose Tool
       *      ↓
       * Execute
       *      ↓
       * Check Result
       *      ↓
       * AI Answer
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
        `[Nodysom Agent] ${latency}ms | tool=${result.tool || "none"}`
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
   LEGACY AI ASSISTANT
   Keeps compatibility with older clients.
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
          result.tool || null,

        toolResult:
          result.toolResult ||
          null,
      });
    } catch (error: any) {
      console.error(
        "[Nodysom Assistant] Error:",
        error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Failed to process request.",

        reply:
          "Nodysom AI could not process that request right now.",
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

      const ai = getAI();

      if (!ai) {
        return res.json({
          summary:
            `Search request received: "${query}"`,

          verifiedFacts: [],

          estimates: [],

          uncertainties: [
            "AI search service is not connected.",
          ],

          sources: [],

          suggestedActions: [],
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
Clearly distinguish known information from uncertainty.
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

        verifiedFacts: [],

        estimates: [],

        uncertainties: [],

        sources: [],

        suggestedActions: [],
      });
    } catch (error: any) {
      console.error(
        "[Nodysom Search] Error:",
        error
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
          middlewareMode: true,
        },

        appType: "spa",
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
    }
  );
}

startServer().catch(
  (error) => {
    console.error(
      "Failed to start Nodysom AI:",
      error
    );

    process.exit(1);
  }
);
