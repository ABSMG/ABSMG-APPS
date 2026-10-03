/**
 * =========================================================
 * NODYSOM AI — LOCAL AGENT TOOLS
 * =========================================================
 *
 * Deterministic tools used by agentController.ts.
 *
 * Available tools:
 *
 * 1. calculator
 * 2. time
 * 3. text_stats
 *
 * IMPORTANT SECURITY RULE:
 *
 * The calculator NEVER uses:
 *
 * eval()
 * Function()
 * new Function()
 *
 * Arithmetic is parsed and evaluated using a dedicated
 * tokenizer + recursive-descent parser.
 */

/**
 * =========================================================
 * AGENT TOOL NAMES
 * =========================================================
 */

export type AgentToolName =
  | "calculator"
  | "time"
  | "text_stats";

/**
 * =========================================================
 * AGENT TOOL RESULT
 * =========================================================
 */

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
 * -(10 + 5)
 * +10
 *
 * Decimal numbers are supported:
 *
 * 10.5
 * 0.25
 * -3.14
 */

function tokenize(
  expression: string
): Token[] {
  const tokens: Token[] = [];

  let i = 0;

  while (
    i < expression.length
  ) {
    const char =
      expression[i];

    /**
     * =====================================================
     * IGNORE WHITESPACE
     * =====================================================
     */

    if (
      /\s/.test(char)
    ) {
      i += 1;

      continue;
    }

    /**
     * =====================================================
     * NUMBER
     * =====================================================
     *
     * A number may contain exactly one decimal point.
     */

    if (
      /[0-9.]/.test(char)
    ) {
      const start =
        i;

      let decimalPoints =
        0;

      while (
        i < expression.length &&
        /[0-9.]/.test(
          expression[i]
        )
      ) {
        if (
          expression[i] === "."
        ) {
          decimalPoints +=
            1;

          if (
            decimalPoints > 1
          ) {
            throw new Error(
              "Invalid number."
            );
          }
        }

        i += 1;
      }

      const rawNumber =
        expression.slice(
          start,
          i
        );

      if (
        rawNumber === "." ||
        rawNumber === ""
      ) {
        throw new Error(
          "Invalid number."
        );
      }

      const value =
        Number(
          rawNumber
        );

      if (
        !Number.isFinite(
          value
        )
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
     * =====================================================
     * OPERATORS
     * =====================================================
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
     * =====================================================
     * LEFT PARENTHESIS
     * =====================================================
     */

    if (
      char === "("
    ) {
      tokens.push({
        type: "lparen",
      });

      i += 1;

      continue;
    }

    /**
     * =====================================================
     * RIGHT PARENTHESIS
     * =====================================================
     */

    if (
      char === ")"
    ) {
      tokens.push({
        type: "rparen",
      });

      i += 1;

      continue;
    }

    /**
     * =====================================================
     * UNSUPPORTED CHARACTER
     * =====================================================
     */

    throw new Error(
      "Only basic arithmetic is supported."
    );
  }

  /**
   * =====================================================
   * EMPTY EXPRESSION
   * =====================================================
   */

  if (
    tokens.length === 0
  ) {
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
 * 2. Unary + / -
 * 3. Multiplication / Division / Modulo
 * 4. Addition / Subtraction
 *
 * IMPORTANT:
 *
 * No eval()
 * No Function()
 * No arbitrary JavaScript execution.
 */

function evaluateExpression(
  expression: string
): number {
  const tokens =
    tokenize(
      expression
    );

  let position =
    0;

  /**
   * =======================================================
   * TOKEN LOOK-AHEAD
   * =======================================================
   */

  const peek =
    (): Token | undefined =>
      tokens[position];

  /**
   * =======================================================
   * PRIMARY
   * =======================================================
   *
   * Handles:
   *
   * numbers
   * parentheses
   * unary +/-
   */

  function parsePrimary(): number {
    const token =
      peek();

    if (!token) {
      throw new Error(
        "Unexpected end of expression."
      );
    }

    /**
     * -----------------------------------------------------
     * UNARY + / -
     * -----------------------------------------------------
     *
     * Examples:
     *
     * -10
     * +10
     * -(10 + 5)
     */

    if (
      token.type ===
        "operator" &&
      (
        token.value === "+" ||
        token.value === "-"
      )
    ) {
      position += 1;

      const value =
        parsePrimary();

      if (
        token.value === "-"
      ) {
        return -value;
      }

      return value;
    }

    /**
     * -----------------------------------------------------
     * NUMBER
     * -----------------------------------------------------
     */

    if (
      token.type ===
      "number"
    ) {
      position += 1;

      return token.value;
    }

    /**
     * -----------------------------------------------------
     * PARENTHESES
     * -----------------------------------------------------
     */

    if (
      token.type ===
      "lparen"
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

    /**
     * -----------------------------------------------------
     * INVALID TOKEN
     * -----------------------------------------------------
     */

    throw new Error(
      "Invalid expression."
    );
  }

  /**
   * =======================================================
   * MULTIPLICATIVE
   * =======================================================
   *
   * Handles:
   *
   * *
   * /
   * %
   */

  function parseMultiplicative(): number {
    let value =
      parsePrimary();

    while (true) {
      const token =
        peek();

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
       * ---------------------------------------------------
       * DIVISION / MODULO BY ZERO
       * ---------------------------------------------------
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

      /**
       * ---------------------------------------------------
       * MULTIPLICATION
       * ---------------------------------------------------
       */

      if (
        token.value === "*"
      ) {
        value *=
          right;
      }

      /**
       * ---------------------------------------------------
       * DIVISION
       * ---------------------------------------------------
       */

      if (
        token.value === "/"
      ) {
        value /=
          right;
      }

      /**
       * ---------------------------------------------------
       * MODULO
       * ---------------------------------------------------
       */

      if (
        token.value === "%"
      ) {
        value %=
          right;
      }

      /**
       * ---------------------------------------------------
       * INVALID RESULT
       * ---------------------------------------------------
       */

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
   * =======================================================
   * ADDITIVE
   * =======================================================
   *
   * Handles:
   *
   * +
   * -
   */

  function parseAdditive(): number {
    let value =
      parseMultiplicative();

    while (true) {
      const token =
        peek();

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

      /**
       * ---------------------------------------------------
       * ADDITION
       * ---------------------------------------------------
       */

      if (
        token.value === "+"
      ) {
        value +=
          right;
      }

      /**
       * ---------------------------------------------------
       * SUBTRACTION
       * ---------------------------------------------------
       */

      if (
        token.value === "-"
      ) {
        value -=
          right;
      }

      /**
       * ---------------------------------------------------
       * INVALID RESULT
       * ---------------------------------------------------
       */

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
   * =======================================================
   * FINAL RESULT
   * =======================================================
   */

  const result =
    parseAdditive();

  /**
   * =======================================================
   * MAKE SURE EVERY TOKEN WAS CONSUMED
   * =======================================================
   */

  if (
    position !==
    tokens.length
  ) {
    throw new Error(
      "Invalid expression."
    );
  }

  /**
   * =======================================================
   * FINAL NUMBER VALIDATION
   * =======================================================
   */

  if (
    !Number.isFinite(
      result
    )
  ) {
    throw new Error(
      "Calculation produced an invalid number."
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
  /**
   * Remove common calculator prefixes.
   */

  let expression =
    input
      .replace(
        /^(calculate|calc|what\s+is)\s*/i,
        ""
      )
      .trim();

  /**
   * Remove a trailing question mark.
   *
   * Example:
   *
   * "25 * 4?"
   */

  expression =
    expression
      .replace(
        /\?+$/,
        ""
      )
      .trim();

  /**
   * Protect the calculator from excessively large
   * expressions.
   */

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
    .replace(
      /\s+/g,
      " "
    )
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
    normalizeInput(
      input
    );

  /**
   * =======================================================
   * EXPLICIT CALCULATOR COMMANDS
   * =======================================================
   *
   * Examples:
   *
   * calculate 25 * 40
   * calc 10 + 5
   * what is 20 / 4
   */

  const explicitMatch =
    normalized.match(
      /^(?:calculate|calc|what\s+is)\s+(.+?)[?]?$/i
    );

  if (
    explicitMatch
  ) {
    const expression =
      explicitMatch[1]
        .trim();

    /**
     * Only classify as calculator if the expression
     * contains numbers and arithmetic characters.
     */

    if (
      /[0-9]/.test(
        expression
      ) &&
      /[+\-*/%()]/.test(
        expression
      )
    ) {
      return {
        intent: "tool",

        tool:
          "calculator",

        input:
          expression,
      };
    }
  }

  /**
   * =======================================================
   * DIRECT ARITHMETIC EXPRESSION
   * =======================================================
   *
   * Examples:
   *
   * 25 * 40
   * 100 / 5
   * (10 + 5) * 2
   * -10 + 5
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

      tool:
        "calculator",

      input:
        normalized,
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
    normalizeInput(
      input
    );

  /**
   * Common time/date questions.
   */

  const timePatterns = [
    "what time is it",

    "what is the time",

    "what's the time",

    "whats the time",

    "current time",

    "current date and time",

    "current date",

    "tell me the time",

    "tell me current time",

    "show me the time",

    "show current time",

    "time now",

    "what time now",

    "what is the date",

    "what's the date",

    "whats the date",

    "today's date",

    "todays date",

    "date today",

    "time today",
  ];

  const matches =
    timePatterns.some(
      (
        pattern
      ) =>
        normalized ===
          pattern ||
        normalized.includes(
          pattern
        )
    );

  if (
    !matches
  ) {
    return null;
  }

  return {
    intent: "tool",

    tool:
      "time",

    input:
      "",
  };
}

/**
 * =========================================================
 * EXTRACT TEXT AFTER COMMAND
 * =========================================================
 *
 * Used by text_stats detection.
 */

function extractTextAfterCommand(
  input: string,
  pattern: RegExp
): string {
  const match =
    input.match(
      pattern
    );

  if (
    !match
  ) {
    return "";
  }

  return (
    match[1] ||
    ""
  ).trim();
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
    normalizeInput(
      input
    );

  /**
   * =======================================================
   * COUNT WORDS
   * =======================================================
   *
   * Examples:
   *
   * count words: hello world
   *
   * count words in: hello world
   *
   * count the words in hello world
   *
   * word count: hello world
   */

  const wordPatterns = [
    /^(?:count)\s+(?:the\s+)?words(?:\s+in)?\s*[:\-]?\s*(.+)$/i,

    /^(?:word\s+count)\s*[:\-]?\s*(.+)$/i,

    /^(?:count\s+words)\s*[:\-]?\s*(.+)$/i,

    /^(?:number\s+of\s+words)\s*[:\-]?\s*(.+)$/i,
  ];

  for (
    const pattern of
      wordPatterns
  ) {
    const text =
      extractTextAfterCommand(
        input,
        pattern
      );

    if (
      text
    ) {
      return {
        intent:
          "tool",

        tool:
          "text_stats",

        input:
          text,
      };
    }
  }

  /**
   * =======================================================
   * COUNT CHARACTERS
   * =======================================================
   *
   * Examples:
   *
   * count characters: hello
   *
   * character count: hello
   *
   * count the characters in hello
   */

  const characterPatterns = [
    /^(?:count)\s+(?:the\s+)?characters(?:\s+in)?\s*[:\-]?\s*(.+)$/i,

    /^(?:character\s+count)\s*[:\-]?\s*(.+)$/i,

    /^(?:count\s+characters)\s*[:\-]?\s*(.+)$/i,
  ];

  for (
    const pattern of
      characterPatterns
  ) {
    const text =
      extractTextAfterCommand(
        input,
        pattern
      );

    if (
      text
    ) {
      return {
        intent:
          "tool",

        tool:
          "text_stats",

        input:
          text,
      };
    }
  }

  /**
   * =======================================================
   * TEXT STATISTICS COMMAND
   * =======================================================
   *
   * Examples:
   *
   * text stats: hello world
   *
   * text statistics: hello world
   *
   * analyze text: hello world
   */

  const statsPatterns = [
    /^(?:text\s+stats)\s*[:\-]?\s*(.+)$/i,

    /^(?:text\s+statistics)\s*[:\-]?\s*(.+)$/i,

    /^(?:analyze\s+text)\s*[:\-]?\s*(.+)$/i,

    /^(?:analyse\s+text)\s*[:\-]?\s*(.+)$/i,
  ];

  for (
    const pattern of
      statsPatterns
  ) {
    const text =
      extractTextAfterCommand(
        input,
        pattern
      );

    if (
      text
    ) {
      return {
        intent:
          "tool",

        tool:
          "text_stats",

        input:
          text,
      };
    }
  }

  /**
   * =======================================================
   * AVOID FALSE POSITIVES
   * =======================================================
   *
   * Do NOT automatically turn a normal conversational
   * message containing words such as "word count" into a
   * tool request.
   *
   * Example:
   *
   * "Can you explain what word count means?"
   *
   * This should go to the AI.
   */

  if (
    normalized ===
      "word count" ||
    normalized ===
      "count words" ||
    normalized ===
      "count characters" ||
    normalized ===
      "character count"
  ) {
    return {
      intent:
        "tool",

      tool:
        "text_stats",

      input:
        "",
    };
  }

  return null;
}

/**
 * =========================================================
 * DETECT TOOL
 * =========================================================
 *
 * Main detection function consumed by
 * agentController.ts.
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
    typeof input ===
    "string"
      ? input.trim()
      : "";

  /**
   * =======================================================
   * EMPTY INPUT
   * =======================================================
   */

  if (
    !text
  ) {
    return {
      intent:
        "answer",
    };
  }

  /**
   * =======================================================
   * CALCULATOR
   * =======================================================
   */

  const calculator =
    detectCalculator(
      text
    );

  if (
    calculator
  ) {
    return calculator;
  }

  /**
   * =======================================================
   * TIME
   * =======================================================
   */

  const time =
    detectTime(
      text
    );

  if (
    time
  ) {
    return time;
  }

  /**
   * =======================================================
   * TEXT STATISTICS
   * =======================================================
   */

  const textStats =
    detectTextStats(
      text
    );

  if (
    textStats
  ) {
    return textStats;
  }

  /**
   * =======================================================
   * NORMAL AI REQUEST
   * =======================================================
   */

  return {
    intent:
      "answer",
  };
}

/**
 * =========================================================
 * FORMAT NUMBER RESULT
 * =========================================================
 *
 * Keeps calculator output clean.
 */

function formatNumberResult(
  value: number
): string {
  /**
   * Integers are returned without unnecessary decimals.
   *
   * Example:
   *
   * 5 instead of 5.000000
   */

  if (
    Number.isInteger(
      value
    )
  ) {
    return String(
      value
    );
  }

  /**
   * JavaScript's normal string conversion is sufficient
   * for ordinary calculator output.
   */

  return String(
    value
  );
}

/**
 * =========================================================
 * TEXT STATISTICS CALCULATOR
 * =========================================================
 */

function calculateTextStats(
  text: string
): string {
  /**
   * Keep the original text exactly as supplied for
   * character counting.
   */

  const characters =
    text.length;

  /**
   * Characters excluding whitespace.
   */

  const charactersWithoutSpaces =
    text.replace(
      /\s/g,
      ""
    ).length;

  /**
   * Words.
   *
   * Whitespace-separated tokens are treated as words.
   */

  const words =
    text.trim()
      ? text
          .trim()
          .split(
            /\s+/
          )
          .length
      : 0;

  /**
   * Lines.
   */

  const lines =
    text
      ? text.split(
          /\r?\n/
        ).length
      : 0;

  return (
    `Characters: ${characters}\n` +
    `Characters without spaces: ${charactersWithoutSpaces}\n` +
    `Words: ${words}\n` +
    `Lines: ${lines}`
  );
}

/**
 * =========================================================
 * RUN TOOL
 * =========================================================
 *
 * This is the only place where agentController.ts
 * executes a deterministic local tool.
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
      name ===
      "calculator"
    ) {
      /**
       * Clean the incoming expression.
       */

      const expression =
        safeMathExpression(
          input
        );

      /**
       * Evaluate safely using our parser.
       */

      const value =
        evaluateExpression(
          expression
        );

      /**
       * Return a clean result.
       */

      return {
        ok:
          true,

        tool:
          name,

        result:
          formatNumberResult(
            value
          ),
      };
    }

    /**
     * =====================================================
     * TIME
     * =====================================================
     *
     * Returns ISO UTC time.
     *
     * Example:
     *
     * 2026-10-02T15:30:00.000Z
     *
     * agentController.ts will present this as:
     *
     * "The current UTC time is ..."
     */

    if (
      name ===
      "time"
    ) {
      const now =
        new Date();

      return {
        ok:
          true,

        tool:
          name,

        result:
          now.toISOString(),
      };
    }

    /**
     * =====================================================
     * TEXT STATISTICS
     * =====================================================
     */

    if (
      name ===
      "text_stats"
    ) {
      const text =
        typeof input ===
        "string"
          ? input
          : "";

      /**
       * If there is no actual text, return a useful
       * validation error rather than silently reporting
       * zero.
       */

      if (
        !text.trim()
      ) {
        return {
          ok:
            false,

          tool:
            name,

          result:
            "Please provide the text you want me to analyze.",
        };
      }

      const result =
        calculateTextStats(
          text
        );

      return {
        ok:
          true,

        tool:
          name,

        result,
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
  } catch (
    error
  ) {
    /**
     * =====================================================
     * SAFE ERROR HANDLING
     * =====================================================
     */

    return {
      ok:
        false,

      tool:
        name,

      result:
        error instanceof Error
          ? error.message
          : "Tool execution failed.",
    };
  }
}
