"use client";

/**
 * Universal CSV Export Helper
 * Creates a downloadable .csv file in the browser with proper BOM and UTF-8 encoding.
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][]
) {
  if (typeof window === "undefined") return;

  const escapeCell = (val: string | number | undefined | null) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = headers.map(escapeCell).join(",");
  const dataRows = rows.map((row) => row.map(escapeCell).join(","));
  const csvContent = "\uFEFF" + [headerRow, ...dataRows].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Universal CSV Parser
 * Handles commas, quotes, newlines, and trims rows.
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      row.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // skip \n in CRLF
      }
      row.push(currentCell.trim());
      if (row.some((cell) => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  // push last cell/row
  if (currentCell.length > 0 || row.length > 0) {
    row.push(currentCell.trim());
    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

/**
 * Pre-formatted Sample CSV Templates for Institutional Uploads
 */
export function downloadSampleTemplate(
  templateType: "students" | "staff" | "ca_scores" | "cbt_questions"
) {
  switch (templateType) {
    case "students":
      exportToCSV(
        "rca_students_enrollment_template.csv",
        [
          "Full Name",
          "Class (e.g. Pre-Play Class, Nursery 1, Primary 5, SS 2A)",
          "Gender (Male/Female)",
          "Guardian Name",
          "Guardian Phone",
          "Sports House (Sapphire, Ruby, Emerald, Topaz)",
          "Fee Status (Fully Cleared, Partially Paid, Outstanding)",
        ],
        [
          [
            "Ibrahim Fatima Zahra",
            "Primary 3",
            "Female",
            "Alhaji Ibrahim Z.",
            "08053334455",
            "Sapphire (Blue)",
            "Fully Cleared",
          ],
          [
            "Samuel Joshua Pam",
            "Nursery 2",
            "Male",
            "Engr. Joshua Pam",
            "08021113322",
            "Ruby (Red)",
            "Partially Paid",
          ],
          [
            "Amina Sani Bello",
            "Primary 5",
            "Female",
            "Dr. Sani Bello",
            "07038889900",
            "Topaz (Yellow)",
            "Fully Cleared",
          ],
        ]
      );
      break;

    case "staff":
      exportToCSV(
        "rca_staff_onboarding_template.csv",
        [
          "Full Legal Name",
          "Email Address",
          "Phone Number",
          "Role (SUPER_ADMIN, EXAM_OFFICER, TEACHER, ACCOUNTANT)",
          "Primary Teaching Subject",
          "Assigned Form Class Arm",
          "Is Form Master? (Yes/No)",
        ],
        [
          [
            "Mrs. Esther Pam",
            "esther.pam@royalcrownacademy.edu.ng",
            "08031234567",
            "TEACHER",
            "Early Childhood Phonics",
            "Nursery 1",
            "Yes",
          ],
          [
            "Mr. Daniel Chollom",
            "daniel.chollom@royalcrownacademy.edu.ng",
            "08149876543",
            "TEACHER",
            "Mathematics & Quantitative Reasoning",
            "Primary 3",
            "Yes",
          ],
        ]
      );
      break;

    case "ca_scores":
      exportToCSV(
        "rca_ca_score_sheet_template.csv",
        [
          "Admission No",
          "Student Full Name",
          "1st Test (Max 10)",
          "2nd Test (Max 10)",
          "Project (Max 10)",
          "Mid-Term (Max 10)",
          "Exam / CBT (Max 60)",
        ],
        [
          ["RCA/STD/2024/001", "Adams Grace Chidinma", 9, 8, 9, 9, 52],
          ["RCA/STD/2024/002", "Bello Emmanuel Chukwu", 8, 7, 8, 7, 46],
          ["RCA/STD/2025/101", "Khadija Umar Farouk", 10, 9, 10, 9, 55],
        ]
      );
      break;

    case "cbt_questions":
      exportToCSV(
        "rca_cbt_question_bank_template.csv",
        [
          "Question Text",
          "Option A",
          "Option B",
          "Option C",
          "Option D",
          "Correct Option Number (1 for A, 2 for B, 3 for C, 4 for D)",
          "Marks Allocation",
        ],
        [
          [
            "What is the capital city of Plateau State?",
            "Bukuru",
            "Jos",
            "Pankshin",
            "Shendam",
            2,
            10,
          ],
          [
            "Which protocol is used for secure web browsing?",
            "FTP",
            "HTTP",
            "HTTPS",
            "SMTP",
            3,
            10,
          ],
        ]
      );
      break;
  }
}
