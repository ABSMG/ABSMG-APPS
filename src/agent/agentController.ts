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

export interface AgentToolCall {
  tool: AgentToolName;
  input: string;
}

/**
 * State passed between the Agent Controller
 * and the Gemini function-calling layer.
 *
 * Gemini 3 function calling requires the previous
 * model content and the matching function-call ID
 * to be preserved when sending the function result
 * back to Gemini.
 */
export interface AgentAIContext {
  toolCallId?: string;
  toolName?: AgentToolName;
  modelContent?: unknown;
}

export interface AgentAIAnswer {
  reply: string;

  detectedAction?:
    | AgentAction
    | null;

  newMemory?:
    | string
    | null;

  toolCall?:
    | AgentToolCall
    | null;

  /**
   * Gemini function-call ID.
   */
  toolCallId?:
    | string
    | null;

  /**
   * Original Gemini model content containing
   * the function call.
   */
  modelContent?:
    | unknown
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

/* =========================================================
   LIMITS
========================================================= */

const MAX_AGENT_STEPS = 6;

const MAX_MESSAGE_LENGTH = 4000;

const MAX_TOOL_RESULT_LENGTH = 2000;

/* =========================================================
   TOOL RESULT SANITIZATION
========================================================= */

function sanitizeToolResult(
  result: string
): string {
  const value =
    String(result || '').trim();

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

/* =========================================================
   TOOL RESULT VERIFICATION
========================================================= */

function verifyToolResult(
  result: string
): boolean {
  const value =
    String(result || '').trim();

  return (
    value.length > 0 &&
    !value
      .toLowerCase()
      .includes(
        'tool execution failed'
      )
  );
}

/* =========================================================
   TOOL FINGERPRINT
========================================================= */

function createToolFingerprint(
  tool: AgentToolName,
  input: string
): string {
  return (
    `${tool}:${input.trim()}`
  );
}

/* =========================================================
   GENERAL NODYSOM AGENT
========================================================= */

export async function runAgent(
  request: AgentRequest,

  aiAnswer: (
    request: AgentRequest,
    toolResult?: string,
    context?: AgentAIContext
  ) => Promise<AgentAIAnswer>
): Promise<AgentResponse> {

  /* =======================================================
     INPUT VALIDATION
  ======================================================= */

  const message =
    String(
      request.message || ''
    ).trim();

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

  /* =======================================================
     AGENT STATE
  ======================================================= */

  let latestToolResult:
    | string
    | undefined;

  let lastTool:
    | AgentToolName
    | undefined;

  let detectedAction:
    | AgentAction
    | null = null;

  let newMemory:
    | string
    | null = null;

  let usedTool = false;

  const toolsUsed: string[] = [];

  /**
   * Prevent the exact same tool call from
   * executing forever.
   */
  const executedTools =
    new Set<string>();

  /**
   * Native Gemini function-calling state.
   *
   * This is critical for multi-turn function
   * calling.
   */
  let geminiContext:
    | AgentAIContext
    | undefined;

  /* =======================================================
     AGENT LOOP
  ======================================================= */

  for (
    let step = 1;
    step <= MAX_AGENT_STEPS;
    step += 1
  ) {

    let modelResult:
      AgentAIAnswer;

    /* =====================================================
       FIRST STEP
    ===================================================== */

    if (
      step === 1 &&
      !latestToolResult
    ) {

      /**
       * Keep deterministic local tools working.
       *
       * Calculator, time and text_stats can be
       * executed locally immediately.
       */
      const localPlan =
        detectTool(
          message
        );

      if (
        localPlan.intent ===
          'tool' &&
        localPlan.tool
      ) {

        modelResult = {
          reply: '',

          toolCall: {
            tool:
              localPlan.tool,

            input:
              localPlan.input ||
              '',
          },

          detectedAction:
            null,

          newMemory:
            null,

          toolCallId:
            null,

          modelContent:
            null,
        };

      } else {

        /**
         * Normal Gemini request.
         */
        modelResult =
          await aiAnswer(
            request
          );
      }

    } else {

      /* ===================================================
         SUBSEQUENT GEMINI TURN
      =================================================== */

      modelResult =
        await aiAnswer(
          request,
          latestToolResult,
          geminiContext
        );
    }

    /* =====================================================
       SAVE AI METADATA
    ===================================================== */

    detectedAction =
      modelResult.detectedAction ||
      detectedAction ||
      null;

    newMemory =
      modelResult.newMemory ||
      newMemory ||
      null;

    /* =====================================================
       SAVE NATIVE GEMINI CONTEXT
    ===================================================== */

    if (
      modelResult.toolCall &&
      modelResult.toolCallId &&
      modelResult.modelContent
    ) {

      geminiContext = {
        toolCallId:
          modelResult.toolCallId,

        toolName:
          modelResult.toolCall.tool,

        modelContent:
          modelResult.modelContent,
      };
    }

    /* =====================================================
       FINAL ANSWER
    ===================================================== */

    if (
      !modelResult.toolCall
    ) {

      return {
        reply:
          modelResult.reply ||
          'I could not generate a response.',

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

    /* =====================================================
       TOOL REQUEST
    ===================================================== */

    const toolName =
      modelResult.toolCall.tool;

    const toolInput =
      String(
        modelResult.toolCall
          .input || ''
      ).trim();

    /* =====================================================
       VALID TOOLS
    ===================================================== */

    const validTools:
      AgentToolName[] = [
        'calculator',
        'time',
        'text_stats',
      ];

    if (
      !validTools.includes(
        toolName
      )
    ) {

      return {
        reply:
          `The requested tool "${toolName}" is not available.`,

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

    /* =====================================================
       LOOP PROTECTION
    ===================================================== */

    const toolFingerprint =
      createToolFingerprint(
        toolName,
        toolInput
      );

    if (
      executedTools.has(
        toolFingerprint
      )
    ) {

      /**
       * Same exact tool call was already
       * executed.
       *
       * Ask Gemini to finish with the
       * existing result.
       */
      const fallback =
        await aiAnswer(
          request,
          latestToolResult,
          geminiContext
        );

      return {
        reply:
          fallback.reply ||
          'I stopped because the same tool request was repeated.',

        usedTool,

        tool:
          lastTool,

        toolResult:
          latestToolResult,

        detectedAction:
          fallback.detectedAction ||
          detectedAction,

        newMemory:
          fallback.newMemory ||
          newMemory,

        steps: step,

        toolsUsed,
      };
    }

    executedTools.add(
      toolFingerprint
    );

    /* =====================================================
       EXECUTE TOOL
    ===================================================== */

    const tool =
      runTool(
        toolName,
        toolInput
      );

    usedTool = true;

    lastTool =
      tool.tool;

    toolsUsed.push(
      tool.tool
    );

    /* =====================================================
       TOOL ERROR
    ===================================================== */

    if (!tool.ok) {

      return {
        reply:
          `I could not complete the ${tool.tool} tool action: ${tool.result}`,

        usedTool: true,

        tool:
          tool.tool,

        toolResult:
          tool.result,

        detectedAction,

        newMemory,

        steps: step,

        toolsUsed,
      };
    }

    /* =====================================================
       SANITIZE RESULT
    ===================================================== */

    const safeResult =
      sanitizeToolResult(
        tool.result
      );

    /* =====================================================
       VERIFY RESULT
    ===================================================== */

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

        detectedAction,

        newMemory,

        steps: step,

        toolsUsed,
      };
    }

    /* =====================================================
       SAVE TOOL RESULT
    ===================================================== */

    latestToolResult =
      safeResult;

    /* =====================================================
       CONTINUE
    ===================================================== */

    continue;
  }

  /* =======================================================
     MAX STEP SAFETY
  ======================================================= */

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
