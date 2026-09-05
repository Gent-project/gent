const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const toLines = (value) => value.replace(/\r\n/g, "\n").split("\n");

function buildLcsMatrix(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = a[i - 1] === b[j - 1]
        ? matrix[i - 1][j - 1] + 1
        : Math.max(matrix[i - 1][j], matrix[i][j - 1]);
    }
  }
  return matrix;
}

function lcsDiff(oldLines, newLines) {
  const matrix = buildLcsMatrix(oldLines, newLines);
  const operations = [];
  let i = oldLines.length;
  let j = newLines.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      operations.push({ type: "equal", text: oldLines[i - 1], old: i, next: j }); i -= 1; j -= 1;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      operations.push({ type: "insert", text: newLines[j - 1], old: "", next: j }); j -= 1;
    } else {
      operations.push({ type: "delete", text: oldLines[i - 1], old: i, next: "" }); i -= 1;
    }
  }
  return { matrix, operations: operations.reverse() };
}

function renderLcs() {
  const oldLines = toLines($("#lcsOld").value);
  const newLines = toLines($("#lcsNew").value);
  const { matrix, operations } = lcsDiff(oldLines, newLines);
  const stats = { equal: 0, insert: 0, delete: 0 };
  operations.forEach((item) => { stats[item.type] += 1; });
  $("#lcsMetrics").innerHTML = `
    <span class="metric">المشترك <b>${stats.equal}</b></span>
    <span class="metric">إضافة <b>${stats.insert}</b></span>
    <span class="metric">حذف <b>${stats.delete}</b></span>
    <span class="metric">طول LCS <b>${matrix.at(-1).at(-1)}</b></span>`;
  $("#diffOutput").innerHTML = operations.map((item) => {
    const sign = item.type === "insert" ? "+" : item.type === "delete" ? "−" : " ";
    const line = item.type === "insert" ? item.next : item.old;
    return `<div class="diff-line ${item.type}"><span class="line-no">${line}</span><span>${sign}</span><span>${escapeHtml(item.text) || "&nbsp;"}</span></div>`;
  }).join("");

  const maxCells = 100;
  if ((oldLines.length + 1) * (newLines.length + 1) > maxCells) {
    $("#matrixOutput").innerHTML = '<p style="padding:12px;color:#91a9b2;font-size:12px">المثال كبير لعرض المصفوفة. النتيجة ما زالت محسوبة كاملة.</p>';
  } else {
    let html = `<table class="matrix"><tr><th>∅</th><th>∅</th>${newLines.map((line) => `<th>${escapeHtml(line.slice(0, 5)) || "∅"}</th>`).join("")}</tr>`;
    for (let i = 0; i <= oldLines.length; i += 1) {
      html += `<tr><th>${i === 0 ? "∅" : escapeHtml(oldLines[i - 1].slice(0, 5)) || "∅"}</th>`;
      for (let j = 0; j <= newLines.length; j += 1) {
        const final = i === oldLines.length && j === newLines.length ? ' class="final"' : "";
        html += `<td${final}>${matrix[i][j]}</td>`;
      }
      html += "</tr>";
    }
    $("#matrixOutput").innerHTML = `${html}</table>`;
  }
}

$("#runLcs").addEventListener("click", renderLcs);
$("#showMatrix").addEventListener("change", (event) => { $("#matrixPanel").hidden = !event.target.checked; });
$("#lcsExample").addEventListener("click", () => {
  $("#lcsOld").value = 'const user = "Lina";\nconst role = "editor";\nsave(user);';
  $("#lcsNew").value = 'const user = "Lina";\nconst role = "admin";\naudit(user);\nsave(user);';
  renderLcs();
});

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  const steps = [];
  for (let index = 0; index < value.length; index += 1) {
    const before = hash >>> 0;
    const code = value.charCodeAt(index);
    hash ^= code;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    if (index < 10) steps.push({ index, char: value[index], code, before, after: hash });
  }
  return { hex: (hash >>> 0).toString(16).padStart(8, "0"), steps };
}

function asHex(number) { return `0x${(number >>> 0).toString(16).padStart(8, "0")}`; }
function renderFnv() {
  const { hex, steps } = fnv1a32($("#fnvInput").value);
  $("#fnvHash").textContent = hex;
  $("#fnvSteps").innerHTML = steps.map((step) => `<tr><td>${step.index + 1}</td><td>${escapeHtml(step.char) || "space"}</td><td>${step.code}</td><td>${asHex(step.before)}</td><td>${asHex(step.after)}</td></tr>`).join("") || '<tr><td colspan="5">أدخل نصاً لبدء الحساب</td></tr>';
}
$("#fnvInput").addEventListener("input", renderFnv);

const commits = [
  { id: "C0", x: 90, y: 150, parents: [], type: "main", title: "بداية المشروع", note: "أول commit، لذلك لا يملك أباً." },
  { id: "C1", x: 220, y: 150, parents: ["C0"], type: "main", title: "إعداد المشروع", note: "أبوه C0 على المسار الرئيسي." },
  { id: "C2", x: 350, y: 150, parents: ["C1"], type: "main", title: "محرك التخزين", note: "هنا بدأ فرع feature لاحقاً." },
  { id: "C3", x: 480, y: 150, parents: ["C2"], type: "main", title: "تحسين diff", note: "commit عادي بأب واحد." },
  { id: "C4", x: 610, y: 150, parents: ["C3"], type: "main", title: "واجهة الأوامر", note: "آخر commit رئيسي قبل الدمج." },
  { id: "F1", x: 480, y: 65, parents: ["C2"], type: "branch", title: "بداية feature", note: "تفرّع من C2، وليس من C3." },
  { id: "F2", x: 610, y: 65, parents: ["F1"], type: "branch", title: "إكمال feature", note: "رأس فرع feature قبل الدمج." },
  { id: "C5", x: 745, y: 150, parents: ["C4", "F2"], type: "merge", title: "merge", note: "له أبوان: C4 من الرئيسي وF2 من الفرع." }
];
const commitMap = new Map(commits.map((commit) => [commit.id, commit]));

function graphMarkup(interactive = false) {
  const edges = commits.flatMap((commit) => commit.parents.map((parent, index) => {
    const p = commitMap.get(parent);
    return `<path class="edge ${index === 1 ? "merge" : ""}" d="M ${commit.x - 26} ${commit.y} C ${commit.x - 65} ${commit.y}, ${p.x + 65} ${p.y}, ${p.x + 26} ${p.y}" />`;
  })).join("");
  const nodes = commits.map((commit) => `<g class="graph-node ${commit.type === "branch" ? "branch" : ""} ${commit.type === "merge" ? "merge-node" : ""}" data-id="${commit.id}" ${interactive ? 'tabindex="0" role="button"' : ""}><circle cx="${commit.x}" cy="${commit.y}" r="26"/><text x="${commit.x}" y="${commit.y + 5}" text-anchor="middle">${commit.id}</text></g>`).join("");
  return `<g>${edges}</g><g>${nodes}</g>`;
}

$("#dagSvg").innerHTML = graphMarkup(true);
function inspectCommit(id) {
  const commit = commitMap.get(id);
  $("#dagInspector").innerHTML = `<span>commit</span><b>${commit.id} — ${commit.title}</b><p>${commit.note}</p>`;
}
$$("#dagSvg .graph-node").forEach((node) => {
  node.addEventListener("mouseenter", () => inspectCommit(node.dataset.id));
  node.addEventListener("focus", () => inspectCommit(node.dataset.id));
});

const selectable = commits.filter((commit) => commit.parents.length > 0);
[$("#nodeA"), $("#nodeB")].forEach((select) => { select.innerHTML = selectable.map((commit) => `<option value="${commit.id}">${commit.id}</option>`).join(""); });
$("#nodeA").value = "C4";
$("#nodeB").value = "F2";
$("#bfsSvg").innerHTML = graphMarkup();
let bfsEvents = [];
let bfsIndex = 0;
let bfsTimer = null;

function parentsOf(id) { return commitMap.get(id)?.parents ?? []; }
function createBfsTrace(a, b) {
  const events = [];
  const ancestorsA = new Set();
  const stack = [a];
  while (stack.length) {
    const current = stack.pop();
    if (ancestorsA.has(current)) continue;
    ancestorsA.add(current);
    events.push({ phase: "collect", id: current });
    stack.push(...parentsOf(current));
  }
  const queue = [b];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    const found = ancestorsA.has(current);
    events.push({ phase: "search", id: current, found, queue: [...queue] });
    if (found) break;
    queue.push(...parentsOf(current));
  }
  return events;
}

function resetBfs() {
  clearInterval(bfsTimer); bfsTimer = null; bfsEvents = []; bfsIndex = 0;
  $("#bfsSvg").innerHTML = graphMarkup();
  $("#bfsLog").innerHTML = "<span>جاهز</span><p>اختر عقدتين ثم ابدأ البحث.</p>";
}
function nextBfsStep() {
  if (!bfsEvents.length) bfsEvents = createBfsTrace($("#nodeA").value, $("#nodeB").value);
  if (bfsIndex >= bfsEvents.length) { clearInterval(bfsTimer); bfsTimer = null; return false; }
  const event = bfsEvents[bfsIndex];
  const node = $(`#bfsSvg .graph-node[data-id="${event.id}"]`);
  if (event.phase === "collect") {
    node.classList.add("ancestor");
    $("#bfsLog").innerHTML = `<span>جمع أسلاف A</span><p>أضفنا <b>${event.id}</b> إلى مجموعة أسلاف A.</p>`;
  } else if (event.found) {
    node.classList.remove("ancestor", "visiting"); node.classList.add("found");
    $("#bfsLog").innerHTML = `<span>وجدنا LCA</span><p><b>${event.id}</b> موجود ضمن أسلاف A؛ هذه هي نقطة الأساس للدمج.</p>`;
    clearInterval(bfsTimer); bfsTimer = null;
  } else {
    $$("#bfsSvg .graph-node.visiting").forEach((item) => item.classList.remove("visiting"));
    node.classList.add("visiting");
    $("#bfsLog").innerHTML = `<span>بحث من B</span><p>زرنا <b>${event.id}</b> ولم نجده ضمن أسلاف A؛ نتابع نحو آبائه.</p>`;
  }
  bfsIndex += 1;
  return !event.found;
}
$("#bfsNext").addEventListener("click", nextBfsStep);
$("#bfsReset").addEventListener("click", resetBfs);
$("#nodeA").addEventListener("change", resetBfs); $("#nodeB").addEventListener("change", resetBfs);
$("#bfsAuto").addEventListener("click", () => {
  resetBfs(); nextBfsStep(); bfsTimer = setInterval(() => { if (!nextBfsStep()) clearInterval(bfsTimer); }, 650);
});

function bytesToHex(buffer) { return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function countDifferentBits(hexA, hexB) {
  let difference = 0;
  for (let index = 0; index < hexA.length; index += 1) {
    let xor = parseInt(hexA[index], 16) ^ parseInt(hexB[index], 16);
    while (xor) { difference += xor & 1; xor >>= 1; }
  }
  return difference;
}
async function sha256(value) {
  const data = new TextEncoder().encode(value);
  return bytesToHex(await crypto.subtle.digest("SHA-256", data));
}
async function renderSha() {
  const [hashA, hashB] = await Promise.all([sha256($("#shaInputA").value), sha256($("#shaInputB").value)]);
  const difference = countDifferentBits(hashA, hashB);
  $("#shaHashA").textContent = hashA; $("#shaHashB").textContent = hashB;
  $("#bitDifference").textContent = difference;
  $("#avalancheFill").style.width = `${difference / 256 * 100}%`;
  $("#avalancheText").textContent = `${Math.round(difference / 256 * 100)}% من البتات تغيّرت`;
}
let shaDebounce;
[$("#shaInputA"), $("#shaInputB")].forEach((input) => input.addEventListener("input", () => { clearTimeout(shaDebounce); shaDebounce = setTimeout(renderSha, 100); }));

const chapterObserver = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  $$(".side-link").forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
}, { rootMargin: "-25% 0px -58% 0px", threshold: [0, .25, .5] });
$$('.chapter').forEach((chapter) => chapterObserver.observe(chapter));
window.addEventListener("scroll", () => {
  const available = document.documentElement.scrollHeight - innerHeight;
  $("#readingProgress").style.width = `${available ? scrollY / available * 100 : 0}%`;
}, { passive: true });

renderLcs(); renderFnv(); renderSha();
