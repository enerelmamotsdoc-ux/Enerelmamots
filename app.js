const storageKey = "quality-manager-checklist-v2";
    const today = new Date().toISOString().slice(0, 10);

    const defaultState = {
      staff: ["Б. Номин", "Г. Тэмүүлэн", "Д. Энхжин", "С. Мөнх-Эрдэнэ", "О. Саруул"],
      groups: [
        group("Халдвар хамгаалал", ["Гарын ариун цэвэр", "Хамгаалах хэрэгсэл"]),
        group("Баримтжуулалт", ["Эмнэлзүйн бүртгэл", "Хяналтын хуудас"]),
        group("Өвчтөний аюулгүй байдал", ["Таних тэмдэг", "Эрсдэлийн үнэлгээ"]),
        group("Эмийн аюулгүй байдал", ["Эмийн хадгалалт", "Эмийн олголт"]),
        group("Орчны аюулгүй байдал", ["Цэвэрлэгээ", "Тоног төхөөрөмж"]),
        group("Харилцаа үйлчилгээ", ["Ёс зүй", "Мэдээлэл өгөх"])
      ],
      records: []
    };

    function group(name, subgroupNames) {
      return {
        id: crypto.randomUUID(),
        name,
        subgroups: subgroupNames.map(subName => ({
          id: crypto.randomUUID(),
          name: subName,
          questions: sampleQuestions(subName)
        }))
      };
    }

    function sampleQuestions(subgroupName) {
      return [
        `${subgroupName} стандартын шаардлага мөрдөгдсөн үү?`,
        `${subgroupName} холбоотой бүртгэл бүрэн хөтлөгдсөн үү?`,
        `${subgroupName} талаар ажилтан зааварчилгаа авсан уу?`
      ];
    }

    let state = normalizeState(loadState());
    let answers = {};
    let signaturePads = {};
    let editingRecordId = null;
    const collapsedKeys = new Set();

    const views = {
      dashboard: ["Нэгдсэн хяналтын самбар", "Нийт ажилчдын хяналтын хуудас, оноо, хувь, дүгнэлт, дараагийн хяналтын сануулгыг нэг дор хянана."],
      checklist: ["Шинэ хяналтын хуудас", "Ажилтан, бүлэг, дэд бүлэг сонгоод тийм/үгүй хариултаар оноо бодож, гарын үсэгтэй хадгална."],
      structure: ["Бүлэг, дэд бүлэг, асуулт", "Нийт зургаан үндсэн бүлэг болон доторх дэд бүлэг, асуултуудыг засах, нэмэх хэсэг."],
      staff: ["Ажилтны бүртгэл", "Хяналтад орох болон үнэлгээ хийх ажилтны нэрсийг нэмэх, хасах хэсэг."],
      records: ["Хяналтын бүртгэл", "Хадгалсан хяналтын оноо, хувь, дүгнэлт, зөвлөмж, эргэн хяналтын мэдээлэл."]
    };

    function loadState() {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return structuredClone(defaultState);
      try { return JSON.parse(saved); } catch { return structuredClone(defaultState); }
    }

    function normalizeState(raw) {
      const next = structuredClone(raw || defaultState);
      next.staff = Array.isArray(next.staff) ? next.staff : [];
      next.groups = Array.isArray(next.groups) && next.groups.length ? next.groups : structuredClone(defaultState.groups);
      next.groups.forEach(groupItem => {
        groupItem.id ||= crypto.randomUUID();
        groupItem.subgroups = Array.isArray(groupItem.subgroups) ? groupItem.subgroups : [];
        if (!groupItem.subgroups.length) {
          groupItem.subgroups.push({ id: crypto.randomUUID(), name: "Ерөнхий", questions: [] });
        }
        groupItem.subgroups.forEach(subgroup => {
          subgroup.id ||= crypto.randomUUID();
          subgroup.questions = Array.isArray(subgroup.questions) ? subgroup.questions : [];
        });
      });
      next.records = Array.isArray(next.records) ? next.records : [];
      return next;
    }

    function saveState() {
      localStorage.setItem(storageKey, JSON.stringify(state));
    }

    function showToast(message) {
      const toast = document.getElementById("toast");
      toast.textContent = message;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2400);
    }

    function switchView(name) {
      document.querySelectorAll(".view").forEach(view => view.classList.toggle("hidden", view.id !== name));
      document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === name));
      document.getElementById("viewTitle").textContent = views[name][0];
      document.getElementById("viewLead").textContent = views[name][1];
      renderAll();
      resizeSignatures();
    }

    function currentGroup() {
      return state.groups.find(item => item.id === document.getElementById("groupInput").value) || state.groups[0];
    }

    function currentSubgroup() {
      const groupItem = currentGroup();
      return groupItem.subgroups.find(item => item.id === document.getElementById("subgroupInput").value) || groupItem.subgroups[0];
    }

    function scoreFromAnswers(subgroup = currentSubgroup()) {
      const total = subgroup.questions.length;
      const score = subgroup.questions.reduce((sum, _, index) => sum + (answers[index] === "yes" ? 1 : 0), 0);
      const percent = total ? Math.round((score / total) * 100) : 0;
      const enoughMin = Math.ceil(total * 0.9);
      const weakMin = Math.ceil(total * 0.64);
      let status = "Хариулт хүлээж байна";
      let className = "bad";
      if (total && score >= enoughMin) {
        status = "Хангалттай";
        className = "good";
      } else if (total && score >= weakMin) {
        status = "Дутагдалтай";
        className = "warn";
      } else if (total) {
        status = "Хангалтгүй";
        className = "bad";
      }
      return { total, score, percent, enoughMin, weakMin, status, className };
    }

    function renderSelects() {
      const staffOptions = state.staff.map(name => `<option>${escapeHtml(name)}</option>`).join("");
      document.getElementById("employeeInput").innerHTML = staffOptions;
      document.getElementById("staffNames").innerHTML = staffOptions;
      document.getElementById("reviewDateInput").value ||= today;

      const groupOptions = state.groups.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
      ["groupInput", "manageGroupSelect", "questionGroupSelect"].forEach(id => {
        const select = document.getElementById(id);
        const previous = select.value;
        select.innerHTML = groupOptions;
        if (state.groups.some(item => item.id === previous)) select.value = previous;
      });

      renderSubgroupSelect("groupInput", "subgroupInput");
      renderSubgroupSelect("manageGroupSelect", "manageSubgroupSelect");
      renderSubgroupSelect("questionGroupSelect", "questionSubgroupSelect");

      const manageGroup = state.groups.find(item => item.id === document.getElementById("manageGroupSelect").value) || state.groups[0];
      const manageSubgroup = manageGroup.subgroups.find(item => item.id === document.getElementById("manageSubgroupSelect").value) || manageGroup.subgroups[0];
      document.getElementById("manageGroupName").value = manageGroup.name;
      document.getElementById("manageSubgroupName").value = manageSubgroup.name;
    }

    function renderSubgroupSelect(groupSelectId, subgroupSelectId) {
      const groupItem = state.groups.find(item => item.id === document.getElementById(groupSelectId).value) || state.groups[0];
      const select = document.getElementById(subgroupSelectId);
      const previous = select.value;
      select.innerHTML = groupItem.subgroups.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
      if (groupItem.subgroups.some(item => item.id === previous)) select.value = previous;
    }

    function renderChecklist() {
      const subgroup = currentSubgroup();
      const list = document.getElementById("questionChecklist");
      if (!subgroup.questions.length) {
        list.innerHTML = `<div class="item"><div class="item-title">Энэ дэд бүлэгт асуулт алга.</div><div class="meta">Бүлэг хэсгээс асуулт нэмээд хяналт хийж болно.</div></div>`;
        updateScore();
        return;
      }
      list.innerHTML = subgroup.questions.map((question, index) => `
        <div class="check-row">
          <div>
            <div class="item-title">${index + 1}. ${escapeHtml(question)}</div>
            <div class="meta">Тийм = 1 оноо, Үгүй = 0 оноо</div>
          </div>
          <div class="segmented" data-question-index="${index}">
            <button data-value="yes">Тийм</button>
            <button data-value="no">Үгүй</button>
          </div>
        </div>
      `).join("");

      document.querySelectorAll("[data-question-index] button").forEach(button => {
        const wrapper = button.closest("[data-question-index]");
        const index = Number(wrapper.dataset.questionIndex);
        button.classList.toggle("active", answers[index] === button.dataset.value);
        button.addEventListener("click", () => {
          answers[index] = button.dataset.value;
          wrapper.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
          updateScore();
        });
      });
      updateScore();
    }

    function updateScore() {
      const result = scoreFromAnswers();
      document.getElementById("percentText").textContent = result.percent + "%";
      document.getElementById("scoreCircle").style.setProperty("--score", result.percent + "%");
      const statusText = document.getElementById("statusText");
      statusText.textContent = result.status;
      statusText.className = "status " + result.className;
      document.getElementById("scoreDetail").textContent = `${result.score}/${result.total} оноо. ${result.enoughMin}-${result.total} оноо: хангалттай, ${result.weakMin}-${Math.max(result.enoughMin - 1, result.weakMin)} оноо: дутагдалтай, ${Math.max(result.weakMin - 1, 0)}-с бага: хангалтгүй.`;
    }

    function renderStructureList() {
      document.getElementById("structureList").innerHTML = state.groups.map(groupItem => {
        const subgroups = groupItem.subgroups.map(subgroup => {
          const subKey = `sub-${subgroup.id}`;
          const questions = subgroup.questions.map((question, index) => `
            <div class="item">
              <div class="item-head">
                <div>
                  <div class="item-title">${index + 1}. ${escapeHtml(question)}</div>
                  <div class="meta">${escapeHtml(subgroup.name)}</div>
                </div>
                <button class="btn danger" data-delete-question="${groupItem.id}|${subgroup.id}|${index}">Устгах</button>
              </div>
            </div>
          `).join("") || `<div class="item"><div class="meta">Асуулт нэмэгдээгүй.</div></div>`;
          return `<div class="item ${collapsedKeys.has(subKey) ? "collapsed" : ""}">
            <button class="toggle-head" data-toggle-key="${subKey}">
              <div class="item-head">
                <div>
                  <div class="item-title">${collapsedKeys.has(subKey) ? "▸" : "▾"} ${escapeHtml(subgroup.name)}</div>
                  <div class="meta">${subgroup.questions.length} асуулттай</div>
                </div>
                <span class="pill">Дэд бүлэг</span>
              </div>
            </button>
            <div class="stack collapsible-body">${questions}</div>
          </div>`;
        }).join("");
        const groupKey = `group-${groupItem.id}`;
        return `<div class="item ${collapsedKeys.has(groupKey) ? "collapsed" : ""}">
          <button class="toggle-head" data-toggle-key="${groupKey}">
            <div class="item-head">
              <div>
                <div class="item-title">${collapsedKeys.has(groupKey) ? "▸" : "▾"} ${escapeHtml(groupItem.name)}</div>
                <div class="meta">${groupItem.subgroups.length} дэд бүлэгтэй</div>
              </div>
              <span class="pill">Бүлэг</span>
            </div>
          </button>
          <div class="stack collapsible-body">${subgroups}</div>
        </div>`;
      }).join("");

      document.querySelectorAll("[data-toggle-key]").forEach(button => {
        button.addEventListener("click", () => {
          const key = button.dataset.toggleKey;
          if (collapsedKeys.has(key)) collapsedKeys.delete(key);
          else collapsedKeys.add(key);
          renderStructureList();
        });
      });

      document.querySelectorAll("[data-delete-question]").forEach(button => {
        button.addEventListener("click", () => {
          const [groupId, subgroupId, rawIndex] = button.dataset.deleteQuestion.split("|");
          const groupItem = state.groups.find(item => item.id === groupId);
          const subgroup = groupItem?.subgroups.find(item => item.id === subgroupId);
          if (!subgroup) return;
          subgroup.questions.splice(Number(rawIndex), 1);
          saveState();
          renderAll();
          showToast("Асуулт устгагдлаа.");
        });
      });
    }

    function renderStaff() {
      document.getElementById("staffList").innerHTML = state.staff.map(name => {
        const records = state.records.filter(record => record.employee === name).sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));
        const usedCount = state.records.filter(record => record.employee === name || record.evaluator === name || record.approvedBy === name).length;
        const rows = records.map(record => `
          <tr>
            <td>${record.reviewDate}</td>
            <td>${escapeHtml(record.groupName)} / ${escapeHtml(record.subgroupName)}</td>
            <td>${record.score}/${record.total}</td>
            <td>${record.percent}%</td>
            <td>${escapeHtml(record.status)}</td>
            <td><div class="toolbar" style="justify-content:flex-start"><button class="btn" data-edit-record="${record.id}">Засах</button><button class="btn" data-print-record="${record.id}">Хэвлэх</button></div></td>
          </tr>
        `).join("");
        return `<div class="item collapsed">
          <button class="toggle-head" data-staff-toggle>
            <div class="item-head">
              <div>
                <div class="item-title">▸ ${escapeHtml(name)}</div>
                <div class="meta">${records.length} бөглөсөн хуудас · ${usedCount} бүртгэлд ашиглагдсан</div>
              </div>
              <span class="pill">Ажилтан</span>
            </div>
          </button>
          <div class="collapsible-body" style="overflow:auto">
            <div class="toolbar" style="justify-content:flex-end;margin-bottom:10px">
              <button class="btn danger" data-delete-staff="${escapeHtml(name)}">Ажилтан хасах</button>
            </div>
            <table><thead><tr><th>Огноо</th><th>Бүлэг</th><th>Оноо</th><th>Хувь</th><th>Дүгнэлт</th><th>Үйлдэл</th></tr></thead><tbody>${rows || `<tr><td colspan="6">Өмнө бөглөсөн хуудас алга.</td></tr>`}</tbody></table>
          </div>
        </div>`;
      }).join("") || `<div class="item"><div class="meta">Ажилтан нэмэгдээгүй байна.</div></div>`;

      document.querySelectorAll("[data-staff-toggle]").forEach(button => {
        button.addEventListener("click", () => {
          const item = button.closest(".item");
          item.classList.toggle("collapsed");
          const title = item.querySelector(".item-title");
          title.textContent = title.textContent.startsWith("▸") ? title.textContent.replace("▸", "▾") : title.textContent.replace("▾", "▸");
        });
      });

      document.querySelectorAll("[data-delete-staff]").forEach(button => {
        button.addEventListener("click", () => {
          const name = button.dataset.deleteStaff;
          state.staff = state.staff.filter(item => item !== name);
          saveState();
          renderAll();
          showToast("Ажилтан жагсаалтаас хасагдлаа. Өмнөх бүртгэл хэвээр үлдэнэ.");
        });
      });
      document.querySelectorAll("#staffList [data-edit-record]").forEach(button => {
        button.addEventListener("click", () => beginEditRecord(button.dataset.editRecord));
      });
      document.querySelectorAll("#staffList [data-print-record]").forEach(button => {
        button.addEventListener("click", () => printRecord(button.dataset.printRecord));
      });
    }

    function renderRecords() {
      const rows = [...state.records].sort((a, b) => b.reviewDate.localeCompare(a.reviewDate)).map(record => `
        <tr>
          <td>${record.reviewDate}</td>
          <td><strong>${escapeHtml(record.employee)}</strong><br><span class="meta">${escapeHtml(record.groupName)} / ${escapeHtml(record.subgroupName)}</span></td>
          <td>${record.score}/${record.total}<div class="progress"><i style="--w:${record.percent}%"></i></div></td>
          <td>${record.percent}%</td>
          <td>${escapeHtml(record.status)}</td>
          <td>${record.nextReview || "-"}</td>
          <td><strong>${escapeHtml(record.evaluator || "-")}</strong><br><span class="meta">Зөвшөөрсөн: ${escapeHtml(record.approvedBy || "-")}</span></td>
          <td>${escapeHtml(record.recommendation || "-")}</td>
          <td>${escapeHtml(record.followup || "-")}</td>
          <td><div class="toolbar" style="justify-content:flex-start"><button class="btn" data-edit-record="${record.id}">Засах</button><button class="btn" data-print-record="${record.id}">Хэвлэх</button></div></td>
        </tr>
      `).join("");
      document.getElementById("recordTable").innerHTML = `<thead><tr><th>Огноо</th><th>Ажилтан</th><th>Оноо</th><th>Хувь</th><th>Дүгнэлт</th><th>Дараагийн хяналт</th><th>Гарын үсэг</th><th>Зөвлөмж</th><th>Эргэн хяналт</th><th>Үйлдэл</th></tr></thead><tbody>${rows || `<tr><td colspan="10">Бүртгэл алга.</td></tr>`}</tbody>`;
      document.querySelectorAll("[data-edit-record]").forEach(button => {
        button.addEventListener("click", () => beginEditRecord(button.dataset.editRecord));
      });
      document.querySelectorAll("[data-print-record]").forEach(button => {
        button.addEventListener("click", () => printRecord(button.dataset.printRecord));
      });
    }

    function renderDashboard() {
      const total = state.records.length;
      const avg = total ? Math.round(state.records.reduce((sum, record) => sum + record.percent, 0) / total) : 0;
      const enough = state.records.filter(record => record.status === "Хангалттай").length;
      const weak = state.records.filter(record => record.status === "Дутагдалтай").length;
      const bad = state.records.filter(record => record.status === "Хангалтгүй").length;
      const overdue = state.records.filter(record => record.nextReview && record.nextReview < today).length;
      document.getElementById("metrics").innerHTML = [
        metric("Нийт хяналт", total, "хадгалсан бүртгэл"),
        metric("Дундаж хувь", avg + "%", "нийт бүртгэлийн дундаж"),
        metric("Хангалттай", enough, "сайн үзүүлэлт"),
        metric("Дутагдалтай", weak, "сайжруулах шаардлагатай"),
        metric("Хангалтгүй", bad, "яаралтай арга хэмжээ"),
        metric("Хугацаа хэтэрсэн", overdue, "эргэн хянах шаардлагатай")
      ].join("");

      const reminders = [...state.records]
        .filter(record => record.nextReview)
        .sort((a, b) => a.nextReview.localeCompare(b.nextReview))
        .slice(0, 8);
      document.getElementById("reminderList").innerHTML = reminders.map(record => {
        const isOverdue = record.nextReview < today;
        return `<div class="item">
          <div class="item-head">
            <div>
              <div class="item-title">${escapeHtml(record.employee)}</div>
              <div class="meta">${escapeHtml(record.groupName)} / ${escapeHtml(record.subgroupName)}</div>
            </div>
            <span class="pill" style="color:${isOverdue ? "var(--red)" : "var(--primary-dark)"}">${record.nextReview}</span>
          </div>
        </div>`;
      }).join("") || `<div class="item"><div class="meta">Сануулах хяналт алга.</div></div>`;
      renderEmployeeHistory();
      renderCharts();
    }

    function metric(label, value, note) {
      return `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
    }

    function renderEmployeeHistory() {
      const byEmployee = state.staff.map(name => {
        const records = state.records.filter(record => record.employee === name).sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));
        const avg = records.length ? Math.round(records.reduce((sum, record) => sum + record.percent, 0) / records.length) : 0;
        return { name, records, avg };
      }).filter(item => item.records.length);

      document.getElementById("employeeHistory").innerHTML = byEmployee.map(item => {
        const rows = item.records.map(record => `
          <tr>
            <td>${record.reviewDate}</td>
            <td>${escapeHtml(record.groupName)} / ${escapeHtml(record.subgroupName)}</td>
            <td>${record.score}/${record.total}</td>
            <td>${record.percent}%</td>
            <td>${escapeHtml(record.status)}</td>
            <td><div class="toolbar" style="justify-content:flex-start"><button class="btn" data-edit-record="${record.id}">Засах</button><button class="btn" data-print-record="${record.id}">Хэвлэх</button></div></td>
          </tr>
        `).join("");
        return `<div class="item collapsed">
          <button class="toggle-head" data-employee-toggle>
            <div class="item-head">
              <div>
                <div class="item-title">▸ ${escapeHtml(item.name)}</div>
                <div class="meta">${item.records.length} хуудас · дундаж ${item.avg}%</div>
              </div>
              <span class="pill">Ажилтан</span>
            </div>
          </button>
          <div class="collapsible-body" style="overflow:auto">
            <table><thead><tr><th>Огноо</th><th>Бүлэг</th><th>Оноо</th><th>Хувь</th><th>Дүгнэлт</th><th>Үйлдэл</th></tr></thead><tbody>${rows}</tbody></table>
          </div>
        </div>`;
      }).join("") || `<div class="item"><div class="meta">Ажилтны хяналтын түүх алга.</div></div>`;

      document.querySelectorAll("[data-employee-toggle]").forEach(button => {
        button.addEventListener("click", () => {
          const item = button.closest(".item");
          item.classList.toggle("collapsed");
          const title = item.querySelector(".item-title");
          title.textContent = title.textContent.startsWith("▸") ? title.textContent.replace("▸", "▾") : title.textContent.replace("▾", "▸");
        });
      });
      document.querySelectorAll("#employeeHistory [data-edit-record]").forEach(button => {
        button.addEventListener("click", () => beginEditRecord(button.dataset.editRecord));
      });
      document.querySelectorAll("#employeeHistory [data-print-record]").forEach(button => {
        button.addEventListener("click", () => printRecord(button.dataset.printRecord));
      });
    }

    function renderCharts() {
      renderMonthlyChart();
      renderQuarterChart();
    }

    function drawChartBase(canvas) {
      const ctx = canvas.getContext("2d");
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#dce5e1";
      ctx.fillStyle = "#66736f";
      ctx.font = "13px Arial";
      for (let i = 0; i <= 4; i++) {
        const y = 28 + i * ((h - 72) / 4);
        ctx.beginPath();
        ctx.moveTo(44, y);
        ctx.lineTo(w - 18, y);
        ctx.stroke();
        ctx.fillText(String(100 - i * 25), 12, y + 4);
      }
      return { ctx, w, h, left: 48, right: w - 26, top: 28, bottom: h - 44 };
    }

    function renderMonthlyChart() {
      const canvas = document.getElementById("monthlyChart");
      const { ctx, h, left, right, top, bottom } = drawChartBase(canvas);
      const year = today.slice(0, 4);
      const values = Array.from({ length: 12 }, (_, i) => {
        const month = String(i + 1).padStart(2, "0");
        const records = state.records.filter(record => record.reviewDate.startsWith(`${year}-${month}`));
        return records.length ? Math.round(records.reduce((sum, record) => sum + record.percent, 0) / records.length) : 0;
      });
      const step = (right - left) / 11;
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      values.forEach((value, index) => {
        const x = left + step * index;
        const y = bottom - (value / 100) * (bottom - top);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      values.forEach((value, index) => {
        const x = left + step * index;
        const y = bottom - (value / 100) * (bottom - top);
        ctx.fillStyle = value ? "#0f766e" : "#c8d2cf";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#66736f";
        ctx.fillText(String(index + 1), x - 5, h - 16);
      });
    }

    function renderQuarterChart() {
      const canvas = document.getElementById("quarterChart");
      const { ctx, w, h, left, top, bottom } = drawChartBase(canvas);
      const year = today.slice(0, 4);
      const values = [1, 2, 3, 4].map(quarter => {
        const records = state.records.filter(record => {
          if (!record.reviewDate.startsWith(year)) return false;
          const month = Number(record.reviewDate.slice(5, 7));
          return Math.ceil(month / 3) === quarter;
        });
        return records.length ? Math.round(records.reduce((sum, record) => sum + record.percent, 0) / records.length) : 0;
      });
      const gap = 28;
      const barW = (w - left - 34 - gap * 3) / 4;
      values.forEach((value, index) => {
        const x = left + index * (barW + gap);
        const height = (value / 100) * (bottom - top);
        ctx.fillStyle = value ? "#2563eb" : "#c8d2cf";
        ctx.fillRect(x, bottom - height, barW, height || 2);
        ctx.fillStyle = "#66736f";
        ctx.fillText(`Q${index + 1}`, x + barW / 2 - 10, h - 16);
        if (value) ctx.fillText(value + "%", x + barW / 2 - 14, bottom - height - 10);
      });
    }

    function downloadFile(filename, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    function csvCell(value) {
      return `"${String(value ?? "").replaceAll('"', '""')}"`;
    }

    function downloadCsvReport() {
      const headers = ["Огноо", "Ажилтан", "Бүлэг", "Дэд бүлэг", "Оноо", "Нийт асуулт", "Хувь", "Дүгнэлт", "Дараагийн хяналт", "Үнэлгээ хийсэн", "Зөвшөөрсөн", "Зөвлөмж", "Эргэн хяналт"];
      const rows = state.records.map(record => [
        record.reviewDate,
        record.employee,
        record.groupName,
        record.subgroupName,
        record.score,
        record.total,
        record.percent + "%",
        record.status,
        record.nextReview,
        record.evaluator,
        record.approvedBy,
        record.recommendation,
        record.followup
      ]);
      const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
      downloadFile(`hyanaltiin-tailan-${today}.csv`, "\ufeff" + csv, "text/csv;charset=utf-8");
      showToast("CSV тайлан татагдлаа.");
    }

    function downloadHtmlReport() {
      const avg = state.records.length ? Math.round(state.records.reduce((sum, record) => sum + record.percent, 0) / state.records.length) : 0;
      const rows = state.records.map(record => `
        <tr>
          <td>${escapeHtml(record.reviewDate)}</td>
          <td>${escapeHtml(record.employee)}</td>
          <td>${escapeHtml(record.groupName)} / ${escapeHtml(record.subgroupName)}</td>
          <td>${record.score}/${record.total}</td>
          <td>${record.percent}%</td>
          <td>${escapeHtml(record.status)}</td>
          <td>${escapeHtml(record.nextReview || "-")}</td>
          <td>${escapeHtml(record.recommendation || "-")}</td>
        </tr>
      `).join("");
      const html = `<!doctype html><html lang="mn"><head><meta charset="utf-8"><title>Хяналтын тайлан</title><style>
        body{font-family:Arial,sans-serif;color:#18211f;margin:28px} h1{font-size:24px} .summary{display:flex;gap:12px;margin:18px 0}
        .box{border:1px solid #dce5e1;border-radius:8px;padding:12px;min-width:150px} table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border-bottom:1px solid #dce5e1;text-align:left;padding:8px;vertical-align:top} th{color:#66736f}
      </style></head><body>
        <h1>Чанарын менежерийн хяналтын тайлан</h1>
        <p>Тайлан татсан огноо: ${today}</p>
        <div class="summary">
          <div class="box"><strong>${state.records.length}</strong><br>Нийт хяналт</div>
          <div class="box"><strong>${avg}%</strong><br>Дундаж хувь</div>
          <div class="box"><strong>${state.records.filter(r => r.status === "Дутагдалтай").length}</strong><br>Дутагдалтай</div>
          <div class="box"><strong>${state.records.filter(r => r.status === "Хангалтгүй").length}</strong><br>Хангалтгүй</div>
        </div>
        <table><thead><tr><th>Огноо</th><th>Ажилтан</th><th>Бүлэг</th><th>Оноо</th><th>Хувь</th><th>Дүгнэлт</th><th>Дараагийн хяналт</th><th>Зөвлөмж</th></tr></thead><tbody>${rows || `<tr><td colspan="8">Бүртгэл алга.</td></tr>`}</tbody></table>
      </body></html>`;
      downloadFile(`hyanaltiin-tailan-${today}.html`, html, "text/html;charset=utf-8");
      showToast("Хэвлэх тайлан татагдлаа.");
    }

    function findRecordQuestions(record) {
      const groupItem = state.groups.find(item => item.id === record.groupId) || state.groups.find(item => item.name === record.groupName);
      const subgroup = groupItem?.subgroups.find(item => item.id === record.subgroupId) || groupItem?.subgroups.find(item => item.name === record.subgroupName);
      return subgroup?.questions || [];
    }

    function printRecord(recordId) {
      const record = state.records.find(item => item.id === recordId);
      if (!record) return showToast("Хэвлэх бүртгэл олдсонгүй.");
      const questions = findRecordQuestions(record);
      const questionRows = questions.map((question, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(question)}</td>
          <td>${record.answers?.[index] === "yes" ? "Тийм" : ""}</td>
          <td>${record.answers?.[index] === "no" ? "Үгүй" : ""}</td>
          <td>${record.answers?.[index] === "yes" ? "1" : "0"}</td>
        </tr>
      `).join("");
      const html = `<!doctype html><html lang="mn"><head><meta charset="utf-8"><title>Хяналтын хуудас</title><style>
        @page{size:A4;margin:14mm}
        *{box-sizing:border-box} body{font-family:Arial,sans-serif;color:#172033;margin:0;background:#fff;font-size:13px}
        .sheet{min-height:100vh;border:1px solid #c9dff4;padding:18px;background:linear-gradient(180deg,#f0f8ff 0,#fff 22%)}
        .head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0f63b6;padding-bottom:12px;margin-bottom:16px}
        .brand{display:flex;gap:12px;align-items:center}.print-logo{width:58px;height:58px;border-radius:12px;background:#0f63b6;color:white;display:grid;place-items:center;font-size:34px;font-weight:900}
        h1{font-size:20px;margin:0}.muted{color:#607085}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;margin:12px 0}
        .box{border:1px solid #d8e8f7;border-radius:8px;padding:10px;background:white}.score{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
        .score .box{text-align:center}.score strong{display:block;font-size:20px;color:#0f63b6;margin-top:4px}
        table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border:1px solid #d8e8f7;padding:7px;text-align:left;vertical-align:top} th{background:#eaf4ff}
        .text-block{white-space:pre-wrap;min-height:42px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
        .sig{border:1px solid #d8e8f7;border-radius:8px;padding:10px;background:white;min-height:120px}.sig img{max-width:100%;height:70px;object-fit:contain;display:block;margin-top:8px}
        .print-actions{margin:0 0 12px;text-align:right}@media print{.print-actions{display:none}.sheet{border:0}}
      </style></head><body>
        <div class="print-actions"><button onclick="window.print()">Хэвлэх</button></div>
        <section class="sheet">
          <div class="head">
            <div class="brand"><div class="print-logo">✚</div><div><h1>Эмнэлгийн нэр</h1><div class="muted">Чанарын баг · Ажилтны үнэлгээний хуудас</div></div></div>
            <div class="muted">Огноо: ${escapeHtml(record.reviewDate)}</div>
          </div>
          <div class="box"><strong>Тайлбар:</strong> Тийм-1 оноо, Үгүй-0 оноо.</div>
          <div class="grid">
            <div class="box"><strong>Хянагдсан ажилтан:</strong> ${escapeHtml(record.employee)}</div>
            <div class="box"><strong>Дараагийн хяналт:</strong> ${escapeHtml(record.nextReview || "-")}</div>
            <div class="box"><strong>Бүлэг:</strong> ${escapeHtml(record.groupName)}</div>
            <div class="box"><strong>Дэд бүлэг:</strong> ${escapeHtml(record.subgroupName)}</div>
          </div>
          <div class="score">
            <div class="box">Оноо<strong>${record.score}/${record.total}</strong></div>
            <div class="box">Хувь<strong>${record.percent}%</strong></div>
            <div class="box">Дүгнэлт<strong>${escapeHtml(record.status)}</strong></div>
          </div>
          <table><thead><tr><th>№</th><th>Асуулт</th><th>Тийм</th><th>Үгүй</th><th>Оноо</th></tr></thead><tbody>${questionRows || `<tr><td colspan="5">Асуултын мэдээлэл олдсонгүй.</td></tr>`}</tbody></table>
          <div class="grid">
            <div class="box"><strong>Зөвлөмж</strong><div class="text-block">${escapeHtml(record.recommendation || "-")}</div></div>
            <div class="box"><strong>Эргэн хяналтын хэрэгжилт</strong><div class="text-block">${escapeHtml(record.followup || "-")}</div></div>
          </div>
          <div class="signatures">
            <div class="sig"><strong>Үнэлгээ хийсэн ажилтан:</strong> ${escapeHtml(record.evaluator || "-")}${record.evaluatorSignature ? `<img src="${record.evaluatorSignature}" alt="Гарын үсэг">` : ""}</div>
            <div class="sig"><strong>Үнэлгээ зөвшөөрсөн ажилтан:</strong> ${escapeHtml(record.approvedBy || "-")}${record.approvedSignature ? `<img src="${record.approvedSignature}" alt="Гарын үсэг">` : ""}</div>
          </div>
        </section>
      </body></html>`;
      const win = window.open("", "_blank");
      if (!win) return showToast("Хэвлэх цонх нээгдсэнгүй. Browser popup зөвшөөрнө үү.");
      win.document.write(html);
      win.document.close();
      win.focus();
      showToast("Хэвлэх хуудас нээгдлээ.");
    }

    function saveRecord() {
      const subgroup = currentSubgroup();
      const result = scoreFromAnswers(subgroup);
      if (!document.getElementById("employeeInput").value) {
        showToast("Хянагдсан ажилтны нэр сонгоно уу.");
        return;
      }
      if (!subgroup.questions.length) {
        showToast("Энэ дэд бүлэгт асуулт нэмнэ үү.");
        return;
      }
      if (Object.keys(answers).length < subgroup.questions.length) {
        showToast("Бүх асуултад тийм/үгүй хариулна уу.");
        return;
      }
      const record = {
        id: editingRecordId || crypto.randomUUID(),
        employee: document.getElementById("employeeInput").value,
        reviewDate: document.getElementById("reviewDateInput").value || today,
        groupId: currentGroup().id,
        groupName: currentGroup().name,
        subgroupId: subgroup.id,
        subgroupName: subgroup.name,
        evaluator: document.getElementById("evaluatorInput").value.trim(),
        approvedBy: document.getElementById("approvedInput").value.trim(),
        nextReview: document.getElementById("nextReviewInput").value,
        recommendation: document.getElementById("recommendationInput").value.trim(),
        followup: document.getElementById("followupInput").value.trim(),
        answers: structuredClone(answers),
        score: result.score,
        total: result.total,
        percent: result.percent,
        status: result.status,
        evaluatorSignature: signaturePads.evaluatorSignature.toDataURL(),
        approvedSignature: signaturePads.approvedSignature.toDataURL()
      };
      if (editingRecordId) {
        const index = state.records.findIndex(item => item.id === editingRecordId);
        if (index >= 0) state.records[index] = record;
      } else {
        state.records.push(record);
      }
      [record.employee, record.evaluator, record.approvedBy].filter(Boolean).forEach(name => {
        if (!state.staff.includes(name)) state.staff.push(name);
      });
      saveState();
      editingRecordId = null;
      answers = {};
      document.getElementById("recommendationInput").value = "";
      document.getElementById("followupInput").value = "";
      clearSignatures();
      renderAll();
      showToast("Хяналтын хуудас хадгалагдлаа.");
    }

    function beginEditRecord(recordId) {
      const record = state.records.find(item => item.id === recordId);
      if (!record) return showToast("Засах бүртгэл олдсонгүй.");
      editingRecordId = recordId;
      switchView("checklist");

      [record.employee, record.evaluator, record.approvedBy].filter(Boolean).forEach(name => {
        if (!state.staff.includes(name)) state.staff.push(name);
      });
      renderSelects();

      document.getElementById("employeeInput").value = record.employee;
      document.getElementById("reviewDateInput").value = record.reviewDate || today;
      document.getElementById("evaluatorInput").value = record.evaluator || "";
      document.getElementById("approvedInput").value = record.approvedBy || "";
      document.getElementById("nextReviewInput").value = record.nextReview || "";
      document.getElementById("recommendationInput").value = record.recommendation || "";
      document.getElementById("followupInput").value = record.followup || "";

      const groupItem = state.groups.find(item => item.id === record.groupId) || state.groups.find(item => item.name === record.groupName) || state.groups[0];
      document.getElementById("groupInput").value = groupItem.id;
      renderSubgroupSelect("groupInput", "subgroupInput");
      const subgroup = groupItem.subgroups.find(item => item.id === record.subgroupId) || groupItem.subgroups.find(item => item.name === record.subgroupName) || groupItem.subgroups[0];
      document.getElementById("subgroupInput").value = subgroup.id;

      answers = structuredClone(record.answers || {});
      renderChecklist();
      loadSignature("evaluatorSignature", record.evaluatorSignature);
      loadSignature("approvedSignature", record.approvedSignature);
      updateEditControls();
      showToast("Бүртгэл засварлах горимд нээгдлээ.");
    }

    function cancelEdit() {
      editingRecordId = null;
      answers = {};
      document.getElementById("recommendationInput").value = "";
      document.getElementById("followupInput").value = "";
      clearSignatures();
      updateEditControls();
      renderAll();
      showToast("Засварлах горим цуцлагдлаа.");
    }

    function renameGroup() {
      const groupItem = state.groups.find(item => item.id === document.getElementById("manageGroupSelect").value);
      const name = document.getElementById("manageGroupName").value.trim();
      if (!groupItem || !name) return showToast("Бүлгийн нэр оруулна уу.");
      groupItem.name = name;
      saveState();
      renderAll();
      showToast("Бүлгийн нэр хадгалагдлаа.");
    }

    function addGroup() {
      const name = document.getElementById("manageGroupName").value.trim() || `Шинэ бүлэг ${state.groups.length + 1}`;
      state.groups.push({ id: crypto.randomUUID(), name, subgroups: [{ id: crypto.randomUUID(), name: "Ерөнхий", questions: [] }] });
      saveState();
      renderAll();
      showToast("Бүлэг нэмэгдлээ.");
    }

    function deleteGroup() {
      if (state.groups.length <= 1) {
        showToast("Доод тал нь нэг бүлэг байх шаардлагатай.");
        return;
      }
      const groupId = document.getElementById("manageGroupSelect").value;
      const groupItem = state.groups.find(item => item.id === groupId);
      state.groups = state.groups.filter(item => item.id !== groupId);
      answers = {};
      saveState();
      renderAll();
      showToast(`"${groupItem?.name || "Бүлэг"}" устгагдлаа. Өмнөх бүртгэл хэвээр үлдэнэ.`);
    }

    function renameSubgroup() {
      const groupItem = state.groups.find(item => item.id === document.getElementById("manageGroupSelect").value);
      const subgroup = groupItem?.subgroups.find(item => item.id === document.getElementById("manageSubgroupSelect").value);
      const name = document.getElementById("manageSubgroupName").value.trim();
      if (!subgroup || !name) return showToast("Дэд бүлгийн нэр оруулна уу.");
      subgroup.name = name;
      saveState();
      renderAll();
      showToast("Дэд бүлгийн нэр хадгалагдлаа.");
    }

    function addSubgroup() {
      const groupItem = state.groups.find(item => item.id === document.getElementById("manageGroupSelect").value) || state.groups[0];
      const name = document.getElementById("manageSubgroupName").value.trim() || `Шинэ дэд бүлэг ${groupItem.subgroups.length + 1}`;
      groupItem.subgroups.push({ id: crypto.randomUUID(), name, questions: [] });
      saveState();
      renderAll();
      showToast("Дэд бүлэг нэмэгдлээ.");
    }

    function deleteSubgroup() {
      const groupItem = state.groups.find(item => item.id === document.getElementById("manageGroupSelect").value) || state.groups[0];
      if (groupItem.subgroups.length <= 1) {
        showToast("Энэ бүлэгт доод тал нь нэг дэд бүлэг байх шаардлагатай.");
        return;
      }
      const subgroupId = document.getElementById("manageSubgroupSelect").value;
      const subgroup = groupItem.subgroups.find(item => item.id === subgroupId);
      groupItem.subgroups = groupItem.subgroups.filter(item => item.id !== subgroupId);
      answers = {};
      saveState();
      renderAll();
      showToast(`"${subgroup?.name || "Дэд бүлэг"}" устгагдлаа. Өмнөх бүртгэл хэвээр үлдэнэ.`);
    }

    function addQuestion() {
      const groupItem = state.groups.find(item => item.id === document.getElementById("questionGroupSelect").value) || state.groups[0];
      const subgroup = groupItem.subgroups.find(item => item.id === document.getElementById("questionSubgroupSelect").value) || groupItem.subgroups[0];
      const text = document.getElementById("newQuestionText").value.trim();
      if (!text) return showToast("Асуултын текст оруулна уу.");
      subgroup.questions.push(text);
      document.getElementById("newQuestionText").value = "";
      saveState();
      renderAll();
      showToast("Асуулт нэмэгдлээ.");
    }

    function addStaff() {
      const name = document.getElementById("newStaffName").value.trim();
      if (!name) return showToast("Ажилтны нэр оруулна уу.");
      if (state.staff.some(item => item.toLowerCase() === name.toLowerCase())) return showToast("Ийм нэртэй ажилтан байна.");
      state.staff.push(name);
      document.getElementById("newStaffName").value = "";
      saveState();
      renderAll();
      showToast("Ажилтан нэмэгдлээ.");
    }

    function setupSignaturePad(canvasId) {
      const canvas = document.getElementById(canvasId);
      const ctx = canvas.getContext("2d");
      let drawing = false;
      function pos(event) {
        const rect = canvas.getBoundingClientRect();
        const point = event.touches ? event.touches[0] : event;
        return {
          x: (point.clientX - rect.left) * (canvas.width / rect.width),
          y: (point.clientY - rect.top) * (canvas.height / rect.height)
        };
      }
      function start(event) {
        drawing = true;
        const p = pos(event);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        event.preventDefault();
      }
      function move(event) {
        if (!drawing) return;
        const p = pos(event);
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#18211f";
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        event.preventDefault();
      }
      function end() { drawing = false; }
      canvas.addEventListener("mousedown", start);
      canvas.addEventListener("mousemove", move);
      window.addEventListener("mouseup", end);
      canvas.addEventListener("touchstart", start, { passive: false });
      canvas.addEventListener("touchmove", move, { passive: false });
      canvas.addEventListener("touchend", end);
      return canvas;
    }

    function clearSignatures() {
      Object.values(signaturePads).forEach(canvas => canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height));
    }

    function loadSignature(canvasId, dataUrl) {
      const canvas = signaturePads[canvasId];
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!dataUrl) return;
      const image = new Image();
      image.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      };
      image.src = dataUrl;
    }

    function updateEditControls() {
      document.getElementById("saveRecord").textContent = editingRecordId ? "Засвар хадгалах" : "Хяналт хадгалах";
      document.getElementById("cancelEdit").classList.toggle("hidden", !editingRecordId);
    }

    function resizeSignatures() {
      Object.values(signaturePads).forEach(canvas => {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(0,0,0,0)";
      });
    }

    function renderAll() {
      renderSelects();
      renderChecklist();
      renderStructureList();
      renderStaff();
      renderRecords();
      renderDashboard();
      updateEditControls();
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]));
    }

    document.querySelectorAll(".nav-btn").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
    document.querySelectorAll("[data-switch]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.switch)));
    ["groupInput", "subgroupInput"].forEach(id => document.getElementById(id).addEventListener("input", () => {
      answers = {};
      renderAll();
    }));
    ["manageGroupSelect", "questionGroupSelect"].forEach(id => document.getElementById(id).addEventListener("input", renderAll));
    document.getElementById("saveRecord").addEventListener("click", saveRecord);
    document.getElementById("clearSignatures").addEventListener("click", clearSignatures);
    document.getElementById("cancelEdit").addEventListener("click", cancelEdit);
    document.getElementById("renameGroup").addEventListener("click", renameGroup);
    document.getElementById("addGroup").addEventListener("click", addGroup);
    document.getElementById("deleteGroup").addEventListener("click", deleteGroup);
    document.getElementById("renameSubgroup").addEventListener("click", renameSubgroup);
    document.getElementById("addSubgroup").addEventListener("click", addSubgroup);
    document.getElementById("deleteSubgroup").addEventListener("click", deleteSubgroup);
    document.getElementById("addQuestion").addEventListener("click", addQuestion);
    document.getElementById("addStaff").addEventListener("click", addStaff);
    document.getElementById("downloadCsv").addEventListener("click", downloadCsvReport);
    document.getElementById("downloadHtml").addEventListener("click", downloadHtmlReport);
    document.getElementById("resetDemo").addEventListener("click", () => {
      localStorage.removeItem(storageKey);
      state = normalizeState(structuredClone(defaultState));
      answers = {};
      editingRecordId = null;
      clearSignatures();
      renderAll();
      showToast("Демо мэдээлэл сэргээгдлээ.");
    });

    signaturePads = {
      evaluatorSignature: setupSignaturePad("evaluatorSignature"),
      approvedSignature: setupSignaturePad("approvedSignature")
    };
    renderAll();
