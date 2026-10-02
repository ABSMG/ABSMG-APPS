import {
  detectTool,
  runTool,
  type AgentToolName,
  type AgentToolResult,
  type DetectedTool,
} from "./tools";

/**
 * =========================================================
 * AGENT REQUEST
 * =========================================================
 */

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

/**
 * =========================================================
 * AI TOOL CALL
 * =========================================================
 *
 * This is returned by the AI when it wants a deterministic
 * local tool to execute.
 */

export interface AgentToolCall {
  tool: AgentToolName;
  input?: string;
}

/**
 * =========================================================
 * AI ANSWER
 * =========================================================
 */

export interface AgentAIAnswer {
  reply: string;

  detectedAction?: any | null;

  newMemory?: any | null;

  toolCall?: AgentToolCall | null;
}

/**
 * =========================================================
 * AGENT RESULT
 * =========================================================
 */

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

/**
 * =========================================================
 * AI CALLBACK
 * =========================================================
 *
 * server.ts supplies the actual AI implementation.
 *
 * IMPORTANT:
 * agentController.ts does NOT call Gemini or OpenRouter
 * directly.
 */

export type GenerateAgentAnswer = (
  request: AgentRequest,
  toolResult?: string
) => Promise<AgentAIAnswer>;

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 *
 * Keep this small to avoid unnecessary AI calls.
 */

const MAX_AGENT_STEPS = 3;

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

function cleanMessage(
  value: unknown
): string {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value.trim();
}

/**
 * Convert any tool result into the short text that is
 * passed back to the AI.
 */

function formatToolResult(
  result: AgentToolResult
): string {
  if (result.ok) {
    return (
      `Tool: ${result.tool}\n` +
      `Result:\n${result.result}`
    );
  }

  return (
    `Tool: ${result.tool}\n` +
    `Error:\n${result.result}`
  );
}

/**
 * =========================================================
 * RUN AGENT
 * =========================================================
 *
 * Flow:
 *
 * User message
 *      ↓
 * Detect deterministic tool
 *      ↓
 * Run tool if needed
 *      ↓
 * Give result to AI
 *      ↓
 * Return final answer
 *
 * The local tools are:
 *
 * calculator
 * time
 * text_stats
 */

export async function runAgent(
  request: AgentRequest,
  generateAnswer: GenerateAgentAnswer
): Promise<AgentResult> {
  const message =
    cleanMessage(
      request.message
    );

  /**
   * Empty request.
   */
  if (!message) {
    return {
      reply:
        "Please enter a message so I can help you.",
      usedTool: false,
      tool: null,
      toolResult: null,
      detectedAction: null,
      newMemory: null,
      steps: 0,
      toolsUsed: [],
    };
  }

  let currentRequest:
    AgentRequest = {
      ...request,
      message,
    };

  let usedTool = false;

  let lastTool:
    AgentToolName | null = null;

  let lastToolResult:
    string | null = null;

  let detectedAction:
    any | null = null;

  let newMemory:
    any | null = null;

  const toolsUsed: string[] = [];

  let steps = 0;

  /**
   * =======================================================
   * STEP 1 — DETERMINISTIC TOOL DETECTION
   * =======================================================
   *
   * This avoids sending simple calculations/time requests
   * to the AI unnecessarily.
   */

  const detection =
    detectTool(message);

  /**
   * =======================================================
   * DIRECT LOCAL TOOL
   * =======================================================
   */

  if (
    detection.intent === "tool"
  ) {
    const detectedTool:
      DetectedTool =
        detection;

    const toolResult =
      runTool(
        detectedTool.tool,
        detectedTool.input
      );

    usedTool = true;

    lastTool =
      detectedTool.tool;

    lastToolResult =
      toolResult.result;

    toolsUsed.push(
      detectedTool.tool
    );

    steps += 1;

    /**
     * -----------------------------------------------------
     * If the tool failed, return the error directly.
     * No need for another expensive AI request.
     * -----------------------------------------------------
     */

    if (!toolResult.ok) {
      return {
        reply:
          toolResult.result,
        usedTool: true,
        tool: detectedTool.tool,
        toolResult:
          toolResult.result,
        detectedAction: null,
        newMemory: null,
        steps,
        toolsUsed,
      };
    }

    /**
     * -----------------------------------------------------
     * For deterministic tools, return a clean answer
     * without making another AI request.
     *
     * This makes calculator/time/text-stat requests
     * significantly faster.
     * -----------------------------------------------------
     */

    if (
      detectedTool.tool ===
      "calculator"
    ) {
      return {
        reply:
          toolResult.result,
        usedTool: true,
        tool: detectedTool.tool,
        toolResult:
          toolResult.result,
        detectedAction: null,
        newMemory: null,
        steps,
        toolsUsed,
      };
    }

    if (
      detectedTool.tool ===
      "time"
    ) {
      return {
        reply:
          `The current UTC time is ${toolResult.result}.`,
        usedTool: true,
        tool: detectedTool.tool,
        toolResult:
          toolResult.result,
        detectedAction: null,
        newMemory: null,
        steps,
        toolsUsed,
      };
    }

    if (
      detectedTool.tool ===
      "text_stats"
    ) {
      return {
        reply:
          toolResult.result,
        usedTool: true,
        tool: detectedTool.tool,
        toolResult:
          toolResult.result,
        detectedAction: null,
        newMemory: null,
        steps,
        toolsUsed,
      };
    }
  }

  /**
   * =======================================================
   * NORMAL AI REQUEST
   * =======================================================
   */

  for (
    let step = 0;
    step < MAX_AGENT_STEPS;
    step += 1
  ) {
    steps += 1;

    /**
     * -----------------------------------------------------
     * Ask the AI for the answer.
     *
     * If a previous tool was executed, provide its result.
     * -----------------------------------------------------
     */

    const answer =
      await generateAnswer(
        currentRequest,
        lastToolResult || undefined
      );

    /**
     * Preserve AI metadata.
     */

    detectedAction =
      answer.detectedAction ??
      null;

    newMemory =
      answer.newMemory ??
      null;

    /**
     * -----------------------------------------------------
     * If AI did not request another tool,
     * return immediately.
     * -----------------------------------------------------
     */

    if (
      !answer.toolCall
    ) {
      return {
        reply:
          cleanMessage(
            answer.reply
          ) ||
          "I’m ready to help. What would you like to do?",
        usedTool,
        tool:
          lastTool,
        toolResult:
          lastToolResult,
        detectedAction,
        newMemory,
        steps,
        toolsUsed,
      };
    }

    /**
     * -----------------------------------------------------
     * AI requested a deterministic tool.
     * -----------------------------------------------------
     */

    const requestedTool =
      answer.toolCall.tool;

    const toolInput =
      cleanMessage(
        answer.toolCall.input
      );

    /**
     * Only allow known local tools.
     */

    if (
      requestedTool !==
        "calculator" &&
      requestedTool !==
        "time" &&
      requestedTool !==
        "text_stats"
    ) {
      return {
        reply:
          cleanMessage(
            answer.reply
          ) ||
          "I couldn't execute that tool.",
        usedTool,
        tool:
          lastTool,
        toolResult:
          lastToolResult,
        detectedAction,
        newMemory,
        steps,
        toolsUsed,
      };
    }

    /**
     * -----------------------------------------------------
     * Execute requested tool.
     * -----------------------------------------------------
     */

    const result =
      runTool(
        requestedTool,
        toolInput
      );

    usedTool = true;

    lastTool =
      requestedTool;

    lastToolResult =
      result.result;

    if (
      !toolsUsed.includes(
        requestedTool
      )
    ) {
      toolsUsed.push(
        requestedTool
      );
    }

    /**
     * -----------------------------------------------------
     * Tool failed.
     * -----------------------------------------------------
     */

    if (!result.ok) {
      return {
        reply:
          result.result,
        usedTool: true,
        tool:
          requestedTool,
        toolResult:
          result.result,
        detectedAction,
        newMemory,
        steps,
        toolsUsed,
      };
    }

    /**
     * -----------------------------------------------------
     * Give the tool result back to the AI on the next
     * iteration so it can produce a natural response.
     * -----------------------------------------------------
     */

    currentRequest = {
      ...currentRequest,
      message:
        `${currentRequest.message}\n\n` +
        `A local tool was executed.\n` +
        formatToolResult(
          result
        ),
    };
  }

  /**
   * =======================================================
   * SAFETY FALLBACK
   * =======================================================
   *
   * Prevent infinite agent loops.
   */

  return {
    reply:
      "I completed the available processing, but I couldn't finish the request within the allowed steps.",
    usedTool,
    tool:
      lastTool,
    toolResult:
      lastToolResult,
    detectedAction,
    newMemory,
    steps,
    toolsUsed,
  };
}
