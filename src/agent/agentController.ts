import {
  detectLocalTool,
  runLocalTool,
} from "./tools";

/* =========================================================
   TYPES
========================================================= */

export interface AgentRequest {
  message: string;

  history?: unknown[];

  memories?: unknown[];

  userProfile?: {
    name?: string;
    preferredLanguage?: string;
    goals?: string;
    country?: string;
    tier?: string;
    lowDataMode?: boolean;
    interests?: string[];
  };

  language?: string;
}

export interface AgentToolCall {
  tool:
    | "calculator"
    | "time"
    | "text_stats";

  input?: string;
}

export interface AgentAIAnswer {
  reply: string;

  detectedAction?: any | null;

  newMemory?: any | null;

  toolCall?: AgentToolCall | null;
}

export interface AgentResult {
  reply: string;

  usedTool: boolean;

  tool?: string | null;

  toolResult?: string | null;

  detectedAction?: any | null;

  newMemory?: any | null;

  steps: number;

  toolsUsed: string[];
}

/* =========================================================
   CONFIG
========================================================= */

const MAX_AGENT_STEPS = 3;

const MAX_MESSAGE_LENGTH = 4000;

const MAX_HISTORY_MESSAGES = 6;

const MAX_HISTORY_ITEM_LENGTH = 1200;

const MAX_MEMORY_ITEMS = 6;

const MAX_MEMORY_LENGTH = 500;

const MAX_TOOL_RESULT_LENGTH = 1800;

const MAX_REPLY_LENGTH = 10000;

/* =========================================================
   HELPERS
========================================================= */

function cleanText(
  value: unknown,
  maxLength = 4000
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function stringifyToolResult(
  value: unknown
): string {
  try {
    const text =
      typeof value === "string"
        ? value
        : JSON.stringify(value);

    return cleanText(
      text,
      MAX_TOOL_RESULT_LENGTH
    );
  } catch {
    return "";
  }
}

/* =========================================================
   HISTORY
========================================================= */

function normalizeHistory(
  history: unknown
): Array<{
  role: "user" | "assistant";
  content: string;
}> {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item: any) => {
      const role =
        item?.role === "user"
          ? "user"
          : "assistant";

      const content =
        cleanText(
          item?.content,
          MAX_HISTORY_ITEM_LENGTH
        );

      return {
        role,
        content,
      };
    })
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
): Array<{
  content: string;
  [key: string]: any;
}> {
  if (!Array.isArray(memories)) {
    return [];
  }

  return memories
    .slice(
      -MAX_MEMORY_ITEMS
    )
    .map((item: any) => {
      if (
        typeof item ===
        "string"
      ) {
        return {
          content:
            cleanText(
              item,
              MAX_MEMORY_LENGTH
            ),
        };
      }

      return {
        ...item,
        content:
          cleanText(
            item?.content,
            MAX_MEMORY_LENGTH
          ),
      };
    })
    .filter(
      (item) =>
        Boolean(item.content)
    );
}

/* =========================================================
   PROFILE
========================================================= */

function normalizeProfile(
  profile:
    | AgentRequest["userProfile"]
    | undefined
) {
  if (!profile) {
    return null;
  }

  return {
    name:
      cleanText(
        profile.name,
        100
      ),

    preferredLanguage:
      cleanText(
        profile.preferredLanguage,
        40
      ),

    goals:
      cleanText(
        profile.goals,
        500
      ),

    country:
      cleanText(
        profile.country,
        80
      ),

    tier:
      profile.tier,

    lowDataMode:
      Boolean(
        profile.lowDataMode
      ),

    interests:
      Array.isArray(
        profile.interests
      )
        ? profile.interests
            .slice(0, 10)
            .map((item) =>
              cleanText(
                item,
                80
              )
            )
            .filter(Boolean)
        : [],
  };
}

/* =========================================================
   TOOL DETECTION
========================================================= */

function tryDetectTool(
  message: string
) {
  try {
    const detected =
      detectLocalTool(
        message
      );

    if (!detected) {
      return null;
    }

    const tool =
      cleanText(
        detected.tool,
        100
      );

    const input =
      cleanText(
        detected.input,
        1000
      );

    if (!tool) {
      return null;
    }

    return {
      tool,
      input,
    };
  } catch (error) {
    console.warn(
      "[Nodysom Agent] Tool detection failed:",
      error
    );

    return null;
  }
}

/* =========================================================
   TOOL EXECUTION
========================================================= */

async function executeTool(
  tool: AgentToolCall
): Promise<{
  success: boolean;
  tool: string;
  result: string;
}> {
  try {
    const result =
      await runLocalTool(
        tool.tool,
        tool.input || ""
      );

    const output =
      stringifyToolResult(
        result
      );

    return {
      success: true,

      tool:
        tool.tool,

      result:
        output ||
        "The tool completed successfully but returned no readable result.",
    };
  } catch (error) {
    console.error(
      `[Nodysom Agent] Tool "${tool.tool}" failed:`,
      error
    );

    return {
      success: false,

      tool:
        tool.tool,

      result:
        "The requested local tool could not be completed.",
    };
  }
}

/* =========================================================
   CALLBACK TYPE
========================================================= */

/*
 * server.ts owns the actual AI provider logic.
 *
 * This callback is supplied by server.ts:
 *
 * runAgent(request, generateAgentAnswer)
 *
 * generateAgentAnswer()
 * -> Gemini
 * -> OpenRouter fallback
 */

export type GenerateAgentAnswer = (
  request: AgentRequest,
  toolResult?: string
) => Promise<AgentAIAnswer>;

/* =========================================================
   VALIDATE TOOL REQUEST
========================================================= */

function normalizeToolCall(
  value: unknown
): AgentToolCall | null {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const raw =
    value as any;

  const tool =
    cleanText(
      raw.tool,
      100
    );

  const allowedTools = [
    "calculator",
    "time",
    "text_stats",
  ];

  if (
    !allowedTools.includes(
      tool
    )
  ) {
    return null;
  }

  return {
    tool:
      tool as
        | "calculator"
        | "time"
        | "text_stats",

    input:
      cleanText(
        raw.input,
        1000
      ),
  };
}

/* =========================================================
   MAIN AGENT
========================================================= */

export async function runAgent(
  request: AgentRequest,
  generateAnswer: GenerateAgentAnswer
): Promise<AgentResult> {
  const startedAt =
    Date.now();

  const message =
    cleanText(
      request?.message,
      MAX_MESSAGE_LENGTH
    );

  if (!message) {
    throw new Error(
      "Agent message is required."
    );
  }

  if (
    typeof generateAnswer !==
    "function"
  ) {
    throw new Error(
      "Agent AI callback is not configured."
    );
  }

  const normalizedRequest:
    AgentRequest = {
    ...request,

    message,

    history:
      normalizeHistory(
        request.history
      ),

    memories:
      normalizeMemories(
        request.memories
      ),

    userProfile:
      normalizeProfile(
        request.userProfile
      ) || undefined,
  };

  let steps = 0;

  let usedTool = false;

  let toolName:
    | string
    | null = null;

  let toolResult:
    | string
    | null = null;

  const toolsUsed: string[] =
    [];

  let lastAnswer:
    | AgentAIAnswer
    | null = null;

  /* =======================================================
     FAST LOCAL TOOL PATH
  ======================================================= */

  const directlyDetected =
    tryDetectTool(
      message
    );

  if (directlyDetected) {
    const directTool =
      normalizeToolCall(
        directlyDetected
      );

    if (directTool) {
      console.log(
        `[Nodysom Agent] Direct local tool: ${directTool.tool}`
      );

      const executed =
        await executeTool(
          directTool
        );

      usedTool = true;

      toolName =
        directTool.tool;

      toolResult =
        executed.result;

      toolsUsed.push(
        directTool.tool
      );

      /*
       * One AI call after the tool.
       *
       * This is much faster than:
       *
       * AI -> tool -> AI -> tool -> AI
       */

      steps++;

      lastAnswer =
        await generateAnswer(
          normalizedRequest,
          toolResult
        );

      /*
       * The direct tool already solved the
       * tool selection problem.
       *
       * If the model asks for another tool,
       * allow the normal loop below to handle
       * at most one more request.
       */

      const nextTool =
        normalizeToolCall(
          lastAnswer?.toolCall
        );

      if (!nextTool) {
        return {
          reply:
            cleanText(
              lastAnswer?.reply,
              MAX_REPLY_LENGTH
            ) ||
            toolResult ||
            "Done.",

          usedTool,

          tool:
            toolName,

          toolResult,

          detectedAction:
            lastAnswer?.detectedAction ||
            null,

          newMemory:
            lastAnswer?.newMemory ||
            null,

          steps,

          toolsUsed,
        };
      }
    }
  }

  /* =======================================================
     NORMAL AGENT PATH
  ======================================================= */

  if (!lastAnswer) {
    steps++;

    lastAnswer =
      await generateAnswer(
        normalizedRequest
      );
  }

  /* =======================================================
     TOOL LOOP
  ======================================================= */

  for (
    let iteration = 0;
    iteration <
      MAX_AGENT_STEPS;
    iteration++
  ) {
    if (!lastAnswer) {
      break;
    }

    const requestedTool =
      normalizeToolCall(
        lastAnswer.toolCall
      );

    /*
     * No tool requested.
     *
     * Return immediately.
     *
     * This is the main latency optimization.
     */

    if (!requestedTool) {
      break;
    }

    /*
     * Prevent duplicate tool loops.
     */

    if (
      toolsUsed.includes(
        requestedTool.tool
      ) &&
      requestedTool.tool !==
        "calculator"
    ) {
      console.warn(
        `[Nodysom Agent] Prevented duplicate tool loop: ${requestedTool.tool}`
      );

      break;
    }

    const executed =
      await executeTool(
        requestedTool
      );

    usedTool = true;

    toolName =
      requestedTool.tool;

    toolResult =
      executed.result;

    if (
      !toolsUsed.includes(
        requestedTool.tool
      )
    ) {
      toolsUsed.push(
        requestedTool.tool
      );
    }

    /*
     * Tool execution itself does not require
     * another model call unless we need the model
     * to explain the result.
     */

    if (
      !executed.success
    ) {
      break;
    }

    /*
     * Ask AI to produce the final answer
     * using the tool result.
     */

    if (
      steps >=
      MAX_AGENT_STEPS
    ) {
      break;
    }

    steps++;

    lastAnswer =
      await generateAnswer(
        normalizedRequest,
        toolResult
      );
  }

  /* =======================================================
     FINAL RESULT
  ======================================================= */

  const finalReply =
    cleanText(
      lastAnswer?.reply,
      MAX_REPLY_LENGTH
    );

  const totalTime =
    Date.now() -
    startedAt;

  console.log(
    `[Nodysom Agent] completed in ${totalTime}ms | steps=${steps} | tool=${toolName || "none"}`
  );

  return {
    reply:
      finalReply ||
      toolResult ||
      "I am ready to help.",

    usedTool,

    tool:
      toolName,

    toolResult,

    detectedAction:
      lastAnswer?.detectedAction ||
      null,

    newMemory:
      lastAnswer?.newMemory ||
      null,

    steps,

    toolsUsed,
  };
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default runAgent;
