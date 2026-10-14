/* =====================================================================
   PMO Dashboard - database.json storage (read / write)
   ---------------------------------------------------------------------
   HOW SAVING WORKS
   * database.json is the only place where project data is stored.
   * READING: if database.json is in the same folder as this page (GitHub
     Pages, or any web server), it is loaded with jQuery AJAX and the
     dashboard opens immediately. A file chosen with the file picker is
     read the same way, through a temporary blob: URL.
   * WRITING: on the published GitHub Pages site, each change is written
     back to database.json in the repository (GitHub asks for a personal
     access token the first time; it stays in this browser only).
     When a local server accepts it, the same save is posted straight to
     database.json. Direct saving also uses the File System Access API
     when the user has connected a file: the change is written, read back
     and compared to confirm it was saved.
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

  /**
   * On page load: use database.json from this same folder when the page is
   * served (GitHub Pages or a local server). Fall back to a previously
   * connected file, then to the Connect button.
   */
  async boot() {
    if (this.supported) {
      const h = await HandleStore.get();
      if (h) this._stored = h;
    }
    if (await this.loadSameDirectory()) return;
    if (this._stored) {
      try { if ((await this._stored.queryPermission({ mode: "readwrite" })) === "granted") return this.attach(this._stored); } catch (e) { }
    }
    this.showConnectScreen();
  },

  /** Read database.json that sits next to index.html. Browsers block this for file:// pages. */
  async loadSameDirectory() {
    if (location.protocol === "file:") return false;
    let text;
    try {
      text = await $.ajax({ url: "database.json", dataType: "text", cache: false, timeout: 20000 });
    } catch (e) { return false; }
    const raw = this.parse(text, "database.json");
    if (raw === false) { this._badFile = true; return false; }
    this.mode = "hosted";
    this.fileName = "database.json";
    this.diskRevision = (raw && raw.meta && raw.meta.revision) || 0;
    this.loaded(raw);
    return true;
  },

  /** Shown only when the same-folder file could not be opened. */
  showConnectScreen() {
    $("#connectBox").show();
    if (!this.supported) {
      $("#btnConnect").prop("disabled", true);
      App.welcomeMsg(`<b>This browser cannot edit files directly.</b> Please open the dashboard in <b>Google Chrome</b> or <b>Microsoft Edge</b> on a computer.<br>
        You can still open database.json with the link below, but you must <b>export</b> it after making changes.`, "warn");
      return;
    }
    if (this._stored) {
      $("#btnReconnect").text("🔄 Reconnect " + this._stored.name).show();
      $("#btnConnect").text("📂 Select a different file");
    }
    if (this._badFile) return;
    const why = location.protocol === "file:"
      ? `This page was opened straight from the computer, so the browser will not read <b>database.json</b> until you select it.`
      : `<b>database.json</b> was not found in the same folder as this page.`;
    App.welcomeMsg(why, "warn");
    $("#welcomeNote").html(`Click <b>Connect Database</b>, select the <b>database.json</b> file in the PMAI folder, and allow the browser to edit it (Chrome or Edge on a computer).`);
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
    toast(this.mode === "hosted" ? "Opened database.json" : "Connected to " + this.fileName);
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

  /** True when this page is the published GitHub Pages site. */
  onGithub() { return /\.github\.io$/i.test(location.hostname); },

  /** Repository that GitHub Pages is serving. database.json lives at the repo root. */
  githubTarget() {
    const owner = location.hostname.replace(/\.github\.io$/i, "");
    const seg = location.pathname.split("/").filter(Boolean);
    const repo = seg.length ? seg[0] : owner + ".github.io";
    return { owner, repo, path: "database.json" };
  },

  ajax(options) {
    return new Promise((resolve, reject) => {
      $.ajax(options).done(resolve).fail(xhr => {
        const msg = (xhr.responseJSON && xhr.responseJSON.message) || ("Request failed (" + (xhr.status || "network") + ")");
        const e = new Error(msg);
        e.status = xhr.status;
        reject(e);
      });
    });
  },

  toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  },

  /**
   * Save the whole database.
   * Called after every add / edit / delete. Returns true when the write succeeded.
   */
  save(activity) {
    if (activity) {
      this.data.activity.unshift({ at: U.now(), text: activity });
      this.data.activity.length = Math.min(this.data.activity.length, 200);
    }
    this.data.meta.revision = (this.data.meta.revision || 0) + 1;
    this.data.meta.updatedAt = U.now();

    if (this.mode === "memory") {                    // opened a loose JSON copy: export is the only save
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

  /** Write database.json through the file handle, a local server, or GitHub. */
  async write(force) {
    const text = JSON.stringify(this.data, null, 2), rev = this.data.meta.revision;
    if (this.mode === "fs" && this.handle) return this.writeHandle(force, text, rev);
    if (!this.onGithub() && await this.writeSameOrigin(text)) return this.markSaved("server", rev);
    if (this.onGithub()) {
      await this.writeGithub(text);
      return this.markSaved("github", rev);
    }
    throw new Error("database.json could not be updated from this page");
  },

  markSaved(mode, rev) {
    this.mode = mode;
    this.diskRevision = rev;
    Object.assign(this.status, { error: null, conflict: false, dirty: false, lastSaved: U.now() });
  },

  /** Local server that accepts POST database.json (see a server started for this folder). */
  async writeSameOrigin(text) {
    try {
      const res = await this.ajax({
        url: "database.json", method: "POST", data: text, processData: false,
        contentType: "application/json; charset=utf-8", dataType: "json", timeout: 20000
      });
      return !!(res && res.ok);
    } catch (e) { return false; }
  },

  /** Update database.json in the GitHub repository that GitHub Pages publishes. */
  async writeGithub(text) {
    const info = this.githubTarget();
    let token = localStorage.getItem("pmai-gh-token") || "";
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!token) token = await this.askGithubToken(info);
      if (!token) throw new Error("database.json was not updated because saving was cancelled");
      try {
        await this.putGithub(info, token, text);
        localStorage.setItem("pmai-gh-token", token);
        return;
      } catch (e) {
        if (e.status === 401 && attempt === 0) { localStorage.removeItem("pmai-gh-token"); token = ""; continue; }
        throw e;
      }
    }
  },

  async putGithub(info, token, text) {
    const base = "https://api.github.com/repos/" + encodeURIComponent(info.owner) + "/" + encodeURIComponent(info.repo) + "/contents/" + info.path;
    const headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    let last;
    for (let i = 0; i < 2; i++) {
      const current = await this.ajax({ url: base, method: "GET", headers, dataType: "json", timeout: 20000 });
      try {
        await this.ajax({
          url: base, method: "PUT", headers,
          data: JSON.stringify({ message: "Update project data in database.json", content: this.toBase64(text), sha: current.sha }),
          processData: false, contentType: "application/json", dataType: "json", timeout: 30000
        });
        return;
      } catch (e) {
        last = e;
        if (e.status !== 409 || i === 1) throw e;   // 409: the file changed, read the new sha and try once more
      }
    }
    throw last;
  },

  /** First save on GitHub Pages: the token is stored in this browser, never in database.json. */
  askGithubToken(info) {
    return new Promise(resolve => {
      let done = false;
      const finish = token => { if (done) return; done = true; resolve(token || ""); };
      App.modal({
        title: "Save changes to database.json",
        onClose: () => finish(""),
        body: `<p>Changes are written to <b>database.json</b> in the GitHub repository <b>${esc(info.owner + "/" + info.repo)}</b>.</p>
          <p>GitHub requires a personal access token the first time. Create one with <b>Contents: Read and write</b> for this repository only, then paste it here. It stays in this browser and is not saved in the project file.</p>
          <p><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Create a token on GitHub</a></p>
          <form class="form" onsubmit="return false"><div class="full"><label>GitHub token</label><input id="ghToken" type="password" autocomplete="off"></div></form>`,
        buttons: [
          { label: "Save to database.json", onClick: () => {
            const t = $("#ghToken").val().trim();
            if (!t) { toast("Paste the token first", true); return false; }
            finish(t);
          } },
          { label: "Cancel", cls: "sec", onClick: () => finish("") }
        ]
      });
    });
  },

  /** Write the connected file, then read it back to confirm the content really changed. */
  async writeHandle(force, text, rev) {
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
    this.diskModified = after.lastModified;
    this.markSaved("fs", rev);
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
        <tr><td>Saving</td><td>${this.mode === "memory" ? badge("Not saving - export needed", "red") : badge("Saves to database.json", "green")}</td></tr>
        <tr><td>Last saved</td><td>${s.lastSaved ? new Date(s.lastSaved).toLocaleString() : "—"}</td></tr>
        <tr><td>Records</td><td>${d.projects.length} projects, ${d.risks.length} risks, ${d.issues.length} issues, ${d.comments.length} comments/updates</td></tr></table>
        ${s.conflict ? `<div class="note bad mt">${esc(s.error)}</div>` : ""}
        <h3 class="mt">Alert thresholds</h3>
        <form class="form" id="setForm" onsubmit="return false">
          <div><label>Schedule warning (% behind plan)</label><input type="number" name="scheduleWarning" min="1" max="100" value="${st.scheduleWarning}"></div>
          <div><label>Schedule critical (% behind plan)</label><input type="number" name="scheduleCritical" min="1" max="100" value="${st.scheduleCritical}"></div>
          <div><label>Budget warning (% of budget used)</label><input type="number" name="budgetWarning" min="1" max="100" value="${st.budgetWarning}"></div>
        </form>
        <div class="note mt small">On the published site, each change is written to <b>database.json</b> in the GitHub repository. The first save asks for a GitHub token and keeps it in this browser only.</div>`,
      buttons: [
        { label: "Save thresholds", onClick: () => this.saveSettings() },
        ...(this.mode !== "memory" ? [{ label: "Reload from file", cls: "sec", onClick: () => { this.reload(); } }] : []),
        ...(this.onGithub() ? [{ label: "Forget GitHub token", cls: "sec", onClick: () => { localStorage.removeItem("pmai-gh-token"); toast("GitHub token removed from this browser"); } }] : []),
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
    if (!(await this.save("Alert thresholds changed"))) return false;
    toast("Thresholds saved"); App.render();
  },

  async reload() {
    try {
      let text, modified = 0;
      if (this.mode === "fs" && this.handle) {
        const file = await this.handle.getFile();
        text = await this.readFile(file);
        modified = file.lastModified;
      } else {
        text = await this.ajax({ url: "database.json", dataType: "text", cache: false, timeout: 20000 });
      }
      const raw = this.parse(text, this.fileName);
      if (!raw) throw new Error("the file is empty or invalid");
      this.data = this.normalize(raw);
      this.diskModified = modified; this.diskRevision = this.data.meta.revision;
      Object.assign(this.status, { state: "saved", error: null, conflict: false, dirty: false });
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
