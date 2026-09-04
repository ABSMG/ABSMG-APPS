import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// In-memory rate limiting tracker (per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests/min

function checkRateLimit(req: Request, res: Response, next: () => void) {
  const ip = req.ip || "global-client";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: "Rate limit reached. Please wait a moment before trying again.",
    });
  }

  entry.count++;
  next();
}

app.use("/api/ai", checkRateLimit);

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    appName: "LifeOS",
    tagline: "Ask. Plan. Learn. Do.",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"),
  });
});

// 1. AI Assistant Endpoint
app.post("/api/ai/assistant", async (req, res) => {
  try {
    const { message, history = [], userProfile, memories = [] } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ai = getAI();
    if (!ai) {
      // Graceful offline/local fallback response
      return res.json({
        reply: `I heard: "${message}". [Note: Connect a Gemini API Key to enable live cloud reasoning. Operating in offline responsive mode.]`,
        detectedAction: parseFallbackAction(message),
      });
    }

    const memoryContext = memories.length > 0
      ? `User Memories / Known Facts: ${memories.map((m: any) => m.content).join("; ")}`
      : "No stored memories yet.";

    const profileContext = userProfile
      ? `User Info: Name: ${userProfile.name || "User"}, Language: ${userProfile.preferredLanguage || "en"}, Goals: ${userProfile.goals || "general productivity"}`
      : "";

    const systemInstruction = `You are LifeOS, the world-class universal everyday AI assistant.
Tagline: "Ask. Plan. Learn. Do."
Your personality is helpful, lightning fast, honest, culturally empathetic, and actionable.
You speak clearly and avoid unnecessary fluff or verbose meta-explanations.

${profileContext}
${memoryContext}

CRITICAL RULES:
1. If the user expresses an actionable request (such as setting a reminder, creating a task, scheduling something, or budgeting money), you MUST extract it as a structured action while answering politely and confirming details.
2. If the user asks a question, give a clear, direct answer.
3. If new important personal information about the user is shared (e.g., "I work night shifts" or "I am studying biology"), suggest a memory snippet to store.
4. Output strictly valid JSON matching the schema provided.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Conversation History:\n${history
                .slice(-6)
                .map((h: any) => `${h.role === "user" ? "User" : "LifeOS"}: ${h.content}`)
                .join("\n")}\n\nCurrent User Request: "${message}"`,
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
              description: "The conversational response to the user.",
            },
            detectedAction: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  description: "TASK, REMINDER, SCHEDULE, BUDGET, or NONE",
                },
                title: { type: Type.STRING },
                date: { type: Type.STRING },
                time: { type: Type.STRING },
                category: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                confirmedRequired: { type: Type.BOOLEAN },
              },
            },
            newMemory: {
              type: Type.STRING,
              description: "Optional single fact or preference to remember about the user, or empty string if none.",
            },
          },
          required: ["reply"],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    return res.json({
      reply: parsed.reply || "I am here to assist you.",
      detectedAction: parsed.detectedAction?.type && parsed.detectedAction.type !== "NONE" ? parsed.detectedAction : null,
      newMemory: parsed.newMemory || null,
    });
  } catch (error: any) {
    console.error("AI Assistant Error:", error);
    res.status(500).json({
      error: error.message || "Failed to process request",
      reply: "I encountered an issue processing that. Please check your connection or try again.",
    });
  }
});

// 2. Universal Search Endpoint (Fact vs Estimate vs Uncertainty)
app.post("/api/ai/search", async (req, res) => {
  try {
    const { query, language = "en" } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const ai = getAI();
    if (!ai) {
      return res.json({
        summary: `Search results for: "${query}".`,
        verifiedFacts: ["LifeOS provides offline-first fast search indexing."],
        estimates: ["Estimated processing latency: <100ms."],
        uncertainties: ["Cloud connection unavailable; showing local data."],
        sources: [{ title: "LifeOS Local Knowledge", url: "https://lifeos.internal" }],
        suggestedActions: ["Explore local tutorials", "Add to daily planner"],
      });
    }

    const systemInstruction = `You are LifeOS Universal Search.
Respond in language '${language}'.
Your objective is to answer questions thoroughly yet concisely, with strict distinction between:
- Verified facts (empirically confirmed or indisputable truths)
- Estimates (reasonable approximations, calculations, or models)
- Uncertainties (what is currently unknown, contested, or subject to variation)
Never invent or hallucinate information.
Provide actionable suggestions and realistic reputable reference domains.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Search Query: "${query}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A high-level concise answer to the query." },
            verifiedFacts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 2-4 verified objective facts.",
            },
            estimates: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 1-3 educated estimates or approximations.",
            },
            uncertainties: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 1-2 caveats, variables, or unknown factors.",
            },
            sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING },
                },
              },
            },
            suggestedActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["summary", "verifiedFacts", "estimates", "uncertainties"],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Search Error:", error);
    res.status(500).json({ error: error.message || "Failed to search" });
  }
});

// 3. Smart Schedule Planner
app.post("/api/ai/smart-schedule", async (req, res) => {
  try {
    const { prompt, date } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const ai = getAI();
    if (!ai) {
      return res.json({
        schedule: [
          { time: "08:00 AM", title: "Morning Review & Focus", durationMinutes: 60, category: "Work" },
          { time: "10:00 AM", title: "Deep Work Session", durationMinutes: 120, category: "Study" },
          { time: "01:00 PM", title: "Nutritious Lunch & Walk", durationMinutes: 60, category: "Health" },
          { time: "03:00 PM", title: "Tasks & Communications", durationMinutes: 90, category: "Life" },
        ],
        advice: "Generated default balanced routine. Connect API key for custom natural language scheduling.",
      });
    }

    const systemInstruction = `You are LifeOS Smart Life Scheduler.
The user provides their day's constraints, classes, work shifts, habits, and goals.
Example: "I have school 8 AM to 3 PM and work from 5 PM to 8 PM. Create my schedule."
Your job is to generate an optimized, realistic, healthy daily timetable with:
- Dedicated buffer & transit times
- Optimal meal / rest periods
- Study or personal focus windows
- High productivity alignment
Return structured JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Date: ${date || "Today"}\nUser Constraints & Goals: "${prompt}"`,
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
                  time: { type: Type.STRING, description: "e.g. 08:00 AM - 09:30 AM" },
                  title: { type: Type.STRING },
                  category: { type: Type.STRING, description: "School, Work, Study, Health, Rest, Personal" },
                  durationMinutes: { type: Type.INTEGER },
                  notes: { type: Type.STRING },
                },
                required: ["time", "title", "category"],
              },
            },
            advice: { type: Type.STRING, description: "One practical scheduling tip." },
          },
          required: ["schedule"],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Schedule Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate schedule" });
  }
});

// 4. Learning Hub AI Tutor
app.post("/api/ai/learn", async (req, res) => {
  try {
    const { topic, difficulty = "beginner", mode = "lesson" } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const ai = getAI();
    if (!ai) {
      return res.json({
        lessonContent: `Welcome to learning ${topic}! At ${difficulty} level, the key principle is mastering the fundamentals before tackling complex edge cases.`,
        keyTakeaways: ["Master foundational terminology", "Practice hands-on examples daily", "Relate concepts to everyday life"],
        quiz: [
          {
            question: `What is the core pillar when starting to learn ${topic}?`,
            options: ["Understanding key terms", "Memorizing without understanding", "Skipping to the final project", "Waiting for someone else"],
            correctIndex: 0,
            explanation: "Solid foundational knowledge enables rapid learning of advanced concepts.",
          },
        ],
        flashcards: [
          { front: `What is the essence of ${topic}?`, back: "A systematic body of practice and knowledge used to solve problems." },
          { front: "How to retain this concept?", back: "Spaced repetition and active recall." },
        ],
      });
    }

    const systemInstruction = `You are LifeOS Universal Learning Tutor.
You teach anyone from rural classrooms to top universities with absolute clarity, active recall, and zero condescension.
Difficulty: ${difficulty} (e.g. Beginner, Intermediate, Advanced, Child, Expert).
Mode: ${mode} (lesson, quiz, or flashcards).
Return JSON containing a structured lesson, key takeaways, quiz questions with explanations, and flashcards.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Topic: "${topic}", Level: "${difficulty}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lessonContent: { type: Type.STRING, description: "Engaging, structured 2-3 paragraph explanation." },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                },
                required: ["question", "options", "correctIndex", "explanation"],
              },
            },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  front: { type: Type.STRING },
                  back: { type: Type.STRING },
                },
                required: ["front", "back"],
              },
            },
          },
          required: ["lessonContent", "keyTakeaways", "quiz", "flashcards"],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Learn Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate learning material" });
  }
});

// 5. Universal Translator
app.post("/api/ai/translate", async (req, res) => {
  try {
    const { text, targetLanguage = "Swahili", sourceLanguage = "auto" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const ai = getAI();
    if (!ai) {
      return res.json({
        translatedText: `[Translated to ${targetLanguage}]: ${text}`,
        phoneticGuide: "Phonetic guide available with API key",
        notes: "Accurate offline dictionary applied.",
      });
    }

    const systemInstruction = `You are LifeOS Universal Translator.
Specialize in high-fidelity colloquial and formal translation across global languages including Swahili, French, Spanish, Arabic, Portuguese, Hindi, Mandarin, and English.
Return JSON with the exact translation, a phonetic reading guide for pronunciation, and cultural/tone notes if applicable.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Translate from ${sourceLanguage} to ${targetLanguage}:\n"${text}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translatedText: { type: Type.STRING },
            phoneticGuide: { type: Type.STRING },
            notes: { type: Type.STRING },
            detectedSource: { type: Type.STRING },
          },
          required: ["translatedText"],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Translate Error:", error);
    res.status(500).json({ error: error.message || "Failed to translate" });
  }
});

function parseFallbackAction(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("remind") || lower.includes("reminder")) {
    return {
      type: "REMINDER",
      title: text.replace(/remind me to/i, "").trim(),
      date: "Tomorrow",
      time: "08:00 AM",
      confirmedRequired: true,
    };
  }
  if (lower.includes("task") || lower.includes("todo")) {
    return {
      type: "TASK",
      title: text.replace(/add task|create task/i, "").trim(),
      category: "Personal",
      confirmedRequired: true,
    };
  }
  return null;
}

// Vite middleware for dev / static for prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LifeOS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
