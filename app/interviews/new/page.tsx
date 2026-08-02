"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Interview, Position } from "@/lib/types";
import { uid, upsertInterview } from "@/lib/storage";
import {
  DEFAULT_CHECKLIST,
  POSITION_LABELS,
  QUESTION_TEMPLATES,
} from "@/lib/data";

export default function NewInterview() {
  const router = useRouter();
  const [candidateName, setCandidateName] = useState("");
  const [position, setPosition] = useState<Position>("backend");
  const [positionDetail, setPositionDetail] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [profileNote, setProfileNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const interview: Interview = {
      id: uid(),
      candidateName: candidateName.trim(),
      position,
      positionDetail: positionDetail.trim(),
      scheduledAt,
      status: "preparing",
      profileNote,
      focusPoints: "",
      checklist: DEFAULT_CHECKLIST.map((label) => ({
        id: uid(),
        label,
        done: false,
      })),
      questions: QUESTION_TEMPLATES[position].map((q) => ({
        id: uid(),
        text: q.text,
        intent: q.intent,
        asked: false,
        note: "",
      })),
      result: {
        judgement: null,
        scores: { technical: 0, experience: 0, communication: 0, ownership: 0 },
        good: "",
        concern: "",
        handover: "",
      },
      createdAt: now,
      updatedAt: now,
    };
    upsertInterview(interview);
    router.push(`/interviews/${interview.id}`);
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none";

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        ← 一覧に戻る
      </Link>
      <h1 className="mt-2 text-xl font-bold">面接を登録</h1>
      <p className="mt-1 text-sm text-slate-500">
        ポジションに応じた質問テンプレートと準備チェックリストが自動でセットされます。
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">候補者名 *</label>
          <input
            required
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            placeholder="山田 太郎"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              ポジション *
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
              className={inputClass}
            >
              {(
                Object.entries(POSITION_LABELS) as [Position, string][]
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">面接日時</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            ポジション補足
          </label>
          <input
            value={positionDetail}
            onChange={(e) => setPositionDetail(e.target.value)}
            placeholder="例: 決済チーム / Go・AWS"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            経歴・スキルシートのメモ
          </label>
          <textarea
            value={profileNote}
            onChange={(e) => setProfileNote(e.target.value)}
            rows={5}
            placeholder="経歴書を読んで気になった点、確認したい経験など（後からでも編集できます）"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          登録して準備を始める
        </button>
      </form>
    </div>
  );
}
