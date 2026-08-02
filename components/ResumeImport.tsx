"use client";

import { useRef, useState } from "react";
import type { ImportResumeResponse } from "@/app/api/import-resume/route";

export default function ResumeImport({
  position,
  onImported,
}: {
  position: string;
  onImported: (result: ImportResumeResponse) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("position", position);

    try {
      const res = await fetch("/api/import-resume", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `エラーが発生しました (${res.status})`);
        return;
      }
      onImported(data as ImportResumeResponse);
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="rounded-lg border border-sky-600 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-50 disabled:border-slate-300 disabled:text-slate-400"
      >
        {loading ? "読み込み中…" : "📄 経歴書ファイルから読み込む"}
      </button>
      <span className="ml-2 text-xs text-slate-400">PDF / テキスト / 画像</span>

      {loading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
          {fileName} をClaudeが分析中…（30秒〜1分ほどかかります）
        </div>
      )}
      {error && (
        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}
