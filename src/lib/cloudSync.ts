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

export async function signUp(email: string, password: string) {
  if (!supabase) {
    throw new Error("Supabase haija-configurewa.");
  }

  return await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
}

export async function signIn(email: string, password: string) {
  if (!supabase) {
    throw new Error("Supabase haija-configurewa.");
  }

  return await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
}

export async function signOut() {
  if (!supabase) return;

  return await supabase.auth.signOut();
}

export async function getCurrentSession() {
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export async function loadCloudData(
  userId: string
): Promise<CloudData | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_data")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.data) {
    return null;
  }

  return data.data as CloudData;
}

export async function saveCloudData(
  userId: string,
  cloudData: CloudData
) {
  if (!supabase) return;

  const { error } = await supabase
    .from("user_data")
    .upsert(
      {
        user_id: userId,
        data: cloudData,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) {
    throw error;
  }
}
