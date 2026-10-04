import { supabase } from "./supabase";

import {
  UserProfile,
  MemoryItem,
  PlannerItem,
  HabitItem,
  ChatMessage,
  Conversation,
  MemorySettings,
} from "../types";

export interface CloudData {
  user: UserProfile;
  memories: MemoryItem[];
  plannerItems: PlannerItem[];
  habits: HabitItem[];

  /**
   * Legacy flat chat history.
   *
   * Kept for backward compatibility with the
   * existing Nodysom AI chat system.
   */
  chatHistory: ChatMessage[];

  /**
   * New persistent multi-conversation system.
   *
   * Optional so existing Supabase records remain
   * compatible with the new application version.
   */
  conversations?: Conversation[];

  /**
   * Currently selected conversation.
   */
  activeConversationId?: string | null;

  /**
   * AI memory controls.
   */
  memorySettings?: MemorySettings;
}

const USER_DATA_TABLE = "user_data";

// =========================================================
// CHAT HISTORY NORMALIZATION
// =========================================================

/**
 * Normalize cloud chat history.
 *
 * Prevents malformed records from breaking
 * the application.
 */
function normalizeChatHistory(
  value: unknown
): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      message
    ): message is ChatMessage => {
      if (
        !message ||
        typeof message !== "object"
      ) {
        return false;
      }

      const item =
        message as Partial<ChatMessage>;

      return (
        typeof item.id === "string" &&
        (
          item.role === "user" ||
          item.role === "assistant" ||
          item.role === "system"
        ) &&
        typeof item.content === "string" &&
        typeof item.timestamp === "string"
      );
    }
  );
}

// =========================================================
// CONVERSATION NORMALIZATION
// =========================================================

/**
 * Normalize a single conversation.
 *
 * This protects the application from malformed
 * or incomplete conversation records.
 */
function normalizeConversation(
  value: unknown
): Conversation | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const item =
    value as Partial<Conversation>;

  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.createdAt !== "string" ||
    typeof item.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id:
      item.id,

    title:
      item.title.trim() ||
      "New Chat",

    messages:
      normalizeChatHistory(
        item.messages
      ),

    createdAt:
      item.createdAt,

    updatedAt:
      item.updatedAt,

    summary:
      typeof item.summary === "string"
        ? item.summary
        : undefined,

    category:
      item.category,

    isActive:
      Boolean(
        item.isActive
      ),

    isArchived:
      Boolean(
        item.isArchived
      ),

    isPinned:
      Boolean(
        item.isPinned
      ),

    tags:
      Array.isArray(
        item.tags
      )
        ? item.tags.filter(
            (
              tag
            ): tag is string =>
              typeof tag === "string"
          )
        : [],

    provider:
      typeof item.provider === "string"
        ? item.provider
        : undefined,

    model:
      typeof item.model === "string"
        ? item.model
        : undefined,
  };
}

/**
 * Normalize the complete conversation collection.
 */
function normalizeConversations(
  value: unknown
): Conversation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      normalizeConversation
    )
    .filter(
      (
        conversation
      ): conversation is Conversation =>
        conversation !== null
    );
}

// =========================================================
// MEMORY SETTINGS
// =========================================================

/**
 * Normalize memory settings.
 *
 * Older cloud records receive safe defaults.
 */
function normalizeMemorySettings(
  value: unknown
): MemorySettings {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return {
      enabled: true,
      autoSave: true,
      useInChat: true,
    };
  }

  const item =
    value as Partial<MemorySettings>;

  return {
    enabled:
      typeof item.enabled === "boolean"
        ? item.enabled
        : true,

    autoSave:
      typeof item.autoSave === "boolean"
        ? item.autoSave
        : true,

    useInChat:
      typeof item.useInChat === "boolean"
        ? item.useInChat
        : true,

    lastReviewedAt:
      typeof item.lastReviewedAt === "string"
        ? item.lastReviewedAt
        : undefined,
  };
}

// =========================================================
// LEGACY CHAT MIGRATION
// =========================================================

/**
 * Converts the old flat chatHistory into a
 * persistent conversation.
 *
 * This prevents existing users from losing their
 * previous Nodysom AI conversations.
 */
function migrateLegacyChatHistory(
  chatHistory: ChatMessage[]
): Conversation[] {
  const normalized =
    normalizeChatHistory(
      chatHistory
    );

  if (
    normalized.length === 0
  ) {
    return [];
  }

  const conversationId =
    `conversation-${Date.now()}`;

  const now =
    new Date().toISOString();

  const firstMessage =
    normalized[0];

  const firstUserMessage =
    normalized.find(
      (
        message
      ) =>
        message.role === "user" &&
        message.content.trim().length > 0
    );

  const rawTitle =
    firstUserMessage?.content ||
    "New Chat";

  const title =
    rawTitle
      .trim()
      .replace(
        /\s+/g,
        " "
      )
      .slice(
        0,
        60
      );

  return [
    {
      id:
        conversationId,

      title:
        title ||
        "New Chat",

      messages:
        normalized.map(
          (
            message
          ) => ({
            ...message,

            conversationId:
              conversationId,
          })
        ),

      createdAt:
        firstMessage?.timestamp ||
        now,

      updatedAt:
        normalized[
          normalized.length - 1
        ]?.timestamp ||
        now,

      category:
        "general",

      isActive:
        true,

      isArchived:
        false,

      isPinned:
        false,

      tags:
        [],

      summary:
        undefined,

      provider:
        undefined,

      model:
        undefined,
    },
  ];
}

// =========================================================
// CLOUD DATA NORMALIZATION
// =========================================================

/**
 * Normalize complete cloud data.
 *
 * Supports both:
 *
 * 1. Old chatHistory-only records
 * 2. New conversations-based records
 *
 * This allows Nodysom AI to upgrade without
 * destroying existing user data.
 */
function normalizeCloudData(
  value: any
): CloudData | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  if (!value.user) {
    return null;
  }

  const chatHistory =
    normalizeChatHistory(
      value.chatHistory
    );

  let conversations =
    normalizeConversations(
      value.conversations
    );

  /**
   * Migrate old chat history automatically
   * when conversations are not available.
   */
  if (
    conversations.length === 0 &&
    chatHistory.length > 0
  ) {
    conversations =
      migrateLegacyChatHistory(
        chatHistory
      );
  }

  let activeConversationId:
    | string
    | null =
    typeof value.activeConversationId ===
      "string"
      ? value.activeConversationId
      : null;

  /**
   * Verify that the active conversation
   * actually exists.
   */
  const activeExists =
    activeConversationId
      ? conversations.some(
          (
            conversation
          ) =>
            conversation.id ===
            activeConversationId
        )
      : false;

  /**
   * If the active conversation no longer exists,
   * automatically select the latest available one.
   */
  if (
    !activeExists
  ) {
    const available =
      conversations
        .filter(
          (
            conversation
          ) =>
            !conversation.isArchived
        )
        .sort(
          (
            first,
            second
          ) =>
            new Date(
              second.updatedAt
            ).getTime() -
            new Date(
              first.updatedAt
            ).getTime()
        );

    activeConversationId =
      available[0]?.id ||
      null;
  }

  return {
    user:
      value.user,

    memories:
      Array.isArray(
        value.memories
      )
        ? value.memories
        : [],

    plannerItems:
      Array.isArray(
        value.plannerItems
      )
        ? value.plannerItems
        : [],

    habits:
      Array.isArray(
        value.habits
      )
        ? value.habits
        : [],

    chatHistory:
      chatHistory,

    conversations:
      conversations,

    activeConversationId:
      activeConversationId,

    memorySettings:
      normalizeMemorySettings(
        value.memorySettings
      ),
  };
}

// =========================================================
// AUTH
// =========================================================

export async function signUp(
  email: string,
  password: string
) {
  if (!supabase) {
    throw new Error(
      "Supabase haija-configurewa."
    );
  }

  const cleanEmail =
    email
      .trim()
      .toLowerCase();

  if (!cleanEmail) {
    throw new Error(
      "Email address is required."
    );
  }

  if (!password) {
    throw new Error(
      "Password is required."
    );
  }

  return await supabase.auth.signUp({
    email:
      cleanEmail,

    password,
  });
}

export async function signIn(
  email: string,
  password: string
) {
  if (!supabase) {
    throw new Error(
      "Supabase haija-configurewa."
    );
  }

  const cleanEmail =
    email
      .trim()
      .toLowerCase();

  if (!cleanEmail) {
    throw new Error(
      "Email address is required."
    );
  }

  if (!password) {
    throw new Error(
      "Password is required."
    );
  }

  return await supabase.auth.signInWithPassword({
    email:
      cleanEmail,

    password,
  });
}

export async function signOut() {
  if (!supabase) {
    return;
  }

  return await supabase.auth.signOut();
}

export async function getCurrentSession() {
  if (!supabase) {
    return null;
  }

  const {
    data: {
      session,
    },
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

// =========================================================
// LOAD CLOUD DATA
// =========================================================

export async function loadCloudData(
  userId: string
): Promise<CloudData | null> {
  if (!supabase) {
    return null;
  }

  if (!userId) {
    throw new Error(
      "A valid user ID is required."
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        USER_DATA_TABLE
      )
      .select(
        "user_id, data, updated_at"
      )
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();

  if (error) {
    console.error(
      "Supabase loadCloudData error:",
      error
    );

    throw error;
  }

  if (!data?.data) {
    return null;
  }

  return normalizeCloudData(
    data.data
  );
}

// =========================================================
// SAVE CLOUD DATA
// =========================================================

export async function saveCloudData(
  userId: string,
  cloudData: CloudData
) {
  if (!supabase) {
    return;
  }

  if (!userId) {
    throw new Error(
      "A valid user ID is required."
    );
  }

  const normalizedHistory =
    normalizeChatHistory(
      cloudData.chatHistory
    );

  let normalizedConversations =
    normalizeConversations(
      cloudData.conversations
    );

  /**
   * Backward compatibility.
   *
   * If a caller only supplies chatHistory,
   * create a conversation automatically.
   */
  if (
    normalizedConversations.length === 0 &&
    normalizedHistory.length > 0
  ) {
    normalizedConversations =
      migrateLegacyChatHistory(
        normalizedHistory
      );
  }

  let activeConversationId =
    cloudData.activeConversationId ??
    null;

  /**
   * Make sure the active conversation exists.
   */
  if (
    activeConversationId &&
    !normalizedConversations.some(
      (
        conversation
      ) =>
        conversation.id ===
        activeConversationId
    )
  ) {
    activeConversationId =
      null;
  }

  /**
   * Automatically select the newest conversation
   * when no active conversation was supplied.
   */
  if (
    !activeConversationId &&
    normalizedConversations.length > 0
  ) {
    const newest =
      [...normalizedConversations]
        .filter(
          (
            conversation
          ) =>
            !conversation.isArchived
        )
        .sort(
          (
            first,
            second
          ) =>
            new Date(
              second.updatedAt
            ).getTime() -
            new Date(
              first.updatedAt
            ).getTime()
        )[0];

    activeConversationId =
      newest?.id ||
      null;
  }

  const normalizedData:
    CloudData = {
    user:
      cloudData.user,

    memories:
      Array.isArray(
        cloudData.memories
      )
        ? cloudData.memories
        : [],

    plannerItems:
      Array.isArray(
        cloudData.plannerItems
      )
        ? cloudData.plannerItems
        : [],

    habits:
      Array.isArray(
        cloudData.habits
      )
        ? cloudData.habits
        : [],

    chatHistory:
      normalizedHistory,

    conversations:
      normalizedConversations,

    activeConversationId:
      activeConversationId,

    memorySettings:
      normalizeMemorySettings(
        cloudData.memorySettings
      ),
  };

  const {
    data,
    error,
  } =
    await supabase
      .from(
        USER_DATA_TABLE
      )
      .upsert(
        {
          user_id:
            userId,

          data:
            normalizedData,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "user_id",
        }
      )
      .select(
        "user_id, updated_at"
      )
      .single();

  if (error) {
    console.error(
      "Supabase saveCloudData error:",
      error
    );

    throw error;
  }

  return data;
}

// =========================================================
// CHAT-SPECIFIC CLOUD FUNCTIONS
// =========================================================

/**
 * Load legacy flat chat history.
 *
 * Kept because existing Nodysom components may
 * still depend on ChatMessage[].
 */
export async function loadCloudChatHistory(
  userId: string
): Promise<ChatMessage[]> {
  const cloudData =
    await loadCloudData(
      userId
    );

  if (!cloudData) {
    return [];
  }

  return normalizeChatHistory(
    cloudData.chatHistory
  );
}

/**
 * Replace only the cloud chat history.
 *
 * Existing profile, memories, planner, habits
 * and conversations remain preserved.
 */
export async function saveCloudChatHistory(
  userId: string,
  chatHistory: ChatMessage[]
) {
  if (!supabase) {
    return;
  }

  const existing =
    await loadCloudData(
      userId
    );

  if (!existing) {
    throw new Error(
      "Cloud profile does not exist yet."
    );
  }

  return await saveCloudData(
    userId,
    {
      ...existing,

      chatHistory:
        normalizeChatHistory(
          chatHistory
        ),
    }
  );
}

// =========================================================
// CONVERSATIONS
// =========================================================

/**
 * Load all persistent conversations.
 */
export async function loadCloudConversations(
  userId: string
): Promise<Conversation[]> {
  const cloudData =
    await loadCloudData(
      userId
    );

  if (!cloudData) {
    return [];
  }

  return normalizeConversations(
    cloudData.conversations
  );
}

/**
 * Load the active conversation ID.
 */
export async function loadActiveConversationId(
  userId: string
): Promise<string | null> {
  const cloudData =
    await loadCloudData(
      userId
    );

  if (!cloudData) {
    return null;
  }

  return (
    cloudData.activeConversationId ??
    null
  );
}

/**
 * Save the complete conversation collection.
 */
export async function saveCloudConversations(
  userId: string,
  conversations: Conversation[],
  activeConversationId?: string | null
) {
  if (!supabase) {
    return;
  }

  const existing =
    await loadCloudData(
      userId
    );

  if (!existing) {
    throw new Error(
      "Cloud profile does not exist yet."
    );
  }

  const normalizedConversations =
    normalizeConversations(
      conversations
    );

  let activeId =
    activeConversationId ??
    existing.activeConversationId ??
    null;

  if (
    activeId &&
    !normalizedConversations.some(
      (
        conversation
      ) =>
        conversation.id ===
        activeId
    )
  ) {
    activeId =
      null;
  }

  return await saveCloudData(
    userId,
    {
      ...existing,

      conversations:
        normalizedConversations,

      activeConversationId:
        activeId,
    }
  );
}

/**
 * Save or update a single conversation.
 */
export async function saveCloudConversation(
  userId: string,
  conversation: Conversation
) {
  if (!supabase) {
    return;
  }

  const existing =
    await loadCloudData(
      userId
    );

  if (!existing) {
    throw new Error(
      "Cloud profile does not exist yet."
    );
  }

  const conversations =
    normalizeConversations(
      existing.conversations
    );

  const normalized =
    normalizeConversation(
      conversation
    );

  if (!normalized) {
    throw new Error(
      "Invalid conversation data."
    );
  }

  const index =
    conversations.findIndex(
      (
        item
      ) =>
        item.id ===
        normalized.id
    );

  if (index >= 0) {
    conversations[index] =
      normalized;
  } else {
    conversations.push(
      normalized
    );
  }

  return await saveCloudData(
    userId,
    {
      ...existing,

      conversations:
        conversations,

      activeConversationId:
        normalized.id,
    }
  );
}

/**
 * Delete a conversation from cloud storage.
 */
export async function deleteCloudConversation(
  userId: string,
  conversationId: string
) {
  if (!supabase) {
    return;
  }

  if (!conversationId) {
    throw new Error(
      "A valid conversation ID is required."
    );
  }

  const existing =
    await loadCloudData(
      userId
    );

  if (!existing) {
    throw new Error(
      "Cloud profile does not exist yet."
    );
  }

  const conversations =
    normalizeConversations(
      existing.conversations
    ).filter(
      (
        conversation
      ) =>
        conversation.id !==
        conversationId
    );

  let activeConversationId =
    existing.activeConversationId ??
    null;

  if (
    activeConversationId ===
    conversationId
  ) {
    const newest =
      [...conversations]
        .filter(
          (
            conversation
          ) =>
            !conversation.isArchived
        )
        .sort(
          (
            first,
            second
          ) =>
            new Date(
              second.updatedAt
            ).getTime() -
            new Date(
              first.updatedAt
            ).getTime()
        )[0];

    activeConversationId =
      newest?.id ||
      null;
  }

  return await saveCloudData(
    userId,
    {
      ...existing,

      conversations:
        conversations,

      activeConversationId:
        activeConversationId,
    }
  );
}

/**
 * Change the active cloud conversation.
 */
export async function setActiveCloudConversation(
  userId: string,
  conversationId: string | null
) {
  if (!supabase) {
    return;
  }

  const existing =
    await loadCloudData(
      userId
    );

  if (!existing) {
    throw new Error(
      "Cloud profile does not exist yet."
    );
  }

  const conversations =
    normalizeConversations(
      existing.conversations
    );

  if (
    conversationId &&
    !conversations.some(
      (
        conversation
      ) =>
        conversation.id ===
        conversationId
    )
  ) {
    throw new Error(
      "Conversation not found."
    );
  }

  return await saveCloudData(
    userId,
    {
      ...existing,

      conversations:
        conversations,

      activeConversationId:
        conversationId,
    }
  );
}

// =========================================================
// MEMORY SETTINGS
// =========================================================

/**
 * Load the user's AI memory settings.
 */
export async function loadCloudMemorySettings(
  userId: string
): Promise<MemorySettings> {
  const cloudData =
    await loadCloudData(
      userId
    );

  if (!cloudData) {
    return {
      enabled: true,
      autoSave: true,
      useInChat: true,
    };
  }

  return normalizeMemorySettings(
    cloudData.memorySettings
  );
}

/**
 * Save the user's AI memory settings.
 */
export async function saveCloudMemorySettings(
  userId: string,
  settings: MemorySettings
) {
  if (!supabase) {
    return;
  }

  const existing =
    await loadCloudData(
      userId
    );

  if (!existing) {
    throw new Error(
      "Cloud profile does not exist yet."
    );
  }

  return await saveCloudData(
    userId,
    {
      ...existing,

      memorySettings:
        normalizeMemorySettings(
          settings
        ),
    }
  );
}

// =========================================================
// CLOUD STATUS
// =========================================================

export function isCloudSyncAvailable(): boolean {
  return Boolean(
    supabase
  );
}
