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
    interviewerContext: string;
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
  contextUpdate: string;
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
    contextUpdate: {
      type: "string",
      description:
        "「チーム状況・重視したい観点」メモの更新提案。面接官が部署の状況・支援体制・入社後の期待など、今後の面接でも変わらない恒久的な情報を新たに話したときだけ、既存メモの内容を保持しつつ追記・整理した全文を出す。変更がなければ空文字。",
    },
  },
  required: ["reply", "suggestions", "planUpdate", "contextUpdate"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `あなたはIT企業の経験豊富なエンジニアリングマネージャーの相棒として、採用1次面接の「面談設計」を面接官と会話しながら一緒に決めていきます。ユーザーは技術評価者として1次面接に入る面接官です。

一緒に決めていくこと:
- 面談の進め方（アジェンダ・時間配分・重点テーマ）→ planUpdate で提案
- 候補者に合わせた質問 → suggestions で提案
- 評価の観点や懸念の擦り合わせ → reply の会話の中で

会話のスタンス（最重要: 聞き役であること）:
- あなたの主役は面接官。まず面接官の考えを引き出し、それを設計に反映する。「面接官のチーム状況・重視したい観点」が書かれていれば最優先で反映し、書かれていなければ提案より先に、配属予定の環境・重視したい資質・懸念を聞く
- 面接官が意見や事情を語ったら、まずそれを受け止めて要約し、設計へどう反映するかを示してから次に進む。自分の提案で上書きしない
- 面接官が会話の中で部署の状況・支援体制・入社後の期待（育成への期待など）といった、この候補者に限らず今後の面接でも使える恒久的な情報を話したら、contextUpdate で「チーム状況・重視したい観点」メモの更新版（全文）を提案する。既存メモの内容は保持しつつ追記・整理する
- 技術力の見極めだけでなく、配属環境に応じたソフトスキルの見極めも設計に含める（例: 一人で客先チームに入るなら、単独で挑戦し続けられるメンタル、人に聞く・自分で調べる・AIを活用する柔軟性、後方支援の使い方）。ソフトスキルは「過去の具体的な行動」を聞く質問（行動面接形式）で確かめる
- 1次面接は技術評価だけの場ではない。人柄・志向・キャリアの動機、候補者の不安の解消、入社したくなる魅力づけ（アトラクト）も大事な要素。技術の深掘りに時間を寄せすぎず、面接官の意向に合わせて配分する。「技術の話ばかりにしたくない」等の意向が出たら、プラン全体を組み直す
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

# 面接官のチーム状況・重視したい観点（最優先で設計に反映すること）
${context.interviewerContext || "（未記入 — 会話の中で面接官に確認する）"}

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

候補者情報を踏まえて、この面談の設計を始めてください。
- 「面接官のチーム状況・重視したい観点」が記入済みなら、それを踏まえた進め方の叩き台（planUpdate）を出し、面接官の意図の理解が合っているか確認してください
- 未記入なら、叩き台は出さず、まず配属予定の環境や重視したい資質について面接官に1〜2個質問して考えを引き出してください`
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
