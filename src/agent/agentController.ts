import {
  detectTool,
  runTool,
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
}

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

  if (!message) {
    throw new Error(
      'Agent message is required.'
    );
  }

  if (message.length > 4000) {
    throw new Error(
      'Message is too long.'
    );
  }

  /*
   * STEP 1
   * Understand the request.
   */
  const plan =
    detectTool(message);

  /*
   * STEP 2
   * Execute tool if required.
   */
  if (
    plan.intent === 'tool' &&
    plan.tool
  ) {
    const tool =
      runTool(
        plan.tool,
        plan.input || ''
      );

    /*
     * STEP 3
     * Verify tool result.
     */
    if (!tool.ok) {
      return {
        reply:
          `I could not complete that tool action: ${tool.result}`,

        usedTool: true,

        tool: tool.tool,

        toolResult:
          tool.result,

        detectedAction:
          null,

        newMemory:
          null,
      };
    }

    /*
     * STEP 4
     * Let AI interpret the tool result.
     */
    const aiResult =
      await aiAnswer(
        request,
        tool.result
      );

    return {
      reply:
        aiResult.reply,

      usedTool: true,

      tool: tool.tool,

      toolResult:
        tool.result,

      detectedAction:
        aiResult.detectedAction ||
        null,

      newMemory:
        aiResult.newMemory ||
        null,
    };
  }

  /*
   * Normal AI request.
   */
  const aiResult =
    await aiAnswer(
      request
    );

  return {
    reply:
      aiResult.reply,

    usedTool: false,

    detectedAction:
      aiResult.detectedAction ||
      null,

    newMemory:
      aiResult.newMemory ||
      null,
  };
}
