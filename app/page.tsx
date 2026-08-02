"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Interview } from "@/lib/types";
import {
  getInterviewsSnapshot,
  getServerInterviewsSnapshot,
  subscribeInterviews,
} from "@/lib/storage";
import {
  JUDGEMENT_LABELS,
  JUDGEMENT_STYLES,
  POSITION_LABELS,
} from "@/lib/data";

function formatDate(iso: string): string {
  if (!iso) return "日時未定";
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InterviewCard({ interview }: { interview: Interview }) {
  const judgement = interview.result.judgement;
  return (
    <Link
      href={`/interviews/${interview.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{interview.candidateName}</div>
          <div className="mt-0.5 text-sm text-slate-500">
            {POSITION_LABELS[interview.position]}
            {interview.positionDetail && ` / ${interview.positionDetail}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-600">
            {formatDate(interview.scheduledAt)}
          </div>
          {interview.status === "done" && judgement && (
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${JUDGEMENT_STYLES[judgement]}`}
            >
              {JUDGEMENT_LABELS[judgement]}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const interviews = useSyncExternalStore(
    subscribeInterviews,
    getInterviewsSnapshot,
    getServerInterviewsSnapshot
  );
  const loaded = useSyncExternalStore(
    subscribeInterviews,
    () => true,
    () => false
  );

  const upcoming = interviews
    .filter((i) => i.status === "preparing")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const done = interviews
    .filter((i) => i.status === "done")
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">面接一覧</h1>
        <Link
          href="/interviews/new"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          + 面接を登録
        </Link>
      </div>

      {loaded && interviews.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          <p className="font-medium">まだ面接が登録されていません</p>
          <p className="mt-1 text-sm">
            「面接を登録」から候補者情報を入れると、質問テンプレートと準備チェックリストが自動でセットされます。
          </p>
        </div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-500">
            準備中・面接予定（{upcoming.length}）
          </h2>
          <div className="space-y-2">
            {upcoming.map((i) => (
              <InterviewCard key={i.id} interview={i} />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-500">
            実施済み（{done.length}）
          </h2>
          <div className="space-y-2">
            {done.map((i) => (
              <InterviewCard key={i.id} interview={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
