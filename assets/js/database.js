/* =====================================================================
   PMO Dashboard - database.json storage (read / write)
   ---------------------------------------------------------------------
   HOW SAVING WORKS
   * database.json is the only place where project data is stored.
   * READING: the selected file is loaded with jQuery AJAX ($.ajax) from a
     temporary blob: URL, then parsed with JSON.parse.
   * WRITING: AJAX cannot write files on your computer and this project has
     no server. So the browser "File System Access API" is used instead:
     the user selects database.json once and allows editing. Every change
     is written to the file, read back and compared to confirm it was saved.
   * Writes run one after another (a queue) so two saves never overlap.
   * IndexedDB only remembers WHICH file was connected (the file handle) so
     the app can reconnect next time. No project data is stored there and
     localStorage is not used.
   * FALLBACK: browsers without this API (Firefox, Safari, phones) can open
     a JSON copy, but changes then have to be saved with "Export JSON".
   ===================================================================== */

/* Small helper that stores the file handle in IndexedDB. */
const HandleStore = {
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("pmai-file-handle", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("h");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async get() {
    try {
      const db = await this.open();
      return await new Promise(res => {
        const q = db.transaction("h").objectStore("h").get("db");
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => res(null);
      });
    } catch (e) { return null; }
  },
  async set(h) {
    try {
      const db = await this.open();
      await new Promise(res => { const t = db.transaction("h", "readwrite"); t.objectStore("h").put(h, "db"); t.oncomplete = res; t.onerror = res; });
    } catch (e) { console.warn("Could not remember the file", e); }
  }
};

/* Default values used when a setting is missing from database.json. */
const DEFAULT_SETTINGS = {
  currency: "PKR",
  scheduleWarning: 5,     // % behind plan that gives a yellow warning
  scheduleCritical: 15,   // % behind plan that gives a red alert
  budgetWarning: 90       // % of budget used that gives a yellow warning
};

const DB = {
  data: null,             // the whole database.json content while the app is open
  handle: null,           // File System Access handle of the connected file
  mode: null,             // "fs" = saves directly to the file, "memory" = must export to save
  fileName: "database.json",
  pending: 0,             // number of writes waiting in the queue
  queue: Promise.resolve(),
  diskRevision: 0,        // meta.revision last written to / read from disk
  diskModified: 0,        // file lastModified time last seen
  status: { state: "idle", error: null, conflict: false, dirty: false, lastSaved: null },
  supported: typeof window.showOpenFilePicker === "function",
  pickerTypes: [{ description: "JSON database", accept: { "application/json": [".json"] } }],

  /* ---------------- Connecting ---------------- */

  /** On page load: reconnect automatically if the browser still allows access to the last file. */
  async boot() {
    if (!this.supported) {
      $("#btnConnect").prop("disabled", true);
      App.welcomeMsg(`<b>This browser cannot edit files directly.</b> Please open the dashboard in <b>Google Chrome</b> or <b>Microsoft Edge</b> on a computer.<br>
        You can still open database.json with the link below, but you must <b>export</b> it after making changes.`, "warn");
      return;
    }
    const h = await HandleStore.get();
    if (!h) return;
    this._stored = h;
    try { if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return this.attach(h); } catch (e) { }
    // The browser needs one click before it gives file access again.
    $("#btnReconnect").text("🔄 Reconnect " + h.name).show();
    $("#btnConnect").text("📂 Select a different file");
  },

  /** "Connect Database" button: let the user pick database.json. */
  async connect() {
    let h;
    try { [h] = await window.showOpenFilePicker({ types: this.pickerTypes, multiple: false }); }
    catch (e) { if (e.name !== "AbortError") App.welcomeMsg("Could not open the file picker: " + esc(e.message), "bad"); return; }
    await this.attach(h);
  },

  async reconnect() { return this._stored ? this.attach(this._stored) : this.connect(); },

  /** Ask for read/write permission, read the file and open the dashboard. */
  async attach(h) {
    try {
      if ((await h.queryPermission({ mode: "readwrite" })) !== "granted" && (await h.requestPermission({ mode: "readwrite" })) !== "granted") {
        App.welcomeMsg("Permission to edit <b>" + esc(h.name) + "</b> was not given. The dashboard needs it to save your projects.", "bad");
        return;
      }
      const file = await h.getFile();
      const raw = this.parse(await this.readFile(file), h.name);
      if (raw === false) return;
      this.handle = h; this.mode = "fs"; this.fileName = h.name;
      this.diskModified = file.lastModified;
      this.diskRevision = (raw && raw.meta && raw.meta.revision) || 0;
      await HandleStore.set(h);
      this.loaded(raw);
    } catch (e) {
      console.error(e);
      App.welcomeMsg("Could not open the database: " + esc(e.message), "bad");
    }
  },

  /** Fallback: open a JSON file without write access (changes must be exported). */
  async openInMemory(file) {
    const raw = this.parse(await this.readFile(file), file.name);
    if (raw === false) return;
    this.mode = "memory"; this.fileName = file.name; this.status.dirty = false;
    this.loaded(raw);
  },

  /** Read a file asynchronously with jQuery AJAX through a temporary blob: URL. */
  readFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      $.ajax({ url, dataType: "text", timeout: 20000 })
        .done(resolve)
        .fail(() => file.text().then(resolve, reject))   // some browsers block AJAX on blob: URLs
        .always(() => URL.revokeObjectURL(url));
    });
  },

  /** Returns the parsed object, null for an empty file, or false if the file cannot be used. */
  parse(text, name) {
    if (!String(text).trim()) return null;
    try {
      const raw = JSON.parse(text);
      if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
      App.welcomeMsg(`<b>${esc(name)}</b> is not a dashboard database. The file was not changed.`, "bad");
    } catch (e) {
      App.welcomeMsg(`<b>${esc(name)} contains invalid JSON</b> (${esc(e.message)}). The file was not changed. Fix it or select another file.`, "bad");
    }
    return false;
  },

  /** Existing data is always kept. Demo data is only offered for an empty file. */
  loaded(raw) {
    this.data = this.normalize(raw || {});
    if (!this.data.projects.length && !this.data.meta.initialized) {
      App.welcomeMsg(`<b>${esc(this.fileName)} has no projects yet.</b><br><br>
        <button class="btn" onclick="DB.init(true)">Load the 3 demo projects</button> <button class="btn sec" onclick="DB.init(false)">Start with an empty dashboard</button>`);
      return;
    }
    App.welcomeMsg("");
    App.start();
    toast("Connected to " + this.fileName);
  },

  async init(demo) {
    if (demo) this.copySample();
    this.data.meta.initialized = true;
    await this.save(demo ? "Demo projects loaded" : "Empty database started");
    App.welcomeMsg(""); App.start();
  },

  copySample() {
    const s = JSON.parse(JSON.stringify(SAMPLE_DB));
    ["projects", "risks", "issues", "comments"].forEach(k => this.data[k] = s[k]);
  },

  /** Make sure every collection and setting exists. Unknown keys from older files are kept. */
  normalize(d) {
    d.meta = Object.assign({ app: "PMO Dashboard", schemaVersion: 3, revision: 0, initialized: false }, d.meta || {});
    d.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
    ["projects", "risks", "issues", "comments", "activity"].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
    d.projects.forEach(p => {
      if (!p.phase) p.phase = p.status === "Completed" ? "Closing" : "Execution";
      if (p.update === undefined) p.update = "";
      ["budget", "planned", "actual", "pp", "ap"].forEach(k => p[k] = +p[k] || 0);
      p.pp = pct(p.pp); p.ap = pct(p.ap);           // progress can never be outside 0-100
    });
    d.risks.forEach(r => {
      if (!r.projectId && r.pid) r.projectId = r.pid;
      if (r.status === "Closed") r.status = "Resolved";
      r.level = Risks.levelOf(r.prob, r.impact);    // severity is always recalculated
    });
    d.issues.forEach(i => {
      if (!i.desc && i.title) i.desc = i.title;
      if (i.status === "Closed") i.status = "Resolved";
      if (i.resolution === undefined) i.resolution = "";
    });
    d.meta.schemaVersion = 3;
    return d;
  },

  /* ---------------- Saving ---------------- */

  /**
   * Save the whole database to the connected file.
   * Called after every add / edit / delete. Returns true when the write was verified.
   */
  save(activity) {
    if (activity) {
      this.data.activity.unshift({ at: U.now(), text: activity });
      this.data.activity.length = Math.min(this.data.activity.length, 200);
    }
    this.data.meta.revision = (this.data.meta.revision || 0) + 1;
    this.data.meta.updatedAt = U.now();

    if (this.mode !== "fs") {                       // fallback mode: remember that an export is needed
      this.status.dirty = true;
      if ($("#app").is(":visible")) App.renderDbStatus();
      return Promise.resolve(true);
    }
    this.pending++; this.status.state = "saving";
    if ($("#app").is(":visible")) App.renderDbStatus();
    const job = this.queue.then(() => this.write(false));   // wait for the previous write first
    this.queue = job.catch(() => { });
    return job.then(() => true, e => { this.fail(e); return false; }).finally(() => {
      this.pending--;
      if (!this.pending && this.status.state !== "error") this.status.state = "saved";
      if ($("#app").is(":visible")) App.renderDbStatus();
    });
  },

  /** Write the file, then read it back to confirm the content really changed. */
  async write(force) {
    const text = JSON.stringify(this.data, null, 2), rev = this.data.meta.revision;
    if (!force && rev <= this.diskRevision && this.status.state !== "error") return;   // a later save already wrote it
    if ((await this.handle.queryPermission({ mode: "readwrite" })) !== "granted" && (await this.handle.requestPermission({ mode: "readwrite" })) !== "granted")
      throw new Error("permission to edit " + this.fileName + " was removed");
    if (!force) {
      // Stop if another tab or program changed the file since we last read it.
      const before = await this.handle.getFile();
      if (before.lastModified !== this.diskModified) {
        let r = null; try { r = JSON.parse(await before.text()).meta.revision; } catch (e) { }
        if (r !== this.diskRevision) {
          const e = new Error(this.fileName + " was changed outside this tab. Reload it or overwrite it (Database options).");
          e.conflict = true; throw e;
        }
      }
    }
    const w = await this.handle.createWritable();
    await w.write(text);
    await w.close();
    const after = await this.handle.getFile();
    if ((await after.text()) !== text) throw new Error("the file content could not be verified after saving");
    this.diskModified = after.lastModified; this.diskRevision = rev;
    Object.assign(this.status, { error: null, conflict: false, lastSaved: U.now() });
  },

  fail(e) {
    console.error(e);
    Object.assign(this.status, { state: "error", error: e.message, conflict: !!e.conflict });
    toast("Saving failed: " + e.message, true);
  },

  /**
   * "Save Changes" button. Changes are already saved automatically, so this
   * writes the current data again (useful after an error). In fallback mode it exports the file.
   */
  saveNow() {
    if (this.mode === "memory") return this.exportJSON();
    if (this.status.conflict) return this.showTools();
    this.pending++; this.status.state = "saving"; App.renderDbStatus();
    const job = this.queue.then(() => this.write(true));
    this.queue = job.catch(() => { });
    return job.then(() => { this.status.state = "saved"; toast("All changes saved to " + this.fileName); }, e => this.fail(e))
      .finally(() => { this.pending--; App.renderDbStatus(); });
  },

  /* ---------------- Database options (header pill) ---------------- */

  showTools() {
    const s = this.status, d = this.data, st = d.settings;
    App.modal({
      title: "Database options",
      body: `<table class="kv"><tr><td>File</td><td>${esc(this.fileName)}</td></tr>
        <tr><td>Saving</td><td>${this.mode === "fs" ? badge("Saves directly to the file", "green") : badge("Not saving - export needed", "red")}</td></tr>
        <tr><td>Last saved</td><td>${s.lastSaved ? new Date(s.lastSaved).toLocaleString() : "—"}</td></tr>
        <tr><td>Records</td><td>${d.projects.length} projects, ${d.risks.length} risks, ${d.issues.length} issues, ${d.comments.length} comments/updates</td></tr></table>
        ${s.conflict ? `<div class="note bad mt">${esc(s.error)}</div>` : ""}
        <h3 class="mt">Alert thresholds</h3>
        <form class="form" id="setForm" onsubmit="return false">
          <div><label>Schedule warning (% behind plan)</label><input type="number" name="scheduleWarning" min="1" max="100" value="${st.scheduleWarning}"></div>
          <div><label>Schedule critical (% behind plan)</label><input type="number" name="scheduleCritical" min="1" max="100" value="${st.scheduleCritical}"></div>
          <div><label>Budget warning (% of budget used)</label><input type="number" name="budgetWarning" min="1" max="100" value="${st.budgetWarning}"></div>
        </form>
        <div class="note mt small">AJAX cannot write files and this dashboard has no server, so saving uses the browser's File System Access API on the file you selected. Export / Import are provided as a backup.</div>`,
      buttons: [
        { label: "Save thresholds", onClick: () => this.saveSettings() },
        ...(this.mode === "fs" ? [{ label: "Reload from file", cls: "sec", onClick: () => { this.reload(); } }] : []),
        ...(s.conflict ? [{ label: "Overwrite file", cls: "del", onClick: () => { if (confirm("Replace the file content with the data shown in this tab?")) { this.status.conflict = false; this.saveNow(); } } }] : []),
        { label: "Reset demo data", cls: "del", onClick: () => { this.resetDemo(); } },
        { label: "Close", cls: "sec" }
      ]
    });
  },

  async saveSettings() {
    const v = n => Math.round(+$(`#setForm [name=${n}]`).val());
    const w = v("scheduleWarning"), c = v("scheduleCritical"), b = v("budgetWarning");
    if (!(w >= 1 && c > w && c <= 100 && b >= 1 && b <= 100)) { toast("Critical must be larger than warning, and all values between 1 and 100", true); return false; }
    Object.assign(this.data.settings, { scheduleWarning: w, scheduleCritical: c, budgetWarning: b });
    await this.save("Alert thresholds changed");
    toast("Thresholds saved"); App.render();
  },

  async reload() {
    try {
      const file = await this.handle.getFile(), raw = this.parse(await this.readFile(file), this.fileName);
      if (!raw) throw new Error("the file is empty or invalid");
      this.data = this.normalize(raw);
      this.diskModified = file.lastModified; this.diskRevision = this.data.meta.revision;
      Object.assign(this.status, { state: "saved", error: null, conflict: false });
      App.render(); toast("Reloaded from " + this.fileName);
    } catch (e) { toast("Reload failed: " + e.message, true); }
  },

  /** "Export JSON": download the current data as database.json. */
  exportJSON() {
    U.download("database.json", JSON.stringify(this.data, null, 2));
    if (this.mode === "memory") { this.status.dirty = false; App.renderDbStatus(); }
    toast("database.json downloaded");
  },

  /** "Import JSON": replace all data with another JSON file (after confirmation). */
  async importReplace(file) {
    const raw = this.parse(await this.readFile(file), file.name);
    if (!raw) return toast("The selected file is empty or not valid JSON", true);
    const n = this.normalize(raw);
    if (!confirm(`Replace ALL current data with ${file.name}?\n(${n.projects.length} projects, ${n.risks.length} risks, ${n.issues.length} issues)`)) return;
    n.meta.revision = Math.max(this.data.meta.revision, n.meta.revision || 0);
    n.meta.initialized = true;
    this.data = n;
    await this.save("Data imported from " + file.name);
    App.go("dashboard"); toast("Data imported");
  },

  /** Replace projects, risks, issues and comments with the demo data (after confirmation). */
  async resetDemo() {
    if (!confirm("Replace ALL current projects, risks, issues and comments with the 3 demo projects?\nYour current data will be lost (use Export JSON first to keep a backup).")) return;
    this.copySample();
    await this.save("Demo data restored");
    App.go("dashboard"); toast("Demo data restored");
  }
};
