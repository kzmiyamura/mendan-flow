"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Interview, Judgement, Question, Scores } from "@/lib/types";
import {
  deleteInterview,
  getInterviewsSnapshot,
  getServerInterviewsSnapshot,
  subscribeInterviews,
  uid,
  upsertInterview,
} from "@/lib/storage";
import {
  JUDGEMENT_LABELS,
  JUDGEMENT_STYLES,
  POSITION_LABELS,
  SCORE_AXES,
} from "@/lib/data";
import QuestionBrainstorm from "@/components/QuestionBrainstorm";
import ResumeImport from "@/components/ResumeImport";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none";

export default function InterviewDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const interviews = useSyncExternalStore(
    subscribeInterviews,
    getInterviewsSnapshot,
    getServerInterviewsSnapshot
  );
  const hydrated = useSyncExternalStore(
    subscribeInterviews,
    () => true,
    () => false
  );
  const [tabChoice, setTabChoice] = useState<"prep" | "result" | null>(null);
  const [newQuestion, setNewQuestion] = useState("");

  const interview: Interview | null =
    interviews.find((i) => i.id === id) ?? null;
  const tab =
    tabChoice ?? (interview?.status === "done" ? "result" : "prep");

  if (hydrated && !interview) {
    return (
      <div className="text-center text-slate-500">
        <p>面接が見つかりませんでした。</p>
        <Link href="/" className="mt-2 inline-block text-sky-600 hover:underline">
          一覧に戻る
        </Link>
      </div>
    );
  }
  if (!interview) return null;

  function update(patch: Partial<Interview>) {
    if (!interview) return;
    upsertInterview({ ...interview, ...patch });
  }

  function updateQuestion(qid: string, patch: Partial<Question>) {
    update({
      questions: interview!.questions.map((q) =>
        q.id === qid ? { ...q, ...patch } : q
      ),
    });
  }

  function updateScore(key: keyof Scores, value: number) {
    update({
      result: {
        ...interview!.result,
        scores: { ...interview!.result.scores, [key]: value },
      },
    });
  }

  function addQuestion() {
    const text = newQuestion.trim();
    if (!text) return;
    update({
      questions: [
        ...interview!.questions,
        { id: uid(), text, intent: "", asked: false, note: "" },
      ],
    });
    setNewQuestion("");
  }

  function handleDelete() {
    if (!confirm(`「${interview!.candidateName}」の面接を削除しますか？`)) return;
    deleteInterview(interview!.id);
    router.push("/");
  }

  const doneCount = interview.checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← 一覧に戻る
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{interview.candidateName}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {POSITION_LABELS[interview.position]}
              {interview.positionDetail && ` / ${interview.positionDetail}`}
              {interview.scheduledAt &&
                ` ・ ${new Date(interview.scheduledAt).toLocaleString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 transition hover:border-rose-300 hover:text-rose-600"
          >
            削除
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-200 p-1">
        {(
          [
            ["prep", "面接準備"],
            ["result", "結果記録"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTabChoice(key)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
              tab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "prep" && (
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">経歴・スキルシートのメモ</h2>
            </div>
            <div className="mt-2">
              <ResumeImport
                position={`${POSITION_LABELS[interview.position]}${interview.positionDetail ? ` / ${interview.positionDetail}` : ""}`}
                onImported={(result) =>
                  update({
                    profileNote: interview.profileNote
                      ? `${interview.profileNote}\n\n--- 経歴書から自動生成 ---\n${result.profileNote}`
                      : result.profileNote,
                    focusPoints: interview.focusPoints
                      ? `${interview.focusPoints}\n\n--- 経歴書から自動生成 ---\n${result.focusPoints}`
                      : result.focusPoints,
                  })
                }
              />
            </div>
            <textarea
              value={interview.profileNote}
              onChange={(e) => update({ profileNote: e.target.value })}
              rows={4}
              placeholder="経歴書を読んで気になった点、確認したい経験など"
              className={`${inputClass} mt-2`}
            />
            <h2 className="mt-4 text-sm font-semibold">深掘りポイント</h2>
            <textarea
              value={interview.focusPoints}
              onChange={(e) => update({ focusPoints: e.target.value })}
              rows={3}
              placeholder="例: マイクロサービス移行の役割が曖昧 → 実際の担当範囲を確認"
              className={`${inputClass} mt-2`}
            />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold">
              準備チェックリスト（{doneCount}/{interview.checklist.length}）
            </h2>
            <ul className="mt-2 space-y-1">
              {interview.checklist.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(e) =>
                        update({
                          checklist: interview.checklist.map((c) =>
                            c.id === item.id
                              ? { ...c, done: e.target.checked }
                              : c
                          ),
                        })
                      }
                      className="h-4 w-4 accent-sky-600"
                    />
                    <span className={item.done ? "text-slate-400 line-through" : ""}>
                      {item.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <QuestionBrainstorm
            interview={interview}
            onAdopt={(text, intent) =>
              update({
                questions: [
                  ...interview.questions,
                  { id: uid(), text, intent, asked: false, note: "" },
                ],
              })
            }
          />

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold">質問リスト</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              面接中はチェックを入れながら進められます。メモ欄は結果記録にも表示されます。
            </p>
            <ul className="mt-3 space-y-3">
              {interview.questions.map((q, idx) => (
                <li key={q.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={q.asked}
                      onChange={(e) => updateQuestion(q.id, { asked: e.target.checked })}
                      className="mt-1 h-4 w-4 accent-sky-600"
                      title="聞いた"
                    />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${q.asked ? "text-slate-400" : ""}`}>
                        <span className="mr-1 text-xs text-slate-400">Q{idx + 1}.</span>
                        {q.text}
                      </div>
                      {q.intent && (
                        <div className="mt-0.5 text-xs text-sky-700">
                          ねらい: {q.intent}
                        </div>
                      )}
                      <input
                        value={q.note}
                        onChange={(e) => updateQuestion(q.id, { note: e.target.value })}
                        placeholder="回答メモ"
                        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() =>
                        update({
                          questions: interview.questions.filter((x) => x.id !== q.id),
                        })
                      }
                      className="text-xs text-slate-400 hover:text-rose-500"
                      title="削除"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addQuestion();
                  }
                }}
                placeholder="質問を追加"
                className={inputClass}
              />
              <button
                onClick={addQuestion}
                className="shrink-0 rounded-lg border border-sky-600 px-4 py-2 text-sm font-medium text-sky-600 transition hover:bg-sky-50"
              >
                追加
              </button>
            </div>
          </section>
        </div>
      )}

      {tab === "result" && (
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold">判定</h2>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {(Object.keys(JUDGEMENT_LABELS) as Judgement[]).map((j) => (
                <button
                  key={j}
                  onClick={() =>
                    update({ result: { ...interview.result, judgement: j } })
                  }
                  className={`rounded-lg border py-2 text-sm font-medium transition ${
                    interview.result.judgement === j
                      ? `${JUDGEMENT_STYLES[j]} border-transparent`
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {JUDGEMENT_LABELS[j]}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold">観点別評価</h2>
            <div className="mt-3 space-y-4">
              {SCORE_AXES.map((axis) => (
                <div key={axis.key}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{axis.label}</span>
                    <span className="text-xs text-slate-400">{axis.hint}</span>
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() =>
                          updateScore(
                            axis.key,
                            interview.result.scores[axis.key] === n ? 0 : n
                          )
                        }
                        className={`h-9 w-9 rounded-lg border text-sm font-semibold transition ${
                          interview.result.scores[axis.key] >= n
                            ? "border-sky-600 bg-sky-600 text-white"
                            : "border-slate-200 text-slate-400 hover:border-sky-300"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">良かった点</h2>
              <textarea
                value={interview.result.good}
                onChange={(e) =>
                  update({ result: { ...interview.result, good: e.target.value } })
                }
                rows={3}
                className={`${inputClass} mt-2`}
              />
            </div>
            <div>
              <h2 className="text-sm font-semibold">懸念点</h2>
              <textarea
                value={interview.result.concern}
                onChange={(e) =>
                  update({ result: { ...interview.result, concern: e.target.value } })
                }
                rows={3}
                className={`${inputClass} mt-2`}
              />
            </div>
            <div>
              <h2 className="text-sm font-semibold">次の面接への申し送り</h2>
              <textarea
                value={interview.result.handover}
                onChange={(e) =>
                  update({ result: { ...interview.result, handover: e.target.value } })
                }
                rows={3}
                placeholder="2次面接で確認してほしい点など"
                className={`${inputClass} mt-2`}
              />
            </div>
          </section>

          {interview.questions.some((q) => q.note) && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold">面接中の回答メモ</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {interview.questions
                  .filter((q) => q.note)
                  .map((q) => (
                    <li key={q.id} className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">{q.text}</div>
                      <div className="mt-0.5">{q.note}</div>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <button
            onClick={() =>
              update({
                status: interview.status === "done" ? "preparing" : "done",
              })
            }
            className={`w-full rounded-lg py-2.5 text-sm font-semibold transition ${
              interview.status === "done"
                ? "border border-slate-300 text-slate-600 hover:bg-slate-100"
                : "bg-sky-600 text-white hover:bg-sky-700"
            }`}
          >
            {interview.status === "done"
              ? "面接を「準備中」に戻す"
              : "面接完了として記録する"}
          </button>
        </div>
      )}
    </div>
  );
}
