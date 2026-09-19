import {
  detectTool,
  runTool,
  AgentToolName,
} from './tools';

export interface AgentRequest {
  message: string;

  history?: Array<{
    role: string;
    content: string;
  }>;

  userProfile?: {
    name?: string;
    preferredLanguage?: string;
    goals?: string;
  };

  memories?: Array<{
    content: string;
  }>;
}

export interface AgentAction {
  type:
    | 'TASK'
    | 'REMINDER'
    | 'SCHEDULE'
    | 'BUDGET';

  title: string;

  date?: string;

  time?: string;

  category?: string;

  amount?: number;

  confirmedRequired?: boolean;
}

export interface AgentAIAnswer {
  reply: string;

  detectedAction?:
    | AgentAction
    | null;

  newMemory?:
    | string
    | null;
}

export interface AgentResponse {
  reply: string;

  usedTool: boolean;

  tool?: string;

  toolResult?: string;

  detectedAction?:
    | AgentAction
    | null;

  newMemory?:
    | string
    | null;

  steps?: number;

  toolsUsed?: string[];
}

const MAX_AGENT_STEPS = 4;

const MAX_MESSAGE_LENGTH = 4000;

const MAX_TOOL_RESULT_LENGTH = 2000;

/**
 * Keep tool output bounded before giving it
 * back to the AI.
 */
function sanitizeToolResult(
  result: string
): string {
  const value = String(
    result || ''
  ).trim();

  if (!value) {
    return 'Tool returned an empty result.';
  }

  if (
    value.length >
    MAX_TOOL_RESULT_LENGTH
  ) {
    return (
      value.slice(
        0,
        MAX_TOOL_RESULT_LENGTH
      ) +
      '\n[Tool result truncated]'
    );
  }

  return value;
}

/**
 * Verify that a successful tool result
 * actually contains usable output.
 */
function verifyToolResult(
  result: string
): boolean {
  const value = String(
    result || ''
  ).trim();

  return (
    value.length > 0 &&
    !value
      .toLowerCase()
      .includes('tool execution failed')
  );
}

/**
 * Prevent the same tool from being
 * executed repeatedly with exactly the
 * same input during one agent run.
 */
function createToolFingerprint(
  tool: AgentToolName,
  input: string
): string {
  return `${tool}:${input.trim()}`;
}

/**
 * Run the general-purpose agent.
 *
 * Flow:
 *
 * USER
 *   ↓
 * Understand
 *   ↓
 * Plan
 *   ↓
 * Choose tool
 *   ↓
 * Execute
 *   ↓
 * Verify
 *   ↓
 * Re-plan if necessary
 *   ↓
 * Final AI answer
 */
export async function runAgent(
  request: AgentRequest,

  aiAnswer: (
    request: AgentRequest,
    toolResult?: string
  ) => Promise<AgentAIAnswer>
): Promise<AgentResponse> {
  const message =
    String(
      request.message || ''
    ).trim();

  // -----------------------------------------
  // INPUT VALIDATION
  // -----------------------------------------

  if (!message) {
    throw new Error(
      'Agent message is required.'
    );
  }

  if (
    message.length >
    MAX_MESSAGE_LENGTH
  ) {
    throw new Error(
      'Message is too long.'
    );
  }

  if (
    typeof aiAnswer !==
    'function'
  ) {
    throw new Error(
      'AI answer handler is required.'
    );
  }

  // -----------------------------------------
  // AGENT STATE
  // -----------------------------------------

  let currentMessage =
    message;

  let latestToolResult:
    | string
    | undefined;

  let usedTool = false;

  let lastTool:
    | AgentToolName
    | undefined;

  let lastToolInput = '';

  let detectedAction:
    | AgentAction
    | null = null;

  let newMemory:
    | string
    | null = null;

  const toolsUsed: string[] = [];

  const executedTools =
    new Set<string>();

  // -----------------------------------------
  // AGENT LOOP
  // -----------------------------------------

  for (
    let step = 1;
    step <= MAX_AGENT_STEPS;
    step += 1
  ) {
    /*
     * STEP 1
     *
     * Understand the current request
     * and determine whether a local
     * deterministic tool is needed.
     */
    const plan =
      detectTool(
        currentMessage
      );

    /*
     * ---------------------------------------
     * NORMAL AI PATH
     * ---------------------------------------
     *
     * If no local tool is required,
     * let the AI produce the answer.
     */
    if (
      plan.intent !== 'tool' ||
      !plan.tool
    ) {
      const aiResult =
        await aiAnswer(
          request,
          latestToolResult
        );

      detectedAction =
        aiResult.detectedAction ||
        null;

      newMemory =
        aiResult.newMemory ||
        null;

      return {
        reply:
          aiResult.reply,

        usedTool,

        tool:
          lastTool,

        toolResult:
          latestToolResult,

        detectedAction,

        newMemory,

        steps: step,

        toolsUsed,
      };
    }

    /*
     * ---------------------------------------
     * TOOL PLANNING
     * ---------------------------------------
     */

    const toolName =
      plan.tool;

    const toolInput =
      String(
        plan.input || ''
      ).trim();

    const fingerprint =
      createToolFingerprint(
        toolName,
        toolInput
      );

    /*
     * ---------------------------------------
     * LOOP PROTECTION
     * ---------------------------------------
     *
     * Do not execute the exact same
     * tool/input combination forever.
     */
    if (
      executedTools.has(
        fingerprint
      )
    ) {
      const aiResult =
        await aiAnswer(
          request,
          latestToolResult
        );

      return {
        reply:
          aiResult.reply,

        usedTool,

        tool:
          lastTool,

        toolResult:
          latestToolResult,

        detectedAction:
          aiResult.detectedAction ||
          null,

        newMemory:
          aiResult.newMemory ||
          null,

        steps: step,

        toolsUsed,
      };
    }

    executedTools.add(
      fingerprint
    );

    /*
     * ---------------------------------------
     * TOOL EXECUTION
     * ---------------------------------------
     */

    const tool =
      runTool(
        toolName,
        toolInput
      );

    usedTool = true;

    lastTool =
      tool.tool;

    lastToolInput =
      toolInput;

    toolsUsed.push(
      tool.tool
    );

    /*
     * ---------------------------------------
     * TOOL FAILURE
     * ---------------------------------------
     */

    if (!tool.ok) {
      return {
        reply:
          `I could not complete the ${tool.tool} tool action: ${tool.result}`,

        usedTool: true,

        tool:
          tool.tool,

        toolResult:
          tool.result,

        detectedAction:
          null,

        newMemory:
          null,

        steps: step,

        toolsUsed,
      };
    }

    /*
     * ---------------------------------------
     * TOOL RESULT SANITIZATION
     * ---------------------------------------
     */

    const safeResult =
      sanitizeToolResult(
        tool.result
      );

    /*
     * ---------------------------------------
     * TOOL RESULT VERIFICATION
     * ---------------------------------------
     */

    if (
      !verifyToolResult(
        safeResult
      )
    ) {
      return {
        reply:
          `The ${tool.tool} tool did not return a usable result.`,

        usedTool: true,

        tool:
          tool.tool,

        toolResult:
          safeResult,

        detectedAction:
          null,

        newMemory:
          null,

        steps: step,

        toolsUsed,
      };
    }

    latestToolResult =
      safeResult;

    /*
     * ---------------------------------------
     * AI VERIFICATION / NEXT DECISION
     * ---------------------------------------
     *
     * The AI receives the tool result.
     *
     * It can:
     *
     * 1. Produce the final answer.
     * 2. Interpret the result and answer.
     *
     * The controller can then stop safely.
     *
     * Future versions can replace this
     * section with native Gemini function
     * calling for true model-driven
     * multi-tool planning.
     */
    const aiResult =
      await aiAnswer(
        request,
        safeResult
      );

    detectedAction =
      aiResult.detectedAction ||
      null;

    newMemory =
      aiResult.newMemory ||
      null;

    /*
     * ---------------------------------------
     * FINAL RESPONSE
     * ---------------------------------------
     *
     * Current AI callback returns the
     * user-facing answer after receiving
     * the tool result.
     */
    return {
      reply:
        aiResult.reply,

      usedTool: true,

      tool:
        tool.tool,

      toolResult:
        safeResult,

      detectedAction,

      newMemory,

      steps: step,

      toolsUsed,
    };
  }

  // -----------------------------------------
  // SAFETY FALLBACK
  // -----------------------------------------

  return {
    reply:
      'I reached the maximum number of agent steps before completing the request. Please try simplifying the task.',

    usedTool,

    tool:
      lastTool,

    toolResult:
      latestToolResult,

    detectedAction,

    newMemory,

    steps:
      MAX_AGENT_STEPS,

    toolsUsed,
  };
}
