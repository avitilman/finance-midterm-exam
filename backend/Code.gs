const CONFIG = {
  sheetName: "ציוני בחינת אמצע במימון",
  openAt: "2026-06-22T09:45:00+03:00",
  closeAt: "2026-06-22T11:00:00+03:00",
  secret: "CHANGE_ME_TO_A_PRIVATE_RANDOM_TEXT"
};

function doGet(e) {
  const callback = (e.parameter.callback || "callback").replace(/[^\w.$]/g, "");
  let payload;
  try {
    const action = e.parameter.action;
    if (action === "start") {
      payload = startExam_(e.parameter.studentId, e.parameter.studentName, e.parameter.secret);
    } else if (action === "submit") {
      payload = submitExam_(e.parameter.studentId, e.parameter.studentName, e.parameter.token, e.parameter.answers, e.parameter.secret);
    } else if (action === "getResults") {
      payload = getResults_(e.parameter.secret);
    } else if (action === "inspect") {
      payload = inspectExam_(e.parameter.studentId, e.parameter.secret);
    } else {
      payload = { ok: false, error: "פעולה לא מוכרת" };
    }
  } catch (err) {
    payload = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function startExam_(studentId, studentName, bypassSecret) {
  validateWindow_(false, bypassSecret);
  validateStudentId_(studentId);
  validateStudentName_(studentName);
  const exam = buildExam_(studentId);
  return {
    ok: true,
    token: makeToken_(studentId),
    closeAt: CONFIG.closeAt,
    questions: exam.questions.map(q => ({
      id: q.id,
      topic: q.topic,
      text: q.text,
      points: q.points,
      choices: q.choices
    }))
  };
}

function submitExam_(studentId, studentName, token, answersJson, bypassSecret) {
  validateWindow_(true, bypassSecret);
  validateStudentId_(studentId);
  validateStudentName_(studentName);
  if (token !== makeToken_(studentId)) throw new Error("אסימון בחינה לא תקין");
  const answers = JSON.parse(answersJson || "{}");
  const exam = buildExam_(studentId);
  const graded = grade_(exam.questions, answers);
  const receiptId = Utilities.getUuid();
  const submittedAt = new Date();
  
  const rowData = [
    submittedAt,
    studentId,
    studentName,
    graded.score,
    graded.maxScore,
    receiptId,
    JSON.stringify(graded.details),
    JSON.stringify(answers)
  ];
  
  saveOrUpdateSubmission_(studentId, rowData);
  
  return {
    ok: true,
    receiptId,
    submittedAt: submittedAt.toISOString(),
    studentId
  };
}

function validateWindow_(isSubmit, bypassSecret) {
  if (bypassSecret && bypassSecret === CONFIG.secret) {
    return; // Bypass validation for testing
  }
  const now = new Date();
  const openAt = new Date(CONFIG.openAt);
  const closeAt = new Date(CONFIG.closeAt);
  if (now < openAt) throw new Error("הבחינה עדיין לא נפתחה");
  if (now > closeAt) throw new Error(isSubmit ? "חלון ההגשה נסגר" : "הבחינה הסתיימה");
}

function validateStudentId_(studentId) {
  if (!/^\d{5,10}$/.test(String(studentId || ""))) throw new Error("תעודת זהות לא תקינה");
}

function validateStudentName_(studentName) {
  if (!studentName || String(studentName).trim().length < 2) {
    throw new Error("יש להזין שם מלא תקין");
  }
}

function saveOrUpdateSubmission_(studentId, rowData) {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  let rowIndex = -1;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(studentId).trim()) {
        rowIndex = i + 2;
        break;
      }
    }
  }
  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function getResults_(secret) {
  if (secret !== CONFIG.secret) throw new Error("גישה נדחתה: סיסמה שגויה");
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, results: [] };
  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  const results = data.map(row => ({
    submittedAt: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
    studentId: String(row[1]),
    studentName: String(row[2]),
    score: Number(row[3]),
    maxScore: Number(row[4]),
    receiptId: String(row[5]),
    details: JSON.parse(row[6] || "[]"),
    answers: JSON.parse(row[7] || "{}")
  }));
  return { ok: true, results };
}

function inspectExam_(studentId, secret) {
  if (secret !== CONFIG.secret) throw new Error("גישה נדחתה: סיסמה שגויה");
  validateStudentId_(studentId);
  const exam = buildExam_(studentId);
  return {
    ok: true,
    questions: exam.questions.map(q => ({
      id: q.id,
      topic: q.topic,
      text: q.text,
      points: q.points,
      choices: q.choices,
      correctLetter: q.correctLetter
    }))
  };
}

function getSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sheet) sheet = ss.insertSheet(CONFIG.sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["submittedAt", "studentId", "studentName", "score", "maxScore", "receiptId", "detailsJson", "answersJson"]);
  } else {
    const headers = sheet.getRange(1, 1, 1, Math.min(sheet.getLastColumn(), 10)).getValues()[0];
    if (headers.indexOf("studentName") === -1) {
      sheet.insertColumnBefore(3);
      sheet.getRange(1, 3).setValue("studentName");
    }
  }
  return sheet;
}

function makeToken_(studentId) {
  const raw = studentId + "|" + CONFIG.openAt + "|" + CONFIG.secret;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return Utilities.base64EncodeWebSafe(bytes);
}

function buildExam_(studentId) {
  const rnd = makeRng_(hash_(studentId + CONFIG.secret));
  const questions = [
    qSavingsComparison_(rnd),
    qRentComparison_(rnd),
    qYearsToGrow_(rnd),
    qAnnuityThenPerpetuity_(rnd),
    qEffectiveToNominal_(rnd),
    qEffectiveRatesComparison_(rnd),
    qFeesAndPrepaidInterest_(rnd),
    qAmortizationComparison_(rnd),
    qSpitzer_(rnd),
    qBond_(rnd),
    qSingleCashFlow_(rnd)
  ];
  shuffle_(questions, rnd);
  return { questions };
}

function qSavingsComparison_(rnd) {
  const p = pick_(rnd, 85000, 90000, 95000, 100000, 110000);
  const r1 = pick_(rnd, 3.2, 3.5, 3.8, 4.0) / 100;
  const r2 = pick_(rnd, 4.4, 4.6, 4.8, 5.0) / 100;
  const r3 = pick_(rnd, 5.5, 5.8, 6.0, 6.2) / 100;
  const fee = pick_(rnd, 800, 900, 1000, 1100);
  const r4 = pick_(rnd, 4.7, 4.9, 5.1, 5.3) / 100;
  const years = 4;
  
  const sumA = p * (1 + r1) * Math.pow(1 + r2, 2) * (1 + r3);
  const sumB = (p - fee) * Math.pow(1 + r4 / 12, years * 12);
  
  const text = `חוסך משווה שתי תוכניות חיסכון ל-${years} שנים עבור הפקדה ראשונית של ${money_(p)} ש"ח:
תוכנית א': נושאת ריבית שנתית של ${pct_(r1)} בשנה הראשונה, ${pct_(r2)} בשנתיים הבאות, ו-${pct_(r3)} בשנה הרביעית.
תוכנית ב': דורשת דמי פתיחת תיק בסך ${money_(fee)} ש"ח (המנוכים מההפקדה ביום הראשון) ונושאת ריבית שנתית נקובה של ${pct_(r4)} בחישוב חודשי.
איזו תוכנית עדיפה ומהו הסכום שיצטבר בה בסוף התקופה?`;

  const correctText = sumA > sumB 
    ? `תוכנית א' עדיפה, ${money_(sumA)} ש"ח` 
    : `תוכנית ב' עדיפה, ${money_(sumB)} ש"ח`;
    
  const distractors = sumA > sumB 
    ? [
        `תוכנית ב' עדיפה, ${money_(sumB)} ש"ח`,
        `תוכנית א' עדיפה, ${money_(p * (1 + r1) * (1 + r2) * (1 + r3))} ש"ח`,
        `אין הבדל משמעותי, שתי התוכניות יצברו סכום זהה`
      ]
    : [
        `תוכנית א' עדיפה, ${money_(sumA)} ש"ח`,
        `תוכנית ב' עדיפה, ${money_(p * Math.pow(1 + r4 / 12, years * 12) - fee)} ש"ח`,
        `אין הבדל משמעותי, שתי התוכניות יצברו סכום זהה`
      ];

  return multipleChoiceQuestion_(rnd, "q1", "השוואת תוכניות חיסכון", text, correctText, distractors, 10);
}

function qRentComparison_(rnd) {
  const n = pick_(rnd, 24, 30, 36);
  const p1 = pick_(rnd, 24000, 25000, 26000, 27000, 28000);
  const s = pick_(rnd, 15000, 18000, 20000, 22000, 25000);
  const p2 = pick_(rnd, 20000, 21000, 22000, 23000, 24000);
  const rate = pick_(rnd, 0.8, 0.85, 0.9, 0.95, 1.0) / 100;
  
  const pvA = p1 * (1 - Math.pow(1 + rate, -n)) / rate;
  const pvB = s + p2 * ((1 - Math.pow(1 + rate, -n)) / rate) * (1 + rate);
  
  const text = `שוכר משווה בין שתי חלופות תשלום עבור חוזה שכירות ל-${n} חודשים:
חלופה א': ${n} תשלומים חודשיים של ${money_(p1)} ש"ח המשולמים בסוף כל חודש.
חלופה ב': תשלום מיידי היום של ${money_(s)} ש"ח ועוד ${n} תשלומים חודשיים של ${money_(p2)} ש"ח המשולמים בתחילת כל חודש.
הריבית החודשית היא ${pct_(rate)}. איזו חלופה זולה יותר ומהו הערך הנוכחי (PV) שלה?`;

  const correctText = pvA < pvB 
    ? `חלופה א' זולה יותר, PV ${money_(pvA)} ש"ח` 
    : `חלופה ב' זולה יותר, PV ${money_(pvB)} ש"ח`;
    
  const distractors = pvA < pvB
    ? [
        `חלופה ב' זולה יותר, PV ${money_(pvB)} ש"ח`,
        `אין הבדל בגלל מספר תשלומים זהה`,
        `חלופה ב' זולה יותר, PV ${money_(s + p2 * (1 - Math.pow(1 + rate, -n)) / rate)} ש"ח`
      ]
    : [
        `חלופה א' זולה יותר, PV ${money_(pvA)} ש"ח`,
        `אין הבדל בגלל מספר תשלומים זהה`,
        `חלופה א' זולה יותר, PV ${money_(p1 * ((1 - Math.pow(1 + rate, -n)) / rate) * (1 + rate))} ש"ח`
      ];

  return multipleChoiceQuestion_(rnd, "q2", "השוואת חלופות שכירות", text, correctText, distractors, 10);
}

function qYearsToGrow_(rnd) {
  const factor = pick_(rnd, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0);
  const rate = pick_(rnd, 5.5, 5.8, 6.0, 6.2, 6.5, 6.8) / 100;
  const answer = Math.log(factor) / Math.log(1 + rate);
  
  const text = `כמה שנים נדרשות על מנת שסכום כסף יגדל פי ${factor} בריבית שנתית אפקטיבית של ${pct_(rate)}?`;
  
  const correctText = `${round_(answer, 1)} שנים`;
  const distractors = [
    `${round_((factor - 1) / rate, 1)} שנים`,
    `${round_(Math.log(factor) / rate, 1)} שנים`,
    `${round_(answer * 2, 1)} שנים`
  ];
  
  return multipleChoiceQuestion_(rnd, "q3", "זמן להגדלת סכום", text, correctText, distractors, 10);
}

function qAnnuityThenPerpetuity_(rnd) {
  const p1 = pick_(rnd, 68000, 70000, 72000, 75000);
  const years = pick_(rnd, 4, 5, 6);
  const p2 = pick_(rnd, 35000, 38000, 40000, 42000);
  const rate = pick_(rnd, 6.5, 7.0, 7.5, 8.0) / 100;
  
  const pvAnnuity = p1 * (1 - Math.pow(1 + rate, -years)) / rate;
  const pvPerp = (p2 / rate) / Math.pow(1 + rate, years);
  const answer = pvAnnuity + pvPerp;
  
  const text = `נכס צפוי להניב תזרים שנתי של ${money_(p1)} ש"ח בכל סוף שנה במשך ${years} השנים הראשונות. לאחר מכן, החל מסוף השנה ה-${years + 1}, התזרים ישתנה ל-${money_(p2)} ש"ח לשנה ויימשך לנצח. שיעור ההיוון השנתי הוא ${pct_(rate)}. מהו הערך הנוכחי של הנכס היום?`;
  
  const correctText = `${money_(answer)} ש"ח`;
  const distractors = [
    `${money_(pvAnnuity)} ש"ח`,
    `${money_(p2 / rate)} ש"ח`,
    `${money_(pvAnnuity + p2 / rate)} ש"ח`
  ];
  
  return multipleChoiceQuestion_(rnd, "q4", "ערך נוכחי של סדרה מוגבלת ואינסופית", text, correctText, distractors, 10);
}

function qEffectiveToNominal_(rnd) {
  const reff = pick_(rnd, 10.0, 10.5, 11.0, 11.5, 12.0) / 100;
  const answer = 4 * (Math.pow(1 + reff, 0.25) - 1) * 100;
  
  const text = `ריבית שנתית אפקטיבית של ${pct_(reff)} שקולה לאיזו ריבית שנתית נקובה בחישוב רבעוני?`;
  
  const correctText = `${round_(answer, 2)}%`;
  const distractors = [
    `${round_(reff * 100, 2)}%`,
    `${round_((Math.pow(1 + reff, 4) - 1) * 100, 2)}%`,
    `${round_((Math.pow(1 + reff, 0.25) - 1) * 100, 2)}%`
  ];
  
  return multipleChoiceQuestion_(rnd, "q5", "מעבר מריבית אפקטיבית לנקובה", text, correctText, distractors, 10);
}

function qEffectiveRatesComparison_(rnd) {
  const r1 = pick_(rnd, 7.3, 7.5, 7.7) / 100;
  const r2 = pick_(rnd, 7.5, 7.7, 7.9) / 100;
  const r3 = pick_(rnd, 7.45, 7.65, 7.85) / 100;
  
  const effA = (Math.pow(1 + r1 / 12, 12) - 1) * 100;
  const effB = (Math.pow(1 + r2 / 2, 2) - 1) * 100;
  const effC = r3 * 100;
  const answer = Math.max(effA, effB, effC);
  
  const text = `חוסך משווה שלושה פיקדונות:
פיקדון א' מציע ריבית שנתית נקובה של ${pct_(r1)} בחישוב חודשי.
פיקדון ב' מציע ריבית שנתית נקובה של ${pct_(r2)} בחישוב חצי שנתי.
פיקדון ג' מציע ריבית שנתית אפקטיבית של ${pct_(r3)}.
מהי הריבית האפקטיבית השנתית של הפיקדון המשתלם ביותר מבין השלושה?`;

  const bestName = answer === effA ? "פיקדון א'" : (answer === effB ? "פיקדון ב'" : "פיקדון ג'");
  const correctText = `${bestName}, ${round_(answer, 2)}%`;
  
  const distractors = [
    `פיקדון א', ${round_(r1 * 100, 2)}%`,
    `פיקדון ב', ${round_(r2 * 100, 2)}%`,
    `פיקדון ג', ${round_(effC, 2)}%`
  ].filter(d => d !== correctText);
  
  while (distractors.length < 3) {
    distractors.push(`כל הפיקדונות שקולים ומציעים תשואה זהה`);
  }
  
  return multipleChoiceQuestion_(rnd, "q6", "השוואת ריביות אפקטיביות", text, correctText, distractors, 10);
}

function qFeesAndPrepaidInterest_(rnd) {
  const loan = pick_(rnd, 80000, 100000, 120000, 150000, 180000);
  const nominal = pick_(rnd, 7, 8, 9, 10) / 100;
  const fee = pick_(rnd, 1, 1.25, 1.5, 2) / 100;
  
  const interest = loan * nominal;
  const received = loan - interest - loan * fee;
  const answer = (loan / received - 1) * 100;
  
  const text = `עסק קיבל הלוואה נומינלית של ${money_(loan)} ש"ח לשנה אחת. הריבית השנתית של ${pct_(nominal)} נגבית מראש, ובנוסף נגבית עמלת הקצאה של ${pct_(fee)} מסכום ההלוואה. מהי הריבית האפקטיבית השנתית על הסכום שהתקבל בפועל?`;
  
  const correctText = `${round_(answer, 2)}%`;
  const distractors = [
    `${round_(nominal * 100, 2)}%`,
    `${round_((nominal + fee) * 100, 2)}%`,
    `${round_((loan / (loan - interest) - 1) * 100, 2)}%`
  ];
  
  return multipleChoiceQuestion_(rnd, "q7", "ריבית מראש ועמלות", text, correctText, distractors, 10);
}

function qAmortizationComparison_(rnd) {
  const principal = pick_(rnd, 250000, 280000, 300000, 320000);
  const years = pick_(rnd, 6, 7, 8);
  const rate = pick_(rnd, 5.5, 6.0, 6.5, 7.0) / 100;
  const k = int_(rnd, 3, 5);
  
  const principalPart = principal / years;
  const remainingPrincipal = principal - (k - 1) * principalPart;
  const interestPart = remainingPrincipal * rate;
  const pmtRegular = principalPart + interestPart;
  const pmtSpitzer = principal * rate / (1 - Math.pow(1 + rate, -years));
  const answer = Math.abs(pmtRegular - pmtSpitzer);
  
  // Distractor 1: wrong difference using K instead of K-1 for principal reduction
  const pmtRegular_wrong = principalPart + (principal - k * principalPart) * rate;
  const diff_wrong = Math.abs(pmtRegular_wrong - pmtSpitzer);
  
  const text = `עסק לוקח הלוואה של ${money_(principal)} ש"ח ל-${years} שנים בריבית שנתית קבועה של ${pct_(rate)}. מהו ההפרש (בערך מוחלט) בין התשלום בשנה ה-${k} בלוח סילוקין רגיל לבין התשלום השנתי הקבוע לפי לוח שפיצר? (הנח תשלומים שנתיים)`;
  
  const correctText = `${money_(answer)} ש"ח`;
  const distractors = [
    `${money_(diff_wrong)} ש"ח`,
    `${money_(pmtRegular)} ש"ח`,
    `0 ש"ח (התשלום בשני הלוחות זהה בשנה זו)`
  ];
  
  return multipleChoiceQuestion_(rnd, "q8", "השוואת לוחות סילוקין", text, correctText, distractors, 10);
}

function qSpitzer_(rnd) {
  const principal = pick_(rnd, 70000, 90000, 110000, 140000);
  const months = pick_(rnd, 24, 36, 48, 60);
  const monthly = pick_(rnd, 0.45, 0.5, 0.55, 0.6) / 100;
  const answer = principal * monthly / (1 - Math.pow(1 + monthly, -months));
  
  const text = `הלוואה של ${money_(principal)} ש"ח מוחזרת בלוח שפיצר במשך ${months} חודשים. הריבית החודשית היא ${pct_(monthly)}. מהו התשלום החודשי הקבוע?`;
  
  const correctText = `${money_(answer)} ש"ח`;
  const distractors = [
    `${money_((principal / months) + (principal * monthly))} ש"ח`,
    `${money_(principal / months)} ש"ח`,
    `${money_(principal * (monthly * 12) / (1 - Math.pow(1 + monthly * 12, -(months / 12))))} ש"ח`
  ];
  
  return multipleChoiceQuestion_(rnd, "q9", "לוח שפיצר", text, correctText, distractors, 10);
}

function qBond_(rnd) {
  const fv = 100;
  const couponRate = pick_(rnd, 5, 6, 7, 8, 9) / 100;
  const ytm = pick_(rnd, 4, 5, 6, 7, 8, 9, 10) / 100;
  const years = pick_(rnd, 3, 4, 5, 6);
  const c = fv * couponRate;
  const answer = c * (1 - Math.pow(1 + ytm, -years)) / ytm + fv / Math.pow(1 + ytm, years);
  
  const text = `אג"ח בערך נקוב 100 ש"ח משלמת קופון שנתי של ${pct_(couponRate)} למשך ${years} שנים. התשואה לפדיון היא ${pct_(ytm)}. מה מחיר האג"ח היום?`;
  
  const correctText = `${round_(answer, 2)} ש"ח`;
  const distractors = [
    `${money_(fv)} ש"ח`,
    `${round_(c * (1 - Math.pow(1 + ytm, -years)) / ytm + fv, 2)} ש"ח`,
    `${round_(fv / Math.pow(1 + ytm, years), 2)} ש"ח`
  ];
  
  return multipleChoiceQuestion_(rnd, "q10", "אגח קופון", text, correctText, distractors, 10);
}

function qSingleCashFlow_(rnd) {
  const pv = pick_(rnd, 18000, 25000, 32000, 45000, 60000);
  const rate = pick_(rnd, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0) / 100;
  const years = int_(rnd, 3, 8);
  const answer = pv * Math.pow(1 + rate, years);
  
  const text = `סטודנט הפקיד היום ${money_(pv)} ש"ח בתוכנית חיסכון ל-${years} שנים בריבית שנתית של ${pct_(rate)}. מה יהיה הסכום שיצטבר בסוף התקופה?`;
  
  const correctText = `${money_(answer)} ש"ח`;
  const distractors = [
    `${money_(pv * (1 + rate * years))} ש"ח`,
    `${money_(pv)} ש"ח`,
    `${money_(pv * Math.pow(1 + rate, years - 1))} ש"ח`
  ];
  
  return multipleChoiceQuestion_(rnd, "q11", "ערך עתידי של סכום חד פעמי", text, correctText, distractors, 10);
}

function multipleChoiceQuestion_(rnd, id, topic, text, correctText, distractors, points) {
  const rawChoices = [correctText].concat(distractors);
  shuffle_(rawChoices, rnd);
  
  const letters = ["א", "ב", "ג", "ד"];
  const choices = rawChoices.map((choice, i) => letters[i] + ". " + choice);
  
  const correctIndex = rawChoices.indexOf(correctText);
  const correctLetter = letters[correctIndex];
  
  return { id, topic, text, choices, correctLetter, points };
}

function grade_(questions, answers) {
  let score = 0;
  let maxScore = 0;
  const details = [];
  questions.forEach(q => {
    maxScore += q.points;
    const submitted = String(answers[q.id] || "").trim();
    const ok = submitted === q.correctLetter;
    if (ok) score += q.points;
    details.push({
      id: q.id,
      topic: q.topic,
      submitted: submitted,
      expected: q.correctLetter,
      points: ok ? q.points : 0
    });
  });
  return { score, maxScore, details };
}

function makeRng_(seed) {
  let a = seed >>> 0;
  return function() {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hash_(value) {
  let h = 2166136261;
  const s = String(value);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle_(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function pick_(rnd) {
  const values = Array.prototype.slice.call(arguments, 1);
  return values[Math.floor(rnd() * values.length)];
}

function int_(rnd, min, max) {
  return min + Math.floor(rnd() * (max - min + 1));
}

function pct_(value) {
  return round_(value * 100, 3) + "%";
}

function money_(value) {
  return Math.round(value).toLocaleString("he-IL");
}

function round_(value, digits) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}
