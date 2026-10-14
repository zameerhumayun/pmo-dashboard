/* =====================================================================
   PMO Dashboard - project comments and progress updates
   Each entry is saved in database.json -> "comments":
     { id, projectId, author, type: "Comment" | "Progress Update", text, at, editedAt }
   Entries are shown newest first on the Project Details page and the report.
   ===================================================================== */

const ENTRY_TYPES = ["Progress Update", "Comment"];

const Comments = {
  /** All entries of one project, newest first. */
  of(pid) {
    return DB.data.comments.filter(c => c.projectId === pid).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  },

  /** HTML for the "Comments & Updates" card (add form + history). */
  section(p) {
    const list = this.of(p.id);
    const author = DB.data.settings.lastAuthor || p.manager || "";
    return `<div class="card mt" id="comments"><h3>Comments & Updates (${list.length})</h3>
      <form class="form noprint" id="cform" onsubmit="return false">
        <div><label>Entry Type</label><select name="type">${U.opts(ENTRY_TYPES, "Progress Update")}</select></div>
        <div><label>Author Name *</label><input name="author" value="${esc(author)}" maxlength="60"><div class="err"></div></div>
        <div class="full"><label>Comment / Update Text *</label><textarea name="text" rows="2" maxlength="1500" placeholder="What was done, what is the problem, what happens next..."></textarea><div class="err"></div></div>
        <div class="full"><button class="btn" type="submit">Add Entry</button></div>
      </form>
      <div class="mt">${list.length ? list.map(c => this.entryHtml(c)).join("") : '<p class="muted">No comments or updates yet.</p>'}</div></div>`;
  },

  entryHtml(c) {
    return `<div class="entry ${c.type === "Comment" ? "comment" : "update"}">
      <div class="entry-h">${badge(c.type, c.type === "Comment" ? "gray" : "blue")} <b>${esc(c.author)}</b>
        <span class="small muted">${U.dateTime(c.at)}${c.editedAt ? " · edited " + U.dateTime(c.editedAt) : ""} · ${esc(c.id)}</span>
        <span class="entry-a noprint"><button class="btn sm sec" onclick="Comments.edit('${esc(c.id)}')">Edit</button><button class="btn sm del" onclick="Comments.remove('${esc(c.id)}')">Delete</button></span></div>
      <div class="entry-t">${esc(c.text).replace(/\n/g, "<br>")}</div></div>`;
  },

  /** Add a new entry from the form on the details page. */
  async add(pid) {
    const $f = $("#cform"), author = $f.find("[name=author]").val().trim(), text = $f.find("[name=text]").val().trim();
    $f.find(".err").text(""); $f.find(".bad").removeClass("bad");
    if (!author) $f.find("[name=author]").addClass("bad").siblings(".err").text("Author name is required");
    if (!text) $f.find("[name=text]").addClass("bad").siblings(".err").text("Please write the comment or update");
    if (!author || !text) return;
    const type = $f.find("[name=type]").val();
    DB.data.comments.push({ id: U.nextId(DB.data.comments, "C-"), projectId: pid, author, type, text, at: U.now() });
    DB.data.settings.lastAuthor = author;                 // remembered so the next entry is faster
    if (!(await DB.save(`${type} added to ${pid}`))) return;
    toast(type + " added"); App.render();
  },

  edit(id) {
    const c = DB.data.comments.find(x => x.id === id);
    App.modal({
      title: "Edit " + c.type + " " + c.id,
      body: `<form class="form" id="ceform" onsubmit="return false">
        <div><label>Entry Type</label><select name="type">${U.opts(ENTRY_TYPES, c.type)}</select></div>
        <div><label>Author Name *</label><input name="author" value="${esc(c.author)}" maxlength="60"></div>
        <div class="full"><label>Comment / Update Text *</label><textarea name="text" rows="4" maxlength="1500">${esc(c.text)}</textarea></div></form>`,
      buttons: [{ label: "Cancel", cls: "sec" }, {
        label: "Save", onClick: () => {
          const f = n => $(`#ceform [name=${n}]`).val().trim();
          if (!f("author") || !f("text")) { toast("Author and text are required", true); return false; }
          Object.assign(c, { type: f("type"), author: f("author"), text: f("text"), editedAt: U.now() });
          DB.save(`Entry ${id} edited`).then(ok => ok && toast("Entry saved"));
          App.render();
        }
      }]
    });
  },

  async remove(id) {
    if (!confirm(`Delete entry ${id}? This cannot be undone.`)) return;
    DB.data.comments = DB.data.comments.filter(x => x.id !== id);
    if (!(await DB.save(`Entry ${id} deleted`))) return;
    toast("Entry deleted"); App.render();
  }
};

$(document).on("submit", "#cform", function (e) { e.preventDefault(); Comments.add(App.currentId); });
