import express, {
  Request,
  Response,
  NextFunction,
} from "express";

import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

import {
  createServer as createViteServer,
} from "vite";

import {
  runAgent,
  type AgentRequest,
  type AgentAIAnswer,
} from "./src/agent/agentController";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const BASE_DIR = process.cwd();
const DIST_DIR = path.join(BASE_DIR, "dist");
const PUBLIC_DIR = path.join(BASE_DIR, "public");

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

const WINDOW_MS = 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX || 60);

const requestCounts = new Map<
  string,
  { count: number; resetAt: number }
>();

function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  let entry = requestCounts.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + WINDOW_MS,
    };
  }

  entry.count += 1;
  requestCounts.set(key, entry);

  res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
  res.setHeader(
    "X-RateLimit-Remaining",
    String(Math.max(0, MAX_REQUESTS - entry.count)),
  );

  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: "Too many requests. Please try again shortly.",
    });
    return;
  }

  next();
}

app.use("/api", rateLimit);

setInterval(() => {
  const now = Date.now();

  for (const [key, entry] of requestCounts.entries()) {
    if (now >= entry.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 60_000).unref();

function getEnv(name: string): string {
  return (process.env[name] || "").trim();
}

function getAIProviderStatus() {
  return {
    geminiConfigured: Boolean(getEnv("GEMINI_API_KEY") || getEnv("GOOGLE_API_KEY")),
    openRouterConfigured: Boolean(getEnv("OPENROUTER_API_KEY")),
    groqConfigured: Boolean(getEnv("GROQ_API_KEY")),
    nodeEnv: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  };
}

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function normalizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item: any) =>
      item &&
      ["user", "assistant", "system"].includes(item.role) &&
      typeof (item.content ?? item.text) === "string"
    )
    .slice(-30)
    .map((item: any) => ({
      role: item.role,
      content: String(item.content ?? item.text).slice(0, 12000),
    }));
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value.trim();

  if (value && typeof value === "object") {
    const item = value as Record<string, any>;

    if (typeof item.text === "string") return item.text.trim();

    if (Array.isArray(item.content)) {
      return item.content
        .map((part: any) => {
          if (typeof part === "string") return part;
          return typeof part?.text === "string" ? part.text : "";
        })
        .filter(Boolean)
        .join("\n")
        .trim();
    }
  }

  return "";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error");
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}/* =========================================================
   AI PROVIDERS — FAST RESPONSE + FALLBACK
========================================================= */

const AI_TIMEOUT_MS = Math.max(
  5000,
  Number(getEnv("AI_REQUEST_TIMEOUT_MS")) || 20000,
);

const GEMINI_MODEL =
  getEnv("GEMINI_MODEL") || "gemini-2.5-flash";

const OPENROUTER_MODEL =
  getEnv("OPENROUTER_MODEL") || "openrouter/free";

const OPENROUTER_BASE_URL =
  getEnv("OPENROUTER_BASE_URL") ||
  "https://openrouter.ai/api/v1";

const GROQ_MODEL =
  getEnv("GROQ_MODEL") || "openai/gpt-oss-20b";

const GROQ_BASE_URL =
  getEnv("GROQ_BASE_URL") ||
  "https://api.groq.com/openai/v1";

const PUBLIC_APP_URL =
  (
    getEnv("PUBLIC_APP_URL") ||
    getEnv("APP_URL") ||
    "https://absmg-apps.onrender.com"
  ).replace(/\/+$/, "");

let geminiCooldownUntil = 0;

type AIResult = {
  text: string;
  provider: string;
  model: string;
};

function hasValidKey(value: string): boolean {
  const key = value.trim().toLowerCase();

  if (!key) return false;

  const invalidValues = [
    "your_api_key",
    "your-api-key",
    "replace_me",
    "replace-me",
    "placeholder",
    "changeme",
    "change_me",
    "insert_api_key",
    "your_key_here",
    "your_real_key",
    "test_key",
    "test-key",
    "none",
    "null",
    "undefined",
  ];

  return !invalidValues.some(
    (invalid) => key.includes(invalid),
  );
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  provider: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `${provider} timed out after ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer!);
  });
}

async function callGemini(
  messages: ChatMessage[],
): Promise<AIResult> {
  const apiKey =
    getEnv("GEMINI_API_KEY") ||
    getEnv("GOOGLE_API_KEY");

  if (!hasValidKey(apiKey)) {
    throw new Error("Gemini API key is not configured.");
  }

  if (Date.now() < geminiCooldownUntil) {
    throw new Error("Gemini is temporarily cooling down.");
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role:
        message.role === "assistant"
          ? "model"
          : "user",
      parts: [
        {
          text: message.content,
        },
      ],
    }));

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          ...(systemInstruction
            ? { systemInstruction }
            : {}),
        },
      } as any),
      AI_TIMEOUT_MS,
      "Gemini",
    );

    const text = extractText(response);

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return {
      text,
      provider: "gemini",
      model: GEMINI_MODEL,
    };
  } catch (error) {
    const message = getErrorMessage(error);

    if (
      /429|quota|rate.?limit|resource.?exhausted/i.test(
        message,
      )
    ) {
      geminiCooldownUntil =
        Date.now() + 5 * 60 * 1000;
    }

    throw error;
  }
}

async function callCompatibleProvider(
  provider: "openrouter" | "groq",
  messages: ChatMessage[],
): Promise<AIResult> {
  const isOpenRouter = provider === "openrouter";

  const apiKey = isOpenRouter
    ? getEnv("OPENROUTER_API_KEY")
    : getEnv("GROQ_API_KEY");

  const model = isOpenRouter
    ? OPENROUTER_MODEL
    : GROQ_MODEL;

  const baseUrl = (
    isOpenRouter
      ? OPENROUTER_BASE_URL
      : GROQ_BASE_URL
  ).replace(/\/+$/, "");

  if (!hasValidKey(apiKey)) {
    throw new Error(
      `${provider} API key is not configured.`,
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (isOpenRouter) {
    headers["HTTP-Referer"] = PUBLIC_APP_URL;
    headers["X-Title"] = "Nodysom AI";
  }

  const response = await withTimeout(
    fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        max_tokens: 1200,
      }),
    }),
    AI_TIMEOUT_MS,
    provider,
  );

  const payload: any = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      String(
        payload?.error?.message ||
        payload?.message ||
        `${provider} returned HTTP ${response.status}`,
      ).slice(0, 500),
    );
  }

  const text = extractText(
    payload?.choices?.[0]?.message?.content,
  );

  if (!text) {
    throw new Error(
      `${provider} returned an empty response.`,
    );
  }

  return {
    text,
    provider,
    model,
  };
}

async function callAI(
  messages: ChatMessage[],
): Promise<AIResult> {
  const errors: string[] = [];

  // Try Gemini first when configured.
  if (
    hasValidKey(
      getEnv("GEMINI_API_KEY") ||
      getEnv("GOOGLE_API_KEY"),
    ) &&
    Date.now() >= geminiCooldownUntil
  ) {
    try {
      return await callGemini(messages);
    } catch (error) {
      errors.push(
        `Gemini: ${getErrorMessage(error)}`,
      );
    }
  }

  // Use OpenRouter if Gemini is unavailable.
  if (hasValidKey(getEnv("OPENROUTER_API_KEY"))) {
    try {
      return await callCompatibleProvider(
        "openrouter",
        messages,
      );
    } catch (error) {
      errors.push(
        `OpenRouter: ${getErrorMessage(error)}`,
      );
    }
  }

  // Final fallback: Groq.
  if (hasValidKey(getEnv("GROQ_API_KEY"))) {
    try {
      return await callCompatibleProvider(
        "groq",
        messages,
      );
    } catch (error) {
      errors.push(
        `Groq: ${getErrorMessage(error)}`,
      );
    }
  }

  throw new Error(
    "No AI provider completed the request. " +
    errors.join(" | "),
  );
}

/* =========================================================
   HEALTH CHECKS — QUICK RENDER RESPONSE
========================================================= */

app.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");

  res.status(200).json({
    success: true,
    service: "Nodysom AI",
    status: "ready",
    environment:
      getEnv("NODE_ENV") || "development",
    providers: getAIProviderStatus(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    status: "ready",
  });
});

app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    "User-agent: *\n" +
    "Allow: /\n" +
    `Sitemap: ${PUBLIC_APP_URL}/sitemap.xml\n`,
  );
});

app.get("/sitemap.xml", (_req, res) => {
  res.type("application/xml").send(
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    `<url><loc>${PUBLIC_APP_URL}/</loc>` +
    "<changefreq>weekly</changefreq>" +
    "<priority>1.0</priority></url>" +
    "</urlset>",
  );
});

/* =========================================================
   AGENT RESPONSE GENERATION
========================================================= */

async function generateAgentAnswer(
  request: AgentRequest,
  toolResult?: string,
): Promise<AgentAIAnswer> {
  const profile = request.userProfile || {};

  const language = cleanText(
    request.language ||
    profile.preferredLanguage ||
    "English",
    60,
  );

  const memories = Array.isArray(request.memories)
    ? request.memories
        .map((memory: any) =>
          cleanText(
            typeof memory === "string"
              ? memory
              : memory?.content ?? memory?.text,
            500,
          ),
        )
        .filter(Boolean)
        .slice(0, 10)
    : [];

  const systemPrompt = [
    "You are Nodysom AI, a helpful personal AI assistant.",
    `Reply in ${language}, unless the user requests another language.`,
    "Be accurate, practical, clear and concise.",
    "Never claim to have performed an external action you did not perform.",
    "Use the provided user profile and memories when relevant.",
    "If a tool is needed, return valid JSON with a reply field and toolCall.",
    "Otherwise return valid JSON with a reply field.",
    "Available local tools: calculator, time, text_stats.",
    `User profile: ${JSON.stringify({
      name: profile.name || "",
      goals: profile.goals || "",
      country: profile.country || "",
      interests: profile.interests || [],
    })}`,
    `Relevant memories: ${memories.join(" | ") || "none"}`,
  ].join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    ...normalizeMessages(request.history),
    {
      role: "user",
      content:
        cleanText(request.message) +
        (
          toolResult
            ? `\n\nTool result:\n${toolResult}`
            : ""
        ),
    },
  ];

  const result = await callAI(messages);
  const parsed = safeJsonParse<Record<string, any>>(
    result.text,
  );

  if (
    parsed &&
    typeof parsed.reply === "string"
  ) {
    return {
      reply: cleanText(parsed.reply, 12000),
      detectedAction:
        parsed.detectedAction ?? null,
      newMemory:
        parsed.newMemory ?? null,
      toolCall:
        parsed.toolCall ?? null,
    };
  }

  return {
    reply: result.text,
    detectedAction: null,
    newMemory: null,
    toolCall: null,
  };
}

/* =========================================================
   AGENT API
========================================================= */

async function handleAgent(
  req: Request,
  res: Response,
) {
  const startedAt = Date.now();

  try {
    const body = req.body || {};

    const message = cleanText(
      body.message ??
      body.prompt ??
      body.text,
    );

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required.",
      });
    }

    const userProfile =
      body.userProfile &&
      typeof body.userProfile === "object"
        ? body.userProfile
        : undefined;

    const request: AgentRequest = {
      message,
      history: normalizeMessages(body.history),
      memories: Array.isArray(body.memories)
        ? body.memories.slice(0, 10)
        : [],
      language: cleanText(
        body.language ||
        userProfile?.preferredLanguage ||
        "English",
        60,
      ),
      userProfile,
    };

    const result = await runAgent(
      request,
      generateAgentAnswer,
    );

    return res.status(200).json({
      success: true,
      reply: result.reply,
      usedTool: result.usedTool,
      tool: result.tool ?? null,
      toolResult: result.toolResult ?? null,
      toolsUsed: result.toolsUsed,
      steps: result.steps,
      detectedAction:
        result.detectedAction ?? null,
      newMemory: result.newMemory ?? null,
      latency: Date.now() - startedAt,
    });
  } catch (error) {
    console.error(
      "[Nodysom Agent]",
      getErrorMessage(error),
    );

    return res.status(503).json({
      success: false,
      error: IS_PRODUCTION
        ? "Nodysom AI is temporarily unavailable. Check the AI provider configuration."
        : getErrorMessage(error),
      reply:
        "Nodysom AI could not process your request right now. Please try again.",
      latency: Date.now() - startedAt,
    });
  }
}

app.post("/api/agent", handleAgent);

app.post(
  ["/api/ai/assistant", "/api/assistant"],
  handleAgent,
);/* =========================================================
   COMMON HELPERS
========================================================= */

function cleanText(
  value: unknown,
  maxLength = 12000,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function getRequestText(body: any): string {
  return cleanText(
    body?.message ??
    body?.prompt ??
    body?.text ??
    body?.query,
  );
}

function getRequestLanguage(body: any): string {
  return cleanText(
    body?.language ??
    body?.targetLanguage ??
    body?.userProfile?.preferredLanguage ??
    "English",
    60,
  );
}

function sendAPIError(
  res: Response,
  error: unknown,
  status = 503,
) {
  console.error(
    "[Nodysom API]",
    getErrorMessage(error),
  );

  return res.status(status).json({
    success: false,
    error: IS_PRODUCTION
      ? "The service is temporarily unavailable. Please try again."
      : getErrorMessage(error),
  });
}

/* =========================================================
   GENERAL AI ASSISTANT
========================================================= */

async function handleGeneralAssistant(
  req: Request,
  res: Response,
) {
  const startedAt = Date.now();

  try {
    const body = req.body || {};
    const message = getRequestText(body);

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Please provide a message.",
      });
    }

    const history = normalizeMessages(
      body.history,
    );

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: [
          "You are Nodysom AI, a helpful AI assistant.",
          `Respond in ${getRequestLanguage(body)}.`,
          "Give useful, accurate and clear answers.",
          "Do not invent facts or claim actions you did not perform.",
          "For complex requests, explain the steps clearly.",
        ].join("\n"),
      },
      ...history,
      {
        role: "user",
        content: message,
      },
    ];

    const result = await callAI(messages);

    return res.status(200).json({
      success: true,
      reply: result.text,
      response: result.text,
      provider: result.provider,
      model: result.model,
      latency: Date.now() - startedAt,
    });
  } catch (error) {
    return sendAPIError(res, error);
  }
}

/*
 * Keep these routes available for existing clients.
 * The dedicated agent endpoint remains /api/agent.
 */

app.post(
  [
    "/api/ai/chat",
    "/api/chat",
    "/api/ai/generate",
  ],
  handleGeneralAssistant,
);

/* =========================================================
   SEARCH ANSWERS
========================================================= */

async function handleAISearch(
  req: Request,
  res: Response,
) {
  const startedAt = Date.now();

  try {
    const body = req.body || {};
    const query = getRequestText(body);

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "A search query is required.",
      });
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: [
          "You are Nodysom AI's search assistant.",
          `Respond in ${getRequestLanguage(body)}.`,
          "Answer the user's query directly.",
          "Separate confirmed information from uncertainty.",
          "Do not claim you searched the live internet unless a web-search tool was actually used.",
          "If current information is needed but unavailable, say so clearly.",
        ].join("\n"),
      },
      {
        role: "user",
        content: query,
      },
    ];

    const result = await callAI(messages);

    return res.status(200).json({
      success: true,
      query,
      answer: result.text,
      reply: result.text,
      provider: result.provider,
      model: result.model,
      latency: Date.now() - startedAt,
    });
  } catch (error) {
    return sendAPIError(res, error);
  }
}

app.post(
  [
    "/api/ai/search",
    "/api/search",
    "/api/assistant/search",
  ],
  handleAISearch,
);

/* =========================================================
   TRANSLATION
========================================================= */

async function handleTranslation(
  req: Request,
  res: Response,
) {
  const startedAt = Date.now();

  try {
    const body = req.body || {};

    const text = cleanText(
      body.text ??
      body.message ??
      body.content,
    );

    const sourceLanguage = cleanText(
      body.sourceLanguage ??
      body.from ??
      "auto-detect",
      60,
    );

    const targetLanguage = cleanText(
      body.targetLanguage ??
      body.to ??
      body.language,
      60,
    );

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Text to translate is required.",
      });
    }

    if (!targetLanguage) {
      return res.status(400).json({
        success: false,
        error: "The target language is required.",
      });
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: [
          "You are a professional translator.",
          `Source language: ${sourceLanguage}.`,
          `Target language: ${targetLanguage}.`,
          "Preserve the original meaning, tone and formatting.",
          "Return only the translated text.",
          "Do not add explanations or quotation marks unless required by the original.",
        ].join("\n"),
      },
      {
        role: "user",
        content: text,
      },
    ];

    const result = await callAI(messages);

    return res.status(200).json({
      success: true,
      originalText: text,
      translatedText: result.text,
      translation: result.text,
      result: result.text,
      sourceLanguage,
      targetLanguage,
      provider: result.provider,
      latency: Date.now() - startedAt,
    });
  } catch (error) {
    return sendAPIError(res, error);
  }
}

app.post(
  [
    "/api/ai/translate",
    "/api/translate",
    "/api/translation",
  ],
  handleTranslation,
);

/* =========================================================
   SMART SCHEDULE
========================================================= */

async function handleSmartSchedule(
  req: Request,
  res: Response,
) {
  const startedAt = Date.now();

  try {
    const body = req.body || {};

    const tasks = Array.isArray(body.tasks)
      ? body.tasks
          .slice(0, 100)
          .map((task: any) => {
            if (typeof task === "string") {
              return cleanText(task, 500);
            }

            return {
              title: cleanText(
                task?.title ??
                task?.name ??
                task?.task,
                200,
              ),
              duration: cleanText(
                String(task?.duration ?? ""),
                50,
              ),
              priority: cleanText(
                task?.priority ?? "normal",
                40,
              ),
              deadline: cleanText(
                task?.deadline ?? "",
                80,
              ),
            };
          })
          .filter(Boolean)
      : [];

    const requestText = getRequestText(body);

    if (tasks.length === 0 && !requestText) {
      return res.status(400).json({
        success: false,
        error: "Provide tasks or describe your scheduling needs.",
      });
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: [
          "You are Nodysom AI Smart Schedule.",
          `Respond in ${getRequestLanguage(body)}.`,
          "Create a realistic, organized schedule.",
          "Respect deadlines, task durations and priorities when provided.",
          "Include reasonable breaks.",
          "Do not invent calendar events or claim you saved a schedule.",
          "Return a readable schedule with times, activities and brief explanations.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          request: requestText,
          tasks,
          availableTime: body.availableTime ?? null,
          startTime: body.startTime ?? null,
          endTime: body.endTime ?? null,
          date: body.date ?? null,
          preferences: body.preferences ?? null,
        }),
      },
    ];

    const result = await callAI(messages);

    return res.status(200).json({
      success: true,
      schedule: result.text,
      reply: result.text,
      provider: result.provider,
      model: result.model,
      latency: Date.now() - startedAt,
    });
  } catch (error) {
    return sendAPIError(res, error);
  }
}

app.post(
  [
    "/api/ai/smart-schedule",
    "/api/assistant/smart-schedule",
    "/api/smart-schedule",
  ],
  handleSmartSchedule,
);

/* =========================================================
   API NOT FOUND
========================================================= */

app.use("/api", (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found.",
    path: req.path,
  });
});

/* =========================================================
   VITE DEVELOPMENT / PRODUCTION STATIC FILES
========================================================= */

async function configureFrontend() {
  if (!IS_PRODUCTION) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          clientPort: Number(
            getEnv("VITE_HMR_CLIENT_PORT") || 443,
          ),
        },
      },
      appType: "custom",
    });

    app.use(vite.middlewares);

    app.use(
      async (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => {
        if (
          req.method !== "GET" ||
          req.path.startsWith("/api/")
        ) {
          return next();
        }

        try {
          const indexPath = path.join(
            BASE_DIR,
            "index.html",
          );

          let html = await fs.promises.readFile(
            indexPath,
            "utf-8",
          );

          html = await vite.transformIndexHtml(
            req.originalUrl,
            html,
          );

          res.status(200).type("html").send(html);
        } catch (error) {
          vite.ssrFixStacktrace(error as Error);
          next(error);
        }
      },
    );

    return;
  }

  const indexPath = path.join(
    DIST_DIR,
    "index.html",
  );

  if (!fs.existsSync(indexPath)) {
    console.error(
      "[Nodysom] Production build not found:",
      indexPath,
    );

    throw new Error(
      "Production frontend build is missing. Run the frontend build before starting the server.",
    );
  }

  app.use(
    express.static(DIST_DIR, {
      index: false,
      maxAge: "1d",
      etag: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader(
            "Cache-Control",
            "no-cache",
          );
        } else if (
          /\.[a-f0-9]{8,}\.(js|css)$/i.test(filePath)
        ) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
        }
      },
    }),
  );

  if (fs.existsSync(PUBLIC_DIR)) {
    app.use(
      "/public",
      express.static(PUBLIC_DIR, {
        maxAge: "1d",
      }),
    );
  }

  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (
      req.method !== "GET" ||
      req.path.startsWith("/api/")
    ) {
      return next();
    }

    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexPath);
  });
}

/* =========================================================
   FINAL ERROR HANDLER
========================================================= */

app.use(
  (
    error: any,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    console.error(
      "[Nodysom Server Error]",
      getErrorMessage(error),
    );

    if (res.headersSent) {
      return;
    }

    res.status(
      Number(error?.status) >= 400 &&
      Number(error?.status) < 600
        ? Number(error.status)
        : 500,
    ).json({
      success: false,
      error: IS_PRODUCTION
        ? "An internal server error occurred."
        : getErrorMessage(error),
    });
  },
);

/* =========================================================
   SERVER STARTUP
========================================================= */

async function startServer() {
  try {
    await configureFrontend();

    const server = app.listen(
      PORT,
      HOST,
      () => {
        console.log(
          `[Nodysom] Server listening on ${HOST}:${PORT}`,
        );

        console.log(
          `[Nodysom] Environment: ${
            process.env.NODE_ENV || "development"
          }`,
        );

        console.log(
          "[Nodysom] AI providers:",
          JSON.stringify(getAIProviderStatus()),
        );
      },
    );

    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    server.requestTimeout = 30000;

    const shutdown = (signal: string) => {
      console.log(
        `[Nodysom] ${signal} received; shutting down.`,
      );

      server.close((error) => {
        if (error) {
          console.error(
            "[Nodysom] Shutdown error:",
            error,
          );

          process.exitCode = 1;
        }

        process.exit();
      });

      setTimeout(() => {
        console.error(
          "[Nodysom] Forced shutdown after timeout.",
        );

        process.exit(1);
      }, 10000).unref();
    };

    process.once("SIGTERM", () => {
      shutdown("SIGTERM");
    });

    process.once("SIGINT", () => {
      shutdown("SIGINT");
    });
  } catch (error) {
    console.error(
      "[Nodysom] Failed to start:",
      getErrorMessage(error),
    );

    process.exitCode = 1;
  }
}

void startServer();
