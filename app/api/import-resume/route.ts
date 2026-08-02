import { query } from "@anthropic-ai/claude-agent-sdk";
import { NextResponse } from "next/server";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export interface ImportResumeResponse {
  profileNote: string;
  focusPoints: string;
}

const ALLOWED_EXTENSIONS = ["pdf", "txt", "md", "png", "jpg", "jpeg"];

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    profileNote: {
      type: "string",
      description:
        "面接準備メモとして使える経歴の要約。経歴サマリ、主要スキルと経験年数、直近のプロジェクト内容を箇条書き中心で。",
    },
    focusPoints: {
      type: "string",
      description:
        "面接で深掘りすべきポイントの箇条書き。曖昧な記述、期間や役割の不整合、盛っている可能性のある箇所、ポジション要件とのギャップなど。各項目に「なぜ気になるか」を添える。",
    },
  },
  required: ["profileNote", "focusPoints"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `あなたはIT企業のエンジニアリングマネージャーの面接準備アシスタントです。
ユーザーは採用1次面接に技術評価者として入る面接官で、候補者の経歴書（職務経歴書・スキルシート）を読み込んで面接準備をしようとしています。

経歴書を読んだら、次の2つを日本語で作成してください:
1. profileNote — 面接中に手元で参照する経歴メモ。経歴サマリ・主要スキルと年数・直近プロジェクトを簡潔な箇条書きで
2. focusPoints — 技術評価者として深掘りすべきポイント。曖昧な役割記述、経歴とスキルの不整合、実務の深さが不明な箇所、応募ポジションとのギャップを、「なぜ気になるか」とセットで

評価や合否の推測はせず、事実の整理と確認すべき点の洗い出しに徹してください。`;

export async function POST(req: Request) {
  let file: File;
  let position: string;
  try {
    const formData = await req.formData();
    const f = formData.get("file");
    if (!(f instanceof File)) throw new Error("no file");
    file = f;
    position = String(formData.get("position") ?? "");
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `対応形式は PDF / テキスト / 画像 です（.${ext} は未対応）` },
      { status: 400 }
    );
  }

  const dir = await mkdtemp(join(tmpdir(), "mendan-resume-"));
  const filePath = join(dir, `resume.${ext}`);
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  try {
    let structured: unknown = null;
    let failureReason: string | null = null;

    for await (const message of query({
      prompt: `候補者の経歴書ファイルを Read ツールで読んで分析してください。
ファイルパス: ${filePath}
応募ポジション: ${position || "（未指定）"}`,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        tools: ["Read"],
        allowedTools: ["Read"],
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
          error: `経歴書の分析に失敗しました${failureReason ? `（${failureReason}）` : ""}。もう一度お試しください。`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(structured as ImportResumeResponse);
  } catch (error) {
    console.error("import-resume route error:", error);
    return NextResponse.json(
      {
        error:
          "Claudeの実行に失敗しました。このマシンでClaude Codeにログイン済みか確認してください。",
      },
      { status: 500 }
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
