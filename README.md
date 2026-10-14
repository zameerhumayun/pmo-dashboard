# PMO Project Management Dashboard

A simple, rule-based **Project Management Office (PMO) dashboard prototype** built for a university assignment.

> This dashboard does **not** use artificial intelligence. All alerts, recommendations, health ratings and completion checks are produced by simple JavaScript `if / else` conditions on the saved project data.

---

## 1. Project Title

**PMO Project Management Dashboard – Project Monitoring, Performance & Risk Management**

## 2. Project Overview

The dashboard lets a PMO team:

- enter project information (budget, schedule, phase, status),
- monitor progress, cost and schedule performance,
- record risks and issues,
- see automatic alerts and recommendations,
- record comments and progress updates,
- block a project from being closed while important problems remain, and
- print a project status report.

All data is stored in one file: **`database.json`**.

## 3. Assignment Objective

To demonstrate how project information is **entered**, **monitored**, **analysed with simple conditions**, and **displayed** in a practical PMO dashboard, using only front-end web technologies.

## 4. Technology Used

| Technology | Used for |
|---|---|
| HTML5 | Page structure (`index.html`) |
| CSS3 | Layout, colours, responsive design, print layout (`assets/css/style.css`) |
| JavaScript | All logic: calculations, rules, validation |
| jQuery 3.7 | DOM updates, events, AJAX file reading |
| AJAX (`$.ajax`) | Reading the selected `database.json` file |
| JSON | Data format of `database.json` |
| Chart.js 4 | Doughnut and bar charts |
| File System Access API (browser) | Writing changes back to `database.json` |

No Node.js, PHP, database server, framework or AI service is used. jQuery and Chart.js are stored locally in `assets/js/vendor`, so the dashboard works offline.

## 5. Project Folder Structure

```
PMAI/
├── index.html              Main application
├── reference.html          Original dashboard (design reference - unchanged)
├── database.json           Project data (projects, risks, issues, comments, settings)
├── README.md               This file
└── assets/
    ├── css/
    │   └── style.css       All styles (based on reference.html)
    └── js/
        ├── app.js          Helpers, page navigation, modal dialog, button wiring
        ├── sample-data.js  The 3 demo projects (used only when you ask for demo data)
        ├── database.js     Connect / read / save / import / export database.json
        ├── projects.js     Calculations, completion validation, project list, form, details page
        ├── risks.js        Risk Register and Issue Register
        ├── comments.js     Comments and progress updates
        ├── alerts.js       Automated alert rules and recommendations
        ├── charts.js       Chart.js doughnut and bar charts
        ├── dashboard.js    Dashboard page (KPIs, overview, alerts) and Performance page
        ├── reports.js      Printable project report
        └── vendor/         jQuery and Chart.js libraries
```

### What each JavaScript file does

| File | Responsibility |
|---|---|
| `app.js` | Small helpers (`esc`, `badge`, money and percent format), `App.go()` to switch pages, the modal dialog, toast messages, and the header buttons. |
| `sample-data.js` | `SAMPLE_DB` – three demo projects with risks, issues and comments. |
| `database.js` | `DB` object: Connect Database, reconnect on next visit, read the file with AJAX, save every change (one write at a time, verified), detect changes made outside the tab, Import / Export JSON, reset demo data, alert thresholds. |
| `projects.js` | `Projects.calc()` (all formulas), `completionChecks()` and `checkCompletion()` (completion validation), the Projects list, Add / Edit form with validation, Delete, and the Project Details page. |
| `risks.js` | Risk severity (probability × impact), add / edit / resolve / delete risks and issues, Risks & Issues page. |
| `comments.js` | Add / edit / delete comments and progress updates, history list (newest first). |
| `alerts.js` | The alert rules (`Alerts.forProject()`), and the alert list shown on the Dashboard, Details page and report. |
| `charts.js` | Chart.js charts: Completed vs Remaining doughnut, Planned vs Actual progress bars, Budget vs Actual cost bars. |
| `dashboard.js` | Dashboard KPIs, project overview table, all alerts; Performance page. |
| `reports.js` | Printable project status report with Print / Save as PDF. |

## 6. Features and Modules

1. **Dashboard** – 6 KPI cards, project overview table (name, phase, progress, budget, schedule status, overall health, actions), and all Automated Alerts & Recommendations.
2. **Projects** – list of all projects with View / Edit / Delete.
3. **Add Project** – form with Project, Budget, Schedule, Risk and Update sections and full validation.
4. **Risks & Issues** – Risk Register and Issue Register with add, edit, resolve, delete and filters.
5. **Performance** – doughnut chart of the selected project, cost and schedule figures, comparison table for all projects, and bar charts.
6. **Reports** – printable report of one project.
7. **Project Details** (opened with *View*) – all information, charts, alerts, open risks / issues, comments and updates, and the *Mark as Completed* button.

## 7. How to Open the Dashboard

1. Open the `PMAI` folder.
2. Double-click **`index.html`** – it opens in your browser.
3. Use **Google Chrome** or **Microsoft Edge** on a computer (these browsers can save to a local file).

No installation or server is needed.

## 8. How to Connect database.json

1. On the start screen click **📂 Connect Database (database.json)**.
2. Select `PMAI\database.json` and click **Open**.
3. When the browser asks, click **Edit files / Allow** so the dashboard can save changes.
4. If the file is empty, choose **Load the 3 demo projects** or **Start with an empty dashboard**. A file that already has data is never overwritten.

Next time you open the dashboard it reconnects automatically. If the browser asks again, click **🔄 Reconnect database.json**.

**Saving:**
- Every add, edit, resolve and delete is saved to `database.json` immediately. The green pill in the header shows **✓ Saved to database.json**.
- **💾 Save Changes** writes all data to the file again (useful if a save failed).
- **Export JSON** downloads a copy (backup). **Import JSON** replaces all data with another file (asks first).
- Click the green pill for **Database options**: reload from file, alert thresholds, reset demo data.

## 9. How to Add a Project

1. Click **Add Project** in the sidebar.
2. Fill in all fields marked `*`: ID, name, manager, department, phase, status, description, budget, planned cost, actual cost, start date, end date, planned % and actual %.
3. Click **Save Project**. Fields with errors turn red and show a message.
4. After saving, the Project Details page opens. Add the project's risks in **Risks & Issues**.

## 10. How to Update Progress

1. Open the project (**View**) and click **Edit**.
2. Change **Actual Progress (%)** (and planned progress, actual cost, phase, remarks…).
3. Click **Save Changes**. All pages, KPIs and charts update immediately.
4. You can also add a dated **Progress Update** in the *Comments & Updates* section of the details page.

Progress must be **between 0 and 100**. The form shows an error while typing and refuses to save values outside this range.

## 11. How Cost and Schedule Are Calculated

| Value | Formula |
|---|---|
| Budget utilization | `Actual Cost ÷ Approved Budget × 100` (can be above 100% – shows overspending, **not** work done) |
| Remaining budget | `Approved Budget − Actual Cost` (negative = over budget) |
| Progress variance | `Actual Progress − Planned Progress` (negative = behind) |
| Forecast finish | `Start Date + (days since start × 100 ÷ Actual Progress)` |
| Completed / Remaining (doughnut) | `Actual Progress` and `100 − Actual Progress` (always totals 100%) |

**Status colours** (thresholds can be changed in Database options):

| Area | 🟢 Green | 🟡 Yellow | 🔴 Red |
|---|---|---|---|
| Cost | utilization ≤ 90% → *Within Budget* | > 90% → *Near Budget Limit* | > 100% → *Over Budget* |
| Schedule | variance ≥ −5% → *On Schedule* | −5% to −15% → *Slightly Behind* | below −15% → *Behind Schedule*, or end date passed with progress < 100% → *Deadline Exceeded* |

**Dashboard KPIs:** Total = all projects · Active = status *In Progress* or *At Risk* · Completed = status *Completed* · At-Risk = not completed and health is *At Risk* or *Critical* · Average Progress = average actual progress · Total Budget = sum of approved budgets.

## 12. How Risk and Issue Monitoring Works

- A **risk** may happen in the future. Its **severity** = Probability × Impact (Low = 1, Medium = 2, High = 3): 6–9 → **High**, 3–4 → **Medium**, 1–2 → **Low**.
- An **issue** has already happened. Its severity is Low, Medium, High or **Critical**.
- Each risk / issue is linked to one project and can be **Added, Edited, Resolved (✓ Resolve button) or Deleted**.
- Only unresolved records count. **Risk score** = open High × 3 + open Medium × 2 + open Low × 1 (≥ 8 High, ≥ 4 Medium, otherwise Low).
- **Overall health** = the worst of cost, schedule, risk score and issues:
  - **On Track** (green) – everything within limits
  - **At Risk** (yellow) – at least one warning (e.g. slightly behind, medium risk score, open High issue)
  - **Critical** (red) – at least one serious problem (over budget, far behind, high risk score, open Critical issue)

Health is separate from the **status** that the user selects (Planning, In Progress, On Hold, At Risk, Completed).

## 13. How Alerts and Recommendations Work

`alerts.js` checks every project with these rules each time a page is shown:

| Rule (IF …) | Alert | Recommendation |
|---|---|---|
| Actual progress is more than 5% below planned (red if more than 15%) | Project is behind schedule | Review delayed activities and adjust priorities |
| End date has passed and progress is below 100% | Project deadline exceeded | Review outstanding work and update the recovery plan |
| Actual cost > approved budget | Budget exceeded | Review expenditure and revise the cost plan |
| More than 90% of budget used (not completed) | Budget almost used | Check the remaining budget is enough |
| Planned cost > approved budget | Planned cost above budget | Reduce planned cost or get approval |
| Unresolved High risks exist | High-risk items require attention | Review and implement mitigation actions |
| Unresolved Critical issues exist | Critical issues are pending | Resolve these before project completion |
| Other unresolved issues exist | Pending issues | Assign an owner and follow up |
| Actual progress is 100% but not Completed | Ready for completion check | Click *Mark as Completed* |

Alerts appear on the **Dashboard** (all projects), the **Project Details** page and the **Report**. They are labelled *Automated Alerts & Recommendations* – they are fixed rules, not AI predictions.

## 14. How Project Completion Validation Works

When a user tries to set a project to **Completed** – with the *Mark as Completed* button **or** by choosing *Completed* in the Edit / Add form – the dashboard checks:

1. Actual Progress = **100%**
2. **No unresolved Critical issues**
3. **No unresolved High-severity risks**
4. **Required information is complete** (name, manager, department, description, dates, budget, actual cost, latest update / remarks)

If any check fails:

- a **⛔ COMPLETION BLOCKED** message lists the exact problems (e.g. *Actual Progress: 85%*, *2 critical issue(s) unresolved*),
- it shows the **required actions** with links to the Issue Register, Risk Register or project form,
- the project status is **not** changed (in the form you can choose *Save other changes* and keep the previous status).

The progress value is **never** set to 100% automatically. Only when every check passes is the project saved as *Completed* (phase set to *Closing*, completion date recorded). In the form, the result of the checks is shown as soon as *Completed* is selected.

## 15. How Comments and Updates Work

On every Project Details page, the **Comments & Updates** section lets you:

- choose **Progress Update** or **Comment**, enter the **author name** and the text, and click **Add Entry**,
- see the history **newest first** with date and time,
- **Edit** or **Delete** any entry.

Each entry is saved in `database.json → comments` as:
`{ id, projectId, author, type, text, at, editedAt }`. The latest 5 entries are printed in the report.

## 16. How to Generate Reports

1. Click **Reports** in the sidebar (or *Report* on a project's details page).
2. Choose the project in the dropdown.
3. Click **🖨️ Print / Save as PDF** and choose your printer or **Save as PDF**.

The report contains project information, phase, progress, budget and schedule performance, the completion doughnut, risk summary, open issues, alerts and recommendations, latest updates and completion readiness.

## 17. Example Demonstration Scenario (class presentation)

Use the demo data (Database options → **Reset demo data**, or load it into an empty file).

| Project | Health | Why |
|---|---|---|
| PMO-002 Campus Network Upgrade | 🟢 On Track | 72% done vs 70% planned, 67% of budget used |
| PMO-001 Solar Parking Shade | 🟡 At Risk | 8% behind plan, medium risk score, one open issue |
| PMO-003 Digital Student Portal | 🔴 Critical | 20% behind, over budget, 3 high risks, 2 critical issues |

**Step-by-step demo:**

1. **Dashboard** – explain the 6 KPI cards, the overview table (green / yellow / red), and the alerts list.
2. **Projects → View** PMO-003 – show health, budget summary, schedule performance, doughnut chart, alerts, open risks / issues, comments.
3. **Performance** – select a project; show Completed vs Remaining = 100%, cost and schedule comparison table and bar charts.
4. **Add Project** – create a new project; type **150** in Actual Progress to show the 0–100 validation; fix it and save.
5. On the new project, **add a Progress Update and a Comment**; edit one.
6. **Risks & Issues** – add a High × High risk (severity becomes *High*), see the project health change; resolve it.
7. Open PMO-003 → **Mark as Completed** → show **COMPLETION BLOCKED** with reasons and required actions.
8. Use the links to **Resolve** the critical issues (I-003, I-004) and high risks (R-007, R-008, R-009).
9. Try again → still blocked: *Actual Progress: 55%* (progress is never changed automatically).
10. **Edit** PMO-003 → set Actual Progress to **100%** → choose status **Completed** (the form shows ✓ all checks pass) → **Save Changes**.
11. Dashboard – Completed Projects is now 1.
12. **Reports** → PMO-003 → **Print / Save as PDF**.
13. Reload the page – all changes are still there because they were saved in `database.json`.

## 18. Known Technical Limitations

- **Browser support:** saving directly to `database.json` needs the File System Access API (Chrome or Edge on desktop). In other browsers you can open a JSON file, but changes must be saved with **Export JSON** and the file replaced manually (the dashboard shows a warning).
- **Permission:** browsers cannot open a file by path on their own. You select the file once; on later visits the browser may ask for permission again (one click on *Reconnect*).
- **AJAX cannot write files.** AJAX is used only to read the selected file; writing uses the File System Access API.
- **Single user:** this is a local prototype for one user. If two tabs or people change the same file, the dashboard detects it and refuses to overwrite, but there is no real multi-user support, login or security.
- **Rule-based only:** alerts, health and forecasts use fixed formulas and thresholds. They are not AI predictions and do not guarantee project success; the completion check only confirms the recorded data.
- **Older data:** a `database.json` created by an earlier version may contain extra keys (for example an old `users` list from a removed login feature). They are kept in the file but no longer used and can be deleted manually.
