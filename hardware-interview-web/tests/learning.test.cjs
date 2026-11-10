const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const key = "hardware-interview-learning-v1";
const source = ["coaching.js", "app.js", "learning.js"].map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
let passed = 0;
function test(name, fn) { fn(); console.log(`PASS ${++passed}: ${name}`); }
function boot(saved, blocked = false) {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://training.example/" });
  if (saved) dom.window.localStorage.setItem(key, saved);
  if (blocked) {
    for (const method of ["getItem", "setItem"]) dom.window.Storage.prototype[method] = () => { throw new Error("blocked"); };
  }
  new vm.Script(source).runInContext(dom.getInternalVMContext());
  return dom;
}
const dom = boot();
let w = dom.window;
let d = w.document;
const $ = selector => d.querySelector(selector);
const click = selector => { assert.ok($(selector), selector); $(selector).click(); };
const filter = (name, value) => click(`[data-filter="${name}"][data-value="${value}"]`);
const input = (selector, value) => { $(selector).value = value; $(selector).dispatchEvent(new w.Event("input", { bubbles: true })); };
const snapshot = () => w.localStorage.getItem(key);
test("277 unique questions and 15 coaching guides match existing titles", () => {
  assert.equal(vm.runInContext("questions.length", dom.getInternalVMContext()), 277);
  assert.equal(vm.runInContext("new Set(questions.map(q => q.id)).size", dom.getInternalVMContext()), 277);
  assert.equal(vm.runInContext("Object.keys(coaching).length", dom.getInternalVMContext()), 15);
  assert.equal(vm.runInContext("Object.keys(coaching).every(title => questions.some(q => q.title === title))", dom.getInternalVMContext()), true);
});
test("single-question default, answers and self-rating hidden", () => {
  assert.equal(d.querySelectorAll(".question-card").length, 1);
  assert.equal($(".answer-content").hidden, true);
  assert.equal($(".reveal-answer").getAttribute("aria-expanded"), "false");
  assert.match($("#practicePosition").textContent, /1 \/ 277/);
  assert.equal($("#previousQuestion").disabled, true);
});
test("draft auto-save does not count as mastery", () => {
  input(".draft", "先核对工况 <img src=x onerror=alert(1)>");
  assert.match(Object.values(JSON.parse(snapshot()).records)[0].draft, /先核对工况/);
  assert.match($("#learningSummary").textContent, /已自评 0/);
});
test("reveal, rate weak, auto-add to notebook", () => {
  click(".reveal-answer");
  assert.equal($(".answer-content").hidden, false);
  click('[data-rating="weak"]');
  assert.match($(".mastery-status").textContent, /不会 · 已在错题本/);
  assert.match($("#learningSummary").textContent, /已自评 1 · 已掌握 0 · 错题 1/);
});
test("reload restores draft and rating but hides answer", () => {
  const restored = boot(snapshot());
  assert.equal(restored.window.document.querySelector(".answer-content").hidden, true);
  assert.match(restored.window.document.querySelector(".draft").value, /<img/);
  assert.equal(restored.window.document.querySelectorAll(".draft img").length, 0);
  assert.match(restored.window.document.querySelector(".mastery-status").textContent, /不会/);
  restored.window.close();
});
test("wrong notebook and mastery remove resolved item from current results", () => {
  filter("study", "wrong");
  assert.equal($("#totalCount").textContent, "1");
  click(".reveal-answer");
  click('[data-rating="mastered"]');
  assert.equal($("#totalCount").textContent, "0");
  assert.match($("#learningSummary").textContent, /已掌握 1 · 错题 0/);
  assert.equal($("#masteryProgress").value, 1);
});
test("unrated filter excludes rated item and navigation resumes", () => {
  filter("study", "new");
  assert.equal($("#totalCount").textContent, "276");
  click("#nextQuestion");
  const title = $(".question-card h2").textContent;
  const restored = boot(snapshot());
  assert.equal(restored.window.document.querySelector(".question-card h2").textContent, title);
  assert.match(restored.window.document.querySelector("#practicePosition").textContent, /2 \/ 276/);
  restored.window.close();
});
test("original company, domain, difficulty, keyword filters intersect correctly", () => {
  filter("study", "all"); filter("company", "small"); filter("domain", "电源设计"); filter("level", "基础");
  input("#searchInput", "纹波");
  // Original search also matches answers and tags (the light-load question matches too).
  assert.equal($("#totalCount").textContent, "2");
  assert.match($(".question-card h2").textContent, /什么是电源纹波/);
  click(".reveal-answer");
  assert.match($(".coaching").textContent, /自查要点/);
});
test("specialist tracks, empty intersections and browse preserve controls", () => {
  input("#searchInput", ""); filter("domain", "全部"); filter("level", "全部"); filter("company", "all");
  for (const [track, label] of [["power", "电源设计"], ["production", "量产测试"], ["reliability", "可靠性测试"]]) {
    filter("track", track); click('[data-mode="browse"]');
    assert.ok(d.querySelectorAll(".question-card").length > 0);
    assert.ok([...d.querySelectorAll(".domain")].every(node => node.textContent === label));
    assert.ok([...d.querySelectorAll(".answer-content")].every(node => node.hidden));
  }
  filter("domain", "FPGA"); assert.equal($("#totalCount").textContent, "0");
  assert.match($(".empty").textContent, /调整筛选/);
});
test("sort, manual notebook toggle and original company shortcuts", () => {
  filter("domain", "全部"); filter("track", "all");
  $("#sortSelect").value = "level"; $("#sortSelect").dispatchEvent(new w.Event("change"));
  assert.equal($(".level").textContent, "基础");
  click(".wrong-toggle"); assert.equal($(".wrong-toggle").getAttribute("aria-pressed"), "true");
  click(".wrong-toggle"); assert.equal($(".wrong-toggle").getAttribute("aria-pressed"), "false");
  click("#focusBig"); assert.ok([...d.querySelectorAll(".question-card")].every(node => node.classList.contains("big")));
  click("#focusSmall"); assert.ok([...d.querySelectorAll(".question-card")].every(node => node.classList.contains("small")));
});
test("learning rating persists and re-enters notebook", () => {
  click(".reveal-answer"); click('[data-rating="learning"]');
  assert.match($(".mastery-status").textContent, /不熟 · 已在错题本/);
  filter("study", "learning"); assert.equal($("#totalCount").textContent, "1");
  assert.equal($(".answer-content").hidden, true);
});
test("export produces parseable versioned records", () => {
  let blob;
  const OriginalBlob = w.Blob;
  w.Blob = class extends OriginalBlob { constructor(parts, options) { super(parts, options); this.parts = parts; } };
  w.URL.createObjectURL = value => { blob = value; return "blob:unit-test"; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { assert.equal(this.download, "hardware-interview-progress.json"); };
  click("#exportProgress"); assert.ok(blob instanceof w.Blob);
  const exported = JSON.parse(blob.parts.join(""));
  assert.equal(exported.version, 1);
  assert.deepEqual(exported.records, JSON.parse(snapshot()).records);
});
test("malformed progress, unknown version and blocked storage leave app usable", () => {
  for (const value of ["{", '{"version":2,"records":{}}', '{"version":1,"records":[]}']) {
    const broken = boot(value);
    assert.match(broken.window.document.querySelector("#storageStatus").textContent, /无法读取/);
    assert.equal(broken.window.document.querySelectorAll(".question-card").length, 1);
    broken.window.close();
  }
  const blocked = boot(null, true);
  const bd = blocked.window.document;
  bd.querySelector(".reveal-answer").click(); bd.querySelector('[data-rating="weak"]').click();
  assert.match(bd.querySelector("#storageStatus").textContent, /保存失败/);
  assert.match(bd.querySelector("#learningSummary").textContent, /错题 1/);
  blocked.window.close();
});
test("invalid records and filter state are normalized", () => {
  const current = JSON.parse(snapshot());
  const id = Object.keys(current.records)[0];
  const normalized = boot(JSON.stringify({ version: 1, records: { [id]: { mastery: "toString", wrong: "yes", draft: 42 }, bogus: {} }, state: { mode: "invalid", domain: "no such domain" } }));
  const nd = normalized.window.document;
  assert.equal(nd.querySelectorAll(".question-card").length, 1);
  assert.equal(nd.querySelector(".draft").value, "");
  assert.match(nd.querySelector("#learningSummary").textContent, /已自评 0/);
  normalized.window.close();
});
dom.window.close();
console.log(`${passed} DOM regression scenarios passed. Real-browser layout/accessibility testing is separate.`);
