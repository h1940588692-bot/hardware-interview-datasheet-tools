"use strict";

const STORAGE_KEY = "hardware-interview-learning-v1";
const masteryLabels = { weak: "不会", learning: "不熟", mastered: "已掌握" };
const tracks = { all: "全部题目", power: "电源设计", production: "量产测试", reliability: "可靠性测试" };
const studyLabels = { all: "全部记录", new: "未自评", wrong: "错题本", weak: "不会", learning: "不熟", mastered: "已掌握" };
const defaults = { company: "all", domain: "全部", level: "全部", query: "", sort: "default", track: "all", study: "all", mode: "practice", currentId: null };
const domains = ["全部", ...new Set(questions.map(item => item.domain))];
const ids = new Set(questions.map(item => item.id));
let records = Object.create(null);
let state = { ...defaults };
let storageMessage = "学习记录会自动保存在当前浏览器。";
const revealed = new Set();
const grid = document.querySelector("#questionGrid");
const template = document.querySelector("#questionTemplate");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");

loadProgress();
renderFilters("#domainFilters", Object.fromEntries(domains.map(x => [x, x])), "domain");
renderFilters("#levelFilters", { 全部: "全部", 基础: "基础", 进阶: "进阶" }, "level");
renderFilters("#trackFilters", tracks, "track");
renderFilters("#studyFilters", studyLabels, "study");
searchInput.value = state.query;
sortSelect.value = state.sort;
bindEvents();
render();

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.records || typeof data.records !== "object" || Array.isArray(data.records)) throw new Error("invalid progress");
    for (const [id, record] of Object.entries(data.records)) {
      if (!ids.has(id) || !record || typeof record !== "object") continue;
      records[id] = {
        mastery: Object.hasOwn(masteryLabels, record.mastery) ? record.mastery : null,
        wrong: record.wrong === true,
        draft: typeof record.draft === "string" ? record.draft.slice(0, 4000) : "",
        updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null
      };
    }
    const saved = data.state || {};
    const allowed = { company: ["all", "big", "small"], domain: domains, level: ["全部", "基础", "进阶"], sort: ["default", "level", "domain"], track: Object.keys(tracks), study: Object.keys(studyLabels), mode: ["practice", "browse"] };
    for (const [key, values] of Object.entries(allowed)) if (values.includes(saved[key])) state[key] = saved[key];
    if (typeof saved.query === "string") state.query = saved.query.slice(0, 200);
    if (ids.has(saved.currentId)) state.currentId = saved.currentId;
    storageMessage = "已恢复上次的思路、自评和训练位置；答案已重新收起。";
  } catch {
    storageMessage = "无法读取学习记录（可能已损坏或浏览器禁止存储）。本次仍可训练；请导出记录备份。";
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records, state }));
    storageMessage = "已自动保存到当前浏览器。";
  } catch {
    storageMessage = "保存失败：浏览器存储不可用或空间不足。本次记录仍在页面中，请导出备份。";
  }
  updateStorageStatus();
}

function updateStorageStatus() {
  const target = document.querySelector("#storageStatus");
  if (target.textContent !== storageMessage) target.textContent = storageMessage;
}

function getRecord(id) {
  return records[id] || { mastery: null, wrong: false, draft: "", updatedAt: null };
}

function saveRecord(id, changes) {
  records[id] = { ...getRecord(id), ...changes, updatedAt: new Date().toISOString() };
  persist();
}

function renderFilters(selector, values, key) {
  const root = document.querySelector(selector);
  for (const [value, label] of Object.entries(values)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.filter = key;
    button.dataset.value = value;
    button.textContent = label;
    root.append(button);
  }
}

function changeView(changes) {
  Object.assign(state, changes);
  state.currentId = null;
  revealed.clear();
  render();
  persist();
}

function bindEvents() {
  document.body.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.filter) return changeView({ [button.dataset.filter]: button.dataset.value });
    if (button.dataset.mode) return changeView({ mode: button.dataset.mode });
    const card = button.closest(".question-card");
    if (!card) return;
    const id = card.dataset.id;
    if (button.classList.contains("reveal-answer")) {
      if (revealed.has(id)) revealed.delete(id); else revealed.add(id);
      updateAnswer(card, id);
    } else if (button.dataset.rating && revealed.has(id)) {
      const mastery = button.dataset.rating;
      const index = filteredQuestions().findIndex(item => item.id === id);
      saveRecord(id, { mastery, wrong: mastery !== "mastered" });
      renderAfterRating(id, ".rating button[data-rating='" + mastery + "']", index);
    } else if (button.classList.contains("wrong-toggle")) {
      const index = filteredQuestions().findIndex(item => item.id === id);
      saveRecord(id, { wrong: !getRecord(id).wrong });
      renderAfterRating(id, ".wrong-toggle", index);
    }
  });
  grid.addEventListener("input", event => {
    if (!event.target.matches(".draft")) return;
    saveRecord(event.target.closest(".question-card").dataset.id, { draft: event.target.value });
  });
  searchInput.addEventListener("input", () => changeView({ query: searchInput.value.slice(0, 200).trim().toLowerCase() }));
  sortSelect.addEventListener("change", () => changeView({ sort: sortSelect.value }));
  document.querySelector("#focusBig").addEventListener("click", () => changeView({ company: "big" }));
  document.querySelector("#focusSmall").addEventListener("click", () => changeView({ company: "small" }));
  document.querySelector("#previousQuestion").addEventListener("click", () => navigate(-1));
  document.querySelector("#nextQuestion").addEventListener("click", () => navigate(1));
  document.querySelector("#exportProgress").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ version: 1, records, state }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hardware-interview-progress.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function renderAfterRating(id, selector, previousIndex) {
  const list = filteredQuestions();
  if (!list.some(item => item.id === id)) state.currentId = list[Math.min(previousIndex, list.length - 1)]?.id || null;
  const oldCards = [...grid.children];
  const oldIndex = oldCards.findIndex(card => card.dataset.id === id);
  render();
  const card = [...grid.children].find(card => card.dataset.id === id);
  if (card) card.querySelector(selector)?.focus();
  else if (list.length) (grid.children[Math.max(0, Math.min(oldIndex, grid.children.length - 1))]?.querySelector("textarea"))?.focus();
  else document.querySelector('button[data-filter="study"].is-active')?.focus();
  persist();
}

function filteredQuestions() {
  return questions.filter(item => {
    const record = getRecord(item.id);
    const studyMatch = state.study === "all" || (state.study === "new" ? !record.mastery : state.study === "wrong" ? record.wrong : record.mastery === state.study);
    const text = [item.domain, item.level, item.title, item.answer, ...item.tags].join(" ").toLowerCase();
    return (state.company === "all" || item.company === state.company)
      && (state.domain === "全部" || item.domain === state.domain)
      && (state.level === "全部" || item.level === state.level)
      && (state.track === "all" || item.domain === tracks[state.track])
      && studyMatch && (!state.query || text.includes(state.query));
  }).sort((a, b) => {
    const rank = { 基础: 1, 进阶: 2 };
    if (state.sort === "level") return rank[a.level] - rank[b.level] || a.domain.localeCompare(b.domain, "zh-CN");
    if (state.sort === "domain") return a.domain.localeCompare(b.domain, "zh-CN") || rank[a.level] - rank[b.level];
    return 0;
  });
}

function navigate(delta) {
  const list = filteredQuestions();
  const index = list.findIndex(item => item.id === state.currentId);
  const next = list[index + delta];
  if (!next) return;
  state.currentId = next.id;
  revealed.clear();
  render();
  persist();
}

function render() {
  const list = filteredQuestions();
  let index = list.findIndex(item => item.id === state.currentId);
  if (index < 0) index = 0;
  state.currentId = list[index]?.id || null;
  document.querySelectorAll("button[data-filter]").forEach(button => {
    const active = state[button.dataset.filter] === button.dataset.value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("button[data-mode]").forEach(button => button.setAttribute("aria-pressed", String(state.mode === button.dataset.mode)));
  grid.classList.toggle("is-practice", state.mode === "practice");
  grid.replaceChildren();
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "当前条件下没有题目。错题本也会叠加公司、方向、专项、难度和搜索条件，请调整筛选。";
    grid.append(empty);
  } else (state.mode === "practice" ? [list[index]] : list).forEach(renderCard);
  document.querySelector("#practiceNav").hidden = state.mode !== "practice";
  document.querySelector("#practicePosition").textContent = list.length ? `第 ${index + 1} / ${list.length} 题` : "0 / 0 题";
  document.querySelector("#previousQuestion").disabled = index <= 0 || !list.length;
  document.querySelector("#nextQuestion").disabled = index >= list.length - 1 || !list.length;
  document.querySelector("#totalCount").textContent = list.length;
  document.querySelector("#bigCount").textContent = questions.filter(item => item.company === "big").length;
  document.querySelector("#smallCount").textContent = questions.filter(item => item.company === "small").length;
  document.querySelector("#domainCount").textContent = domains.length - 1;
  document.querySelector("#resultTitle").textContent = `${tracks[state.track]} · ${studyLabels[state.study]}`;
  document.querySelector("#resultHint").textContent = `${state.domain === "全部" ? "全方向" : state.domain} · ${state.level} · ${companyText(state.company)}`;
  const values = questions.map(item => getRecord(item.id));
  const mastered = values.filter(record => record.mastery === "mastered").length;
  document.querySelector("#learningSummary").textContent = `全题库 ${questions.length} 题 · 已自评 ${values.filter(record => record.mastery).length} · 已掌握 ${mastered} · 错题 ${values.filter(record => record.wrong).length}`;
  const progress = document.querySelector("#masteryProgress");
  progress.max = questions.length;
  progress.value = mastered;
  progress.textContent = `${mastered} / ${questions.length}`;
  updateStorageStatus();
}

function updateAnswer(node, id) {
  const open = revealed.has(id);
  node.querySelector(".answer-content").hidden = !open;
  const button = node.querySelector(".reveal-answer");
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? "收起答案" : "想好了，查看答案";
}

function renderCard(item) {
  const node = template.content.firstElementChild.cloneNode(true);
  const record = getRecord(item.id);
  node.dataset.id = item.id;
  node.classList.add(item.company);
  node.querySelector(".domain").textContent = item.domain;
  node.querySelector(".level").textContent = item.level;
  node.querySelector("h2").textContent = item.title;
  node.querySelector(".answer").textContent = item.answer;
  node.querySelector(".draft").value = record.draft;
  node.querySelector(".mastery-status").textContent = `${masteryLabels[record.mastery] || "未自评"}${record.wrong ? " · 已在错题本" : ""}`;
  node.querySelector(".wrong-toggle").textContent = record.wrong ? "移出错题本" : "加入错题本";
  node.querySelector(".wrong-toggle").setAttribute("aria-pressed", String(record.wrong));
  node.querySelectorAll("[data-rating]").forEach(button => button.setAttribute("aria-pressed", String(record.mastery === button.dataset.rating)));
  const detail = coaching[item.title];
  if (detail) {
    const root = node.querySelector(".coaching");
    for (const [heading, lines] of [["面试回答步骤", detail.steps], ["自查要点", detail.checks]]) {
      const h = document.createElement("h3");
      h.textContent = heading;
      const list = document.createElement("ol");
      lines.forEach(text => { const li = document.createElement("li"); li.textContent = text; list.append(li); });
      root.append(h, list);
    }
    if (detail.source) {
      const link = document.createElement("a");
      link.href = detail.source;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "延伸阅读：厂商资料";
      root.append(link);
    }
  }
  const tags = node.querySelector(".tags");
  [companyText(item.company), ...item.tags].forEach(tag => {
    const span = document.createElement("span");
    span.textContent = tag;
    tags.append(span);
  });
  updateAnswer(node, item.id);
  grid.append(node);
}

function companyText(value) {
  return value === "big" ? "大厂侧重" : value === "small" ? "小厂侧重" : "大厂 + 小厂";
}
