/* =====================================================================
   PMO Dashboard - Risk Register and Issue Register
   Risk  = something that MAY happen in the future (rated by probability x impact).
   Issue = a problem that HAS ALREADY happened and needs a resolution.
   Risk counts and risk scores are always calculated from these records.
   ===================================================================== */

const LEVELS = ["Low", "Medium", "High"];
const RISK_CATS = ["Schedule", "Cost", "Scope", "Technical", "Resource", "Quality", "External", "General"];
const RISK_STATUS = ["Open", "Mitigating", "Resolved"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];
const ISSUE_STATUS = ["Open", "In Progress", "Resolved"];

const Risks = {
  /**
   * Risk severity from probability x impact (Low = 1, Medium = 2, High = 3):
   *   score 6 or 9 -> High, score 3 or 4 -> Medium, score 1 or 2 -> Low
   */
  levelOf(prob, impact) {
    const v = x => ({ Low: 1, Medium: 2, High: 3 }[x] || +x || 1);
    const s = v(prob) * v(impact);
    return s >= 6 ? "High" : s >= 3 ? "Medium" : "Low";
  },
  statusColor: s => ({ Open: "red", Mitigating: "yellow", "In Progress": "yellow", Resolved: "green" }[s] || "gray"),
  projectName: id => { const p = Projects.get(id); return p ? p.name : id; },
  find: (kind, id) => DB.data[kind].find(x => x.id === id),

  resolveBtn(kind, x) {
    return x.status === "Resolved" ? "" : `<button class="btn sm ok" onclick="Risks.resolve('${kind}','${esc(x.id)}')">✓ Resolve</button>`;
  },

  /** Small risk table used on the project details page. */
  miniRisks(list) {
    if (!list.length) return `<p class="muted">No open risks.</p>`;
    return `<div class="tw"><table><tr><th>ID</th><th>Risk</th><th>Severity</th><th>Status</th><th></th></tr>${list.map(r => `<tr><td>${esc(r.id)}</td>
      <td>${esc(r.desc)}<div class="small muted">Mitigation: ${esc(r.mit) || "—"}</div></td><td>${badge(r.level, riskColor(r.level))}</td>
      <td>${badge(r.status, this.statusColor(r.status))}</td><td>${this.resolveBtn("risks", r)}</td></tr>`).join("")}</table></div>`;
  },
  /** Small issue table used on the project details page. */
  miniIssues(list) {
    if (!list.length) return `<p class="muted">No open issues.</p>`;
    return `<div class="tw"><table><tr><th>ID</th><th>Issue</th><th>Severity</th><th>Status</th><th></th></tr>${list.map(i => `<tr><td>${esc(i.id)}</td>
      <td>${esc(i.desc)}<div class="small muted">Resolution: ${esc(i.resolution) || "—"}</div></td><td>${badge(i.severity, riskColor(i.severity))}</td>
      <td>${badge(i.status, this.statusColor(i.status))}</td><td>${this.resolveBtn("issues", i)}</td></tr>`).join("")}</table></div>`;
  },

  /* ---------------- Add / edit a risk ---------------- */
  editRisk(id, pid) {
    if (!DB.data.projects.length) return toast("Add a project first", true);
    const r = id ? this.find("risks", id) : { projectId: pid || (App.current() || {}).id, desc: "", cat: "General", prob: "Medium", impact: "Medium", mit: "", status: "Open" };
    App.modal({
      title: id ? "Edit Risk " + id : "Add Risk",
      body: `<form class="form" id="rform" onsubmit="return false">
        <div class="full"><label>Related Project *</label><select name="projectId">${U.opts(DB.data.projects.map(p => [p.id, p.id + " - " + p.name]), r.projectId)}</select></div>
        <div class="full"><label>Risk Description *</label><textarea name="desc" rows="2" maxlength="500">${esc(r.desc)}</textarea><div class="err"></div></div>
        <div><label>Category</label><select name="cat">${U.opts(RISK_CATS, r.cat)}</select></div>
        <div><label>Status</label><select name="status">${U.opts(RISK_STATUS, r.status)}</select></div>
        <div><label>Probability</label><select name="prob">${U.opts(LEVELS, r.prob)}</select></div>
        <div><label>Impact</label><select name="impact">${U.opts(LEVELS, r.impact)}</select></div>
        <div class="full">Severity (probability × impact): <span id="rlevel"></span></div>
        <div class="full"><label>Mitigation Action</label><textarea name="mit" rows="2" maxlength="500">${esc(r.mit)}</textarea></div></form>`,
      onOpen() {
        // Show the calculated severity as soon as probability or impact changes.
        const upd = () => { const l = Risks.levelOf($("#rform [name=prob]").val(), $("#rform [name=impact]").val()); $("#rlevel").html(badge(l, riskColor(l))); };
        $("#rform select").on("change", upd); upd();
      },
      buttons: [{ label: "Cancel", cls: "sec" }, {
        label: "Save Risk", onClick: () => {
          const f = n => $(`#rform [name=${n}]`).val();
          if (!f("desc").trim()) { $("#rform [name=desc]").addClass("bad").siblings(".err").text("Description is required"); return false; }
          const d = { projectId: f("projectId"), desc: f("desc").trim(), cat: f("cat"), status: f("status"), prob: f("prob"), impact: f("impact"),
            mit: f("mit").trim(), level: Risks.levelOf(f("prob"), f("impact")), updatedAt: U.now() };
          if (id) Object.assign(r, d);
          else DB.data.risks.push(Object.assign({ id: U.nextId(DB.data.risks, "R-"), createdAt: U.now() }, d));
          DB.save(id ? `Risk ${id} updated` : "Risk added").then(ok => ok && toast("Risk saved"));
          App.render();
        }
      }]
    });
  },

  /* ---------------- Add / edit an issue ---------------- */
  editIssue(id, pid) {
    if (!DB.data.projects.length) return toast("Add a project first", true);
    const i = id ? this.find("issues", id) : { projectId: pid || (App.current() || {}).id, desc: "", severity: "Medium", resolution: "", status: "Open" };
    App.modal({
      title: id ? "Edit Issue " + id : "Add Issue",
      body: `<form class="form" id="iform" onsubmit="return false">
        <div class="full"><label>Related Project *</label><select name="projectId">${U.opts(DB.data.projects.map(p => [p.id, p.id + " - " + p.name]), i.projectId)}</select></div>
        <div class="full"><label>Issue Description *</label><textarea name="desc" rows="2" maxlength="500">${esc(i.desc)}</textarea><div class="err"></div></div>
        <div><label>Severity</label><select name="severity">${U.opts(SEVERITIES, i.severity)}</select></div>
        <div><label>Status</label><select name="status">${U.opts(ISSUE_STATUS, i.status)}</select></div>
        <div class="full"><label>Suggested Resolution</label><textarea name="resolution" rows="2" maxlength="500">${esc(i.resolution)}</textarea></div></form>`,
      buttons: [{ label: "Cancel", cls: "sec" }, {
        label: "Save Issue", onClick: () => {
          const f = n => $(`#iform [name=${n}]`).val();
          if (!f("desc").trim()) { $("#iform [name=desc]").addClass("bad").siblings(".err").text("Description is required"); return false; }
          const d = { projectId: f("projectId"), desc: f("desc").trim(), severity: f("severity"), status: f("status"), resolution: f("resolution").trim(), updatedAt: U.now() };
          if (d.status === "Resolved" && i.status !== "Resolved") d.resolvedAt = U.now();
          if (id) Object.assign(i, d);
          else DB.data.issues.push(Object.assign({ id: U.nextId(DB.data.issues, "I-"), createdAt: U.now() }, d));
          DB.save(id ? `Issue ${id} updated` : "Issue added").then(ok => ok && toast("Issue saved"));
          App.render();
        }
      }]
    });
  },

  /** "Resolve" button: mark a risk or issue as Resolved. */
  async resolve(kind, id) {
    const x = this.find(kind, id);
    x.status = "Resolved"; x.resolvedAt = x.updatedAt = U.now();
    await DB.save(`${kind === "risks" ? "Risk" : "Issue"} ${id} resolved`);
    toast(`${id} resolved`); App.render();
  },

  async del(kind, id) {
    if (!confirm(`Delete ${kind === "risks" ? "risk" : "issue"} ${id}? This cannot be undone.`)) return;
    DB.data[kind] = DB.data[kind].filter(x => x.id !== id);
    await DB.save(`${kind === "risks" ? "Risk" : "Issue"} ${id} deleted`);
    toast("Deleted"); App.render();
  }
};

/* ---------------- Risks & Issues page ---------------- */
App.views.risks = function ($v, params) {
  const tab = params.tab || "risks", isR = tab === "risks";
  const pid = params.pid || "", fs = params.status || "";
  const go = (extra) => esc(JSON.stringify(Object.assign({ tab, pid, status: fs }, extra)));
  const all = DB.data[tab].filter(x => !pid || x.projectId === pid);
  const list = all.filter(x => !fs || (fs === "unresolved" ? x.status !== "Resolved" : x.status === fs));
  const stats = isR ? RISK_STATUS : ISSUE_STATUS;
  const serious = isR ? all.filter(r => r.level === "High" && r.status !== "Resolved").length
                      : all.filter(i => i.severity === "Critical" && i.status !== "Resolved").length;
  const count = k => DB.data[k].filter(x => !pid || x.projectId === pid).length;

  $v.html(`<div class="toolbar"><h2>Risks & Issues</h2></div>
    <div class="note small"><b>Risk</b> = an uncertain event that <i>may</i> happen (severity = probability × impact). <b>Issue</b> = a problem that <i>has already</i> happened and needs a resolution.</div>
    <div class="tabs"><a class="${isR ? "active" : ""}" data-go="risks" data-p='${go({ tab: "risks", status: "" })}'>Risk Register (${count("risks")})</a>
      <a class="${!isR ? "active" : ""}" data-go="risks" data-p='${go({ tab: "issues", status: "" })}'>Issue Register (${count("issues")})</a></div>
    <div class="grid">
      ${stats.map(s => `<div class="card kpi"><small>${s}</small><b>${all.filter(x => x.status === s).length}</b></div>`).join("")}
      <div class="card kpi"><small>${isR ? "Unresolved High Risks" : "Unresolved Critical Issues"}</small><b class="${serious ? "txt-red" : ""}">${serious}</b></div>
    </div>
    <div class="toolbar">
      <select id="fProject"><option value="">All projects</option>${U.opts(DB.data.projects.map(p => [p.id, p.id + " - " + p.name]), pid)}</select>
      <select id="fStatus" style="max-width:200px"><option value="">All statuses</option>${U.opts([["unresolved", "Unresolved only"], ...stats], fs)}</select>
      <button class="btn" onclick="Risks.${isR ? "editRisk" : "editIssue"}(null,'${esc(pid)}')">+ Add ${isR ? "Risk" : "Issue"}</button>
    </div>
    <div class="card"><div class="tw"><table>
      ${isR ? `<thead><tr><th>Risk ID</th><th>Project</th><th>Description</th><th>Category</th><th>Probability</th><th>Impact</th><th>Severity</th><th>Mitigation Action</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${list.map(r => `<tr><td>${esc(r.id)}</td><td class="small">${esc(Risks.projectName(r.projectId))}</td><td>${esc(r.desc)}</td><td>${esc(r.cat)}</td>
          <td>${esc(r.prob)}</td><td>${esc(r.impact)}</td><td>${badge(r.level, riskColor(r.level))}</td><td class="small">${esc(r.mit) || "—"}</td>
          <td>${badge(r.status, Risks.statusColor(r.status))}</td>
          <td class="nowrap">${Risks.resolveBtn("risks", r)}<button class="btn sm sec" onclick="Risks.editRisk('${esc(r.id)}')">Edit</button><button class="btn sm del" onclick="Risks.del('risks','${esc(r.id)}')">Delete</button></td></tr>`).join("")
          || `<tr><td colspan="10" class="muted">No risks match this filter.</td></tr>`}`
      : `<thead><tr><th>Issue ID</th><th>Project</th><th>Issue Description</th><th>Severity</th><th>Suggested Resolution</th><th>Raised</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${list.map(i => `<tr><td>${esc(i.id)}</td><td class="small">${esc(Risks.projectName(i.projectId))}</td><td>${esc(i.desc)}</td><td>${badge(i.severity, riskColor(i.severity))}</td>
          <td class="small">${esc(i.resolution) || "—"}</td><td class="small nowrap">${U.date(i.createdAt)}</td><td>${badge(i.status, Risks.statusColor(i.status))}</td>
          <td class="nowrap">${Risks.resolveBtn("issues", i)}<button class="btn sm sec" onclick="Risks.editIssue('${esc(i.id)}')">Edit</button><button class="btn sm del" onclick="Risks.del('issues','${esc(i.id)}')">Delete</button></td></tr>`).join("")
          || `<tr><td colspan="8" class="muted">No issues match this filter.</td></tr>`}`}
    </tbody></table></div></div>`);

  $("#fProject").on("change", function () { App.go("risks", { tab, pid: this.value, status: fs }); });
  $("#fStatus").on("change", function () { App.go("risks", { tab, pid, status: this.value }); });
};
