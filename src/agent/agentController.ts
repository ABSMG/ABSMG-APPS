import {
  detectTool,
  runTool,
  type AgentToolName,
  type DetectedTool,
} from "./tools";

/**
 * =========================================================
 * AGENT REQUEST
 * =========================================================
 *
 * This is the request shape expected by the new
 * Experiential Labs based server.ts.
 *
 * userProfile is intentionally typed as unknown so the
 * controller does not depend on a specific frontend
 * profile shape.
 */
export interface AgentRequest {
  message: string;
  history?: unknown[];
  memories?: string[];
  userProfile?: unknown;
}

/**
 * =========================================================
 * JSON TOOL CALL
 * =========================================================
 *
 * This matches the JSON protocol used by the new
 * server.ts:
 *
 * {
 *   "toolCall": {
 *     "tool": "calculator",
 *     "input": "25 * 40"
 *   }
 * }
 */
export interface AgentToolCall {
  tool: AgentToolName;
  input: string;
}

/**
 * =========================================================
 * AI ANSWER
 * =========================================================
 *
 * No Gemini-native modelContent/function-call state.
 *
 * Experiential Labs returns structured JSON instead.
 */
export interface AgentAIAnswer {
  reply: string;
  detectedAction?: AgentAction | null;
  newMemory?: string | null;
  toolCall?: AgentToolCall | null;
}

/**
 * =========================================================
 * AGENT ACTION
 * =========================================================
 */
export interface AgentAction {
  type: string;
  payload?: Record<string, unknown>;
}

/**
 * =========================================================
 * AGENT RESPONSE
 * =========================================================
 */
export interface AgentResponse {
  reply: string;
  detectedAction?: AgentAction | null;
  newMemory?: string | null;

  usedTool: boolean;
  tool?: AgentToolName | null;
  toolResult?: string | null;

  steps: number;
  toolsUsed: AgentToolName[];
}

/**
 * =========================================================
 * LIMITS
 * =========================================================
 */
const MAX_AGENT_STEPS = 6;

const MAX_MESSAGE_LENGTH = 4000;

const MAX_TOOL_RESULT_LENGTH = 2000;

const MAX_MEMORY_LENGTH = 1000;

const MAX_REPLY_LENGTH = 4000;

/**
 * =========================================================
 * ALLOWED TOOLS
 * =========================================================
 */
const ALLOWED_TOOLS = new Set<AgentToolName>([
  "calculator",
  "time",
  "text_stats",
]);

/**
 * =========================================================
 * TEXT SANITIZATION
 * =========================================================
 */
function cleanText(
  value: unknown,
  maxLength: number
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * =========================================================
 * TOOL RESULT SANITIZATION
 * =========================================================
 */
function sanitizeToolResult(
  value: unknown
): string {
  if (typeof value === "string") {
    return cleanText(
      value,
      MAX_TOOL_RESULT_LENGTH
    );
  }

  try {
    return cleanText(
      JSON.stringify(value),
      MAX_TOOL_RESULT_LENGTH
    );
  } catch {
    return "Tool returned an unreadable result.";
  }
}

/**
 * =========================================================
 * TOOL INPUT SANITIZATION
 * =========================================================
 */
function sanitizeToolInput(
  value: unknown
): string {
  return cleanText(
    value,
    MAX_MESSAGE_LENGTH
  );
}

/**
 * =========================================================
 * TOOL VALIDATION
 * =========================================================
 */
function isAllowedTool(
  tool: unknown
): tool is AgentToolName {
  return (
    typeof tool === "string" &&
    ALLOWED_TOOLS.has(
      tool as AgentToolName
    )
  );
}

/**
 * =========================================================
 * NORMALIZE AI JSON TOOL CALL
 * =========================================================
 *
 * Converts potentially unsafe/invalid model output into
 * a safe internal tool-call object.
 */
function normalizeToolCall(
  toolCall:
    | AgentToolCall
    | null
    | undefined
): AgentToolCall | null {
  if (!toolCall) {
    return null;
  }

  if (
    typeof toolCall !== "object" ||
    !isAllowedTool(toolCall.tool)
  ) {
    return null;
  }

  return {
    tool: toolCall.tool,
    input: sanitizeToolInput(
      toolCall.input
    ),
  };
}

/**
 * =========================================================
 * NORMALIZE LOCALLY DETECTED TOOL
 * =========================================================
 */
function normalizeDetectedTool(
  detected: DetectedTool | null
): AgentToolCall | null {
  if (!detected) {
    return null;
  }

  if (!isAllowedTool(detected.tool)) {
    return null;
  }

  return {
    tool: detected.tool,
    input: sanitizeToolInput(
      detected.input
    ),
  };
}

/**
 * =========================================================
 * SAFE REQUEST
 * =========================================================
 *
 * Keeps the original request structure, including:
 *
 * - message
 * - history
 * - memories
 * - userProfile
 */
function createSafeRequest(
  request: AgentRequest,
  message: string
): AgentRequest {
  return {
    ...request,
    message,
    history: Array.isArray(request.history)
      ? request.history
      : [],
    memories: Array.isArray(request.memories)
      ? request.memories
          .filter(
            (item): item is string =>
              typeof item === "string"
          )
          .map((item) =>
            cleanText(
              item,
              MAX_MEMORY_LENGTH
            )
          )
          .filter(Boolean)
          .slice(0, 20)
      : [],
    userProfile:
      request.userProfile ?? null,
  };
}

/**
 * =========================================================
 * AGENT CONTROLLER
 * =========================================================
 *
 * Flow:
 *
 * 1. Validate request.
 * 2. Check deterministic local tools.
 * 3. If local tool is detected, execute it.
 * 4. Ask Experiential Labs to formulate the response.
 * 5. Otherwise ask Experiential Labs for a JSON response.
 * 6. If AI returns toolCall, execute it locally.
 * 7. Send the tool result back through aiAnswer().
 * 8. Repeat until final response or MAX_AGENT_STEPS.
 */
export async function runAgent(
  request: AgentRequest,
  aiAnswer: (
    request: AgentRequest,
    toolResult?: string
  ) => Promise<AgentAIAnswer>
): Promise<AgentResponse> {
  /**
   * -------------------------------------------------------
   * VALIDATE MESSAGE
   * -------------------------------------------------------
   */
  const message = cleanText(
    request.message,
    MAX_MESSAGE_LENGTH
  );

  if (!message) {
    return {
      reply: "Please provide a message.",
      detectedAction: null,
      newMemory: null,
      usedTool: false,
      tool: null,
      toolResult: null,
      steps: 0,
      toolsUsed: [],
    };
  }

  /**
   * -------------------------------------------------------
   * CREATE SAFE REQUEST
   * -------------------------------------------------------
   */
  const safeRequest =
    createSafeRequest(
      request,
      message
    );

  /**
   * -------------------------------------------------------
   * AGENT STATE
   * -------------------------------------------------------
   */
  let steps = 0;

  let latestToolResult:
    | string
    | undefined;

  let lastTool:
    | AgentToolName
    | null = null;

  let detectedAction:
    | AgentAction
    | null = null;

  let newMemory:
    | string
    | null = null;

  let usedTool = false;

  const toolsUsed:
    AgentToolName[] = [];

  /**
   * =======================================================
   * STEP 1
   * LOCAL DETERMINISTIC TOOL DETECTION
   * =======================================================
   *
   * Example:
   *
   * "calculate 25 * 40"
   * "what time is it"
   * "count the words in this text"
   */
  const detected =
    normalizeDetectedTool(
      detectTool(message)
    );

  if (detected) {
    steps++;

    usedTool = true;

    lastTool = detected.tool;

    if (
      !toolsUsed.includes(
        detected.tool
      )
    ) {
      toolsUsed.push(
        detected.tool
      );
    }

    /**
     * -----------------------------------------------------
     * EXECUTE LOCAL TOOL
     * -----------------------------------------------------
     */
    try {
      const rawResult =
        await runTool(
          detected.tool,
          detected.input
        );

      latestToolResult =
        sanitizeToolResult(
          rawResult
        );
    } catch (error) {
      latestToolResult =
        error instanceof Error
          ? cleanText(
              error.message,
              MAX_TOOL_RESULT_LENGTH
            )
          : "The tool failed to execute.";
    }

    /**
     * -----------------------------------------------------
     * ASK AI TO EXPLAIN TOOL RESULT
     * -----------------------------------------------------
     *
     * IMPORTANT:
     * There is no Gemini-native context here.
     *
     * Experiential Labs receives the tool result as
     * normal structured context through server.ts.
     */
    try {
      const finalResult =
        await aiAnswer(
          safeRequest,
          latestToolResult
        );

      /**
       * Save detected action.
       */
      if (
        finalResult.detectedAction
      ) {
        detectedAction =
          finalResult.detectedAction;
      }

      /**
       * Save memory.
       */
      if (
        finalResult.newMemory
      ) {
        newMemory =
          cleanText(
            finalResult.newMemory,
            MAX_MEMORY_LENGTH
          );
      }

      /**
       * Return final answer.
       */
      return {
        reply:
          cleanText(
            finalResult.reply,
            MAX_REPLY_LENGTH
          ) ||
          latestToolResult ||
          "Done.",

        detectedAction,

        newMemory,

        usedTool,

        tool: lastTool,

        toolResult:
          latestToolResult,

        steps,

        toolsUsed,
      };
    } catch {
      /**
       * If AI fails after the local tool succeeds,
       * return the deterministic tool result.
       */
      return {
        reply:
          latestToolResult ||
          "The tool completed successfully.",

        detectedAction,

        newMemory,

        usedTool,

        tool: lastTool,

        toolResult:
          latestToolResult,

        steps,

        toolsUsed,
      };
    }
  }

  /**
   * =======================================================
   * STEP 2+
   * AI CONTROLLED TOOL LOOP
   * =======================================================
   *
   * Experiential Labs returns:
   *
   * {
   *   "reply": "...",
   *   "detectedAction": null,
   *   "newMemory": null,
   *   "toolCall": {
   *     "tool": "calculator",
   *     "input": "25 * 40"
   *   }
   * }
   *
   * OR:
   *
   * {
   *   "reply": "The answer is 1000.",
   *   "detectedAction": null,
   *   "newMemory": null,
   *   "toolCall": null
   * }
   */
  for (
    let currentStep = 0;
    currentStep <
    MAX_AGENT_STEPS;
    currentStep++
  ) {
    steps++;

    let modelResult:
      AgentAIAnswer;

    /**
     * -----------------------------------------------------
     * CALL EXPERIENTIAL LABS
     * -----------------------------------------------------
     *
     * server.ts is responsible for:
     *
     * - API key
     * - model
     * - OpenAI-compatible endpoint
     * - response_format JSON
     * - parsing JSON
     *
     * This controller only handles the agent logic.
     */
    try {
      modelResult =
        await aiAnswer(
          safeRequest,
          latestToolResult
        );
    } catch {
      return {
        reply:
          "I couldn't complete that request right now.",

        detectedAction,

        newMemory,

        usedTool,

        tool: lastTool,

        toolResult:
          latestToolResult ?? null,

        steps,

        toolsUsed,
      };
    }

    /**
     * -----------------------------------------------------
     * DETECTED ACTION
     * -----------------------------------------------------
     */
    if (
      modelResult.detectedAction
    ) {
      detectedAction =
        modelResult.detect
