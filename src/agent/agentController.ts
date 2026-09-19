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

export interface AgentAIAnswer {
  reply: string;

  detectedAction?:
    | AgentAction
    | null;

  newMemory?:
    | string
    | null;

  /*
   * Gemini can request a tool.
   */
  toolCall?:
    | AgentToolCall
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

/*
 * Maximum number of agent iterations.
 *
 * Example:
 *
 * Step 1 -> calculator
 * Step 2 -> time
 * Step 3 -> final answer
 */
const MAX_AGENT_STEPS = 6;

const MAX_MESSAGE_LENGTH = 4000;

const MAX_TOOL_RESULT_LENGTH = 2000;

/*
 * Keep tool results small before returning
 * them to the model.
 */
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

/*
 * Verify that the tool actually produced
 * usable output.
 */
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

/*
 * Create a unique identifier for a tool call.
 *
 * This prevents:
 *
 * calculator -> same input
 * calculator -> same input
 * calculator -> same input
 *
 * forever.
 */
function createToolFingerprint(
  tool: AgentToolName,
  input: string
): string {
  return (
    `${tool}:${input.trim()}`
  );
}

/*
 * General-purpose Nodysom AI Agent Controller.
 *
 * FLOW:
 *
 * USER
 *   ↓
 * UNDERSTAND
 *   ↓
 * PLAN
 *   ↓
 * CHOOSE TOOL
 *   ↓
 * EXECUTE
 *   ↓
 * VERIFY
 *   ↓
 * RETURN RESULT TO AI
 *   ↓
 * RE-PLAN
 *   ↓
 * ANOTHER TOOL OR FINAL ANSWER
 */
export async function runAgent(
  request: AgentRequest,

  aiAnswer: (
    request: AgentRequest,
    toolResult?: string
  ) => Promise<AgentAIAnswer>
): Promise<AgentResponse> {
  /*
   * -----------------------------------------
   * INPUT VALIDATION
   * -----------------------------------------
   */

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

  /*
   * -----------------------------------------
   * AGENT STATE
   * -----------------------------------------
   */

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

  /*
   * Prevent infinite repeated calls.
   */
  const executedTools =
    new Set<string>();

  /*
   * -----------------------------------------
   * AGENT LOOP
   * -----------------------------------------
   */

  for (
    let step = 1;
    step <= MAX_AGENT_STEPS;
    step += 1
  ) {
    let modelResult:
      | AgentAIAnswer;

    /*
     * ---------------------------------------
     * STEP 1
     * ---------------------------------------
     *
     * Deterministic local tool detection.
     *
     * This keeps calculator/time/text_stats
     * working even when Gemini does not
     * explicitly request them.
     */

    if (
      step === 1 &&
      !latestToolResult
    ) {
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
        };
      } else {
        /*
         * Normal Gemini request.
         */
        modelResult =
          await aiAnswer(
            request
          );
      }
    } else {
      /*
       * -------------------------------------
       * RE-PLANNING
       * -------------------------------------
       *
       * Gemini receives the latest tool
       * result and decides what happens next.
       */

      modelResult =
        await aiAnswer(
          request,
          latestToolResult
        );
    }

    /*
     * ---------------------------------------
     * SAVE AI METADATA
     * ---------------------------------------
     */

    detectedAction =
      modelResult.detectedAction ||
      null;

    newMemory =
      modelResult.newMemory ||
      null;

    /*
     * ---------------------------------------
     * FINAL ANSWER
     * ---------------------------------------
     *
     * No tool call means Gemini has finished.
     */

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

    /*
     * ---------------------------------------
     * TOOL REQUEST
     * ---------------------------------------
     */

    const toolName =
      modelResult.toolCall.tool;

    const toolInput =
      String(
        modelResult.toolCall
          .input || ''
      ).trim();

    /*
     * ---------------------------------------
     * VALID TOOL CHECK
     * ---------------------------------------
     */

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

    /*
     * ---------------------------------------
     * LOOP PROTECTION
     * ---------------------------------------
     */

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
      /*
       * Same exact tool call was already
       * executed.
       *
       * Ask Gemini to finish using the
       * available result instead of looping.
       */

      const fallback =
        await aiAnswer(
          request,
          latestToolResult
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

    /*
     * ---------------------------------------
     * EXECUTE TOOL
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

    toolsUsed.push(
      tool.tool
    );

    /*
     * ---------------------------------------
     * TOOL ERROR
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

        detectedAction,

        newMemory,

        steps: step,

        toolsUsed,
      };
    }

    /*
     * ---------------------------------------
     * SANITIZE RESULT
     * ---------------------------------------
     */

    const safeResult =
      sanitizeToolResult(
        tool.result
      );

    /*
     * ---------------------------------------
     * VERIFY RESULT
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

        detectedAction,

        newMemory,

        steps: step,

        toolsUsed,
      };
    }

    /*
     * ---------------------------------------
     * SAVE TOOL RESULT
     * ---------------------------------------
     */

    latestToolResult =
      safeResult;

    /*
     * ---------------------------------------
     * CONTINUE AGENT LOOP
     * ---------------------------------------
     *
     * IMPORTANT:
     *
     * We do NOT return here.
     *
     * The next iteration gives the tool
     * result back to Gemini.
     *
     * Gemini can then:
     *
     * 1. Request another tool.
     *
     * OR
     *
     * 2. Return the final answer.
     */

    continue;
  }

  /*
   * -----------------------------------------
   * MAX STEP SAFETY
   * -----------------------------------------
   */

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
