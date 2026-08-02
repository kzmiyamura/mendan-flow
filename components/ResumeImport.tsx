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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");

  async function upload(file: File, pw: string | null) {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("position", position);
    if (pw) formData.append("password", pw);

    try {
      const res = await fetch("/api/import-resume", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.needPassword) {
        // パスワードが必要（または間違い）→ 入力欄を出して再送を待つ
        setPendingFile(file);
        setError(pw ? data.error : null);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `エラーが発生しました (${res.status})`);
        setPendingFile(null);
        return;
      }

      onImported(data as ImportResumeResponse);
      setPendingFile(null);
      setPassword("");
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function cancelPassword() {
    setPendingFile(null);
    setPassword("");
    setError(null);
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
          if (file) {
            setPassword("");
            upload(file, null);
          }
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading || pendingFile !== null}
        className="rounded-lg border border-sky-600 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-50 disabled:border-slate-300 disabled:text-slate-400"
      >
        {loading ? "読み込み中…" : "📄 経歴書ファイルから読み込む"}
      </button>
      <span className="ml-2 text-xs text-slate-400">PDF / テキスト / 画像</span>

      {pendingFile && !loading && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="text-xs font-medium text-amber-900">
            🔒 「{pendingFile.name}」はパスワードで保護されています
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && password && !loading) {
                  e.preventDefault();
                  upload(pendingFile, password);
                }
              }}
              placeholder="PDFのパスワード"
              autoFocus
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={() => upload(pendingFile, password)}
              disabled={!password || loading}
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:bg-slate-300"
            >
              解除して読み込む
            </button>
            <button
              onClick={cancelPassword}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 transition hover:bg-slate-100"
            >
              キャンセル
            </button>
          </div>
          <p className="mt-1.5 text-xs text-amber-700">
            パスワードは解除にのみ使用し、保存や外部送信はしません。
          </p>
        </div>
      )}

      {loading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
          Claudeが分析中…（30秒〜1分ほどかかります）
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
