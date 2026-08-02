export type Position = "backend" | "frontend" | "infra" | "mobile" | "other";

export type Judgement = "recommend" | "lean_recommend" | "hold" | "reject";

export interface Question {
  id: string;
  text: string;
  intent: string;
  asked: boolean;
  note: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

/** 観点別評価（1〜5、0は未評価） */
export interface Scores {
  technical: number;
  experience: number;
  communication: number;
  ownership: number;
}

export interface InterviewResult {
  judgement: Judgement | null;
  scores: Scores;
  good: string;
  concern: string;
  handover: string;
}

export interface CopilotMessage {
  role: "user" | "assistant";
  /** assistantの場合はSuggestResponseのJSON文字列 */
  content: string;
}

export interface CopilotState {
  messages: CopilotMessage[];
  /** 提案カードの処理状態。キーは `${msgIndex}:s${sugIndex}` または `${msgIndex}:plan` */
  handled: Record<string, "adopted" | "skipped">;
}

export interface Interview {
  id: string;
  candidateName: string;
  position: Position;
  positionDetail: string;
  scheduledAt: string;
  status: "preparing" | "done";
  profileNote: string;
  focusPoints: string;
  /** 面談の進め方（アジェンダ・時間配分・重点テーマ） */
  plan: string;
  copilot: CopilotState;
  /** 最終アウトプット: 時間配分＋項目＋質問がまとまった面談シート */
  sheet: string;
  checklist: ChecklistItem[];
  questions: Question[];
  result: InterviewResult;
  createdAt: string;
  updatedAt: string;
}
