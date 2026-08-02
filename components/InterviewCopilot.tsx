"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CopilotMessage, Interview } from "@/lib/types";
import { POSITION_LABELS } from "@/lib/data";
import {
  getInterviewerContextSnapshot,
  getServerInterviewerContextSnapshot,
  saveInterviewerContext,
  subscribeInterviews,
  uid,
} from "@/lib/storage";
import type { SuggestResponse } from "@/app/api/suggest/route";

const QUICK_CHIPS = [
  "時間配分を相談したい",
  "質問をもっと考えたい",
  "評価の観点を整理したい",
];

function parseAssistant(content: string): SuggestResponse | null {
  try {
    const parsed = JSON.parse(content) as SuggestResponse;
    if (typeof parsed.reply !== "string") return null;
    return {
      reply: parsed.reply,
      suggestions: parsed.suggestions ?? [],
      planUpdate: parsed.planUpdate ?? "",
      contextUpdate: parsed.contextUpdate ?? "",
    };
  } catch {
    return null;
  }
}

export default function InterviewCopilot({
  interview,
  onUpdate,
}: {
  interview: Interview;
  onUpdate: (patch: Partial<Interview>) => void;
}) {
  const copilot = interview.copilot;
  const interviewerContext = useSyncExternalStore(
    subscribeInterviews,
    getInterviewerContextSnapshot,
    getServerInterviewerContextSnapshot
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(copilot.messages.length);

  useEffect(() => {
    if (copilot.messages.length > prevCount.current || loading) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevCount.current = copilot.messages.length;
  }, [copilot.messages.length, loading]);

  async function send(text: string | null) {
    setLoading(true);
    setError(null);
    const next: CopilotMessage[] = text
      ? [...copilot.messages, { role: "user", content: text }]
      : [...copilot.messages];
    if (text) {
      onUpdate({ copilot: { ...copilot, messages: next } });
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
            plan: interview.plan,
            interviewerContext,
            existingQuestions: interview.questions.map((q) => q.text),
          },
          chat: next,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `エラーが発生しました (${res.status})`);
        return;
      }
      onUpdate({
        copilot: {
          ...copilot,
          messages: [...next, { role: "assistant", content: JSON.stringify(data) }],
        },
      });
    } catch {
      setError("通信に失敗しました。サーバーが起動しているか確認してください。");
    } finally {
      setLoading(false);
    }
  }

  function markHandled(
    key: string,
    status: "adopted" | "skipped",
    extra?: Partial<Interview>
  ) {
    onUpdate({
      ...extra,
      copilot: {
        ...copilot,
        handled: { ...copilot.handled, [key]: status },
      },
    });
  }

  return (
    <section className="flex h-[38rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
      {/* ヘッダー */}
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold">🤝 面談設計アシスタント</h2>
        <details open={!interviewerContext}>
          <summary className="mt-1 cursor-pointer text-xs font-medium text-sky-700">
            あなたのチーム状況・重視したい観点
            <span className="ml-1 font-normal text-slate-400">
              {interviewerContext ? "（設定済み・クリックで編集）" : "（未設定 — 最初に書くのがおすすめ）"}
            </span>
          </summary>
          <textarea
            value={interviewerContext}
            onChange={(e) => saveInterviewerContext(e.target.value)}
            rows={3}
            placeholder="例: 一人で客先チームに入る可能性が高い。後方支援は必ずする。単独で挑戦できるメンタルと、人に聞く・調べる・AIを使う柔軟性を重視。"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
          />
        </details>
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {copilot.messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-slate-500">
              この候補者の面談の進め方・時間配分・質問を
              <br />
              会話しながら一緒に決めていきます
            </p>
            <button
              onClick={() => send(null)}
              className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              面談設計を始める
            </button>
          </div>
        )}

        {copilot.messages.map((msg, mi) => {
          if (msg.role === "user") {
            return (
              <div key={mi} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-sky-600 px-3.5 py-2 text-sm text-white">
                  {msg.content}
                </div>
              </div>
            );
          }
          const parsed = parseAssistant(msg.content);
          if (!parsed) return null;
          return (
            <div key={mi} className="flex gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                C
              </div>
              <div className="max-w-[85%] flex-1 space-y-2">
                <div className="w-fit whitespace-pre-wrap rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-2 text-sm">
                  {parsed.reply}
                </div>

                {parsed.contextUpdate && (
                  <ProposalCard
                    icon="👤"
                    title="チーム状況メモの更新提案"
                    body={parsed.contextUpdate}
                    adoptLabel="メモに反映"
                    adoptedLabel="✓ チーム状況メモに反映済み"
                    color="teal"
                    status={copilot.handled[`${mi}:ctx`]}
                    onAdopt={() => {
                      saveInterviewerContext(parsed.contextUpdate);
                      markHandled(`${mi}:ctx`, "adopted");
                    }}
                    onSkip={() => markHandled(`${mi}:ctx`, "skipped")}
                  />
                )}

                {parsed.planUpdate && (
                  <ProposalCard
                    icon="📋"
                    title="面談プランの提案"
                    body={parsed.planUpdate}
                    adoptLabel="面談プランに反映"
                    adoptedLabel="✓ 面談プランに反映済み"
                    color="indigo"
                    status={copilot.handled[`${mi}:plan`]}
                    onAdopt={() =>
                      markHandled(`${mi}:plan`, "adopted", { plan: parsed.planUpdate })
                    }
                    onSkip={() => markHandled(`${mi}:plan`, "skipped")}
                  />
                )}

                {parsed.suggestions.map((s, si) => {
                  const key = `${mi}:s${si}`;
                  const status = copilot.handled[key];
                  return (
                    <div
                      key={key}
                      className={`rounded-lg border p-3 ${
                        status === "skipped"
                          ? "border-slate-200 bg-slate-100 opacity-60"
                          : "border-sky-300 bg-white"
                      }`}
                    >
                      <div className="text-sm font-medium">{s.text}</div>
                      <div className="mt-0.5 text-xs text-sky-700">ねらい: {s.intent}</div>
                      <div className="mt-2 flex items-center gap-2">
                        {status === "adopted" && (
                          <span className="text-xs font-medium text-emerald-600">
                            ✓ 質問リストに追加済み
                          </span>
                        )}
                        {status === "skipped" && (
                          <span className="text-xs text-slate-400">スキップ済み</span>
                        )}
                        {!status && (
                          <>
                            <button
                              onClick={() =>
                                markHandled(key, "adopted", {
                                  questions: [
                                    ...interview.questions,
                                    {
                                      id: uid(),
                                      text: s.text,
                                      intent: s.intent,
                                      asked: false,
                                      note: "",
                                    },
                                  ],
                                })
                              }
                              className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-sky-700"
                            >
                              質問リストに採用
                            </button>
                            <button
                              onClick={() => markHandled(key, "skipped")}
                              className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-100"
                            >
                              スキップ
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-2">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
              C
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-500">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
              考え中…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="border-t border-slate-200 p-3">
        {error && (
          <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}
        {copilot.messages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => !loading && send(chip)}
                disabled={loading}
                className="rounded-full border border-sky-300 bg-white px-3 py-1 text-xs text-sky-700 transition hover:bg-sky-50 disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim() && !loading) {
                e.preventDefault();
                send(input.trim());
              }
            }}
            placeholder="例: 面談は60分。技術の話ばかりにしたくない"
            disabled={loading}
            className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm focus:border-sky-500 focus:outline-none disabled:bg-slate-100"
          />
          <button
            onClick={() => input.trim() && send(input.trim())}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:bg-slate-300"
          >
            送信
          </button>
        </div>
      </div>
    </section>
  );
}

const CARD_COLORS = {
  indigo: {
    border: "border-indigo-300",
    bg: "bg-indigo-50/50",
    title: "text-indigo-700",
    button: "bg-indigo-600 hover:bg-indigo-700",
  },
  teal: {
    border: "border-teal-300",
    bg: "bg-teal-50/50",
    title: "text-teal-700",
    button: "bg-teal-600 hover:bg-teal-700",
  },
} as const;

function ProposalCard({
  icon,
  title,
  body,
  adoptLabel,
  adoptedLabel,
  color,
  status,
  onAdopt,
  onSkip,
}: {
  icon: string;
  title: string;
  body: string;
  adoptLabel: string;
  adoptedLabel: string;
  color: keyof typeof CARD_COLORS;
  status?: "adopted" | "skipped";
  onAdopt: () => void;
  onSkip: () => void;
}) {
  const c = CARD_COLORS[color];
  return (
    <div
      className={`rounded-lg border p-3 ${
        status === "skipped"
          ? "border-slate-200 bg-slate-100 opacity-60"
          : `${c.border} ${c.bg}`
      }`}
    >
      <div className={`text-xs font-semibold ${c.title}`}>
        {icon} {title}
      </div>
      <pre className="mt-1.5 whitespace-pre-wrap font-sans text-sm text-slate-800">
        {body}
      </pre>
      <div className="mt-2 flex items-center gap-2">
        {status === "adopted" && (
          <span className="text-xs font-medium text-emerald-600">{adoptedLabel}</span>
        )}
        {status === "skipped" && (
          <span className="text-xs text-slate-400">スキップ済み</span>
        )}
        {!status && (
          <>
            <button
              onClick={onAdopt}
              className={`rounded-md px-3 py-1 text-xs font-semibold text-white transition ${c.button}`}
            >
              {adoptLabel}
            </button>
            <button
              onClick={onSkip}
              className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-100"
            >
              スキップ
            </button>
          </>
        )}
      </div>
    </div>
  );
}
