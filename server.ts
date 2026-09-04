import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

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

app.use(express.json({ limit: "1mb" }));

/* =========================================================
   RATE LIMITING
========================================================= */

const rateLimitMap = new Map<
  string,
  { count: number; resetTime: number }
>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

function checkRateLimit(
  req: Request,
  res: Response,
  next: () => void
) {
  const ip = req.ip || "global-client";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });

    return next();
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error:
        "Rate limit reached. Please wait a moment before trying again.",
    });
  }

  entry.count++;
  next();
}

app.use("/api/ai", checkRateLimit);

/* =========================================================
   GEMINI CLIENT
========================================================= */

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (aiClient) {
    return aiClient;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }

  aiClient = new GoogleGenAI({
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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = AI_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>(
    (_, reject) => {
      timeoutId = setTimeout(() => {
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
    clearTimeout(timeoutId!);
  }
}

function parseAIJson(text: string): any {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    appName: "Nodysom AI",
    tagline: "Plan Your Day. Live Smarter.",
    hasGeminiKey: Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !==
          "MY_GEMINI_API_KEY"
    ),
  });
});

/* =========================================================
   1. AI ASSISTANT
========================================================= */

app.post(
  "/api/ai/assistant",
  async (req, res) => {
    const startedAt = Date.now();

    try {
      const {
        message,
        history = [],
        userProfile,
        memories = [],
      } = req.body;

      const userMessage = cleanText(
        message,
        MAX_MESSAGE_LENGTH
      );

      if (!userMessage) {
        return res.status(400).json({
          error: "Message is required",
        });
      }

      const ai = getAI();

      /* Offline fallback */

      if (!ai) {
        return res.json({
          reply: `I heard: "${userMessage}". Connect a Gemini API key to enable full AI reasoning.`,
          detectedAction:
            parseFallbackAction(userMessage),
          newMemory: null,
        });
      }

      /* Keep only recent conversation */

      const recentHistory = Array.isArray(history)
        ? history
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
              (item: any) => item.content
            )
        : [];

      /* Keep only recent memories */

      const recentMemories = Array.isArray(
        memories
      )
        ? memories
            .slice(0, MAX_MEMORY_ITEMS)
            .map((item: any) =>
              cleanText(
                item?.content,
                MAX_MEMORY_LENGTH
              )
            )
            .filter(Boolean)
        : [];

      const memoryContext =
        recentMemories.length > 0
          ? `Known user facts: ${recentMemories.join(
              "; "
            )}`
          : "";

      const profileContext = userProfile
        ? `
User name: ${cleanText(
            userProfile.name || "User",
            100
          )}
Language: ${cleanText(
            userProfile.preferredLanguage || "en",
            30
          )}
Goals: ${cleanText(
            userProfile.goals ||
              "general productivity",
            500
          )}
`
        : "";

      const historyText =
        recentHistory.length > 0
          ? recentHistory
              .map(
                (item: any) =>
                  `${item.role}: ${item.content}`
              )
              .join("\n")
          : "No previous conversation.";

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

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-3.8-flash",

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
            responseMimeType: "application/json",

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
                      type: Type.BOOLEAN,
                    },
                  },
                },

                newMemory: {
                  type: Type.STRING,
                },
              },

              required: ["reply"],
            },
          },
        })
      );

      const parsed = parseAIJson(
        response.text || "{}"
      );

      const latency =
        Date.now() - startedAt;

      console.log(
        `[Nodysom AI Assistant] ${latency}ms`
      );

      return res.json({
        reply:
          typeof parsed.reply === "string" &&
          parsed.reply.trim()
            ? parsed.reply.trim()
            : "I am here to help.",

        detectedAction:
          parsed.detectedAction?.type &&
          parsed.detectedAction.type !==
            "NONE"
            ? parsed.detectedAction
            : null,

        newMemory:
          typeof parsed.newMemory === "string" &&
          parsed.newMemory.trim()
            ? parsed.newMemory.trim()
            : null,

        latency,
      });
    } catch (error: any) {
      const latency =
        Date.now() - startedAt;

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

      const searchQuery = cleanText(
        query,
        MAX_QUERY_LENGTH
      );

      if (!searchQuery) {
        return res.status(400).json({
          error: "Query is required",
        });
      }

      const ai = getAI();

      if (!ai) {
        return res.json({
          summary: `Search results for: "${searchQuery}".`,
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

      const safeLanguage = cleanText(
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

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-3.8-flash",

          contents: `Search Query: "${searchQuery}"`,

          config: {
            systemInstruction,
            responseMimeType: "application/json",

            responseSchema: {
              type: Type.OBJECT,

              properties: {
                summary: {
                  type: Type.STRING,
                },

                verifiedFacts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                },

                estimates: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                },

                uncertainties: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                },

                sources: {
                  type: Type.ARRAY,

                  items: {
                    type: Type.OBJECT,

                    properties: {
                      title: {
                        type: Type.STRING,
                      },

                      url: {
                        type: Type.STRING,
                      },
                    },
                  },
                },

                suggestedActions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                },
              },

              required: [
                "summary",
                "verifiedFacts",
                "estimates",
                "uncertainties",
              ],
            },
          },
        })
      );

      return res.json(
        parseAIJson(
          response.text || "{}"
        )
      );
    } catch (error: any) {
      console.error(
        "AI Search Error:",
        error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Failed to search",
      });
    }
  }
);

/* =========================================================
   3. SMART SCHEDULE
========================================================= */

app.post(
  "/api/ai/smart-schedule",
  async (req, res) => {
    try {
      const {
        prompt,
        date,
      } = req.body;

      const userPrompt = cleanText(
        prompt,
        MAX_QUERY_LENGTH
      );

      if (!userPrompt) {
        return res.status(400).json({
          error: "Prompt is required",
        });
      }

      const ai = getAI();

      if (!ai) {
        return res.json({
          schedule: [
            {
              time: "08:00 AM",
              title: "Morning Review & Focus",
              durationMinutes: 60,
              category: "Work",
            },
            {
              time: "10:00 AM",
              title: "Deep Work Session",
              durationMinutes: 120,
              category: "Study",
            },
            {
              time: "01:00 PM",
              title: "Lunch & Walk",
              durationMinutes: 60,
              category: "Health",
            },
            {
              time: "03:00 PM",
              title: "Tasks & Communications",
              durationMinutes: 90,
              category: "Life",
            },
          ],

          advice:
            "Connect Gemini for a personalized schedule.",
        });
      }

      const systemInstruction = `
You are Nodysom AI Smart Life Scheduler.

Create a realistic daily schedule from the user's constraints.

Include:
- Work or school
- Study
- Rest
- Meals
- Personal time
- Reasonable buffers

Avoid impossible overlapping activities.

Return JSON only.
`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-3.8-flash",

          contents: `Date: ${cleanText(
            date || "Today",
            50
          )}

User constraints:
${userPrompt}`,

          config: {
            systemInstruction,
            responseMimeType: "application/json",

            responseSchema: {
              type: Type.OBJECT,

              properties: {
                schedule: {
                  type: Type.ARRAY,

                  items: {
                    type: Type.OBJECT,

                    properties: {
                      time: {
                        type: Type.STRING,
                      },

                      title: {
                        type: Type.STRING,
                      },

                      category: {
                        type: Type.STRING,
                      },

                      durationMinutes: {
                        type: Type.INTEGER,
                      },

                      notes: {
                        type: Type.STRING,
                      },
                    },

                    required: [
                      "time",
                      "title",
                      "category",
                    ],
                  },
                },

                advice: {
                  type: Type.STRING,
                },
              },

              required: ["schedule"],
            },
          },
        })
      );

      return res.json(
        parseAIJson(
          response.text || "{}"
        )
      );
    } catch (error: any) {
      console.error(
        "AI Schedule Error:",
        error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Failed to generate schedule",
      });
    }
  }
);

/* =========================================================
   4. LEARNING HUB
========================================================= */

app.post(
  "/api/ai/learn",
  async (req, res) => {
    try {
      const {
        topic,
        difficulty = "beginner",
        mode = "lesson",
      } = req.body;

      const safeTopic = cleanText(
        topic,
        MAX_TOPIC_LENGTH
      );

      if (!safeTopic) {
        return res.status(400).json({
          error: "Topic is required",
        });
      }

      const ai = getAI();

      if (!ai) {
        return res.json({
          lessonContent: `Welcome to learning ${safeTopic}! Start with the fundamentals before moving to advanced concepts.`,

          keyTakeaways: [
            "Master foundational terminology",
            "Practice regularly",
            "Use active recall",
          ],

          quiz: [
            {
              question: `What should you learn first in ${safeTopic}?`,
              options: [
                "The fundamentals",
                "Only advanced topics",
                "Nothing",
                "Skip practice",
              ],
              correctIndex: 0,
              explanation:
                "Strong fundamentals make advanced learning easier.",
            },
          ],

          flashcards: [
            {
              front: `What is ${safeTopic}?`,
              back:
                "A subject that can be learned through structured study and practice.",
            },
          ],
        });
      }

      const safeDifficulty = cleanText(
        difficulty,
        50
      );

      const safeMode = cleanText(
        mode,
        50
      );

      const systemInstruction = `
You are Nodysom AI Learning Tutor.

Teach clearly and practically.

Difficulty: ${safeDifficulty}
Mode: ${safeMode}

Use simple explanations, examples and active recall.

Return JSON only.
`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-3.8-flash",

          contents: `Topic: "${safeTopic}"`,

          config: {
            systemInstruction,
            responseMimeType: "application/json",

            responseSchema: {
              type: Type.OBJECT,

              properties: {
                lessonContent: {
                  type: Type.STRING,
                },

                keyTakeaways: {
                  type: Type.ARRAY,

                  items: {
                    type: Type.STRING,
                  },
                },

                quiz: {
                  type: Type.ARRAY,

                  items: {
                    type: Type.OBJECT,

                    properties: {
                      question: {
                        type: Type.STRING,
                      },

                      options: {
                        type: Type.ARRAY,

                        items: {
                          type: Type.STRING,
                        },
                      },

                      correctIndex: {
                        type: Type.INTEGER,
                      },

                      explanation: {
                        type: Type.STRING,
                      },
                    },

                    required: [
                      "question",
                      "options",
                      "correctIndex",
                      "explanation",
                    ],
                  },
                },

                flashcards: {
                  type: Type.ARRAY,

                  items: {
                    type: Type.OBJECT,

                    properties: {
                      front: {
                        type: Type.STRING,
                      },

                      back: {
                        type: Type.STRING,
                      },
                    },

                    required: [
                      "front",
                      "back",
                    ],
                  },
                },
              },

              required: [
                "lessonContent",
                "keyTakeaways",
                "quiz",
                "flashcards",
              ],
            },
          },
        })
      );

      return res.json(
        parseAIJson(
          response.text || "{}"
        )
      );
    } catch (error: any) {
      console.error(
        "AI Learn Error:",
        error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Failed to generate learning material",
      });
    }
  }
);

/* =========================================================
   5. UNIVERSAL TRANSLATOR
========================================================= */

app.post(
  "/api/ai/translate",
  async (req, res) => {
    try {
      const {
        text,
        targetLanguage = "Swahili",
        sourceLanguage = "auto",
      } = req.body;

      const safeText = cleanText(
        text,
        MAX_MESSAGE_LENGTH
      );

      if (!safeText) {
        return res.status(400).json({
          error: "Text is required",
        });
      }

      const ai = getAI();

      if (!ai) {
        return res.json({
          translatedText: `[Translated to ${targetLanguage}]: ${safeText}`,
          phoneticGuide:
            "Phonetic guide available with AI enabled.",
          notes:
            "Connect Gemini for accurate translation.",
        });
      }

      const safeTarget = cleanText(
        targetLanguage,
        50
      );

      const safeSource = cleanText(
        sourceLanguage,
        50
      );

      const systemInstruction = `
You are Nodysom AI Universal Translator.

Provide accurate natural translation.

Preserve:
- Meaning
- Tone
- Context

Return JSON only.
`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-3.8-flash",

          contents: `Translate from ${safeSource} to ${safeTarget}:

"${safeText}"`,

          config: {
            systemInstruction,
            responseMimeType: "application/json",

            responseSchema: {
              type: Type.OBJECT,

              properties: {
                translatedText: {
                  type: Type.STRING,
                },

                phoneticGuide: {
                  type: Type.STRING,
                },

                notes: {
                  type: Type.STRING,
                },

                detectedSource: {
                  type: Type.STRING,
                },
              },

              required: ["translatedText"],
            },
          },
        })
      );

      return res.json(
        parseAIJson(
          response.text || "{}"
        )
      );
    } catch (error: any) {
      console.error(
        "AI Translate Error:",
        error
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Failed to translate",
      });
    }
  }
);

/* =========================================================
   FALLBACK ACTION PARSER
========================================================= */

function parseFallbackAction(
  text: string
) {
  const lower = text.toLowerCase();

  if (
    lower.includes("remind") ||
    lower.includes("reminder")
  ) {
    return {
      type: "REMINDER",
      title: text
        .replace(
          /remind me to/i,
          ""
        )
        .trim(),

      date: "Tomorrow",
      time: "08:00 AM",
      confirmedRequired: true,
    };
  }

  if (
    lower.includes("task") ||
    lower.includes("todo")
  ) {
    return {
      type: "TASK",

      title: text
        .replace(
          /add task|create task/i,
          ""
        )
        .trim(),

      category: "Personal",
      confirmedRequired: true,
    };
  }

  return null;
}

/* =========================================================
   VITE / PRODUCTION SERVER
========================================================= */

async function startServer() {
  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    const vite =
      await createViteServer({
        server: {
          middlewareMode: true,
        },

        appType: "spa",
      });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(
      process.cwd(),
      "dist"
    );

    app.use(
      express.static(distPath)
    );

    app.get("*", (req, res) => {
      res.sendFile(
        path.join(
          distPath,
          "index.html"
        )
      );
    });
  }

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `Nodysom AI server running on port ${PORT}`
      );
    }
  );
}

startServer();
