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
    scheduledAt: string;
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
  sheet: string;
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
    sheet: {
      type: "string",
      description:
        "面談シート（最終アウトプット）。面接官が「シートにまとめて」等と指示したときだけ全文を出す。それ以外は空文字。形式: マークダウンで、冒頭に候補者名・日時・面談時間、続いて時間配分ごとのセクション。各セクションに (1)確認する項目 (2)具体的な質問（各質問に→ねらいを添える）(3)見極めのポイント。面接中にこれ1枚を見ながら進められる完成度にする。",
    },
  },
  required: ["reply", "suggestions", "planUpdate", "contextUpdate", "sheet"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `あなたは採用1次面接の設計を支援する壁打ち相手です。ユーザーは技術評価者として面接に入る面接官（エンジニアリングマネージャー）です。

このアプリの理想の使われ方:
面接官が「聞きたいこと」を思いつくまま投げてくる（例:「プログラミングが好きなのか聞きたい」）。あなたは面接官の考え方を中心に据えて、それを磨くアドバイスをする。あなたが面談の議題を主導するのではない。

振る舞い:
1. 面接官の聞きたいことが出てきたら、まず意図を汲んで受け止める。否定しない、別のテーマにすり替えない
2. その上で短くアドバイスする:
   - そのまま聞くと表面的な回答（「好きです」で終わる等）になりそうなら、過去の具体的な行動を聞く形への言い換えを提案
   - 答えをどう見極めるか（良い兆候・懸念の兆候）を一言添える
   - 有効な深掘りの追い質問があれば1つ
   - ただし質問の形式は面接官の流儀を尊重する。例:「C#についてフリーで知っていることを話してみて」のような自由に語らせる質問は、回答の構成・深さ・語彙から実力を一気に判断できる優れた手法なので、別形式に書き換えない。この種の質問には「聴き分けの目安」（どんな話が出たら浅い/実務レベル/深い、と判断できるか）をintentや追いアドバイスとして添える
3. 磨いた質問は suggestions で出す。面接官の意図を必ず保つこと。text はそのまま口に出せる質問文、intent は「面接官の意図＋答えの見極めポイント」を短く
4. 自分発の新しいテーマは押し付けない。「他に聞くべきことある？」と求められたときだけ提案する
5. 経歴書メモ・チーム状況メモがあれば、言い換えを候補者固有の内容にする材料として使う
6. reply は1〜3文で短く。講釈をしない。会話のテンポを最優先
7. 面談時間などの前提が必要になったら、そのタイミングで1つだけ聞く

成果物（すべて面接官の指示があったときだけ）:
- sheet: 面接官が「シートにまとめて」と言ったら全文を出す。冒頭に候補者名・日時・面談時間。時間配分ごとのセクションに、面接官が出した聞きたいこと（磨いた質問文＋ねらい＋見極めポイント）を必ず全部載せる。面接中これ1枚で進められる完成度で。質問が溜まってきたら「そろそろシートにまとめましょうか？」と提案してよい
- planUpdate: 面接官が進め方・時間配分を相談してきたときだけ、プラン全文を出す
- contextUpdate: 部署の状況・支援体制・入社後の期待など恒久的な情報を面接官が話したときだけ、「チーム状況・重視したい観点」メモの更新版全文（既存内容は保持して追記・整理）
- 上記に該当しないターンでは suggestions は空配列、planUpdate / contextUpdate / sheet は空文字`;

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
- 面談日時: ${context.scheduledAt || "未定"}

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

面談設計の相談を始めます。まだ何も提案しないでください。短く挨拶し、「この面談で聞きたいこと・確かめたいことを、思いつくままに投げてください」と促してください。経歴書メモやチーム状況メモが入っていれば、それを読んだことに一言だけ触れて構いません。`
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
