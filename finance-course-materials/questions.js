// Seeded random helper (Mulberry32)
function createRng(seedStr) {
    let hash = 0;
    if (seedStr.length > 0) {
        for (let i = 0; i < seedStr.length; i++) {
            let chr = seedStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
    }
    let seed = hash;
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randomRange(rng, min, max, step = 1) {
    const range = (max - min) / step;
    return min + Math.floor(rng() * (range + 1)) * step;
}

function shuffle(rng, array) {
    let currentIndex = array.length, randomIndex;
    const result = [...array];
    while (currentIndex !== 0) {
        randomIndex = Math.floor(rng() * currentIndex);
        currentIndex--;
        [result[currentIndex], result[randomIndex]] = [result[randomIndex], result[currentIndex]];
    }
    return result;
}

// // Generate the 11 questions
function generateExam(studentId, includeAnswers = false) {
    const rng = createRng(studentId);
    const questions = [];

    // Helper to format currency
    const fmtCurr = (num) => new Intl.NumberFormat('he-IL', { style: 'decimal', maximumFractionDigits: 0 }).format(num) + ' ₪';

    // ----------------------------------------------------
    // Q1: Changing Interest Rates (Single Sum PV/FV)
    // ----------------------------------------------------
    const q1_pv = randomRange(rng, 10000, 50000, 5000);
    const q1_n1 = randomRange(rng, 2, 4);
    const q1_n2 = randomRange(rng, 3, 5);
    const q1_r1 = randomRange(rng, 3, 5, 0.5);
    const q1_r2 = randomRange(rng, 5.5, 7.5, 0.5);
    const q1_ans = q1_pv * Math.pow(1 + q1_r1 / 100, q1_n1) * Math.pow(1 + q1_r2 / 100, q1_n2);
    
    questions.push({
        id: 1,
        topic: "ערך הזמן של הכסף - שינוי ריבית",
        text: `דני מפקיד היום סכום חד-פעמי של ${fmtCurr(q1_pv)} בתכנית חיסכון בנקאית למשך ${q1_n1 + q1_n2} שנים. ב-${q1_n1} השנים הראשונות, הפיקדון נושא ריבית שנתית קבועה של ${q1_r1}% (ריבית דריבית). ב-${q1_n2} השנים הנותרות, הריבית השנתית עולה ל-${q1_r2}%. מה יהיה סכום החיסכון של דני בתום תקופת החיסכון כולה?`,
        correct: q1_ans,
        makeOptions: (ans) => {
            const step = q1_pv * 0.15;
            return [
                ans,
                ans * 0.9,
                ans * 1.1,
                q1_pv * (1 + (q1_r1 * q1_n1 + q1_r2 * q1_n2) / 100) // simple interest error
            ];
        }
    });

    // ----------------------------------------------------
    // Q2: EAR Comparison (Cheaper Loan)
    // ----------------------------------------------------
    const q2_r1 = randomRange(rng, 7.0, 9.0, 0.1); // Monthly nominal rate
    const q2_diff = randomRange(rng, -1, 3) * 0.1; // Difference of -0.1%, 0%, 0.1%, 0.2%, 0.3%
    const q2_r2 = q2_r1 + q2_diff; // Quarterly nominal rate
    
    const ear1 = Math.pow(1 + (q2_r1 / 100) / 12, 12) - 1; // monthly compounding
    const ear2 = Math.pow(1 + (q2_r2 / 100) / 4, 4) - 1;   // quarterly compounding
    
    const ear1_pct = ear1 * 100;
    const ear2_pct = ear2 * 100;
    const q2_cheaper_ear = Math.min(ear1_pct, ear2_pct);
    const q2_is_1_cheaper = ear1_pct < ear2_pct;

    questions.push({
        id: 2,
        topic: "ריבית נקובה מול ריבית אפקטיבית (EAR)",
        text: `חברה זקוקה למימון ומקבלת שתי הצעות להלוואה:<br/>
        הצעה א': ריבית שנתית נקובה של ${q2_r1.toFixed(1)}% בחישוב חודשי (הצבירה מבוצעת בכל חודש).<br/>
        הצעה ב': ריבית שנתית נקובה של ${q2_r2.toFixed(1)}% בחישוב רבעוני (הצבירה מבוצעת בכל רבעון).<br/>
        מהי הריבית האפקטיבית השנתית (EAR) של ההצעה הזולה (המשתלמת) ביותר עבור החברה?`,
        correct: q2_cheaper_ear,
        makeOptions: (ans) => {
            return [
                ans,
                Math.max(ear1_pct, ear2_pct),
                q2_is_1_cheaper ? q2_r1 : q2_r2, // nominal instead of effective
                ans * 0.95
            ];
        },
        suffix: "%"
    });

    // ----------------------------------------------------
    // Q3: Loan with Upfront Interest and Fees
    // ----------------------------------------------------
    const q3_L = randomRange(rng, 50000, 100000, 10000);
    const q3_r = randomRange(rng, 6, 9, 0.5);
    const q3_F = randomRange(rng, 800, 1500, 100);
    
    const q3_upfront_interest = q3_L * (q3_r / 100);
    const q3_net_received = q3_L - q3_upfront_interest - q3_F;
    const q3_ans = (q3_L / q3_net_received - 1) * 100;

    questions.push({
        id: 3,
        topic: "הלוואות - ריבית מראש ועמלות",
        text: `אדם מבקש לקבל הלוואה בסך של ${fmtCurr(q3_L)} למשך שנה אחת. תנאי ההלוואה הם כדלקמן:<br/>
        1. ריבית שנתית נקובה של ${q3_r}% מנוכה מראש (משולמת במועד קבלת ההלוואה).<br/>
        2. במועד קבלת ההלוואה משולמת עמלה חד-פעמית של ${fmtCurr(q3_F)}.<br/>
        מהו שיעור הריבית האפקטיבית השנתית (העלות הממשית של האשראי) של הלוואה זו?`,
        correct: q3_ans,
        makeOptions: (ans) => {
            const ear_without_fee = (q3_L / (q3_L - q3_upfront_interest) - 1) * 100;
            const fee_added_to_pv = (q3_L / (q3_L - q3_upfront_interest + q3_F) - 1) * 100;
            const linear_rate = q3_r + (q3_F / q3_L) * 100;
            return [
                ans,
                ear_without_fee,
                fee_added_to_pv,
                linear_rate
            ];
        },
        suffix: "%"
    });

    // ----------------------------------------------------
    // Q4: Annuity PV (Begin vs. End)
    // ----------------------------------------------------
    const q4_N = randomRange(rng, 5, 8);
    const q4_PMT = randomRange(rng, 15000, 25000, 1000);
    const q4_r = randomRange(rng, 5, 7, 0.5);
    
    const r_val = q4_r / 100;
    const pv_annuity_end = q4_PMT * (1 - Math.pow(1 + r_val, -q4_N)) / r_val;
    const pv_annuity_begin = pv_annuity_end * (1 + r_val);
    const q4_ans = pv_annuity_begin - pv_annuity_end;

    questions.push({
        id: 4,
        topic: "סדרת תשלומים (אנונה) - תחילת תקופה מול סוף תקופה",
        text: `חברת "לוגיסטיקה" רוכשת מלגזה חדשה. החברה מתלבטת בין שתי שיטות תשלום מול היבואן:<br/>
        אפשרות א': פריסה ל-${q4_N} תשלומים שנתיים שווים של ${fmtCurr(q4_PMT)} כל אחד, כאשר התשלום הראשון משולם **היום** (תחילת שנה - Annuity Due).<br/>
        אפשרות ב': פריסה ל-${q4_N} תשלומים שנתיים שווים של ${fmtCurr(q4_PMT)} כל אחד, כאשר התשלום הראשון משולם **בעוד שנה** (סוף שנה - Ordinary Annuity).<br/>
        בהנחה ששיעור ההיוון השנתי הרלוונטי הוא ${q4_r}%, מהו ההפרש (בשקלים) בין שווי המזומן (הערך הנוכחי) של ההצעות היום?`,
        correct: q4_ans,
        makeOptions: (ans) => {
            return [
                ans,
                0, // treating both as begin or both as end
                pv_annuity_end, // treating both as option B (ordinary annuity)
                pv_annuity_begin // treating both as option A (annuity due)
            ];
        }
    });

    // ----------------------------------------------------
    // Q5: Delayed Annuity (סדרה נדחית)
    // ----------------------------------------------------
    const q5_PMT = randomRange(rng, 8000, 12000, 500);
    const q5_N = randomRange(rng, 4, 6);
    const q5_k = randomRange(rng, 4, 6); // First payment at end of year k
    const q5_r = randomRange(rng, 4.5, 6.5, 0.5);
    
    const r5 = q5_r / 100;
    const pv_annuity_k_minus_1 = q5_PMT * (1 - Math.pow(1 + r5, -q5_N)) / r5;
    const q5_ans = pv_annuity_k_minus_1 / Math.pow(1 + r5, q5_k - 1);

    questions.push({
        id: 5,
        topic: "סדרת תשלומים נדחית",
        text: `סטודנט מעוניין להבטיח לעצמו סדרת תקבולים שנתית של ${fmtCurr(q5_PMT)} בכל סוף שנה למשך ${q5_N} שנים. הסטודנט מעוניין שהתקבול הראשון יתקבל בדיוק בעוד ${q5_k} שנים מהיום (כלומר בסוף שנה ${q5_k}). שיעור הריבית השנתית בשוק הוא ${q5_r}%. כמה כסף עליו להפקיד היום כסכום חד-פעמי בקופת חיסכון על מנת לממן את סדרת התקבולים הזו במלואה?`,
        correct: q5_ans,
        makeOptions: (ans) => {
            return [
                ans,
                pv_annuity_k_minus_1 / Math.pow(1 + r5, q5_k), // incorrect discount to k
                pv_annuity_k_minus_1, // no delay discounting
                ans * 1.15
            ];
        }
    });

    // ----------------------------------------------------
    // Q6: Perpetuity with Growth (סדרה אינסופית עם צמיחה)
    // ----------------------------------------------------
    const q6_PMT = randomRange(rng, 30000, 60000, 5000);
    const q6_r = randomRange(rng, 5.5, 7.5, 0.5);
    const q6_g = randomRange(rng, 1.5, 3.0, 0.5);
    
    const r6 = q6_r / 100;
    const g6 = q6_g / 100;
    const q6_ans = q6_PMT / (r6 - g6);

    questions.push({
        id: 6,
        topic: "סדרה אינסופית (פרפטאויטי) עם צמיחה",
        text: `תורם מעוניין להקים קרן מלגות מיוחדת באוניברסיטה. המלגה הראשונה בסך ${fmtCurr(q6_PMT)} תחולק בעוד שנה מהיום (בסוף שנה 1). התורם מעוניין שגובה המלגה יצמח בכל שנה בשיעור קבוע של ${q6_g}% לצמיתות (עד אינסוף) כדי להתמודד עם עליית יוקר המחיה. שיעור הריבית השנתית הצפוי הוא ${q6_r}%. מהו הסכום הכולל שעל התורם להפקיד בקרן היום לשם כך?`,
        correct: q6_ans,
        makeOptions: (ans) => {
            return [
                ans,
                q6_PMT / r6, // without growth
                q6_PMT / (r6 + g6), // add growth error
                ans * 0.8
            ];
        }
    });

    // ----------------------------------------------------
    // Q7: Spitzer Amortization (לוח שפיצר)
    // ----------------------------------------------------
    const q7_L = randomRange(rng, 150000, 250000, 10000);
    const q7_N = randomRange(rng, 8, 12);
    const q7_r = randomRange(rng, 4, 6, 0.5);
    const q7_t = randomRange(rng, 3, 5); // Target year
    
    const r7 = q7_r / 100;
    const q7_pmt = q7_L * r7 / (1 - Math.pow(1 + r7, -q7_N));
    
    // Remaining balance at t-1
    const bal_t_minus_1 = q7_pmt * (1 - Math.pow(1 + r7, -(q7_N - (q7_t - 1)))) / r7;
    const interest_t = bal_t_minus_1 * r7;
    const q7_ans = q7_pmt - interest_t; // Principal repayment in year t

    questions.push({
        id: 7,
        topic: "לוחות סילוקין - לוח שפיצר",
        text: `חברה לקחה הלוואה בסך של ${fmtCurr(q7_L)} לתקופה של ${q7_N} שנים, להחזר בתשלומים שנתיים שווים בסוף כל שנה לפי לוח שפיצר. הריבית השנתית היא ${q7_r}%. מהו גובה ההחזר על חשבון **הקרן** בלבד (קרן פדיון, ללא ריבית!) הכלול בתשלום השנתי של השנה ה-${q7_t}?`,
        correct: q7_ans,
        makeOptions: (ans) => {
            return [
                ans,
                q7_pmt, // total payment including interest
                interest_t, // interest component only
                ans * 0.9
            ];
        }
    });

    // ----------------------------------------------------
    // Q8: Amortization - Regular (Linear) Amortization (לוח סילוקין רגיל / קרן שווה)
    // ----------------------------------------------------
    const q8_L = randomRange(rng, 100000, 200000, 10000);
    const q8_N = randomRange(rng, 5, 8);
    const q8_r = randomRange(rng, 3, 5, 0.5);
    const q8_t = randomRange(rng, 2, 4); // Target year
    
    const r8 = q8_r / 100;
    const principal_repayment = q8_L / q8_N;
    const balance_before_t = q8_L - principal_repayment * (q8_t - 1);
    const interest_in_t = balance_before_t * r8;
    const q8_ans = principal_repayment + interest_in_t;

    questions.push({
        id: 8,
        topic: "לוחות סילוקין - סילוקין רגיל (קרן שווה)",
        text: `נלקחה הלוואה בסך ${fmtCurr(q8_L)} למשך ${q8_N} שנים בריבית שנתית קבועה של ${q8_r}%. ההלוואה מוחזרת בתשלומי קרן שווים בכל שנה (לוח סילוקין רגיל / קרן שווה), ובתוספת הריבית שנצברה על יתרת הקרן הלא-מסולקת. מה יהיה סך **התשלום הכולל** (קרן + ריבית) שתשלם החברה בשנה ה-${q8_t}?`,
        correct: q8_ans,
        makeOptions: (ans) => {
            return [
                ans,
                principal_repayment, // principal component only
                interest_in_t, // interest component only
                principal_repayment + (q8_L * r8) // first year payment (interest on full loan)
            ];
        }
    });

    // ----------------------------------------------------
    // Q9: Amortization with CPI Linkage (קרן שווה עם הצמדה למדד)
    // ----------------------------------------------------
    const q9_L = randomRange(rng, 100000, 200000, 10000);
    const q9_N = randomRange(rng, 5, 8);
    const q9_r = randomRange(rng, 3, 5, 0.5);
    const q9_t = randomRange(rng, 2, 4); // Target year
    const q9_inf = randomRange(rng, 4, 8, 0.5); // Cumulative CPI inflation in %
    
    const r9 = q9_r / 100;
    const inf9 = q9_inf / 100;
    const p9 = q9_L / q9_N; // real principal payment
    const bal_before9 = q9_L - p9 * (q9_t - 1); // real balance before payment t
    const int9 = bal_before9 * r9; // real interest
    const pmt_real = p9 + int9; // total real payment
    const q9_ans = pmt_real * (1 + inf9); // indexed payment

    questions.push({
        id: 9,
        topic: "לוחות סילוקין - קרן שווה עם הצמדה למדד",
        text: `נלקחה הלוואה בריבית שנתית קבועה (צמודה) של ${q9_r}%. סכום ההלוואה הוא ${fmtCurr(q9_L)} למשך ${q9_N} שנים, והיא מוחזרת בתשלומי קרן שווים בכל שנה (לוח סילוקין רגיל / קרן שווה), כאשר הקרן והריבית צמודים למדד המחירים לצרכן. ידוע כי מתחילת ההלוואה ועד למועד התשלום של השנה ה-${q9_t}, עלה מדד המחירים לצרכן בשיעור מצטבר של ${q9_inf}%. מה יהיה גובה התשלום הכולל (קרן + ריבית) שתשלם החברה בשנה ה-${q9_t} לאחר ההצמדה למדד?`,
        correct: q9_ans,
        makeOptions: (ans) => {
            const unindexed = pmt_real;
            const only_principal_indexed = p9 * (1 + inf9) + int9;
            const only_interest_indexed = p9 + int9 * (1 + inf9);
            return [
                ans,
                unindexed,
                only_principal_indexed,
                only_interest_indexed
            ];
        }
    });
    // ----------------------------------------------------
    // Q10: Zero-coupon Bond / T-Bill (מק"מ)
    // ----------------------------------------------------
    const q10_D = randomRange(rng, 90, 270, 30); // days to maturity
    const q10_P = randomRange(rng, 92.5, 96.5, 0.1); // price per 100 par
    
    const q10_ans = (Math.pow(100 / q10_P, 365 / q10_D) - 1) * 100;

    questions.push({
        id: 10,
        topic: "אג\"ח - מלווה קצר מועד (מק\"מ)",
        text: `איגרת חוב ממשלתית מסוג מק"מ (מלווה קצר מועד) בעלת ערך נקוב של 100 ש"ח נסחרת היום בשוק במחיר של ${q10_P.toFixed(2)} ש"ח. מועד פדיון האיגרת הוא בעוד ${q10_D} ימים מהיום. מהו שיעור התשואה לפדיון (YTM) השנתי האפקטיבי של המק"מ? (הניחו שנה של 365 יום)`,
        correct: q10_ans,
        makeOptions: (ans) => {
            const nominal_error = ((100 - q10_P) / q10_P) * (365 / q10_D) * 100;
            return [
                ans,
                nominal_error, // nominal annual return (without compounding)
                ((100 - q10_P) / 100) * 100, // holding period return on par
                ans * 0.9
            ];
        },
        suffix: "%"
    });

    // ----------------------------------------------------
    // Q11: Coupon Bond Pricing
    // ----------------------------------------------------
    const q11_FV = 1000;
    const q11_c = randomRange(rng, 4.5, 6.5, 0.5);
    const q11_N = randomRange(rng, 4, 6);
    const q11_y = randomRange(rng, 6.5, 8.5, 0.5); // YTM > coupon -> discount bond
    
    const C11 = q11_FV * (q11_c / 100);
    const y11 = q11_y / 100;
    const q11_ans = C11 * (1 - Math.pow(1 + y11, -q11_N)) / y11 + q11_FV / Math.pow(1 + y11, q11_N);

    questions.push({
        id: 11,
        topic: "תמחור אגרות חוב (מחיר אג\"ח קופוני)",
        text: `איגרת חוב של חברה בעלת ערך נקוב של ${fmtCurr(q11_FV)}, הנושאת ריבית קופון שנתית של ${q11_c}% המשולמת פעם בשנה בסוף כל שנה, נפדת בתום ${q11_N} שנים במלואה (ערך נקוב). מהו מחיר האיגרת היום בשוק אם שיעור התשואה לפדיון (YTM) השנתי הנדרש כעת בשוק על ידי משקיעים עבור אג"ח ברמת סיכון דומה הוא ${q11_y}%?`,
        correct: q11_ans,
        makeOptions: (ans) => {
            return [
                ans,
                q11_FV, // par value error
                C11 * q11_N + q11_FV, // undiscounted sum of payments
                ans * 1.1
            ];
        }
    });

    // Post-process questions to build choices and select correct answer index
    return questions.map(q => {
        // Evaluate the raw options
        const rawOptions = q.makeOptions(q.correct);
        
        // Map to display strings rounded to 2 decimals, format percentages or currencies
        const suffix = q.suffix || '';
        const isPercentage = suffix === '%';
        
        const formatVal = (v) => {
            if (isPercentage) {
                return v.toFixed(2) + ' %';
            } else {
                return new Intl.NumberFormat('he-IL', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' ₪';
            }
        };

        // Unique formatting
        const formattedChoices = rawOptions.map((v, idx) => ({
            value: v,
            label: formatVal(v),
            isCorrect: idx === 0 // The first option in makeOptions is always the correct one
        }));

        // Shuffle options using the seeded RNG
        const shuffledChoices = shuffle(rng, formattedChoices);
        const correctIndex = shuffledChoices.findIndex(c => c.isCorrect);

        const result = {
            id: q.id,
            topic: q.topic,
            text: q.text,
            choices: shuffledChoices.map(c => c.label)
        };

        if (includeAnswers) {
            result.correctIndex = correctIndex;
            result.correctValue = q.correct;
            result.formatVal = formatVal;
        }

        return result;
    });
}

// Make globally available
window.FinanceExam = {
    generateExam: generateExam
};
