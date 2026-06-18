(function () {
  const config = window.EXAM_CONFIG || {
    appsScriptUrl: "https://script.google.com/macros/s/AKfycbz78IcWXt1yBbIKkVWfAN9MGfF2iVyjuNo38UnDlOOzusNkKMC2MUOX9MBW0VQI3GUX/exec"
  };
  const state = {
    studentId: "",
    studentName: "",
    token: "",
    questions: [],
    closeAt: null,
    backendCloseAt: null,
    receipt: null
  };

  const els = {
    intro: document.getElementById("intro"),
    exam: document.getElementById("exam"),
    result: document.getElementById("result"),
    loginForm: document.getElementById("loginForm"),
    studentName: document.getElementById("studentName"),
    studentId: document.getElementById("studentId"),
    studentTitle: document.getElementById("studentTitle"),
    courseName: document.getElementById("courseName"),
    notice: document.getElementById("notice"),
    examForm: document.getElementById("examForm"),
    submitExam: document.getElementById("submitExam"),
    timer: document.getElementById("timer"),
    resultText: document.getElementById("resultText"),
    downloadReceipt: document.getElementById("downloadReceipt")
  };

  els.courseName.textContent = config.courseName || "בחינת אמצע במימון";
  const metaEl = document.querySelector(".intro .meta");
  if (metaEl && config.examDateLabel && config.examWindowLabel) {
    metaEl.textContent = config.examDateLabel + ", " + config.examWindowLabel;
  }

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!config.appsScriptUrl) {
        reject(new Error("לא הוגדר קישור Apps Script בקובץ config.js"));
        return;
      }
      const callbackName = "examCallback_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
      const script = document.createElement("script");
      const url = new URL(config.appsScriptUrl);
      Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]));
      url.searchParams.set("callback", callbackName);
      window[callbackName] = (payload) => {
        delete window[callbackName];
        script.remove();
        resolve(payload);
      };
      script.onerror = () => {
        delete window[callbackName];
        script.remove();
        reject(new Error("לא ניתן להתחבר לשרת הבחינה"));
      };
      script.src = url.toString();
      document.body.appendChild(script);
    });
  }

  function showError(message) {
    els.notice.innerHTML = '<span class="error">' + escapeHtml(message) + "</span>";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function startTimer() {
    const tick = () => {
      if (!state.closeAt) return;
      const now = Date.now();
      const ms = state.closeAt.getTime() - now;
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      els.timer.textContent = minutes + ":" + seconds;
      
      if (ms <= 0) {
        els.timer.style.color = "var(--danger)";
        showError("זמן הבחינה הרשמי הסתיים! אנא הגש את הבחינה מיד.");
      } else {
        els.timer.style.color = "";
      }

      if (state.backendCloseAt && now > state.backendCloseAt.getTime()) {
        els.submitExam.disabled = true;
        showError("חלון ההגשה נסגר. הבחינה הסתיימה.");
      }
    };
    tick();
    window.setInterval(tick, 1000);
  }

  function renderQuestions() {
    els.examForm.innerHTML = "";
    state.questions.forEach((question, index) => {
      const item = document.createElement("section");
      item.className = "question";
      
      const choicesHtml = question.choices.map((choice) => {
        const letter = choice.trim().charAt(0);
        return [
          '<label class="choiceOption">',
          '<input type="radio" name="' + escapeHtml(question.id) + '" value="' + escapeHtml(letter) + '" required>',
          '<span>' + escapeHtml(choice) + '</span>',
          '</label>'
        ].join("");
      }).join("");

      item.innerHTML = [
        '<p class="questionTitle">' + (index + 1) + ". " + escapeHtml(question.text) + "</p>",
        '<p class="questionMeta">נושא: ' + escapeHtml(question.topic) + " | ניקוד: " + escapeHtml(question.points) + "</p>",
        '<div class="choicesList">',
        choicesHtml,
        '</div>'
      ].join("");
      els.examForm.appendChild(item);
    });
  }

  function collectAnswers() {
    const answers = {};
    state.questions.forEach((question) => {
      const node = els.examForm.elements[question.id];
      answers[question.id] = node ? node.value : "";
    });
    return answers;
  }

  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const studentName = els.studentName.value.trim();
    const studentId = els.studentId.value.trim();
    if (!studentName || studentName.length < 2) {
      alert("יש להזין שם מלא תקין.");
      return;
    }
    if (!/^\d{5,10}$/.test(studentId)) {
      alert("יש להזין תעודת זהות בספרות בלבד.");
      return;
    }
    els.loginForm.querySelector("button").disabled = true;
    try {
      const response = await jsonp({ action: "start", studentId, studentName });
      if (!response.ok) throw new Error(response.error || "לא ניתן להתחיל את הבחינה");
      state.studentId = studentId;
      state.studentName = studentName;
      state.token = response.token;
      state.questions = response.questions;
      state.closeAt = config.timerCloseAt ? new Date(config.timerCloseAt) : new Date(response.closeAt);
      state.backendCloseAt = new Date(response.closeAt);
      els.studentTitle.textContent = studentName + " | ת.ז. " + studentId;
      els.notice.textContent = "יש לבחור את התשובה הנכונה ביותר מבין האפשרויות המוצגות עבור כל שאלה.";
      renderQuestions();
      els.intro.classList.add("hidden");
      els.exam.classList.remove("hidden");
      startTimer();
    } catch (error) {
      alert(error.message);
    } finally {
      els.loginForm.querySelector("button").disabled = false;
    }
  });

  els.submitExam.addEventListener("click", async () => {
    if (!confirm("להגיש את הבחינה? לאחר הגשה לא ניתן לשנות תשובות.")) return;
    els.submitExam.disabled = true;
    try {
      const answers = JSON.stringify(collectAnswers());
      const response = await jsonp({
        action: "submit",
        studentId: state.studentId,
        studentName: state.studentName,
        token: state.token,
        answers
      });
      if (!response.ok) throw new Error(response.error || "ההגשה נכשלה");
      state.receipt = response;
      els.exam.classList.add("hidden");
      els.result.classList.remove("hidden");
      els.resultText.textContent = state.studentName + " | ת.ז. " + state.studentId + " | מספר אישור: " + response.receiptId;
    } catch (error) {
      els.submitExam.disabled = false;
      alert(error.message);
    }
  });

  els.downloadReceipt.addEventListener("click", () => {
    if (!state.receipt) return;
    const blob = new Blob([JSON.stringify(state.receipt, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "finance-exam-receipt-" + state.studentId + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
})();
