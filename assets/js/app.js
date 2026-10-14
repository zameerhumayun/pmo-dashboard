/* =====================================================================
   PMO Dashboard - shared helpers, page navigation, modal and start-up
   Every page is a function in App.views. App.go("name") draws that page
   inside <main id="view"> using the data in DB.data.
   ===================================================================== */

/* ---------- Small helpers (same style as reference.html) ---------- */

/** Escape text before putting it into HTML (prevents broken layout / script injection). */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Coloured status label, e.g. badge("On Track", "green"). */
const badge = (t, c) => `<span class="badge ${c}">${esc(t)}</span>`;
/** Percentage with at most one decimal, e.g. 52.5% */
const P = n => (Math.round((+n || 0) * 10) / 10) + "%";
/** Money in millions, e.g. "PKR 40M" (same format as reference.html). */
const M = n => { n = +n || 0; const s = n < 0 ? "-" : "", a = Math.abs(n); return "PKR " + s + (a / 1e6).toFixed(a % 1e6 ? 1 : 0) + "M"; };
/** Limit a percentage to 0-100. Used for progress values and chart/bar widths. */
const pct = n => Math.min(100, Math.max(0, +n || 0));
/** Colour for a Low / Medium / High / Critical value. */
const riskColor = l => ({ High: "red", Critical: "red", Medium: "yellow", Low: "green" }[l] || "gray");

/** Horizontal progress bar. The bar width is capped at 100%, the text shows the real value. */
function bar(label, val, color, txt) {
  return `<div class="row"><div class="l"><span>${label}</span><b>${txt ?? P(val)}</b></div><div class="bar"><i style="width:${pct(val)}%;background:${color}"></i></div></div>`;
}

const U = {
  now: () => new Date().toISOString(),
  /** Today's date as YYYY-MM-DD in local time. */
  today() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); },
  date(s) { if (!s) return "—"; const d = new Date(s.length <= 10 ? s + "T00:00:00" : s); return isNaN(d) ? esc(s) : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); },
  dateTime(s) { const d = new Date(s); return isNaN(d) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); },
  /** <option> list for a <select>. Items can be "value" or ["value", "label"]. */
  opts(list, sel) {
    return list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(sel ?? "") ? "selected" : ""}>${esc(l)}</option>`; }).join("");
  },
  /** Start a file download in the browser (used by Export JSON). */
  download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
    const a = $("<a>").attr({ href: url, download: name }).appendTo("body"); a[0].click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  /** Next ID in a list, e.g. R-012 -> R-013. */
  nextId(list, prefix) {
    const max = list.reduce((m, x) => Math.max(m, parseInt(String(x.id).replace(/\D/g, "")) || 0), 0);
    return prefix + String(max + 1).padStart(3, "0");
  },
  /** Data attribute value for [data-go] links. */
  link: (view, params) => `data-go="${view}" data-p='${esc(JSON.stringify(params || {}))}'`
};

/** Short message in the top-right corner. */
function toast(msg, bad) {
  $("#toast").text(msg).css("background", bad ? "#d92d20" : "#12a150").stop(true, true).fadeIn(150);
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $("#toast").fadeOut(250), bad ? 4000 : 2600);
}

/* ---------- Application shell ---------- */
const App = {
  views: {},          // each module registers its page: App.views.name = function ($view, params) { ... }
  view: "dashboard",
  params: {},
  currentId: null,    // project selected in the project dropdowns

  /** Open a page, e.g. App.go("details", { id: "PMO-001" }). */
  go(view, params) {
    this.view = view; this.params = params || {};
    if (this.params.id) this.currentId = this.params.id;
    $("#side").removeClass("open");
    this.render();
    window.scrollTo(0, 0);
  },

  /** Redraw the current page (called after every data change). */
  render() {
    const active = this.view === "details" || (this.view === "add" && this.params.id) ? "projects" : this.view;
    $("#nav a").each(function () { $(this).toggleClass("active", $(this).data("v") === active); });
    Charts.destroyAll();
    const $v = $("#view");
    if (["details", "performance", "report"].includes(this.view) && !DB.data.projects.length) {
      $v.html(`<div class="card">No projects yet. <a href="#" data-go="add">Add your first project</a>.</div>`);
    } else {
      (this.views[this.view] || this.views.dashboard)($v, this.params);
    }
    this.renderDbStatus();
  },

  /** The project currently selected (falls back to the first project). */
  current() { return Projects.get(this.currentId) || DB.data.projects[0] || null; },

  /** Dropdown to choose a project on project-specific pages. */
  projectSelect() {
    const cur = (this.current() || {}).id;
    return `<select class="noprint" onchange="App.go(App.view,{id:this.value})">${DB.data.projects.map(p => `<option value="${esc(p.id)}" ${p.id === cur ? "selected" : ""}>${esc(p.id)} - ${esc(p.name)}</option>`).join("")}</select>`;
  },

  /** Header save indicator and the warning banner. */
  renderDbStatus() {
    const s = DB.status;
    let cls = "ok", txt = "✓ Saved to " + DB.fileName;
    if (s.state === "saving") { cls = "busy"; txt = "Saving…"; }
    else if (s.state === "error") { cls = "bad"; txt = "⚠ Save failed"; }
    else if (DB.mode === "memory") { cls = s.dirty ? "bad" : "warn"; txt = s.dirty ? "⚠ Not saved - export needed" : "⚠ Read-only copy"; }
    else if (DB.mode === "hosted") { txt = "✓ database.json"; }
    $("#dbStatus").attr("class", "dbpill " + cls).text(txt);
    let b = "";
    if (DB.mode === "memory") b = `<div class="note warn noprint">⚠ <b>Changes are not being saved to a file.</b> Click <b>Export JSON</b> and replace database.json in the PMAI folder to keep your changes.</div>`;
    else if (s.state === "error") b = `<div class="note bad noprint">⚠ <b>The last change was NOT saved to database.json:</b> ${esc(s.error)} <button class="btn sm" onclick="DB.saveNow()">Try again</button> <button class="btn sm sec" onclick="DB.exportJSON()">Export a backup</button></div>`;
    $("#banner").html(b);
  },

  /* ---------- Modal dialog ---------- */
  /** App.modal({ title, body, buttons: [{ label, cls, onClick }], onOpen }). Return false from onClick to keep it open. */
  modal(o) {
    this._modalOnClose = o.onClose || null;
    $("#modalTitle").text(o.title || "");
    $("#modalBody").html(o.body || "");
    const btns = o.buttons || [{ label: "Close" }];
    $("#modalFoot").html(btns.map((b, i) => `<button class="btn ${b.cls || ""}" data-mb="${i}">${esc(b.label)}</button>`).join(""));
    $("#modalFoot [data-mb]").on("click", function () {
      const b = btns[+$(this).data("mb")];
      if (!b.onClick || b.onClick() !== false) App.closeModal();
    });
    $("#modal").addClass("open");
    if (o.onOpen) o.onOpen();
  },
  closeModal() {
    $("#modal").removeClass("open");
    const done = this._modalOnClose;
    this._modalOnClose = null;
    if (done) done();
  },

  start() { $("#welcome").hide(); $("#app").show(); this.go("dashboard"); },
  welcomeMsg(html, cls) { $("#welcomeMsg").html(html ? `<div class="note ${cls || ""}">${html}</div>` : ""); }
};

/* ---------- Event wiring ---------- */
$(function () {
  $("#nav a").on("click", function () { App.go($(this).data("v")); });
  $("#menuBtn").on("click", () => $("#side").toggleClass("open"));
  $("#sideShade").on("click", () => $("#side").removeClass("open"));
  $(document).on("click", "[data-close]", () => App.closeModal());
  $("#modal").on("mousedown", e => { if (e.target.id === "modal") App.closeModal(); });
  $(document).on("keydown", e => { if (e.key === "Escape") App.closeModal(); });

  // Links and buttons with data-go="page" data-p='{"id":"PMO-001"}' open a page.
  $(document).on("click", "[data-go]", function (e) {
    e.preventDefault(); App.closeModal();
    App.go($(this).data("go"), $(this).data("p") || {});
  });

  // Start screen
  $("#btnConnect").on("click", () => DB.connect());
  $("#btnReconnect").on("click", () => DB.reconnect());
  $("#btnImport").on("click", e => { e.preventDefault(); $("#importFile").val("").trigger("click"); });
  $("#importFile").on("change", function () { if (this.files[0]) DB.openInMemory(this.files[0]); });

  // Header buttons
  $("#dbStatus").on("click", () => DB.showTools());
  $("#btnSave").on("click", () => DB.saveNow());
  $("#btnExport").on("click", () => DB.exportJSON());
  $("#btnImportJson").on("click", () => $("#hdrImport").val("").trigger("click"));
  $("#hdrImport").on("change", function () { if (this.files[0]) DB.importReplace(this.files[0]); });

  // Warn before closing the tab while a save is running or unsaved changes exist.
  window.addEventListener("beforeunload", e => {
    if (DB.pending > 0 || DB.status.state === "error" || (DB.mode === "memory" && DB.status.dirty)) { e.preventDefault(); e.returnValue = ""; }
  });
  DB.boot();
});
