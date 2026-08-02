import { query } from "@anthropic-ai/claude-agent-sdk";
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
          intent: {
            type: "string",
            description: "この質問で何を見極めたいか（短く）",
          },
        },
        required: ["text", "intent"],
        additionalProperties: false,
      },
    },
  },
  required: ["reply", "suggestions"],
  additionalProperties: false,
};

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
${context.existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n") || "（なし）"}`;

  const transcript = chat
    .map((m) =>
      m.role === "user"
        ? `面接官: ${m.content}`
        : `あなたの過去の提案(JSON): ${m.content}`
    )
    .join("\n\n");

  const prompt =
    chat.length === 0
      ? `${contextText}\n\nこの候補者向けの質問を一緒に考えてください。まず候補者情報から気になる点を踏まえて提案してください。`
      : `${contextText}\n\n# これまでの壁打ちのやり取り\n${transcript}\n\n最後の面接官の発言を踏まえて、次の提案をしてください。`;

  try {
    let structured: unknown = null;
    let failureReason: string | null = null;

    for await (const message of query({
      prompt,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        maxTurns: 1,
        tools: [],
        outputFormat: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
    })) {
      if (message.type === "result") {
        if (message.subtype === "success") {
          structured = message.structured_output;
        } else {
          failureReason = message.subtype;
        }
      }
    }

    if (!structured) {
      return NextResponse.json(
        {
          error: `提案の生成に失敗しました${failureReason ? `（${failureReason}）` : ""}。もう一度お試しください。`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(structured as SuggestResponse);
  } catch (error) {
    console.error("suggest route error:", error);
    return NextResponse.json(
      {
        error:
          "Claudeの実行に失敗しました。このマシンでClaude Codeにログイン済みか（claude /login）確認してください。",
      },
      { status: 500 }
    );
  }
}
