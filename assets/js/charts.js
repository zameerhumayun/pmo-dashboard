/* =====================================================================
   PMO Dashboard - Chart.js charts
   Progress values are limited to 0-100% so Completed + Remaining = 100%.
   ===================================================================== */

const Charts = {
  list: [],
  ok: typeof window.Chart === "function",

  destroyAll() { this.list.forEach(c => c.destroy()); this.list = []; },

  make(id, cfg) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (!this.ok) { $(el).replaceWith(`<p class="muted small">Chart library not loaded.</p>`); return null; }
    const c = new Chart(el, cfg); this.list.push(c); return c;
  },

  /** Doughnut: Completed vs Remaining work. */
  progressPie(id, actual) {
    const done = pct(actual), rest = Math.round((100 - done) * 10) / 10;
    return this.make(id, {
      type: "doughnut",
      data: { labels: ["Completed", "Remaining"], datasets: [{ data: [done, rest], backgroundColor: ["#12a150", "#e4e7ec"], borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "62%", animation: { duration: 400 },
        plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed}%` } } }
      },
      plugins: [{ id: "center", afterDraw(ch) {
        const { ctx, chartArea: a } = ch; ctx.save();
        ctx.font = "700 22px Segoe UI, Arial"; ctx.fillStyle = "#101828"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(P(done), (a.left + a.right) / 2, (a.top + a.bottom) / 2); ctx.restore();
      } }]
    });
  },

  /** Grouped bars: planned vs actual progress per project (0-100%). */
  progressBars(id, projects) {
    return this.make(id, {
      type: "bar",
      data: { labels: projects.map(p => p.id), datasets: [
        { label: "Planned %", data: projects.map(p => pct(p.pp)), backgroundColor: "#2563eb" },
        { label: "Actual %", data: projects.map(p => pct(p.ap)), backgroundColor: "#12a150" }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + "%" } } }, plugins: { legend: { position: "bottom" } } }
    });
  },

  /** Grouped bars: budget vs actual cost per project (real values, overruns not capped). */
  costBars(id, projects) {
    return this.make(id, {
      type: "bar",
      data: { labels: projects.map(p => p.id), datasets: [
        { label: "Approved budget", data: projects.map(p => p.budget / 1e6), backgroundColor: "#94a3b8" },
        { label: "Actual cost", data: projects.map(p => p.actual / 1e6), backgroundColor: projects.map(p => p.actual > p.budget ? "#d92d20" : "#f59e0b") }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: v => v + "M" } } },
        plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: PKR ${c.parsed.y.toFixed(1)}M` } } } }
    });
  }
};
