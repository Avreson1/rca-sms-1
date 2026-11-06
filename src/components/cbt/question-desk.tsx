"use client";

import React, { useEffect, useRef, useState } from "react";
import { FileUp, Plus, TriangleAlert } from "lucide-react";
import { parseCSV } from "@/lib/csv-utils";
import type { CBTQuestionInput } from "@/lib/supabase/db";

/**
 * Where a paper is written.
 *
 * The CBT screen used to have no way into the bank at all: the CSV button only
 * downloaded a blank template, so whatever was on a machine was whatever that
 * machine had been left holding. Everything filed here goes to the school's
 * records, and the questions a candidate is served are the ones the office
 * filed — which is the difference between a paper and a guess.
 */

interface Draft {
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  marks: string;
}

const EMPTY_DRAFT: Draft = { questionText: "", options: ["", "", "", ""], correctOptionIndex: 0, marks: "5" };

interface QuestionDeskProps {
  /** The exam office and the super admin set papers; everyone else sits what they set. */
  canWrite: boolean;
  /** The arms on the school's class list. A paper set for an arm nobody runs cannot be handed to a room. */
  armNames: string[];
  armsSource: "server" | "device";
  /** Files the questions and reports why the school refused them. */
  onFile: (list: Omit<CBTQuestionInput, "id">[]) => Promise<{ ok: boolean; saved: number; reason: string | null }>;
}

export function QuestionDesk({ canWrite, armNames, armsSource, onFile }: QuestionDeskProps) {
  const [subject, setSubject] = useState("");
  const [className, setClassName] = useState(armNames[0] ?? "");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [fileName, setFileName] = useState("");
  const [rowsLoaded, setRowsLoaded] = useState<Record<string, Omit<CBTQuestionInput, "id">[]>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [isFiling, setIsFiling] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The arms arrive a moment after the screen does, so the first one is chosen
  // when it turns up — but only while nothing has been picked, so a desk that
  // was set to an arm stays there however the list is re-read.
  useEffect(() => {
    setClassName((current) => current || armNames[0] || "");
  }, [armNames]);

  if (!canWrite) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1.5">
        <p className="font-bold text-slate-800">Papers are set by the exam office</p>
        <p>
          This desk is read-only for your role, so a question typed here would never reach the school&apos;s bank. The
          paper below is what whoever set it filed; run a sitting from it, or ask the office to change it.
        </p>
      </div>
    );
  }

  const filledOptions = draft.options.map((option) => option.trim()).filter(Boolean);
  const draftMarks = Number(draft.marks);
  const draftProblems: string[] = [];
  if (subject.trim().length < 2) draftProblems.push("name the subject the paper is set for");
  if (className.trim().length < 2) draftProblems.push("choose the class arm it is set for");
  if (draft.questionText.trim().length < 5) draftProblems.push("write the question");
  if (filledOptions.length < 2) draftProblems.push("give at least two options");
  if (draft.correctOptionIndex >= filledOptions.length) draftProblems.push("say which of those options is correct");
  if (!Number.isInteger(draftMarks) || draftMarks < 1 || draftMarks > 100) draftProblems.push("set its marks between 1 and 100");

  const fileQuestion = async () => {
    setIsFiling(true);
    const outcome = await onFile([
      {
        subject: subject.trim(),
        className: className.trim(),
        questionText: draft.questionText.trim(),
        options: filledOptions,
        correctOptionIndex: draft.correctOptionIndex,
        marks: draftMarks,
      },
    ]);
    setIsFiling(false);

    if (!outcome.ok) {
      setMessage({ kind: "bad", text: outcome.reason ?? "the school did not take the question" });
      return;
    }
    // The paper stays open: an office writes a paper question by question, so
    // only the question itself is cleared, not the subject and arm above it.
    setDraft(EMPTY_DRAFT);
    setMessage({ kind: "ok", text: "Question filed on the school's exam bank. It is on this list and on every other machine now." });
  };

  /**
   * Reads a CSV the office exported or typed by hand.
   *
   * Columns are matched by their header words rather than by position, because
   * the file is written in spreadsheets and the order drifts. A row that names
   * its own subject and arm is filed against those, so one file can carry
   * several papers; a row that does not belongs to the paper named above.
   */
  const readFile = (file: File) => {
    setFileName(file.name);
    setMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result ?? "");
      const table = parseCSV(text);
      if (table.length < 2) {
        setMessage({ kind: "bad", text: "The file has a header row and nothing under it, so there was nothing to file." });
        return;
      }

      const header = table[0].map((cell) => cell.toLowerCase());
      const column = (...words: string[]) => header.findIndex((cell) => words.some((word) => cell.includes(word)));
      const subjectCol = column("subject");
      const classCol = column("class", "arm", "year");
      const textCol = column("question");
      const marksCol = column("mark");
      const answerCol = column("correct", "answer");
      const optionCols = [0, 1, 2, 3, 4, 5]
        .map((offset) => {
          const letter = String.fromCharCode(97 + offset);
          // "A", "Option A" and "option-a" are the same column written three ways;
          // a file saved by the screen's own export uses the second.
          return header.findIndex((cell) => {
            const flat = cell.replace(/[^a-z0-9]/g, "");
            return flat === letter || flat === `option${letter}`;
          });
        })
        .filter((index) => index >= 0);

      if (textCol < 0 || optionCols.length < 2 || answerCol < 0 || marksCol < 0) {
        setMessage({
          kind: "bad",
          text: `The file needs a question column, at least two columns headed A, B, C or D, a correct-option column and a marks column. What this one has: ${table[0]
            .filter(Boolean)
            .join(" | ")}.`,
        });
        return;
      }

      const parsed: Omit<CBTQuestionInput, "id">[] = [];
      let skipped = 0;
      for (const row of table.slice(1)) {
        const questionText = (row[textCol] ?? "").trim();
        const options = optionCols.map((index) => (row[index] ?? "").trim()).filter(Boolean);
        // 1 in the file, 0 on the records: a paper typed as "2" is option B.
        const answer = Number((row[answerCol] ?? "").trim());
        const marks = Number((row[marksCol] ?? "").trim());
        const rowSubject = subjectCol >= 0 ? (row[subjectCol] ?? "").trim() : "";
        const rowClass = classCol >= 0 ? (row[classCol] ?? "").trim() : "";

        if (
          questionText.length < 5 ||
          options.length < 2 ||
          !Number.isInteger(answer) ||
          answer < 1 ||
          answer > options.length ||
          !Number.isInteger(marks) ||
          marks < 1 ||
          marks > 100
        ) {
          skipped++;
          continue;
        }

        parsed.push({
          subject: (rowSubject || subject).trim(),
          className: (rowClass || className).trim(),
          questionText,
          options,
          correctOptionIndex: answer - 1,
          marks,
        });
      }

      if (parsed.length === 0) {
        setMessage({
          kind: "bad",
          text: `None of the ${skipped} row${skipped === 1 ? "" : "s"} could be filed — each needs a question, two options, a correct option numbered within them and marks from 1 to 100. Fix the file and load it again.`,
        });
        return;
      }

      setRowsLoaded((current) => ({ ...current, [file.name]: parsed }));
      setMessage({
        kind: "ok",
        text: skipped > 0
          ? `${parsed.length} question${parsed.length === 1 ? "" : "s"} read from ${file.name}; ${skipped} row${skipped === 1 ? "" : "s"} left out because they were not whole questions. Nothing is on the school's bank until you file the paper.`
          : `${parsed.length} question${parsed.length === 1 ? "" : "s"} read from ${file.name}. Nothing is on the school's bank until you file the paper.`,
      });
    };
    reader.onerror = () => setMessage({ kind: "bad", text: "The file could not be read by this browser." });
    reader.readAsText(file);
  };

  const fileLoadedPaper = async () => {
    const list = rowsLoaded[fileName] ?? [];
    if (list.length === 0) return;
    setIsFiling(true);
    const outcome = await onFile(list);
    setIsFiling(false);

    if (!outcome.ok) {
      setMessage({ kind: "bad", text: outcome.reason ?? "the school did not take the paper" });
      return;
    }
    setRowsLoaded((current) => {
      const next = { ...current };
      delete next[fileName];
      return next;
    });
    setMessage({ kind: "ok", text: `${outcome.saved} questions filed on the school's exam bank — every machine now serves this paper.` });
  };

  const loadedRows = rowsLoaded[fileName] ?? [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-1">
        <h3 className="font-bold text-sm text-slate-800">Set a paper</h3>
        <p className="text-[11px] text-slate-500">
          Questions filed here go onto the school&apos;s records and are served to every machine. A question that
          arrives with no answer inside it, or an answer that points past its own options, is refused rather than
          quietly kept.
        </p>
        {armsSource === "device" && (
          <p className="text-[11px] text-amber-800 font-semibold">
            The class arms offered below are this browser&apos;s copy — the school&apos;s own list could not be read. A
            paper set against an arm nobody runs will not be found by a room.
          </p>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Subject this paper is set for</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Mathematics"
              className="mt-1 w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Class arm it is set for</span>
            <select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="mt-1 w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {armNames.length === 0 ? <option value="">No class arm on the school&apos;s list</option> : null}
              {armNames.map((arm) => (
                <option key={arm} value={arm}>
                  {arm}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* One question, typed */}
        <div className="border border-slate-200 rounded-xl p-3 space-y-3">
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Type one question</p>
          <textarea
            value={draft.questionText}
            onChange={(e) => setDraft((d) => ({ ...d, questionText: e.target.value }))}
            rows={2}
            placeholder="What is the capital city of Plateau State?"
            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {draft.options.map((option, index) => (
              <label key={index} className="flex items-center gap-2">
                <input
                  value={option}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((entry, i) => (i === index ? e.target.value : entry)),
                    }))
                  }
                  placeholder={`Option ${String.fromCharCode(65 + index)}${index > 1 ? " (leave blank to drop it)" : ""}`}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Correct option</span>
              <select
                value={draft.correctOptionIndex}
                onChange={(e) => setDraft((d) => ({ ...d, correctOptionIndex: Number(e.target.value) }))}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {filledOptions.length === 0 ? <option value={0}>No options typed yet</option> : null}
                {filledOptions.map((_, index) => (
                  <option key={index} value={index}>
                    {String.fromCharCode(65 + index)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Marks</span>
              <input
                type="number"
                min={1}
                max={100}
                value={draft.marks}
                onChange={(e) => setDraft((d) => ({ ...d, marks: e.target.value }))}
                className="w-24 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </label>
            <button
              type="button"
              onClick={fileQuestion}
              disabled={draftProblems.length > 0 || isFiling}
              title={draftProblems.length > 0 ? `Cannot file yet: ${draftProblems.join(", ")}.` : "File this question on the school's exam bank"}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              File question
            </button>
          </div>
          {draftProblems.length > 0 && (
            <p className="text-[11px] text-slate-500">Not filed yet — first {draftProblems.join(", ")}.</p>
          )}
        </div>

        {/* A whole paper, from a file */}
        <div className="border border-slate-200 rounded-xl p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Load a paper from CSV</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Columns read by their header words: Question Text, Option A to Option D, Correct Option Number (1 = A),
                Marks. Optional Subject and Class columns let one file carry several papers; a row without them joins the
                paper named above.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <FileUp className="w-3.5 h-3.5 text-slate-500" />
              Choose file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {loadedRows.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-bold text-slate-800">
                {fileName}: {loadedRows.length} question{loadedRows.length === 1 ? "" : "s"} read, none filed yet
              </p>
              <ul className="text-[11px] text-slate-600 space-y-0.5 max-h-28 overflow-y-auto">
                {loadedRows.slice(0, 12).map((row, index) => (
                  <li key={index}>
                    {row.subject} · {row.className} · {row.questionText.slice(0, 70)}
                    {row.questionText.length > 70 ? "…" : ""} · option {String.fromCharCode(65 + row.correctOptionIndex)} ·{" "}
                    {row.marks} mk
                  </li>
                ))}
                {loadedRows.length > 12 && <li className="text-slate-500">…and {loadedRows.length - 12} more.</li>}
              </ul>
              <button
                type="button"
                onClick={fileLoadedPaper}
                disabled={isFiling}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-1.5 cursor-pointer"
              >
                File these {loadedRows.length} questions on the school&apos;s bank
              </button>
            </div>
          )}
        </div>

        {message && (
          <div
            className={`rounded-lg px-3 py-2 text-[11px] font-semibold flex items-start gap-2 ${
              message.kind === "ok"
                ? "bg-emerald-50 border border-emerald-300 text-emerald-900"
                : "bg-rose-50 border border-rose-300 text-rose-900"
            }`}
          >
            <TriangleAlert className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{message.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
