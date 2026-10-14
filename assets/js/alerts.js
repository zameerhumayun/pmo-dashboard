/* =====================================================================
   PMO Dashboard - Automated Alerts & Recommendations
   These are simple IF / ELSE rules applied to the saved project data.
   They are NOT AI predictions. Thresholds can be changed in
   Database options (header) and are stored in database.json -> settings.
   ===================================================================== */

const Alerts = {
  /**
   * Apply every rule to one project and return the alerts it triggers.
   * Each alert: { level: "red" | "yellow" | "blue", title, msg, rec (recommendation), link }
   */
  forProject(p) {
    const c = Projects.calc(p), st = DB.data.settings, out = [];
    const done = p.status === "Completed";
    const add = (level, title, msg, rec, link) => out.push({ level, title, msg, rec, link, pid: p.id, pname: p.name });

    // Rule 1: behind schedule (actual progress lower than planned by the threshold)
    if (!done && c.progVar < -st.scheduleWarning) {
      add(c.progVar < -st.scheduleCritical ? "red" : "yellow", "Project is behind schedule",
        `Actual progress is ${P(p.ap)} but ${P(p.pp)} was planned (${P(c.progVar)}).`,
        "Review delayed activities and adjust priorities. Add resources to critical tasks if needed.", ["details", { id: p.id }]);
    }

    // Rule 2: deadline exceeded (end date passed and progress below 100%)
    if (c.overdue) {
      add("red", "Project deadline exceeded", `The expected end date was ${U.date(p.end)} and progress is only ${P(p.ap)}.`,
        "Review outstanding work and update the recovery plan with a new realistic end date.", ["add", { id: p.id }]);
    }

    // Rule 3: budget exceeded (actual cost above approved budget)
    if (p.actual > p.budget) {
      add("red", "Budget exceeded", `Actual cost ${M(p.actual)} is ${M(p.actual - p.budget)} over the approved budget of ${M(p.budget)} (${P(c.util)} used).`,
        "Review expenditure and revise the cost plan. Request a budget revision if the extra cost is justified.", ["details", { id: p.id }]);
    } else if (!done && c.util > st.budgetWarning) {
      // Rule 3b: budget almost used
      add("yellow", "Budget almost used", `${P(c.util)} of the budget is spent while only ${P(p.ap)} of the work is done.`,
        "Check that the remaining budget is enough to finish the work and control further spending.", ["details", { id: p.id }]);
    }

    // Rule 4: planned cost higher than the approved budget
    if (c.plannedOver) {
      add("yellow", "Planned cost is above the approved budget", `Planned cost ${M(p.planned)} is ${M(p.planned - p.budget)} more than the budget.`,
        "Reduce the planned cost or get approval for a larger budget.", ["add", { id: p.id }]);
    }

    // Rule 5: unresolved high-severity risks
    const high = c.openRisks.filter(r => r.level === "High");
    if (high.length) {
      add("red", "High-risk items require attention", `${high.length} high risk(s) are not resolved: ${high.map(r => r.id).join(", ")}.`,
        "Review and implement the mitigation actions, then mark the risks as Resolved.", ["risks", { tab: "risks", pid: p.id }]);
    }

    // Rule 6: unresolved critical issues
    if (c.critIssues) {
      add("red", "Critical issues are pending", `${c.critIssues} critical issue(s) are not resolved.`,
        "Resolve these issues before project completion.", ["risks", { tab: "issues", pid: p.id }]);
    }

    // Rule 7: other pending issues
    const other = c.openIssues.length - c.critIssues;
    if (other > 0) {
      add("yellow", "Pending issues", `${other} other issue(s) are still open or in progress.`,
        "Assign each issue to a person with a target date and follow up.", ["risks", { tab: "issues", pid: p.id }]);
    }

    // Rule 8: work finished but status not yet Completed
    if (!done && +p.ap === 100) {
      add("blue", "Ready for completion check", "Actual progress is 100% but the project is not marked Completed.",
        'Open the project and click "Mark as Completed" to run the completion check.', ["details", { id: p.id }]);
    }
    return out;
  },

  /** Alerts of all projects. */
  all() { return DB.data.projects.flatMap(p => this.forProject(p)); },

  /** HTML list of alerts, most serious first. */
  list(alerts, showProject) {
    if (!alerts.length) return `<div class="alert green"><b>✓ No alerts</b><div class="rec">All rules passed - schedule, cost, risks and issues are within limits.</div></div>`;
    const order = { red: 0, yellow: 1, blue: 2 };
    return alerts.slice().sort((a, b) => order[a.level] - order[b.level]).map(a => `<div class="alert ${a.level}">
      <b>${{ red: "🔴", yellow: "🟡", blue: "🔵" }[a.level]} ${esc(a.title)}${showProject ? ` - <span class="muted">${esc(a.pname)}</span>` : ""}</b>
      <small>${esc(a.msg)}</small>
      <div class="rec"><b style="display:inline">Recommendation:</b> ${esc(a.rec)} <a href="#" class="small noprint" ${U.link(a.link[0], a.link[1])}>Open →</a></div></div>`).join("");
  }
};
