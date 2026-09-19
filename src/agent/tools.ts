export type AgentToolName =
  | 'calculator'
  | 'time'
  | 'text_stats';

export interface AgentToolResult {
  ok: boolean;
  tool: AgentToolName;
  result: string;
}

type Token =
  | { type: 'number'; value: number }
  | {
      type: 'operator';
      value: '+' | '-' | '*' | '/' | '%';
    }
  | { type: 'lparen' }
  | { type: 'rparen' };

/**
 * Convert a basic arithmetic expression into tokens.
 *
 * Supported:
 *   10
 *   10 + 5
 *   10 - 5
 *   10 * 5
 *   10 / 5
 *   10 % 3
 *   (10 + 5) * 2
 *   -10 + 5
 */
function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const char = expression[i];

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    // Number
    if (/[0-9.]/.test(char)) {
      const start = i;
      let decimalPoints = 0;

      while (
        i < expression.length &&
        /[0-9.]/.test(expression[i])
      ) {
        if (expression[i] === '.') {
          decimalPoints += 1;

          if (decimalPoints > 1) {
            throw new Error('Invalid number.');
          }
        }

        i += 1;
      }

      const rawNumber = expression.slice(start, i);

      if (rawNumber === '.') {
        throw new Error('Invalid number.');
      }

      const value = Number(rawNumber);

      if (!Number.isFinite(value)) {
        throw new Error('Invalid number.');
      }

      tokens.push({
        type: 'number',
        value,
      });

      continue;
    }

    // Operators
    if (
      char === '+' ||
      char === '-' ||
      char === '*' ||
      char === '/' ||
      char === '%'
    ) {
      tokens.push({
        type: 'operator',
        value: char,
      });

      i += 1;
      continue;
    }

    // Parentheses
    if (char === '(') {
      tokens.push({
        type: 'lparen',
      });

      i += 1;
      continue;
    }

    if (char === ')') {
      tokens.push({
        type: 'rparen',
      });

      i += 1;
      continue;
    }

    throw new Error(
      'Only basic arithmetic is supported.'
    );
  }

  if (tokens.length === 0) {
    throw new Error(
      'Invalid calculation.'
    );
  }

  return tokens;
}

/**
 * Safely evaluate a basic arithmetic expression.
 *
 * Operator precedence:
 *   1. Parentheses
 *   2. Multiplication / Division / Modulo
 *   3. Addition / Subtraction
 */
function evaluateExpression(
  expression: string
): number {
  const tokens = tokenize(expression);

  let position = 0;

  const peek = (): Token | undefined =>
    tokens[position];

  function parsePrimary(): number {
    const token = peek();

    if (!token) {
      throw new Error(
        'Unexpected end of expression.'
      );
    }

    // Unary + / -
    if (
      token.type === 'operator' &&
      (token.value === '+' ||
        token.value === '-')
    ) {
      position += 1;

      const value = parsePrimary();

      return token.value === '-'
        ? -value
        : value;
    }

    // Number
    if (token.type === 'number') {
      position += 1;

      return token.value;
    }

    // Parentheses
    if (token.type === 'lparen') {
      position += 1;

      const value =
        parseAdditive();

      if (
        peek()?.type !== 'rparen'
      ) {
        throw new Error(
          'Missing closing parenthesis.'
        );
      }

      position += 1;

      return value;
    }

    throw new Error(
      'Invalid expression.'
    );
  }

  function parseMultiplicative(): number {
    let value =
      parsePrimary();

    while (true) {
      const token = peek();

      if (
        !token ||
        token.type !== 'operator' ||
        !['*', '/', '%'].includes(
          token.value
        )
      ) {
        break;
      }

      position += 1;

      const right =
        parsePrimary();

      // Prevent division/modulo by zero.
      if (
        (token.value === '/' ||
          token.value === '%') &&
        right === 0
      ) {
        throw new Error(
          'Cannot divide by zero.'
        );
      }

      if (token.value === '*') {
        value *= right;
      }

      if (token.value === '/') {
        value /= right;
      }

      if (token.value === '%') {
        value %= right;
      }

      if (!Number.isFinite(value)) {
        throw new Error(
          'Calculation produced an invalid number.'
        );
      }
    }

    return value;
  }

  function parseAdditive(): number {
    let value =
      parseMultiplicative();

    while (true) {
      const token = peek();

      if (
        !token ||
        token.type !== 'operator' ||
        !['+', '-'].includes(
          token.value
        )
      ) {
        break;
      }

      position += 1;

      const right =
        parseMultiplicative();

      if (token.value === '+') {
        value += right;
      }

      if (token.value === '-') {
        value -= right;
      }

      if (!Number.isFinite(value)) {
        throw new Error(
          'Calculation produced an invalid number.'
        );
      }
    }

    return value;
  }

  const result =
    parseAdditive();

  // Make sure every token was consumed.
  if (
    position !== tokens.length
  ) {
    throw new Error(
      'Invalid expression.'
    );
  }

  return result;
}

/**
 * Clean calculator input.
 */
function safeMathExpression(
  input: string
): string {
  const expression = input
    .replace(
      /^(calculate|calc|what is)\s*/i,
      ''
    )
    .trim();

  if (
    !expression ||
    expression.length > 120
  ) {
    throw new Error(
      'Invalid calculation.'
    );
  }

  return expression;
}

/**
 * Execute an agent tool.
 */
export function runTool(
  name: AgentToolName,
  input: string
): AgentToolResult {
  try {
    // -----------------------------------------
    // CALCULATOR
    // -----------------------------------------
    if (name === 'calculator') {
      const expression =
        safeMathExpression(input);

      const value =
        evaluateExpression(
          expression
        );

      return {
        ok: true,
        tool: name,
        result: String(value),
      };
    }

    // -----------------------------------------
    // CURRENT TIME
    // -----------------------------------------
    if (name === 'time') {
      return {
        ok: true,
        tool: name,
        result:
          new Date().toString(),
      };
    }

    // -----------------------------------------
    // TEXT STATISTICS
    // -----------------------------------------
    if (name === 'text_stats') {
      const text =
        input.trim();

      return {
        ok: true,
        tool: name,
        result:
          `Characters: ${text.length}\n` +
          `Words: ${
            text
              ? text.split(/\s+/).length
              : 0
          }`,
      };
    }

    throw new Error(
      'Unknown tool.'
    );
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

/**
 * Detect whether the user's request
 * should use one of the local tools.
 */
export function detectTool(
  message: string
) {
  const text =
    message.trim();

  // -----------------------------------------
  // CALCULATOR
  // -----------------------------------------
  if (
    /^(calculate|calc|what is)\b.*[0-9][0-9+\-*/().%\s]*$/i.test(
      text
    )
  ) {
    return {
      intent: 'tool' as const,
      tool:
        'calculator' as const,
      input: text,
    };
  }

  // -----------------------------------------
  // CURRENT TIME
  // -----------------------------------------
  if (
    /\b(what time is it|current time|time now|what's the time)\b/i.test(
      text
    )
  ) {
    return {
      intent: 'tool' as const,
      tool:
        'time' as const,
      input: '',
    };
  }

  // -----------------------------------------
  // TEXT STATISTICS
  // -----------------------------------------
  if (
    /\b(count words|word count|character count|count characters)\b/i.test(
      text
    )
  ) {
    const input =
      text.replace(
        /^(count words|word count|character count|count characters)[:\s]*/i,
        ''
      );

    return {
      intent: 'tool' as const,
      tool:
        'text_stats' as const,
      input,
    };
  }

  // -----------------------------------------
  // NORMAL AI ANSWER
  // -----------------------------------------
  return {
    intent: 'answer' as const,
  };
}
