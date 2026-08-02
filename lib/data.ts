import { Judgement, Position, Scores } from "./types";

export const POSITION_LABELS: Record<Position, string> = {
  backend: "バックエンド",
  frontend: "フロントエンド",
  infra: "インフラ / SRE",
  mobile: "モバイル",
  other: "その他",
};

export const JUDGEMENT_LABELS: Record<Judgement, string> = {
  recommend: "推薦",
  lean_recommend: "やや推薦",
  hold: "保留",
  reject: "見送り",
};

export const JUDGEMENT_STYLES: Record<Judgement, string> = {
  recommend: "bg-emerald-100 text-emerald-800",
  lean_recommend: "bg-sky-100 text-sky-800",
  hold: "bg-amber-100 text-amber-800",
  reject: "bg-rose-100 text-rose-800",
};

export const SCORE_AXES: { key: keyof Scores; label: string; hint: string }[] = [
  { key: "technical", label: "技術力", hint: "スキルの深さ・正確さ" },
  { key: "experience", label: "経歴の整合性", hint: "話の内容と経歴書が一致しているか" },
  { key: "communication", label: "コミュニケーション", hint: "説明のわかりやすさ・質疑の噛み合い" },
  { key: "ownership", label: "自走力・学習意欲", hint: "キャッチアップ姿勢・主体性" },
];

export const DEFAULT_CHECKLIST: string[] = [
  "職務経歴書・スキルシートを読み込んだ",
  "深掘りしたいポイントを洗い出した",
  "質問リストを確認・調整した",
  "募集ポジションの要件を再確認した",
  "時間配分（自己紹介・質疑・逆質問）を決めた",
];

const COMMON_QUESTIONS: { text: string; intent: string }[] = [
  { text: "直近のプロジェクトでの役割と担当範囲を教えてください", intent: "経歴の実態確認・盛りの検出" },
  { text: "技術的に一番苦労した課題と、どう解決したかを教えてください", intent: "問題解決力・技術の深さ" },
  { text: "チーム開発での立ち回り（レビュー・設計議論など）を教えてください", intent: "協働スタイル" },
  { text: "最近キャッチアップした技術と、その学び方を教えてください", intent: "学習意欲・自走力" },
  { text: "障害やトラブル対応の経験があれば教えてください", intent: "実務経験の深さ・冷静さ" },
];

export const QUESTION_TEMPLATES: Record<Position, { text: string; intent: string }[]> = {
  backend: [
    ...COMMON_QUESTIONS,
    { text: "DB設計で意識していることを教えてください", intent: "インデックス・正規化などの基礎理解" },
    { text: "API設計で気をつけている点を教えてください", intent: "認証・エラーハンドリング・互換性の意識" },
    { text: "パフォーマンス改善の経験があれば、ボトルネック特定の手順を教えてください", intent: "計測ドリブンで動けるか" },
  ],
  frontend: [
    ...COMMON_QUESTIONS,
    { text: "状態管理の設計方針と、その選択理由を教えてください", intent: "技術選定の判断力" },
    { text: "レンダリングやバンドルサイズなど、パフォーマンス改善の経験を教えてください", intent: "フロント特有の性能理解" },
    { text: "アクセシビリティやUXで意識していることを教えてください", intent: "ユーザー視点の有無" },
  ],
  infra: [
    ...COMMON_QUESTIONS,
    { text: "IaC（Terraformなど）の運用経験を教えてください", intent: "コード化された運用の経験" },
    { text: "監視・アラート設計の考え方を教えてください", intent: "SLO・ノイズ制御の理解" },
    { text: "障害対応のフロー（一次対応〜恒久対応）を経験ベースで教えてください", intent: "実践的な運用力" },
  ],
  mobile: [
    ...COMMON_QUESTIONS,
    { text: "OSアップデートや端末差異への対応経験を教えてください", intent: "モバイル特有の運用理解" },
    { text: "ストア申請・リリースフローの経験を教えてください", intent: "リリース運用の実務経験" },
    { text: "クラッシュやパフォーマンスの監視・改善経験を教えてください", intent: "品質への意識" },
  ],
  other: [...COMMON_QUESTIONS],
};
