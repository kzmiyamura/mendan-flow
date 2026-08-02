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

export interface Interview {
  id: string;
  candidateName: string;
  position: Position;
  positionDetail: string;
  scheduledAt: string;
  status: "preparing" | "done";
  profileNote: string;
  focusPoints: string;
  checklist: ChecklistItem[];
  questions: Question[];
  result: InterviewResult;
  createdAt: string;
  updatedAt: string;
}
