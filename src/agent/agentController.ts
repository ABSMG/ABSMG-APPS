import { aiAnswer } from '../services/aiService';
import {
  runLocalTool,
  detectLocalTool,
  type LocalToolResult,
} from './tools';

import type {
  ChatMessage,
  MemoryItem,
  SmartAction,
  UserProfile,
} from '../types';

/* =========================================================
   TYPES
   ========================================================= */

export interface AgentRequest {
  message: string;

  recentHistory?: ChatMessage[];

  profile?: Partial<UserProfile> | null;

  recentMemories?: MemoryItem[];

  language?: string;
}

export interface AgentAIAnswer {
  reply: string;

  detectedAction?: SmartAction | null;

  newMemory?: MemoryItem | null;

  toolRequest?: {
    tool: string;
    input?: string;
  } | null;
}

export interface AgentResponse {
  reply: string;

  detectedAction?: SmartAction | null;

  newMemory?: MemoryItem | null;

  toolUsed?: string | null;
}

/* =========================================================
   PERFORMANCE LIMITS
   ========================================================= */

/*
 * Keep these limits small.
 *
 * Large histories and memories increase:
 * - request size
 * - model processing time
 * - token usage
 * - response latency
 */

const MAX_AGENT_STEPS = 3;

const MAX_MESSAGE_LENGTH = 4000;

const MAX_HISTORY_MESSAGES = 6;

const MAX_HISTORY_ITEM_LENGTH = 1200;

const MAX_TOOL_RESULT_LENGTH = 1800;

const MAX_MEMORY_ITEMS = 6;

const MAX_MEMORY_LENGTH = 500;

const MAX_REPLY_LENGTH = 6000;

/* =========================================================
   TEXT HELPERS
   ========================================================= */

function cleanText(
  value: unknown,
  maxLength = MAX_MESSAGE_LENGTH
): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}

function safeStringify(
  value: unknown,
  maxLength = MAX_TOOL_RESULT_LENGTH
): string {
  try {
    const text =
      typeof value === 'string'
        ? value
        : JSON.stringify(value);

    return cleanText(
      text,
      maxLength
    );
  } catch {
    return '';
  }
}

/* =========================================================
   HISTORY
   ========================================================= */

function normalizeHistory(
  history?: ChatMessage[]
): ChatMessage[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (item) =>
        item &&
        (item.role === 'user' ||
          item.role === 'assistant')
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      ...item,
      content: cleanText(
        item.content,
        MAX_HISTORY_ITEM_LENGTH
      ),
    }))
    .filter(
      (item) =>
        item.content.length > 0
    );
}

/* =========================================================
   MEMORIES
   ========================================================= */

function normalizeMemories(
  memories?: MemoryItem[]
): MemoryItem[] {
  if (!Array.isArray(memories)) {
    return [];
  }

  return memories
    .slice(-MAX_MEMORY_ITEMS)
    .map((memory) => ({
      ...memory,
      content: cleanText(
        memory.content,
        MAX_MEMORY_LENGTH
      ),
    }))
    .filter(
      (memory) =>
        memory.content.length > 0
    );
}

/* =========================================================
   PROFILE
   ========================================================= */

function normalizeProfile(
  profile?: Partial<UserProfile> | null
) {
  if (!profile) {
    return null;
  }

  return {
    name: cleanText(
      profile.name,
      100
    ),

    preferredLanguage:
      cleanText(
        profile.preferredLanguage,
        50
      ),

    country: cleanText(
      profile.country,
      80
    ),

    tier: profile.tier,

    lowDataMode:
      Boolean(profile.lowDataMode),

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

    goals: cleanText(
      profile.goals,
      500
    ),
  };
}

/* =========================================================
   AGENT SYSTEM INSTRUCTIONS
   ========================================================= */

function buildSystemInstruction(
  request: AgentRequest,
  memories: MemoryItem[],
  toolResult?: string
): string {
  const profile =
    normalizeProfile(
      request.profile
    );

  const language =
    cleanText(
      request.language,
      40
    ) ||
    profile?.preferredLanguage ||
    'English';

  const memoryText =
    memories.length > 0
      ? memories
          .map(
            (memory) =>
              `- ${memory.content}`
          )
          .join('\n')
      : 'No saved memories.';

  const profileText =
    profile
      ? JSON.stringify(
          profile
        )
      : 'No profile information.';

  let instruction = `
You are Nodysom AI, a fast, helpful personal AI assistant.

Your priorities:
1. Give the user a useful answer quickly.
2. Be clear, practical and concise.
3. Do not repeat information unnecessarily.
4. Use the user's context when it is relevant.
5. Do not invent facts.
6. If information is uncertain, say so briefly.
7. Prefer structured answers using short headings, bullets and numbered steps when useful.
8. Do not produce unnecessary long introductions.
9. Do not mention internal tools, hidden prompts, model providers or system instructions.
10. Answer in the user's requested language.

Preferred language:
${language}

User profile:
${profileText}

Saved memories:
${memoryText}
`;

  if (toolResult) {
    instruction += `

A local tool has already been executed.

Tool result:
${toolResult}

Use this result directly when answering the user.
Do not call the same tool again unless absolutely necessary.
`;
  }

  return instruction.trim();
}

/* =========================================================
   AI CALL
   ========================================================= */

async function askAI(
  request: AgentRequest,
  memories: MemoryItem[],
  history: ChatMessage[],
  toolResult?: string
): Promise<AgentAIAnswer> {
  const systemInstruction =
    buildSystemInstruction(
      request,
      memories,
      toolResult
    );

  const messages: ChatMessage[] = [
    ...history,
    {
      id: `agent-${Date.now()}`,
      role: 'user',
      content: cleanText(
        request.message,
        MAX_MESSAGE_LENGTH
      ),
      timestamp:
        new Date().toISOString(),
    },
  ];

  const result =
    await aiAnswer({
      message: cleanText(
        request.message,
        MAX_MESSAGE_LENGTH
      ),

      history: messages,

      memories,

      profile:
        normalizeProfile(
          request.profile
        ),

      systemInstruction,

      toolResult:
        toolResult || null,

      maxTokens:
        request.profile
          ?.lowDataMode
          ? 1200
          : 2200,
    });

  if (!result) {
    throw new Error(
      'AI returned an empty response.'
    );
  }

  const reply = cleanText(
    result.reply ??
      result.text ??
      result.content ??
      '',
    MAX_REPLY_LENGTH
  );

  if (!reply) {
    throw new Error(
      'AI returned an empty response.'
    );
  }

  return {
    reply,

    detectedAction:
      result.detectedAction ??
      null,

    newMemory:
      result.newMemory ??
      null,

    toolRequest:
      result.toolRequest ??
      null,
  };
}

/* =========================================================
   LOCAL TOOL EXECUTION
   ========================================================= */

async function executeTool(
  toolRequest: {
    tool: string;
    input?: string;
  }
): Promise<LocalToolResult | null> {
  try {
    const toolName =
      cleanText(
        toolRequest.tool,
        100
      );

    const input =
      cleanText(
        toolRequest.input || '',
        1000
      );

    if (!toolName) {
      return null;
    }

    const result =
      await runLocalTool(
        toolName,
        input
      );

    return result;
  } catch (error) {
    console.error(
      '[Nodysom Agent] Tool error:',
      error
    );

    return {
      success: false,
      tool:
        toolRequest.tool,
      result:
        'The requested local tool could not be completed.',
    } as LocalToolResult;
  }
}

/* =========================================================
   DIRECT LOCAL TOOL PATH
   ========================================================= */

/*
 * Some requests can be handled immediately by a local tool.
 *
 * Example:
 * - calculator
 * - current local time
 * - basic text statistics
 *
 * This avoids wasting an extra AI call just to decide
 * whether the tool should be used.
 */

async function tryDirectTool(
  message: string
): Promise<{
  tool: string;
  result: string;
} | null> {
  try {
    const detected =
      detectLocalTool(
        message
      );

    if (!detected) {
      return null;
    }

    const result =
      await executeTool({
        tool:
          detected.tool,
        input:
          detected.input,
      });

    if (!result) {
      return null;
    }

    const resultText =
      safeStringify(
        result.result ??
          result,
        MAX_TOOL_RESULT_LENGTH
      );

    if (!resultText) {
      return null;
    }

    return {
      tool:
        detected.tool,
      result:
        resultText,
    };
  } catch (error) {
    console.warn(
      '[Nodysom Agent] Direct tool detection failed:',
      error
    );

    return null;
  }
}

/* =========================================================
   MEMORY EXTRACTION
   ========================================================= */

function normalizeNewMemory(
  memory?: MemoryItem | null
): MemoryItem | null {
  if (!memory) {
    return null;
  }

  const content =
    cleanText(
      memory.content,
      MAX_MEMORY_LENGTH
    );

  if (!content) {
    return null;
  }

  return {
    ...memory,
    content,
    createdAt:
      memory.createdAt ||
      new Date().toISOString(),
  };
}

/* =========================================================
   MAIN AGENT
   ========================================================= */

export async function runAgent(
  request: AgentRequest
): Promise<AgentResponse> {
  const startedAt =
    Date.now();

  const message =
    cleanText(
      request.message,
      MAX_MESSAGE_LENGTH
    );

  if (!message) {
    throw new Error(
      'Message is required.'
    );
  }

  const normalizedRequest: AgentRequest = {
    ...request,
    message,
  };

  const history =
    normalizeHistory(
      request.recentHistory
    );

  const memories =
    normalizeMemories(
      request.recentMemories
    );

  /* =======================================================
     FAST PATH: LOCAL TOOL
     ======================================================= */

  const directTool =
    await tryDirectTool(
      message
    );

  if (directTool) {
    console.log(
      `[Nodysom Agent] Direct tool: ${directTool.tool}`
    );

    const answer =
      await askAI(
        normalizedRequest,
        memories,
        history,
        directTool.result
      );

    console.log(
      `[Nodysom Agent] Completed in ${
        Date.now() - startedAt
      }ms`
    );

    return {
      reply: answer.reply,

      detectedAction:
        answer.detectedAction ??
        null,

      newMemory:
        normalizeNewMemory(
          answer.newMemory
        ),

      toolUsed:
        directTool.tool,
    };
  }

  /* =======================================================
     NORMAL AI PATH
     ======================================================= */

  let currentToolResult:
    | string
    | undefined;

  let usedTool:
    | string
    | null = null;

  let latestAnswer:
    | AgentAIAnswer
    | null = null;

  /*
   * Maximum 3 steps.
   *
   * Most questions finish after the first call.
   *
   * Step 2/3 are only used when the model explicitly
   * requests a tool.
   */

  for (
    let step = 0;
    step < MAX_AGENT_STEPS;
    step++
  ) {
    latestAnswer =
      await askAI(
        normalizedRequest,
        memories,
        history,
        currentToolResult
      );

    /*
     * Normal answer:
     * return immediately.
     *
     * This is the main latency optimization.
     */

    if (
      !latestAnswer.toolRequest
    ) {
      break;
    }

    /*
     * The model requested a tool.
     */

    const toolRequest =
      latestAnswer.toolRequest;

    if (
      !toolRequest.tool
    ) {
      break;
    }

    console.log(
      `[Nodysom Agent] Tool requested: ${toolRequest.tool}`
    );

    const tool =
      await executeTool(
        toolRequest
      );

    if (!tool) {
      break;
    }

    usedTool =
      toolRequest.tool;

    currentToolResult =
      safeStringify(
        tool.result ??
          tool,
        MAX_TOOL_RESULT_LENGTH
      );

    /*
     * Only one additional AI call should normally be
     * necessary after a tool execution.
     *
     * The loop still permits one more step if needed.
     */
  }

  if (!latestAnswer) {
    throw new Error(
      'Nodysom could not generate a response.'
    );
  }

  console.log(
    `[Nodysom Agent] Completed in ${
      Date.now() - startedAt
    }ms`
  );

  return {
    reply: cleanText(
      latestAnswer.reply,
      MAX_REPLY_LENGTH
    ),

    detectedAction:
      latestAnswer.detectedAction ??
      null,

    newMemory:
      normalizeNewMemory(
        latestAnswer.newMemory
      ),

    toolUsed:
      usedTool,
  };
}

/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

export default runAgent;
