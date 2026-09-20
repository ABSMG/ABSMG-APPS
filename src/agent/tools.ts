export type AgentToolName =
  | "calculator"
  | "time"
  | "text_stats";

export interface AgentToolResult {
  ok: boolean;
  tool: AgentToolName;
  result: string;
}

/**
 * =========================================================
 * DETECTED TOOL TYPES
 * =========================================================
 *
 * Used by agentController.ts to determine whether the
 * user's message should be handled by a deterministic tool.
 */

export interface DetectedTool {
  intent: "tool";
  tool: AgentToolName;
  input: string;
}

export interface DetectedAnswer {
  intent: "answer";
}

export type ToolDetection =
  | DetectedTool
  | DetectedAnswer;

/**
 * =========================================================
 * CALCULATOR TOKEN TYPES
 * =========================================================
 */

type Operator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%";

type Token =
  | {
      type: "number";
      value: number;
    }
  | {
      type: "operator";
      value: Operator;
    }
  | {
      type: "lparen";
    }
  | {
      type: "rparen";
    };

/**
 * =========================================================
 * TOKENIZER
 * =========================================================
 *
 * Supports:
 *
 * 10
 * 10 + 5
 * 10 - 5
 * 10 * 5
 * 10 / 5
 * 10 % 3
 * (10 + 5) * 2
 * -10 + 5
 */
function tokenize(
  expression: string
): Token[] {
  const tokens: Token[] = [];

  let i = 0;

  while (i < expression.length) {
    const char = expression[i];

    /**
     * Ignore whitespace.
     */
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    /**
     * -----------------------------------------------------
     * NUMBER
     * -----------------------------------------------------
     */
    if (/[0-9.]/.test(char)) {
      const start = i;

      let decimalPoints = 0;

      while (
        i < expression.length &&
        /[0-9.]/.test(expression[i])
      ) {
        if (expression[i] === ".") {
          decimalPoints += 1;

          if (decimalPoints > 1) {
            throw new Error(
              "Invalid number."
            );
          }
        }

        i += 1;
      }

      const rawNumber =
        expression.slice(start, i);

      if (
        rawNumber === "." ||
        rawNumber === ""
      ) {
        throw new Error(
          "Invalid number."
        );
      }

      const value =
        Number(rawNumber);

      if (
        !Number.isFinite(value)
      ) {
        throw new Error(
          "Invalid number."
        );
      }

      tokens.push({
        type: "number",
        value,
      });

      continue;
    }

    /**
     * -----------------------------------------------------
     * OPERATORS
     * -----------------------------------------------------
     */
    if (
      char === "+" ||
      char === "-" ||
      char === "*" ||
      char === "/" ||
      char === "%"
    ) {
      tokens.push({
        type: "operator",
        value: char,
      });

      i += 1;

      continue;
    }

    /**
     * -----------------------------------------------------
     * LEFT PARENTHESIS
     * -----------------------------------------------------
     */
    if (char === "(") {
      tokens.push({
        type: "lparen",
      });

      i += 1;

      continue;
    }

    /**
     * -----------------------------------------------------
     * RIGHT PARENTHESIS
     * -----------------------------------------------------
     */
    if (char === ")") {
      tokens.push({
        type: "rparen",
      });

      i += 1;

      continue;
    }

    /**
     * -----------------------------------------------------
     * UNSUPPORTED CHARACTER
     * -----------------------------------------------------
     */
    throw new Error(
      "Only basic arithmetic is supported."
    );
  }

  if (tokens.length === 0) {
    throw new Error(
      "Invalid calculation."
    );
  }

  return tokens;
}

/**
 * =========================================================
 * SAFE ARITHMETIC PARSER
 * =========================================================
 *
 * Operator precedence:
 *
 * 1. Parentheses
 * 2. Multiplication / Division / Modulo
 * 3. Addition / Subtraction
 *
 * IMPORTANT:
 * No eval()
 * No Function()
 * No arbitrary JavaScript execution.
 */
function evaluateExpression(
  expression: string
): number {
  const tokens =
    tokenize(expression);

  let position = 0;

  const peek =
    (): Token | undefined =>
      tokens[position];

  /**
   * -------------------------------------------------------
   * PRIMARY
   * -------------------------------------------------------
   */
  function parsePrimary(): number {
    const token = peek();

    if (!token) {
      throw new Error(
        "Unexpected end of expression."
      );
    }

    /**
     * Unary + / -
     */
    if (
      token.type === "operator" &&
      (
        token.value === "+" ||
        token.value === "-"
      )
    ) {
      position += 1;

      const value =
        parsePrimary();

      return token.value === "-"
        ? -value
        : value;
    }

    /**
     * Number
     */
    if (
      token.type === "number"
    ) {
      position += 1;

      return token.value;
    }

    /**
     * Parentheses
     */
    if (
      token.type === "lparen"
    ) {
      position += 1;

      const value =
        parseAdditive();

      if (
        peek()?.type !==
        "rparen"
      ) {
        throw new Error(
          "Missing closing parenthesis."
        );
      }

      position += 1;

      return value;
    }

    throw new Error(
      "Invalid expression."
    );
  }

  /**
   * -------------------------------------------------------
   * MULTIPLICATIVE
   * -------------------------------------------------------
   */
  function parseMultiplicative(): number {
    let value =
      parsePrimary();

    while (true) {
      const token = peek();

      if (
        !token ||
        token.type !==
          "operator" ||
        ![
          "*",
          "/",
          "%",
        ].includes(
          token.value
        )
      ) {
        break;
      }

      position += 1;

      const right =
        parsePrimary();

      /**
       * Prevent division/modulo by zero.
       */
      if (
        (
          token.value === "/" ||
          token.value === "%"
        ) &&
        right === 0
      ) {
        throw new Error(
          "Cannot divide by zero."
        );
      }

      if (
        token.value === "*"
      ) {
        value *= right;
      }

      if (
        token.value === "/"
      ) {
        value /= right;
      }

      if (
        token.value === "%"
      ) {
        value %= right;
      }

      if (
        !Number.isFinite(
          value
        )
      ) {
        throw new Error(
          "Calculation produced an invalid number."
        );
      }
    }

    return value;
  }

  /**
   * -------------------------------------------------------
   * ADDITIVE
   * -------------------------------------------------------
   */
  function parseAdditive(): number {
    let value =
      parseMultiplicative();

    while (true) {
      const token = peek();

      if (
        !token ||
        token.type !==
          "operator" ||
        ![
          "+",
          "-",
        ].includes(
          token.value
        )
      ) {
        break;
      }

      position += 1;

      const right =
        parseMultiplicative();

      if (
        token.value === "+"
      ) {
        value += right;
      }

      if (
        token.value === "-"
      ) {
        value -= right;
      }

      if (
        !Number.isFinite(
          value
        )
      ) {
        throw new Error(
          "Calculation produced an invalid number."
        );
      }
    }

    return value;
  }

  const result =
    parseAdditive();

  /**
   * Make sure every token
   * was consumed.
   */
  if (
    position !==
    tokens.length
  ) {
    throw new Error(
      "Invalid expression."
    );
  }

  return result;
}

/**
 * =========================================================
 * CALCULATOR INPUT CLEANING
 * =========================================================
 */
function safeMathExpression(
  input: string
): string {
  const expression =
    input
      .replace(
        /^(calculate|calc|what is)\s*/i,
        ""
      )
      .trim();

  if (
    !expression ||
    expression.length > 120
  ) {
    throw new Error(
      "Invalid calculation."
    );
  }

  return expression;
}

/**
 * =========================================================
 * TOOL DETECTION HELPERS
 * =========================================================
 */

/**
 * Normalize user text for deterministic matching.
 */
function normalizeInput(
  input: string
): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * =========================================================
 * CALCULATOR DETECTION
 * =========================================================
 */
function detectCalculator(
  input: string
): DetectedTool | null {
  const normalized =
    normalizeInput(input);

  /**
   * Explicit calculator commands.
   *
   * Examples:
   *
   * calculate 25 * 40
   * calc 10 + 5
   * what is 20 / 4
   */
  const explicitMatch =
    normalized.match(
      /^(?:calculate|calc|what is)\s+(.+)$/i
    );

  if (explicitMatch) {
    const expression =
      explicitMatch[1].trim();

    /**
     * Only classify as calculator if
     * the expression contains arithmetic
     * characters/numbers.
     */
    if (
      /[0-9]/.test(expression) &&
      /[+\-*/%()]/.test(
        expression
      )
    ) {
      return {
        intent: "tool",
        tool: "calculator",
        input: expression,
      };
    }
  }

  /**
   * Direct arithmetic expression.
   *
   * Examples:
   *
   * 25 * 40
   * 100 / 5
   * (10 + 5) * 2
   */
  if (
    /^[\d\s()+\-*/%.]+$/.test(
      normalized
    ) &&
    /[+\-*/%]/.test(
      normalized
    ) &&
    /\d/.test(
      normalized
    )
  ) {
    return {
      intent: "tool",
      tool: "calculator",
      input: normalized,
    };
  }

  return null;
}

/**
 * =========================================================
 * TIME DETECTION
 * =========================================================
 */
function detectTime(
  input: string
): DetectedTool | null {
  const normalized =
    normalizeInput(input);

  const timePatterns = [
    "what time is it",
    "what is the time",
    "current time",
    "current date and time",
    "tell me the time",
    "show me the time",
    "time now",
    "what's the time",
    "whats the time",
  ];

  const matches =
    timePatterns.some(
      (pattern) =>
        normalized === pattern ||
        normalized.includes(
          pattern
        )
    );

  if (!matches) {
    return null;
  }

  return {
    intent: "tool",
    tool: "time",
    input: "",
  };
}

/**
 * =========================================================
 * TEXT STATS DETECTION
 * =========================================================
 */
function detectTextStats(
  input: string
): DetectedTool | null {
  const normalized =
    normalizeInput(input);

  /**
   * "count words: hello world"
   */
  const wordMatch =
    input.match(
      /^(?:count|calculate)\s+(?:the\s+)?words(?:\s+in)?\s*[:\-]?\s*(.+)$/i
    );

  if (wordMatch) {
    return {
      intent: "tool",
      tool: "text_stats",
      input:
        wordMatch[1].trim(),
    };
  }

  /**
   * "word count: hello world"
   */
  const wordCountMatch =
    input.match(
      /^(?:word\s+count|count\s+words)\s*[:\-]?\s*(.+)$/i
    );

  if (wordCountMatch) {
    return {
      intent: "tool",
      tool: "text_stats",
      input:
        wordCountMatch[1].trim(),
    };
  }

  /**
   * "count characters: hello"
   */
  const characterMatch =
    input.match(
      /^(?:count|calculate)\s+(?:the\s+)?characters(?:\s+in)?\s*[:\-]?\s*(.+)$/i
    );

  if (characterMatch) {
    return {
      intent: "tool",
      tool: "text_stats",
      input:
        characterMatch[1].trim(),
    };
  }

  /**
   * General text-statistics request.
   */
  const statsKeywords = [
    "word count",
    "count words",
    "number of words",
    "character count",
    "count characters",
    "text statistics",
    "text stats",
  ];

  const isStatsRequest =
    statsKeywords.some(
      (keyword) =>
        normalized.includes(
          keyword
        )
    );

  if (
    isStatsRequest &&
    input.length > 0
  ) {
    return {
      intent: "tool",
      tool: "text_stats",
      input: input,
    };
  }

  return null;
}

/**
 * =========================================================
 * DETECT TOOL
 * =========================================================
 *
 * This function is consumed by agentController.ts.
 *
 * Priority:
 *
 * 1. Calculator
 * 2. Time
 * 3. Text statistics
 * 4. Normal AI answer
 */
export function detectTool(
  input: string
): ToolDetection {
  const text =
    typeof input === "string"
      ? input.trim()
      : "";

  if (!text) {
    return {
      intent: "answer",
    };
  }

  /**
   * Calculator
   */
  const calculator =
    detectCalculator(
      text
    );

  if (calculator) {
    return calculator;
  }

  /**
   * Time
   */
  const time =
    detectTime(text);

  if (time) {
    return time;
  }

  /**
   * Text statistics
   */
  const textStats =
    detectTextStats(
      text
    );

  if (textStats) {
    return textStats;
  }

  /**
   * Normal AI request.
   */
  return {
    intent: "answer",
  };
}

/**
 * =========================================================
 * RUN TOOL
 * =========================================================
 *
 * This is the only place where agentController.ts
 * executes a tool.
 */
export function runTool(
  name: AgentToolName,
  input: string
): AgentToolResult {
  try {
    /**
     * =====================================================
     * CALCULATOR
     * =====================================================
     */
    if (
      name === "calculator"
    ) {
      const expression =
        safeMathExpression(
          input
        );

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

    /**
     * =====================================================
     * CURRENT TIME
     * =====================================================
     */
    if (
      name === "time"
    ) {
      return {
        ok: true,
        tool: name,
        result:
          new Date().toISOString(),
      };
    }

    /**
     * =====================================================
     * TEXT STATISTICS
     * =====================================================
     */
    if (
      name === "text_stats"
    ) {
      const text =
        input.trim();

      const words =
        text
          ? text.split(/\s+/)
              .length
          : 0;

      return {
        ok: true,
        tool: name,
        result:
          `Characters: ${text.length}\n` +
          `Words: ${words}`,
      };
    }

    /**
     * =====================================================
     * UNKNOWN TOOL
     * =====================================================
     */
    throw new Error(
      "Unknown tool."
    );
  } catch (error) {
    return {
      ok: false,
      tool: name,
      result:
        error instanceof Error
          ? error.message
          : "Tool execution failed.",
    };
  }
}
