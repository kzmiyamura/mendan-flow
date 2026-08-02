"use client";

import { useState } from "react";
import { Interview } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/data";
import type { SuggestResponse, Suggestion } from "@/app/api/suggest/route";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface LogEntry {
  from: "you" | "ai";
  text: string;
}

interface PendingSuggestion extends Suggestion {
  id: number;
}

let suggestionSeq = 0;

export default function QuestionBrainstorm({
  interview,
  onAdopt,
}: {
  interview: Interview;
  onAdopt: (text: string, intent: string) => void;
}) {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [pending, setPending] = useState<PendingSuggestion[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const started = chat.length > 0 || loading;

  async function send(userText: string | null) {
    setLoading(true);
    setError(null);
    const nextChat: ChatMessage[] = userText
      ? [...chat, { role: "user", content: userText }]
      : [...chat];
    if (userText) {
      setLog((l) => [...l, { from: "you", text: userText }]);
      setChat(nextChat);
      setInput("");
    }

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            candidateName: interview.candidateName,
            position: POSITION_LABELS[interview.position],
            positionDetail: interview.positionDetail,
            profileNote: interview.profileNote,
            focusPoints: interview.focusPoints,
            existingQuestions: interview.questions.map((q) => q.text),
          },
          chat: nextChat,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `エラーが発生しました (${res.status})`);
        return;
      }
      const result = data as SuggestResponse;
      setChat([...nextChat, { role: "assistant", content: JSON.stringify(result) }]);
      setLog((l) => [...l, { from: "ai", text: result.reply }]);
      setPending((p) => [
        ...p,
        ...result.suggestions.map((s) => ({ ...s, id: suggestionSeq++ })),
      ]);
    } catch {
      setError("通信に失敗しました。サーバーが起動しているか確認してください。");
    } finally {
      setLoading(false);
    }
  }

  function adopt(s: PendingSuggestion) {
    onAdopt(s.text, s.intent);
    setPending((p) => p.filter((x) => x.id !== s.id));
  }

  function skip(s: PendingSuggestion) {
    setPending((p) => p.filter((x) => x.id !== s.id));
  }

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50/50 p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">💡 質問を一緒に考える</h2>
        <span className="text-xs text-slate-500">Claudeが候補者に合わせた質問を提案します</span>
      </div>

      {!started && (
        <button
          onClick={() => send(null)}
          className="mt-3 w-full rounded-lg border border-sky-600 bg-white py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
        >
          経歴メモをもとに提案をもらう
        </button>
      )}

      {log.length > 0 && (
        <div className="mt-3 space-y-2">
          {log.map((entry, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm ${
                entry.from === "you"
                  ? "ml-8 bg-white border border-slate-200"
                  : "mr-4 bg-white border border-sky-200"
              }`}
            >
              <span className="mr-1 text-xs text-slate-400">
                {entry.from === "you" ? "あなた" : "Claude"}
              </span>
              <span className="whitespace-pre-wrap">{entry.text}</span>
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <ul className="mt-3 space-y-2">
          {pending.map((s) => (
            <li key={s.id} className="rounded-lg border border-sky-300 bg-white p-3">
              <div className="text-sm font-medium">{s.text}</div>
              <div className="mt-0.5 text-xs text-sky-700">ねらい: {s.intent}</div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => adopt(s)}
                  className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-sky-700"
                >
                  質問リストに採用
                </button>
                <button
                  onClick={() => skip(s)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-100"
                >
                  スキップ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
          考え中…
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {started && (
        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim() && !loading) {
                e.preventDefault();
                send(input.trim());
              }
            }}
            placeholder="例: もっとチームでの立ち回りを聞きたい"
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none disabled:bg-slate-100"
          />
          <button
            onClick={() => input.trim() && send(input.trim())}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:bg-slate-300"
          >
            送信
          </button>
        </div>
      )}
    </section>
  );
}
