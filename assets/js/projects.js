/* =====================================================================
   PMO Dashboard - projects
   * Projects.calc()  : all cost, schedule, risk and health calculations
   * Completion validation (the client's most important rule)
   * Projects list, Add / Edit form, Delete, and the Project Details page
   ===================================================================== */

const PHASES = ["Initiation", "Planning", "Execution", "Monitoring", "Closing"];
const STATUSES = ["Planning", "In Progress", "On Hold", "At Risk", "Completed"];
const HEALTH = ["On Track", "At Risk", "Critical"];        // index = severity 0 / 1 / 2
const HEALTH_COLOR = ["green", "yellow", "red"];
const DAY = 864e5;                                          // milliseconds in one day

const Projects = {
  get: id => DB.data.projects.find(p => p.id === id),
  risksOf: id => DB.data.risks.filter(r => r.projectId === id),
  issuesOf: id => DB.data.issues.filter(i => i.projectId === id),

  /**
   * Calculate every indicator for one project. Formulas (from reference.html):
   *   Budget utilization (%) = Actual Cost / Approved Budget x 100   (can be above 100%)
   *   Remaining budget       = Approved Budget - Actual Cost         (negative = overrun)
   *   Progress variance (%)  = Actual Progress - Planned Progress    (negative = behind)
   *   Risk score             = open High x 3 + open Medium x 2 + open Low x 1
   *                            score >= 8 -> High, >= 4 -> Medium, else Low
   * Each area gets a severity 0 (green), 1 (yellow) or 2 (red).
   * Overall health = the worst severity of cost, schedule, risks and issues.
   */
  calc(p) {
    const st = DB.data.settings;
    const util = p.budget > 0 ? p.actual / p.budget * 100 : 0;
    const remaining = p.budget - p.actual;
    const progVar = p.ap - p.pp;
    const done = p.status === "Completed";

    // Only unresolved risks count towards the risk score.
    const openRisks = this.risksOf(p.id).filter(r => r.status !== "Resolved");
    const rc = { High: 0, Medium: 0, Low: 0 };
    openRisks.forEach(r => rc[r.level]++);
    const riskScore = rc.High * 3 + rc.Medium * 2 + rc.Low;
    const riskLevel = riskScore >= 8 ? "High" : riskScore >= 4 ? "Medium" : "Low";

    const openIssues = this.issuesOf(p.id).filter(i => i.status !== "Resolved");
    const critIssues = openIssues.filter(i => i.severity === "Critical").length;
    const highIssues = openIssues.filter(i => i.severity === "High").length;

    // Deadline exceeded: the expected end date has passed and the work is not finished.
    const overdue = !done && !!p.end && U.today() > p.end && p.ap < 100;

    const costSev = util > 100 ? 2 : util > st.budgetWarning ? 1 : 0;
    const schedSev = done ? 0 : overdue || progVar < -st.scheduleCritical ? 2 : progVar < -st.scheduleWarning ? 1 : 0;
    const riskSev = riskScore >= 8 ? 2 : riskScore >= 4 ? 1 : 0;
    const issueSev = critIssues ? 2 : highIssues ? 1 : 0;
    const sev = Math.max(costSev, schedSev, riskSev, issueSev);

    const forecast = this.forecast(p);
    return {
      util, remaining, progVar, rc, riskScore, riskLevel, openRisks, openIssues, critIssues, highIssues, overdue,
      plannedOver: p.planned > p.budget,
      costSev, schedSev, riskSev, issueSev, sev,
      health: HEALTH[sev], healthColor: HEALTH_COLOR[sev],
      costStatus: ["Within Budget", "Near Budget Limit", "Over Budget"][costSev],
      schedStatus: done ? "Completed" : overdue ? "Deadline Exceeded" : ["On Schedule", "Slightly Behind", "Behind Schedule"][schedSev],
      forecast,
      lateDays: forecast && p.end ? Math.round((new Date(forecast) - new Date(p.end + "T00:00:00")) / DAY) : 0
    };
  },

  /**
   * Forecast finish date at the current pace:
   *   days needed = days since start x 100 / actual progress
   * Returns YYYY-MM-DD, or null when it cannot be estimated (no progress yet / not started).
   */
  forecast(p) {
    if (p.status === "Completed") return p.completedAt ? p.completedAt.slice(0, 10) : p.end;
    const start = new Date(p.start + "T00:00:00"), elapsed = (new Date(U.today() + "T00:00:00") - start) / DAY;
    if (!(p.ap > 0) || !(elapsed > 0)) return null;
    if (p.ap >= 100) return U.today();
    return new Date(start.getTime() + Math.round(elapsed * 100 / p.ap) * DAY).toISOString().slice(0, 10);
  },

  statusColor: s => ({ Completed: "green", "In Progress": "blue", Planning: "gray", "On Hold": "yellow", "At Risk": "red" }[s] || "gray"),
  healthBadge(c) { return badge(c.health, c.healthColor); },

  /* ---------------- Completion validation ---------------- */

  /** Required information that must be filled in before a project can be closed. */
  missingInfo(p) {
    const need = [["name", "Project Name"], ["manager", "Project Manager"], ["dept", "Department"], ["desc", "Description"], ["start", "Start Date"], ["end", "Expected End Date"], ["update", "Latest Update / Remarks"]];
    const miss = need.filter(([k]) => !String(p[k] || "").trim()).map(([, l]) => l);
    if (!(p.budget > 0)) miss.push("Approved Budget");
    if (!(p.actual > 0)) miss.push("Actual Cost");
    return miss;
  },

  /**
   * The four completion checks. A project can only be marked Completed when all pass:
   *   1. Actual progress = 100%
   *   2. No unresolved Critical issues
   *   3. No unresolved High-severity risks
   *   4. Required project information is complete
   */
  completionChecks(p) {
    const crit = this.issuesOf(p.id).filter(i => i.status !== "Resolved" && i.severity === "Critical");
    const high = this.risksOf(p.id).filter(r => r.status !== "Resolved" && r.level === "High");
    const miss = this.missingInfo(p);
    return [
      { ok: +p.ap === 100, text: "Actual progress is 100%", problem: `Actual Progress: ${P(p.ap)}`,
        action: "Complete the remaining work, then update Actual Progress to 100%.", link: ["add", { id: p.id }], linkText: "Edit project" },
      { ok: !crit.length, text: "No unresolved critical issues", problem: `${crit.length} critical issue(s) unresolved (${crit.map(i => i.id).join(", ")})`,
        action: "Resolve the critical issues in the Issue Register.", link: ["risks", { tab: "issues", pid: p.id }], linkText: "Open Issue Register" },
      { ok: !high.length, text: "No unresolved high risks", problem: `${high.length} high risk(s) unresolved (${high.map(r => r.id).join(", ")})`,
        action: "Carry out the mitigation actions and resolve the high risks.", link: ["risks", { tab: "risks", pid: p.id }], linkText: "Open Risk Register" },
      { ok: !miss.length, text: "Required project information is complete", problem: `Missing information: ${miss.join(", ")}`,
        action: "Fill in the missing fields in the project form.", link: ["add", { id: p.id }], linkText: "Edit project" }
    ];
  },

  /**
   * Run the checks. If all pass, onOk() is called. Otherwise the
   * "COMPLETION BLOCKED" message is shown and nothing is changed.
   * extraButtons lets the form offer "save other changes but keep the old status".
   */
  checkCompletion(p, onOk, extraButtons) {
    const checks = this.completionChecks(p), failed = checks.filter(c => !c.ok);
    if (!failed.length) return onOk();
    App.modal({
      title: "⛔ COMPLETION BLOCKED",
      body: `<div class="note bad"><b>${esc(p.name)}</b> cannot be marked as Completed. The project status was not changed.</div>
        <b>Problems found</b>
        <ul class="clean">${failed.map(c => `<li class="check bad">✗ ${esc(c.problem)}</li>`).join("")}</ul>
        <b>Required actions</b>
        <ul class="clean">${failed.map(c => `<li>${esc(c.action)} <a href="#" ${U.link(c.link[0], c.link[1])}>${esc(c.linkText)} →</a></li>`).join("")}</ul>
        <div class="small muted">Passed: ${checks.filter(c => c.ok).map(c => "✓ " + esc(c.text)).join(" &nbsp; ") || "none"}</div>`,
      buttons: [...(extraButtons || []), { label: "OK", cls: "sec" }]
    });
  },

  /** "Mark as Completed" button on the details page. Progress is never changed automatically. */
  markCompleted(id) {
    const p = this.get(id);
    this.checkCompletion(p, async () => {
      if (!confirm(`All completion checks passed.\nMark "${p.name}" as Completed?`)) return;
      Object.assign(p, { status: "Completed", phase: "Closing", completedAt: U.now(), updatedAt: U.now() });
      if (!(await DB.save(`Project ${p.id} completed`))) return;
      toast("Project marked as Completed"); App.render();
    });
  },

  /** Delete a project together with its risks, issues and comments. */
  async remove(id) {
    const p = this.get(id);
    const r = this.risksOf(id).length, i = this.issuesOf(id).length, c = DB.data.comments.filter(x => x.projectId === id).length;
    if (!confirm(`Delete project "${p.name}"?\nIts ${r} risk(s), ${i} issue(s) and ${c} comment(s) will also be deleted. This cannot be undone.`)) return;
    DB.data.projects = DB.data.projects.filter(x => x.id !== id);
    DB.data.risks = DB.data.risks.filter(x => x.projectId !== id);
    DB.data.issues = DB.data.issues.filter(x => x.projectId !== id);
    DB.data.comments = DB.data.comments.filter(x => x.projectId !== id);
    if (App.currentId === id) App.currentId = null;
    if (!(await DB.save(`Project ${id} deleted`))) return;
    toast("Project deleted");
    App.go(App.view === "dashboard" ? "dashboard" : "projects");
  },

  /** View / Edit / Delete buttons used in the project tables. */
  actions(p) {
    return `<span class="nowrap"><button class="btn sm" ${U.link("details", { id: p.id })}>View</button><button class="btn sm sec" ${U.link("add", { id: p.id })}>Edit</button><button class="btn sm del" onclick="Projects.remove('${esc(p.id)}')">Delete</button></span>`;
  }
};

/* ---------------- Projects list ---------------- */
App.views.projects = function ($v) {
  const list = DB.data.projects;
  $v.html(`<div class="toolbar"><h2>Projects</h2><button class="btn" data-go="add">+ Add Project</button></div>
    <div class="card"><div class="tw"><table><thead><tr><th>ID</th><th>Project</th><th>Manager</th><th>Phase</th><th>Status</th><th>Progress</th><th>Budget</th><th>Health</th><th>Actions</th></tr></thead><tbody>
    ${list.map(p => {
      const c = Projects.calc(p);
      return `<tr><td>${esc(p.id)}</td><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.dept)}</div></td><td>${esc(p.manager)}</td>
        <td>${esc(p.phase)}</td><td>${badge(p.status, Projects.statusColor(p.status))}</td><td class="nowrap">${P(p.ap)} <span class="small muted">/ ${P(p.pp)} planned</span></td>
        <td>${M(p.budget)}</td><td>${Projects.healthBadge(c)}</td><td>${Projects.actions(p)}</td></tr>`;
    }).join("") || `<tr><td colspan="9" class="muted">No projects yet.</td></tr>`}
    </tbody></table></div></div>`);
};

/* ---------------- Add / Edit project form ---------------- */
App.views.add = function ($v, params) {
  const edit = params.id ? Projects.get(params.id) : null;
  const p = edit || { id: U.nextId(DB.data.projects, "PMO-"), name: "", manager: "", dept: "", desc: "", phase: "Initiation", status: "Planning", budget: "", planned: "", actual: 0, start: U.today(), end: "", pp: 0, ap: 0, update: "" };
  const c = edit ? Projects.calc(edit) : null;
  const num = (n, l, v, extra) => `<div><label>${l}</label><input type="number" name="${n}" value="${esc(v)}" min="0" step="any" ${extra || ""}><div class="err"></div></div>`;

  $v.html(`<div class="toolbar"><h2>${edit ? "Edit Project - " + esc(p.id) : "Add New Project"}</h2>${edit ? `<button class="btn sec" ${U.link("details", { id: p.id })}>Cancel</button>` : ""}</div>
  <form class="card form" id="pform" novalidate>
    <div class="sec-t full">1. Project Information</div>
    <div><label>Project ID *</label><input name="id" value="${esc(p.id)}" ${edit ? "readonly" : ""} maxlength="20"><div class="err"></div></div>
    <div><label>Project Name *</label><input name="name" value="${esc(p.name)}" maxlength="120"><div class="err"></div></div>
    <div><label>Project Manager *</label><input name="manager" value="${esc(p.manager)}" maxlength="80"><div class="err"></div></div>
    <div><label>Department *</label><input name="dept" value="${esc(p.dept)}" maxlength="80"><div class="err"></div></div>
    <div><label>Current Phase *</label><select name="phase">${U.opts(PHASES, p.phase)}</select></div>
    <div><label>Project Status *</label><select name="status">${U.opts(STATUSES, p.status)}</select><div class="err"></div></div>
    <div class="full"><label>Project Description *</label><textarea name="desc" rows="2" maxlength="1000">${esc(p.desc)}</textarea><div class="err"></div></div>
    <div class="full" id="completeHint"></div>

    <div class="sec-t full">2. Budget Information (PKR)</div>
    ${num("budget", "Approved Budget *", p.budget)}${num("planned", "Planned Cost *", p.planned)}${num("actual", "Actual Cost *", p.actual)}
    <div class="hint full" id="costHint"></div>

    <div class="sec-t full">3. Schedule Information</div>
    <div><label>Start Date *</label><input type="date" name="start" value="${esc(p.start)}"><div class="err"></div></div>
    <div><label>Expected End Date *</label><input type="date" name="end" value="${esc(p.end)}"><div class="err"></div></div>
    ${num("pp", "Planned Progress (%) *", p.pp, 'max="100" step="1"')}${num("ap", "Actual Progress (%) *", p.ap, 'max="100" step="1"')}
    <div class="hint full">Progress shows how much of the work is done, so it must be between 0% and 100%.</div>

    <div class="sec-t full">4. Risk Information</div>
    <div class="full">${edit
      ? `Open risks: ${badge("High: " + c.rc.High, "red")} ${badge("Medium: " + c.rc.Medium, "yellow")} ${badge("Low: " + c.rc.Low, "green")}
         &nbsp; <a href="#" ${U.link("risks", { tab: "risks", pid: p.id })}>Manage risks in the Risk Register →</a>`
      : `After saving the project, add each risk in <b>Risks &amp; Issues</b>.`}
      <div class="hint">Risks are recorded one by one in the Risk Register, so the counts are calculated automatically and always match.</div></div>

    <div class="sec-t full">5. Latest Project Update / Remarks</div>
    <div class="full"><textarea name="update" rows="3" maxlength="2000" placeholder="Progress achieved, problems faced, next steps...">${esc(p.update)}</textarea></div>

    <div class="full"><button class="btn big" type="submit">${edit ? "Save Changes" : "Save Project"}</button>
      ${edit ? `<button class="btn del" type="button" onclick="Projects.remove('${esc(p.id)}')">Delete Project</button>` : ""}</div>
  </form>`);

  const $f = $("#pform");
  const val = n => $f.find(`[name=${n}]`).val();
  const setErr = (n, m) => { $f.find(`[name=${n}]`).toggleClass("bad", !!m).siblings(".err").text(m || ""); return !m; };

  // Progress must be a number from 0 to 100 (checked while typing and before saving).
  const checkPct = n => { const v = val(n); return setErr(n, v === "" ? "Required" : isNaN(+v) || +v < 0 || +v > 100 ? "Must be between 0 and 100" : ""); };

  // Live warnings for cost overruns (these may exceed 100% - they are not capped).
  const costHint = () => {
    const b = +val("budget") || 0, a = +val("actual") || 0, pl = +val("planned") || 0, msgs = [];
    if (b && a > b) msgs.push(`⚠ Actual cost exceeds the approved budget by ${M(a - b)} (${P(a / b * 100)} of budget used).`);
    if (b && pl > b) msgs.push(`⚠ Planned cost exceeds the approved budget by ${M(pl - b)}.`);
    $("#costHint").html(msgs.join("<br>"));
  };

  /** Collect the form values into a project object. */
  const formData = () => ({
    name: val("name").trim(), manager: val("manager").trim(), dept: val("dept").trim(), desc: val("desc").trim(),
    phase: val("phase"), status: val("status"), budget: +val("budget") || 0, planned: +val("planned") || 0, actual: +val("actual") || 0,
    start: val("start"), end: val("end"), pp: +val("pp"), ap: +val("ap"), update: val("update").trim(), updatedAt: U.now()
  });

  // When "Completed" is selected, show the completion checks immediately.
  const completeHint = () => {
    if (val("status") !== "Completed" || (edit && edit.status === "Completed")) return $("#completeHint").html("");
    const draft = Object.assign({ id: p.id }, edit || {}, formData());
    const failed = Projects.completionChecks(draft).filter(x => !x.ok);
    $("#completeHint").html(failed.length
      ? `<div class="note bad" style="margin:0"><b>Completion will be blocked:</b><ul class="clean" style="margin-bottom:0">${failed.map(x => `<li>${esc(x.problem)}</li>`).join("")}</ul></div>`
      : `<div class="note good" style="margin:0">✓ All completion checks pass. The project can be saved as Completed.</div>`);
  };

  $f.on("input", "[name=pp],[name=ap]", function () { checkPct(this.name); });
  $f.on("input", "[name=budget],[name=actual],[name=planned]", costHint);
  $f.on("input change", completeHint);
  costHint(); completeHint();

  /** Save the project. Same completion validation as the "Mark as Completed" button. */
  $f.on("submit", async function (e) {
    e.preventDefault();
    $f.find(".err").text(""); $f.find(".bad").removeClass("bad");

    // 1. Validate required fields
    let ok = true;
    const id = val("id").trim();
    if (!edit) {
      if (!id) ok = setErr("id", "Project ID is required");
      else if (!/^[A-Za-z0-9_-]+$/.test(id)) ok = setErr("id", "Use letters, numbers and - only (e.g. PMO-004)");
      else if (Projects.get(id)) ok = setErr("id", "This ID is already used");
    }
    [["name", "Project name"], ["manager", "Project manager"], ["dept", "Department"], ["desc", "Description"]].forEach(([n, l]) => { if (!val(n).trim()) ok = setErr(n, l + " is required") && ok; });
    ["budget", "planned", "actual"].forEach(n => { if (val(n) === "" || isNaN(+val(n)) || +val(n) < 0) ok = setErr(n, "Enter an amount of 0 or more") && ok; });
    if (val("budget") !== "" && !(+val("budget") > 0)) ok = setErr("budget", "Approved budget must be greater than 0") && ok;
    if (!val("start")) ok = setErr("start", "Required") && ok;
    if (!val("end")) ok = setErr("end", "Required") && ok;
    else if (val("start") && val("end") < val("start")) ok = setErr("end", "End date must be after the start date") && ok;
    ok = checkPct("pp") && ok;
    ok = checkPct("ap") && ok;
    if (!ok) { toast("Please correct the highlighted fields", true); $f.find(".bad").first().trigger("focus"); return; }

    const data = formData();
    const target = edit || { id, createdAt: U.now(), completedAt: null };
    const draft = Object.assign({}, target, data);

    // 2. Write the values into the database and save the file
    const commit = async (finalStatus) => {
      Object.assign(target, data, { status: finalStatus });
      if (finalStatus === "Completed") { if (!target.completedAt) target.completedAt = U.now(); target.phase = "Closing"; }
      else target.completedAt = null;
      if (!edit) DB.data.projects.push(target);
      if (!(await DB.save(`Project ${target.id} ${edit ? "updated" : "created"}${finalStatus === "Completed" ? " (Completed)" : ""}`))) return;
      toast(edit ? "Project saved" : "Project created");
      App.go("details", { id: target.id });
    };

    // 3. Completed status is only accepted after every completion check passes
    if (data.status === "Completed") {
      const keep = edit && edit.status !== "Completed" ? edit.status : "In Progress";
      return Projects.checkCompletion(draft, () => commit("Completed"),
        [{ label: `Save other changes (keep status "${keep}")`, onClick: () => { commit(keep); } }]);
    }
    commit(data.status);
  });
};

/* ---------------- Project details page ---------------- */
App.views.details = function ($v, params) {
  const p = Projects.get(params.id) || App.current();
  if (!p) return App.go("projects");
  App.currentId = p.id;
  const c = Projects.calc(p), alerts = Alerts.forProject(p);
  const barColor = s => ["#12a150", "#f59e0b", "#d92d20"][s];

  $v.html(`<div class="toolbar"><h2>${esc(p.name)}</h2>
      <div class="noprint">${App.projectSelect()} <button class="btn sec" ${U.link("add", { id: p.id })}>Edit</button>
      ${p.status !== "Completed" ? `<button class="btn ok" onclick="Projects.markCompleted('${esc(p.id)}')">Mark as Completed</button>` : ""}
      <button class="btn sec" ${U.link("report", { id: p.id })}>Report</button></div></div>
    <div class="grid">
      <div class="card kpi"><small>Overall Health</small><b>${Projects.healthBadge(c)}</b></div>
      <div class="card kpi"><small>Project Status</small><b>${badge(p.status, Projects.statusColor(p.status))}</b></div>
      <div class="card kpi"><small>Current Phase</small><b>${badge(p.phase, "gray")}</b></div>
      <div class="card kpi"><small>Schedule</small><b>${badge(c.schedStatus, HEALTH_COLOR[c.schedSev])}</b></div>
      <div class="card kpi"><small>Budget</small><b>${badge(c.costStatus, HEALTH_COLOR[c.costSev])}</b></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>Project Information</h3><table class="kv">
        <tr><td>Project ID</td><td>${esc(p.id)}</td></tr><tr><td>Project Manager</td><td>${esc(p.manager)}</td></tr>
        <tr><td>Department</td><td>${esc(p.dept) || "—"}</td></tr><tr><td>Description</td><td>${esc(p.desc) || "—"}</td></tr>
        ${p.completedAt ? `<tr><td>Completed on</td><td>${U.date(p.completedAt)}</td></tr>` : ""}
        <tr><td>Latest update</td><td>${esc(p.update) || '<span class="muted">No update recorded.</span>'}</td></tr></table></div>
      <div class="card"><h3>Work Completed vs Remaining</h3><div class="chart-box"><canvas id="detailPie"></canvas></div></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>Budget Summary</h3>
        ${bar("Budget utilization (money spent, not work done)", c.util, barColor(c.costSev), P(c.util))}
        <table class="kv"><tr><td>Approved budget</td><td>${M(p.budget)}</td></tr>
          <tr><td>Planned cost</td><td>${M(p.planned)}${c.plannedOver ? " " + badge("Above budget", "yellow") : ""}</td></tr>
          <tr><td>Actual cost</td><td>${M(p.actual)}</td></tr>
          <tr><td>Remaining budget</td><td class="${c.remaining < 0 ? "txt-red" : ""}"><b>${M(c.remaining)}</b>${c.remaining < 0 ? " (over budget)" : ""}</td></tr></table></div>
      <div class="card"><h3>Schedule Performance</h3>
        ${bar("Planned progress", p.pp, "#2563eb")}${bar("Actual progress", p.ap, barColor(c.schedSev))}
        <table class="kv"><tr><td>Progress variance</td><td><b>${c.progVar > 0 ? "+" : ""}${P(c.progVar)}</b></td></tr>
          <tr><td>Start → expected end</td><td>${U.date(p.start)} → ${U.date(p.end)}</td></tr>
          <tr><td>Forecast finish</td><td>${c.forecast ? U.date(c.forecast) + (p.status !== "Completed" && c.lateDays > 0 ? " " + badge(c.lateDays + " days late", "yellow") : "") : '<span class="muted">Not enough progress to estimate</span>'}</td></tr>
          <tr><td>Schedule status</td><td>${badge(c.schedStatus, HEALTH_COLOR[c.schedSev])}</td></tr></table></div>
    </div>
    <div class="card"><h3>Automated Alerts & Recommendations</h3>${Alerts.list(alerts)}</div>
    <div class="grid2 mt">
      <div class="card"><div class="toolbar"><h3>Open Risks (${c.openRisks.length})</h3><a href="#" ${U.link("risks", { tab: "risks", pid: p.id })}>Risk Register →</a></div>${Risks.miniRisks(c.openRisks)}</div>
      <div class="card"><div class="toolbar"><h3>Open Issues (${c.openIssues.length})</h3><a href="#" ${U.link("risks", { tab: "issues", pid: p.id })}>Issue Register →</a></div>${Risks.miniIssues(c.openIssues)}</div>
    </div>
    ${Comments.section(p)}`);
  Charts.progressPie("detailPie", p.ap);
};
