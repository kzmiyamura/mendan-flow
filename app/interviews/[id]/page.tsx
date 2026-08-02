"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Interview, Judgement, Scores } from "@/lib/types";
import {
  deleteInterview,
  getInterviewsSnapshot,
  getServerInterviewsSnapshot,
  subscribeInterviews,
  upsertInterview,
} from "@/lib/storage";
import {
  JUDGEMENT_LABELS,
  JUDGEMENT_STYLES,
  POSITION_LABELS,
  SCORE_AXES,
} from "@/lib/data";
import InterviewCopilot from "@/components/InterviewCopilot";

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

  function updateScore(key: keyof Scores, value: number) {
    update({
      result: {
        ...interview!.result,
        scores: { ...interview!.result.scores, [key]: value },
      },
    });
  }

  function handleDelete() {
    if (!confirm(`「${interview!.candidateName}」の面接を削除しますか？`)) return;
    deleteInterview(interview!.id);
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
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

      {/* タブ切替でアンマウントしない（考え中のチャットが止まって見えるため）。CSSで隠すだけにする */}
      <div className={tab === "prep" ? "" : "hidden"}>
        <InterviewCopilot interview={interview} onUpdate={update} />
      </div>

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
