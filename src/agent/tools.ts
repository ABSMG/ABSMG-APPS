export type AgentToolName =
  | 'calculator'
  | 'time'
  | 'text_stats';

export interface AgentToolResult {
  ok: boolean;
  tool: AgentToolName;
  result: string;
}

function safeMathExpression(input: string): string {
  const expression = input
    .replace(/^(calculate|calc|what is)\s*/i, '')
    .trim();

  if (!expression || expression.length > 120) {
    throw new Error('Invalid calculation.');
  }

  // Only basic arithmetic
  if (!/^[0-9+\-*/().%\s]+$/.test(expression)) {
    throw new Error(
      'Only basic arithmetic is supported.'
    );
  }

  return expression;
}

export function runTool(
  name: AgentToolName,
  input: string
): AgentToolResult {
  try {
    if (name === 'calculator') {
      const expression = safeMathExpression(input);

      const value = Function(
        '"use strict"; return (' + expression + ')'
      )();

      if (
        typeof value !== 'number' ||
        !Number.isFinite(value)
      ) {
        throw new Error(
          'Calculation did not produce a valid number.'
        );
      }

      return {
        ok: true,
        tool: name,
        result: String(value),
      };
    }

    if (name === 'time') {
      return {
        ok: true,
        tool: name,
        result: new Date().toString(),
      };
    }

    if (name === 'text_stats') {
      const text = input.trim();

      return {
        ok: true,
        tool: name,
        result:
          `Characters: ${text.length}\n` +
          `Words: ${
            text ? text.split(/\s+/).length : 0
          }`,
      };
    }

    throw new Error('Unknown tool.');
  } catch (error: any) {
    return {
      ok: false,
      tool: name,
      result:
        error?.message ||
        'Tool execution failed.',
    };
  }
}

export function detectTool(message: string) {
  const text = message.trim();

  // Calculator
  if (
    /^(calculate|calc|what is)\b.*[0-9][0-9+\-*/().%\s]*$/i.test(
      text
    )
  ) {
    return {
      intent: 'tool' as const,
      tool: 'calculator' as const,
      input: text,
    };
  }

  // Current time
  if (
    /\b(what time is it|current time|time now|what's the time)\b/i.test(
      text
    )
  ) {
    return {
      intent: 'tool' as const,
      tool: 'time' as const,
      input: '',
    };
  }

  // Text statistics
  if (
    /\b(count words|word count|character count|count characters)\b/i.test(
      text
    )
  ) {
    const input = text.replace(
      /^(count words|word count|character count|count characters)[:\s]*/i,
      ''
    );

    return {
      intent: 'tool' as const,
      tool: 'text_stats' as const,
      input,
    };
  }

  return {
    intent: 'answer' as const,
  };
}
