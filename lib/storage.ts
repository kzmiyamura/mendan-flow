import { Interview } from "./types";

const KEY = "mendan-flow:interviews";

const EMPTY: Interview[] = [];
let cache: Interview[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  cache = null;
  listeners.forEach((l) => l());
}

/** useSyncExternalStore用: 変更購読 */
export function subscribeInterviews(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** useSyncExternalStore用: クライアント側スナップショット */
export function getInterviewsSnapshot(): Interview[] {
  if (cache === null) cache = loadInterviews();
  return cache;
}

/** useSyncExternalStore用: SSR側スナップショット */
export function getServerInterviewsSnapshot(): Interview[] {
  return EMPTY;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function loadInterviews(): Interview[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Interview[]) : [];
    // 旧バージョンで保存されたデータにフィールドを補完
    return list.map((i) => ({
      ...i,
      plan: i.plan ?? "",
      copilot: i.copilot ?? { messages: [], handled: {} },
    }));
  } catch {
    return [];
  }
}

function saveInterviews(list: Interview[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  emit();
}

const CONTEXT_KEY = "mendan-flow:interviewer-context";
let contextCache: string | null = null;

/** 面接官のチーム状況・重視したい観点（全面接で共有） */
export function getInterviewerContextSnapshot(): string {
  if (contextCache === null) {
    contextCache =
      typeof window === "undefined"
        ? ""
        : (localStorage.getItem(CONTEXT_KEY) ?? "");
  }
  return contextCache;
}

export function getServerInterviewerContextSnapshot(): string {
  return "";
}

export function saveInterviewerContext(value: string) {
  localStorage.setItem(CONTEXT_KEY, value);
  contextCache = value;
  listeners.forEach((l) => l());
}

export function getInterview(id: string): Interview | undefined {
  return loadInterviews().find((i) => i.id === id);
}

export function upsertInterview(interview: Interview): Interview {
  const list = loadInterviews();
  const updated = { ...interview, updatedAt: new Date().toISOString() };
  const idx = list.findIndex((i) => i.id === interview.id);
  if (idx >= 0) list[idx] = updated;
  else list.push(updated);
  saveInterviews(list);
  return updated;
}

export function deleteInterview(id: string) {
  saveInterviews(loadInterviews().filter((i) => i.id !== id));
}
