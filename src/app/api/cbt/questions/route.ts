import { NextResponse } from "next/server";
import { requireRole, requireRoleSession } from "@/lib/auth/guard";
import {
  databaseSetupRequired,
  databaseUnavailable,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SQL_FILE = "supabase/cbt.sql";

// A question is read by whoever sits it, which in this portal includes the
// family login — the paper is served to the browser that marks it, so blocking
// the candidate from the bank would only stop the sitting from running.
const READ_QUESTIONS = ["SUPER_ADMIN", "EXAM_OFFICER", "TEACHER", "ACCOUNTANT", "STUDENT_PARENT", "TESTERS"] as const;
// Setting a paper is the exam office's job. A teacher may read the bank and run
// a sitting, but the questions a whole school is examined on are filed here by
// two roles, the same two that file the subject packages.
const WRITE_QUESTIONS = ["SUPER_ADMIN", "EXAM_OFFICER"] as const;

const INTEGER_ID = /^\d+$/;

const SUBJECT_MAX = 255;
const CLASS_MAX = 100;
const QUESTION_MAX = 4000;
const OPTION_MAX = 500;
const OPTION_MIN_COUNT = 2;
const OPTION_MAX_COUNT = 6;

type QuestionPayload = {
  id?: unknown;
  subject?: unknown;
  class_name?: unknown;
  question_text?: unknown;
  options?: unknown;
  correct_option_index?: unknown;
  marks?: unknown;
};

type QuestionRow = {
  id: number;
  subject: string;
  class_name: string;
  question_text: string;
  options: string[] | null;
  correct_answer_index: number;
  marks: number;
};

/**
 * The questions on the school's records, in subject then paper order.
 *
 * A browser used to hold its own bank, so the exam office could set a paper on
 * one machine and the room two doors away would sit whatever its own cache had
 * picked up. Whatever is filed here is what every machine serves.
 */
export async function GET() {
  const denied = await requireRole(READ_QUESTIONS);
  if (denied) return denied;

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data, error } = await supabase
    .from("cbt_questions")
    .select("*")
    .order("subject")
    .order("class_name")
    .order("id");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  const rows = ((data ?? []) as unknown as QuestionRow[]).map((row) => ({
    ...row,
    options: Array.isArray(row.options) ? row.options : [],
  }));

  return NextResponse.json({ success: true, data: rows });
}

/**
 * Files questions. Re-sending one with its id corrects that question, so a
 * badly-worded paper can be fixed without deleting the sitting that used it.
 *
 * The file is accepted as one row or an array: the screen adds a question at a
 * time, and the CSV import brings a whole paper in one go.
 */
export async function POST(request: Request) {
  const access = await requireRoleSession(WRITE_QUESTIONS);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) {
    return NextResponse.json({ success: false, error: "No question was sent." }, { status: 400 });
  }
  if (list.length > 200) {
    return NextResponse.json(
      { success: false, error: "Too many questions in one submission (max 200). Split the paper into smaller files." },
      { status: 400 }
    );
  }

  const rows: Omit<QuestionRow, "id">[] = [];
  const ids: (number | null)[] = [];

  for (const [index, item] of (list as QuestionPayload[]).entries()) {
    const where = `Row ${index + 1}`;

    const subject = typeof item?.subject === "string" ? item.subject.trim() : "";
    if (subject.length < 2) {
      return NextResponse.json(
        { success: false, error: `${where}: a question needs the subject it is set for, so the paper can be named.` },
        { status: 400 }
      );
    }

    const className = typeof item?.class_name === "string" ? item.class_name.trim() : "";
    if (className.length < 2) {
      return NextResponse.json(
        { success: false, error: `“${subject}”: ${where} needs the class arm it is set for. A paper with no year group cannot be handed to a room.` },
        { status: 400 }
      );
    }

    const questionText = typeof item?.question_text === "string" ? item.question_text.trim() : "";
    if (questionText.length < 5) {
      return NextResponse.json(
        { success: false, error: `“${subject}”: ${where} has no question worth answering (at least five characters).` },
        { status: 400 }
      );
    }

    const options = Array.isArray(item?.options)
      ? item.options.map((option) => (typeof option === "string" ? option.trim() : "")).filter(Boolean)
      : [];
    if (options.length < OPTION_MIN_COUNT || options.length > OPTION_MAX_COUNT) {
      return NextResponse.json(
        {
          success: false,
          error: `“${subject}”: ${where} has ${options.length} option${options.length === 1 ? "" : "s"}. A CBT question needs between ${OPTION_MIN_COUNT} and ${OPTION_MAX_COUNT} that are not blank.`,
        },
        { status: 400 }
      );
    }

    const correctIndex = Number(item?.correct_option_index);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      return NextResponse.json(
        {
          success: false,
          error: `“${subject}”: ${where} marks option ${String(item?.correct_option_index)} as correct, and there are only ${options.length} options (numbered 1 to ${options.length}). Nothing on this paper would be scored.`,
        },
        { status: 400 }
      );
    }

    const marks = Number(item?.marks);
    if (!Number.isInteger(marks) || marks < 1 || marks > 100) {
      return NextResponse.json(
        { success: false, error: `“${subject}”: ${where} carries ${item?.marks ?? "(nothing)"} marks. Use a whole number from 1 to 100.` },
        { status: 400 }
      );
    }

    const sentId = typeof item?.id === "number" || typeof item?.id === "string" ? String(item.id).trim() : "";
    const id = INTEGER_ID.test(sentId) ? Number(sentId) : null;
    // A row edited on screen arrives with the id this route gave it. A row whose
    // id is text was invented by a browser that has never seen the bank, and
    // would otherwise update whichever question happens to hold that number.
    if (sentId.length > 0 && id === null) {
      return NextResponse.json(
        { success: false, error: `“${subject}”: ${where} carries a number no question on the school's bank has (${sentId}). Reload the page before editing it.` },
        { status: 400 }
      );
    }

    rows.push({
      subject: subject.slice(0, SUBJECT_MAX),
      class_name: className.slice(0, CLASS_MAX),
      question_text: questionText.slice(0, QUESTION_MAX),
      options: options.map((option) => option.slice(0, OPTION_MAX)),
      correct_answer_index: correctIndex,
      marks,
    });
    ids.push(id);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const saved: QuestionRow[] = [];
  for (const [index, columns] of rows.entries()) {
    const id = ids[index];
    const stamped = { ...columns, updated_at: new Date().toISOString() };
    const query = id
      ? supabase.from("cbt_questions").update(stamped).eq("id", id)
      : supabase.from("cbt_questions").insert(stamped);

    const { data, error } = await query.select("*");
    if (error) {
      const setup = databaseSetupRequired(error, SQL_FILE);
      if (setup) return setup;
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    if (data) saved.push(...(data as unknown as QuestionRow[]));
  }

  return NextResponse.json({ success: true, data: saved });
}

/**
 * Removes questions from the bank.
 *
 * A sitting already filed keeps its own score in cbt_exam_sessions, so taking a
 * question away does not rewrite a result — it stops the paper being set again.
 */
export async function DELETE(request: Request) {
  const access = await requireRoleSession(WRITE_QUESTIONS);
  if (access.denied) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const sent = (body ?? {}) as { ids?: unknown };
  const raw = Array.isArray(sent.ids) ? sent.ids : [];
  const ids = raw.map((id) => String(id).trim()).filter((id) => INTEGER_ID.test(id)).map(Number);
  if (ids.length === 0) {
    return NextResponse.json(
      { success: false, error: "No question on this device has a number on the school's bank, so nothing was removed. Reload the page." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return databaseUnavailable();

  const { data: removed, error } = await supabase
    .from("cbt_questions")
    .delete()
    .in("id", ids)
    .select("id");
  if (error) {
    const setup = databaseSetupRequired(error, SQL_FILE);
    if (setup) return setup;
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, data: { removed: removed?.length ?? 0 } });
}
