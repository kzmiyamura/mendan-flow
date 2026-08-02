import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export interface SuggestRequest {
  context: {
    candidateName: string;
    position: string;
    positionDetail: string;
    profileNote: string;
    focusPoints: string;
    existingQuestions: string[];
  };
  chat: { role: "user" | "assistant"; content: string }[];
}

export interface Suggestion {
  text: string;
  intent: string;
}

export interface SuggestResponse {
  reply: string;
  suggestions: Suggestion[];
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description:
        "面接官への短い返答。提案の狙いや、候補者情報から読み取ったポイントを1〜3文で。",
    },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "質問文そのもの" },
          intent: { type: "string", description: "この質問で何を見極めたいか（短く）" },
        },
        required: ["text", "intent"],
        additionalProperties: false,
      },
    },
  },
  required: ["reply", "suggestions"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `あなたはIT企業の経験豊富なエンジニアリングマネージャーの壁打ち相手です。
ユーザーは採用の1次面接に技術評価者として入る面接官で、候補者への質問リストを一緒に練り上げようとしています。

役割:
- 候補者の経歴メモ・深掘りポイントを踏まえ、その候補者に固有の質問を提案する（汎用質問の焼き直しは避ける）
- 経歴の曖昧な点・盛っていそうな点を見抜く質問、実務の深さを確かめる質問を重視する
- 既にリストにある質問と重複しない
- 1回の応答で質問案は1〜3個。数より質
- ユーザーが方向性を指定したら（例:「もっとチーム面を聞きたい」）、その角度で提案し直す
- 質問文は面接でそのまま口に出せる自然な日本語にする`;

export async function POST(req: Request) {
  let body: SuggestRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { context, chat } = body;

  const contextText = `# 候補者情報
- 名前: ${context.candidateName}
- 応募ポジション: ${context.position}${context.positionDetail ? ` / ${context.positionDetail}` : ""}

# 経歴・スキルシートのメモ
${context.profileNote || "（未記入）"}

# 深掘りしたいポイント
${context.focusPoints || "（未記入）"}

# 既にリストにある質問（重複を避けること）
${context.existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n") || "（なし）"}

この候補者向けの質問を一緒に考えてください。まず候補者情報から気になる点を踏まえて提案してください。`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: contextText },
    ...chat.map((m) => ({ role: m.role, content: m.content })),
  ];

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "モデルから回答を取得できませんでした" },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(textBlock.text) as SuggestResponse;
    return NextResponse.json(parsed);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "APIキーが未設定または無効です。.env.local の ANTHROPIC_API_KEY を確認してください。" },
        { status: 401 }
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "レート制限中です。少し待ってから再試行してください。" },
        { status: 429 }
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude APIエラー: ${error.message}` },
        { status: 502 }
      );
    }
    throw error;
  }
}
