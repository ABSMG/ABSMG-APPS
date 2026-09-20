import {
  detectTool,
  runTool,
  type AgentToolName,
  type DetectedTool,
} from "./tools";

export interface AgentRequest {
  message: string;
  history?: unknown[];
  memories?: string[];
  userProfile?: unknown;
}

export interface AgentToolCall {
  tool: AgentToolName;
  input: string;
}

export interface AgentAIAnswer {
  reply: string;
  detectedAction?: AgentAction | null;
  newMemory?: string | null;
  toolCall?: AgentToolCall | null;
}

export interface AgentAction {
  type: string;
  payload?: Record<string, unknown>;
}

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

const MAX_AGENT_STEPS = 6;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOOL_RESULT_LENGTH = 2000;
const MAX_MEMORY_LENGTH = 1000;
const MAX_REPLY_LENGTH = 4000;

const ALLOWED_TOOLS = new Set<AgentToolName>([
  "calculator",
  "time",
  "text_stats",
]);

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizeToolResult(value: unknown): string {
  if (typeof value === "string") {
    return cleanText(value, MAX_TOOL_RESULT_LENGTH);
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

function sanitizeToolInput(value: unknown): string {
  return cleanText(value, MAX_MESSAGE_LENGTH);
}

function isAllowedTool(
  tool: unknown
): tool is AgentToolName {
  return (
    typeof tool === "string" &&
    ALLOWED_TOOLS.has(tool as AgentToolName)
  );
}

function normalizeToolCall(
  toolCall: AgentToolCall | null | undefined
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
    input: sanitizeToolInput(toolCall.input),
  };
}

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
    input: sanitizeToolInput(detected.input),
  };
}

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
            cleanText(item, MAX_MEMORY_LENGTH)
          )
          .filter(Boolean)
          .slice(0, 20)
      : [],

    userProfile: request.userProfile ?? null,
  };
}

export async function runAgent(
  request: AgentRequest,
  aiAnswer: (
    request: AgentRequest,
    toolResult?: string
  ) => Promise<AgentAIAnswer>
): Promise<AgentResponse> {
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

  const safeRequest = createSafeRequest(
    request,
    message
  );

  let steps = 0;
  let latestToolResult: string | undefined;
  let lastTool: AgentToolName | null = null;
  let detectedAction: AgentAction | null = null;
  let newMemory: string | null = null;
  let usedTool = false;

  const toolsUsed: AgentToolName[] = [];

  const detectedRaw = detectTool(message);

  const detected =
    detectedRaw.intent === "tool"
      ? normalizeDetectedTool(detectedRaw)
      : null;

  if (detected) {
    steps++;
    usedTool = true;
    lastTool = detected.tool;

    if (!toolsUsed.includes(detected.tool)) {
      toolsUsed.push(detected.tool);
    }

    try {
      const rawResult = runTool(
        detected.tool,
        detected.input
      );

      latestToolResult = sanitizeToolResult(
        rawResult.result
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

    try {
      const finalResult = await aiAnswer(
        safeRequest,
        latestToolResult
      );

      if (finalResult.detectedAction) {
        detectedAction =
          finalResult.detectedAction;
      }

      if (finalResult.newMemory) {
        newMemory = cleanText(
          finalResult.newMemory,
          MAX_MEMORY_LENGTH
        );
      }

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
        toolResult: latestToolResult,
        steps,
        toolsUsed,
      };
    } catch {
      return {
        reply:
          latestToolResult ||
          "The tool completed successfully.",

        detectedAction,
        newMemory,
        usedTool,
        tool: lastTool,
        toolResult: latestToolResult,
        steps,
        toolsUsed,
      };
    }
  }

  for (
    let currentStep = 0;
    currentStep < MAX_AGENT_STEPS;
    currentStep++
  ) {
    steps++;

    let modelResult: AgentAIAnswer;

    try {
      modelResult = await aiAnswer(
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

    if (modelResult.detectedAction) {
      detectedAction =
        modelResult.detectedAction;
    }

    if (modelResult.newMemory) {
      newMemory = cleanText(
        modelResult.newMemory,
        MAX_MEMORY_LENGTH
      );
    }

    const toolCall = normalizeToolCall(
      modelResult.toolCall
    );

    if (!toolCall) {
      return {
        reply:
          cleanText(
            modelResult.reply,
            MAX_REPLY_LENGTH
          ) ||
          latestToolResult ||
          "Done.",

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

    if (steps >= MAX_AGENT_STEPS) {
      return {
        reply:
          cleanText(
            modelResult.reply,
            MAX_REPLY_LENGTH
          ) ||
          latestToolResult ||
          "I reached the maximum number of processing steps.",

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

    try {
      const rawResult = runTool(
        toolCall.tool,
        toolCall.input
      );

      latestToolResult =
        sanitizeToolResult(
          rawResult.result
        );
    } catch (error) {
      latestToolResult =
        error instanceof Error
          ? cleanText(
              error.message,
              MAX_TOOL_RESULT_LENGTH
            )
          : "The requested tool failed to execute.";
    }

    usedTool = true;
    lastTool = toolCall.tool;

    if (!toolsUsed.includes(toolCall.tool)) {
      toolsUsed.push(toolCall.tool);
    }
  }

  return {
    reply:
      latestToolResult ||
      "I couldn't complete that request.",

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
