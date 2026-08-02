import { query } from "@anthropic-ai/claude-agent-sdk";
import { NextResponse } from "next/server";

export interface SuggestRequest {
  context: {
    candidateName: string;
    position: string;
    positionDetail: string;
    profileNote: string;
    focusPoints: string;
    plan: string;
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
  planUpdate: string;
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description:
        "面接官への会話の返答。簡潔に（3文程度まで）。判断を仰ぐ問いかけは1つに絞る。",
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
      description: "質問を提案するときだけ0〜3個。しないときは空配列。",
    },
    planUpdate: {
      type: "string",
      description:
        "面談の進行プラン全体の提案。進め方・時間配分を提案または修正するときだけ、プラン全文をマークダウン箇条書きで（時間配分付き）。変更しないときは空文字。",
    },
  },
  required: ["reply", "suggestions", "planUpdate"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `あなたはIT企業の経験豊富なエンジニアリングマネージャーの相棒として、採用1次面接の「面談設計」を面接官と会話しながら一緒に決めていきます。ユーザーは技術評価者として1次面接に入る面接官です。

一緒に決めていくこと:
- 面談の進め方（アジェンダ・時間配分・重点テーマ）→ planUpdate で提案
- 候補者に合わせた質問 → suggestions で提案
- 評価の観点や懸念の擦り合わせ → reply の会話の中で

会話のスタンス:
- 一方的に完成品を押し付けず、会話で決めていく。提案には「なぜそうするか」を短く添え、判断が分かれる点は面接官に問いかける（問いかけは1回に1つ）
- 経歴メモ・深掘りポイント・現在のプラン・既存質問を必ず踏まえ、その候補者に固有の内容にする
- 面談時間が不明なら早めに確認する（時間配分の前提になるため）
- planUpdate は進行プランを提案・修正するときだけ全文を出す（部分差分ではなく反映すればそのまま使える全文）。変更がなければ空文字
- suggestions は質問を提案するときだけ0〜3個。既存質問と重複しない。質問文はそのまま口に出せる自然な日本語で
- reply は簡潔に。長い説明はプランや質問の中に入れる`;

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

# 現在の面談プラン
${context.plan || "（未作成）"}

# 既にリストにある質問（重複を避けること）
${context.existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n") || "（なし）"}`;

  const transcript = chat
    .map((m) =>
      m.role === "user"
        ? `面接官: ${m.content}`
        : `あなたの過去の応答(JSON): ${m.content}`
    )
    .join("\n\n");

  const prompt =
    chat.length === 0
      ? `${contextText}

候補者情報を踏まえて、この面談の設計を始めてください。まず進め方の叩き台（planUpdate）を出し、前提として確認したいこと（面談時間など）があれば1つだけ聞いてください。`
      : `${contextText}

# これまでの相談のやり取り
${transcript}

最後の面接官の発言を踏まえて応答してください。`;

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
          error: `応答の生成に失敗しました${failureReason ? `（${failureReason}）` : ""}。もう一度お試しください。`,
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
          "Claudeの実行に失敗しました。このマシンでClaude Codeにログイン済みか確認してください。",
      },
      { status: 500 }
    );
  }
}
