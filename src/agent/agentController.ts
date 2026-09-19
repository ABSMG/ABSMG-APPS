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

export interface AgentResponse {
  reply: string;
  usedTool: boolean;
  tool?: string;
  toolResult?: string;
}

export async function runAgent(
  request: AgentRequest,
  aiAnswer: (
    request: AgentRequest,
    toolResult?: string
  ) => Promise<string>
): Promise<AgentResponse> {
  const message = String(
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
  const plan = detectTool(message);

  /*
   * STEP 2
   * Execute a tool if needed.
   */
  if (
    plan.intent === 'tool' &&
    plan.tool
  ) {
    const tool = runTool(
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
        toolResult: tool.result,
      };
    }

    /*
     * STEP 4
     * Let the AI turn the tool result
     * into a natural response.
     */
    const reply = await aiAnswer(
      request,
      tool.result
    );

    return {
      reply,
      usedTool: true,
      tool: tool.tool,
      toolResult: tool.result,
    };
  }

  /*
   * Normal AI request.
   */
  const reply = await aiAnswer(request);

  return {
    reply,
    usedTool: false,
  };
}
