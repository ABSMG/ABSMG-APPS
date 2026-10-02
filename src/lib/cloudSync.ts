import { supabase } from "./supabase";

import {
  UserProfile,
  MemoryItem,
  PlannerItem,
  HabitItem,
  ChatMessage,
} from "../types";

export interface CloudData {
  user: UserProfile;
  memories: MemoryItem[];
  plannerItems: PlannerItem[];
  habits: HabitItem[];
  chatHistory: ChatMessage[];
}

const USER_DATA_TABLE = "user_data";

/**
 * Normalize cloud chat history.
 *
 * Prevents malformed records from breaking the application.
 */
function normalizeChatHistory(
  value: unknown
): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((message): message is ChatMessage => {
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
  });
}

/**
 * Normalize cloud data.
 *
 * This keeps the app compatible if some older
 * cloud records are missing optional arrays.
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

  return {
    user: value.user,

    memories:
      Array.isArray(value.memories)
        ? value.memories
        : [],

    plannerItems:
      Array.isArray(value.plannerItems)
        ? value.plannerItems
        : [],

    habits:
      Array.isArray(value.habits)
        ? value.habits
        : [],

    chatHistory:
      normalizeChatHistory(
        value.chatHistory
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
    email.trim().toLowerCase();

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
    email: cleanEmail,
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
    email.trim().toLowerCase();

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
    email: cleanEmail,
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
  } = await supabase.auth.getSession();

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
  } = await supabase
    .from(USER_DATA_TABLE)
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

  const normalizedData: CloudData = {
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
      normalizeChatHistory(
        cloudData.chatHistory
      ),
  };

  const {
    data,
    error,
  } = await supabase
    .from(USER_DATA_TABLE)
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
 * Load only chat history from the user's cloud data.
 *
 * Useful when the application needs to restore chat
 * without replacing planner/memory/habit data.
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
 * This first loads the existing cloud record so that
 * planner, memories, habits and profile are preserved.
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
// CLOUD STATUS
// =========================================================

export function isCloudSyncAvailable(): boolean {
  return Boolean(
    supabase
  );
}
