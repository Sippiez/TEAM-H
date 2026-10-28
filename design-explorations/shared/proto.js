/*
 * Shared prototype behaviour: language, selection state, canned chat replies,
 * and the illustrative form facsimile. Each design only restyles and arranges.
 */
(function () {
  const D = window.FH_DATA;
  const listeners = {};
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const FH = {
    lang: "en",
    state: { selectedId: null, visited: new Set(), page: 1, docId: "pptc153" },
    esc,
    data: D,

    on(evt, fn) { (listeners[evt] ||= []).push(fn); },
    emit(evt, detail) { (listeners[evt] || []).forEach((fn) => fn(detail)); },

    t(key, vars) {
      let s = D.i18n[FH.lang][key] ?? D.i18n.en[key] ?? key;
      if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
      return s;
    },

    setLang(lang) {
      FH.lang = lang;
      document.documentElement.lang = lang;
      FH.applyI18n(document);
      FH.emit("lang", lang);
    },
    toggleLang() { FH.setLang(FH.lang === "en" ? "fr" : "en"); },

    applyI18n(root) {
      root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = FH.t(el.dataset.i18n); });
      root.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = FH.t(el.dataset.i18nPh); });
      root.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", FH.t(el.dataset.i18nAria)); });
    },

    fields() { return D.fields.map((f) => FH.field(f.id)); },
    field(id) {
      const f = D.fields.find((x) => x.id === id);
      if (!f) return null;
      const L = f[FH.lang];
      return {
        id: f.id, page: f.page, section: f.section, sectionLabel: D.sections[f.section][FH.lang],
        type: f.type, grounded: f.grounded, guarantor: !!f.guarantor, bold: !!f.bold,
        options: f.options ? f.options[FH.lang] : null,
        label: L.label, meaning: L.meaning, enter: L.enter, example: L.example, find: L.find,
        mistakes: L.mistakes || [], points: L.points || null,
        sources: f.sources.map(FH.resource),
        index: D.fields.indexOf(f),
      };
    },
    resource(id) {
      const r = D.resources[id];
      return { id, url: r.url, title: r[FH.lang], note: FH.lang === "fr" ? FH.t("sourceLang") : "", checked: FH.t("checked") };
    },
    sectionsInOrder() {
      const seen = [];
      D.fields.forEach((f) => { if (!seen.includes(f.section)) seen.push(f.section); });
      return seen.map((id) => ({ id, label: D.sections[id][FH.lang], fields: D.fields.filter((f) => f.section === id).map((f) => FH.field(f.id)) }));
    },
    overview() { return { ...D.overview[FH.lang], sources: D.overview.sources.map(FH.resource) }; },
    doc() { return D.docs.find((d) => d.id === FH.state.docId); },

    select(id) {
      if (id && !FH.field(id)) return;
      FH.state.selectedId = id;
      if (id) {
        FH.state.visited.add(id);
        const p = FH.field(id).page;
        if (p !== FH.state.page) { FH.state.page = p; FH.emit("page", p); }
      }
      FH.emit("select", id ? FH.field(id) : null);
    },
    step(dir) {
      const ids = D.fields.map((f) => f.id);
      const i = ids.indexOf(FH.state.selectedId);
      const next = i < 0 ? ids[0] : ids[Math.min(ids.length - 1, Math.max(0, i + dir))];
      FH.select(next);
    },
    setPage(p) { FH.state.page = p; FH.emit("page", p); },
    setDoc(id) {
      FH.state.docId = id;
      FH.emit("doc", id);
      FH.setLang(FH.doc().lang);
    },

    /** Canned keyword replies so every design can demo the chat. */
    reply(text) {
      const q = text.toLowerCase();
      const fr = FH.lang === "fr";
      const pick = (en, frs) => (fr ? frs : en);
      if (/guarant|répondant|repondant/.test(q)) {
        const f = FH.field("g-number");
        return {
          text: pick("Your guarantor confirms who you are. They must meet all of these:", "Votre répondant confirme votre identité. Il doit respecter tous ces critères :"),
          list: f.points.items,
          refs: ["g-surname", "g-number"],
          sources: [FH.resource("passport-required-docs")],
        };
      }
      if (/date|birth|naissance|né/.test(q)) return { text: pick("Write your date of birth as year, month, day, for example 1990-04-15. It's in section 1 on page 1.", "Inscrivez votre date de naissance au format année, mois, jour, par exemple 1990-04-15. C'est à la section 1, page 1."), refs: ["dob"], sources: [FH.resource("passport-citizenship-proof")] };
      if (/surname|name|nom/.test(q)) return { text: pick("Write your surname in capital letters, exactly as on your proof of citizenship. Former surnames go in their own box.", "Écrivez votre nom de famille en majuscules, exactement comme sur votre preuve de citoyenneté. Les noms antérieurs vont dans leur propre case."), refs: ["surname", "former"], sources: [FH.resource("passport-citizenship-proof"), FH.resource("passport-change-name")] };
      if (/travel|trip|voyage/.test(q)) return { text: pick("Give a travel date if you have one, or choose Unknown. The form recommends not booking non-refundable travel until your passport arrives.", "Indiquez une date de voyage si vous en avez une, sinon choisissez Inconnue. Le formulaire recommande de ne pas réserver de voyage non remboursable avant de recevoir le passeport."), refs: ["travel"], sources: [FH.resource("passport-submit")] };
      if (/cost|fee|price|pay|frais|coût|cout|prix/.test(q)) return { text: pick("Fees depend on the passport validity and where you apply. The official fees page has the current amounts.", "Les frais dépendent de la durée de validité et de l'endroit où vous présentez la demande. La page officielle des frais indique les montants actuels."), refs: [], sources: [FH.resource("passport-fees")] };
      if (/renew|renouvel/.test(q)) return { text: pick("If you already have an adult passport, you may be able to renew instead, which uses a simpler form.", "Si vous avez déjà un passeport pour adulte, vous pourriez plutôt le renouveler avec un formulaire plus simple."), refs: [], sources: [FH.resource("passport-renew")] };
      return { text: pick("In the real app, this answer would be written from the form text and official pages. Try asking about guarantors, dates, names, travel or fees.", "Dans l'application réelle, cette réponse serait rédigée à partir du formulaire et des pages officielles. Essayez une question sur le répondant, les dates, les noms, le voyage ou les frais."), refs: [], sources: [FH.resource("passports")] };
    },

    /** Seeded conversation shown when the workspace opens. */
    seedChat() {
      const o = FH.overview();
      return [
        { role: "assistant", kind: "overview", overview: o },
        { role: "user", text: FH.t("suggestion1") },
        { role: "assistant", ...FH.reply("guarantor") },
      ];
    },

    /* ---------------- Facsimile ---------------- */
    renderSheet(container, opts = {}) {
      const doc = FH.doc();
      const fr = doc.lang === "fr";
      const p = FH.state.page;
      const L = (en, f) => (fr ? f : en);
      const ff = (id, inner = "", cls = "") => {
        const f = D.fields.find((x) => x.id === id);
        const lab = f[doc.lang].label;
        const st = [FH.state.selectedId === id ? "is-selected" : "", FH.state.visited.has(id) ? "is-visited" : "", f.bold ? "is-bold" : ""].join(" ");
        return `<button type="button" class="ff ${cls} ${st}" data-field="${id}" aria-label="${esc(lab)}" aria-pressed="${FH.state.selectedId === id}"><span class="ff-label">${esc(lab)}</span>${inner}</button>`;
      };
      const boxes = (labels) => `<span class="ff-boxes">${labels.map((l) => `<span class="ff-box"><i>${esc(l)}</i></span>`).join("")}</span>`;
      const ticks = (labels) => `<span class="ff-ticks">${labels.map((l) => `<span class="ff-tick"><b></b>${esc(l)}</span>`).join("")}</span>`;
      const filler = (n, label) => Array.from({ length: n }, (_, i) => `<div class="fs-static"><span>${esc(label)} ${i + 1}</span></div>`).join("");

      let body = "";
      if (p === 1) {
        body = `
          <div class="fs-bar">${L("1 — PERSONAL INFORMATION", "1 — RENSEIGNEMENTS PERSONNELS")}</div>
          <div class="fs-row">${ff("surname")}</div>
          <div class="fs-row">${ff("given")}</div>
          <div class="fs-row fs-2">${ff("former")}${ff("parents")}</div>
          <div class="fs-row fs-4">${ff("dob", boxes(fr ? ["AAAA", "MM", "JJ"] : ["YYYY", "MM", "DD"]))}${ff("sex", ticks(["F", "M", "X"]))}${ff("eye")}${ff("height")}</div>
          <div class="fs-row">${ff("pob", boxes(fr ? ["Ville", "Pays", "Prov./Terr./État"] : ["City", "Country", "Prov./Terr./State"]))}</div>
          <div class="fs-bar">${L("TRAVEL", "VOYAGE")}</div>
          <div class="fs-row">${ff("travel", ticks(fr ? ["Date", "Inconnue"] : ["Date", "Unknown"]))}</div>
          <div class="fs-row fs-2">${filler(2, L("Contact information", "Coordonnées"))}</div>
          <div class="fs-row fs-3">${filler(3, L("Address", "Adresse"))}</div>`;
      } else if (p === 3) {
        body = `
          <div class="fs-bar">${L("2 — GUARANTOR DECLARATION", "2 — DÉCLARATION DU RÉPONDANT")}</div>
          <p class="fs-decl">${L("I declare that I have known the applicant personally for at least two years and that, to the best of my knowledge, the information in this application is true. (Paraphrased for the prototype.)", "Je déclare connaître personnellement le demandeur depuis au moins deux ans et que, à ma connaissance, les renseignements de cette demande sont exacts. (Paraphrasé pour le prototype.)")}</p>
          <div class="fs-row">${ff("g-surname")}</div>
          <div class="fs-row fs-3">${ff("g-number")}${ff("g-issue", boxes(fr ? ["AAAA", "MM", "JJ"] : ["YYYY", "MM", "DD"]))}${ff("g-expiry", boxes(fr ? ["AAAA", "MM", "JJ"] : ["YYYY", "MM", "DD"]))}</div>
          <div class="fs-row fs-2">${filler(2, L("Guarantor contact", "Coordonnées du répondant"))}</div>
          <div class="fs-sign"><span>${L("Guarantor's signature", "Signature du répondant")}</span></div>`;
      } else {
        body = `<div class="fs-greek">${Array.from({ length: 9 }, () => "<span></span>").join("")}</div>
          <p class="fs-missing">${esc(FH.t("pageNotMocked"))}</p>`;
      }

      container.innerHTML = `
        <article class="form-sheet ${opts.compact ? "is-compact" : ""}" lang="${doc.lang}">
          <header class="fs-head">
            <span class="fs-num">${doc.number} <em>${L("(illustrative facsimile)", "(fac-similé illustratif)")}</em></span>
            <strong class="fs-title">${L("ADULT GENERAL PASSPORT APPLICATION", "DEMANDE DE PASSEPORT GÉNÉRAL POUR ADULTES")}</strong>
            <span class="fs-page">${L("Page", "Page")} ${p} ${L("of", "de")} ${doc.pages}</span>
          </header>
          <div class="fs-body">${body}</div>
        </article>`;

      container.querySelectorAll("[data-field]").forEach((b) => b.addEventListener("click", () => FH.select(b.dataset.field)));
    },

    /** Re-render a sheet whenever state changes. */
    mountSheet(container, opts) {
      const draw = () => FH.renderSheet(container, opts);
      ["select", "page", "doc", "lang"].forEach((e) => FH.on(e, draw));
      draw();
      return draw;
    },

    /* ---------------- Small render helpers ---------------- */
    sourceList(sources, cls = "src") {
      if (!sources.length) return "";
      return `<ul class="${cls}-list">${sources.map((s) => `<li class="${cls}"><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a>${s.note ? `<small class="${cls}-note">${esc(s.note)}</small>` : ""}<small class="${cls}-date">${esc(s.checked)}</small></li>`).join("")}</ul>`;
    },

    /** Prototype switcher shared by every design file. */
    mountSwitcher(onView) {
      const nav = document.createElement("nav");
      nav.className = "proto-switch";
      nav.setAttribute("aria-label", "Prototype views");
      nav.innerHTML = `<button type="button" data-view="landing">Landing</button><button type="button" data-view="workspace">Workspace</button><a href="index.html">← All designs</a>`;
      document.body.appendChild(nav);
      const set = (v) => {
        nav.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === v));
        document.body.dataset.view = v;
        onView && onView(v);
        if (location.hash !== `#${v}`) history.replaceState(null, "", `#${v}`);
        window.scrollTo(0, 0);
      };
      nav.addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) set(b.dataset.view); });
      FH.showView = set;
      set(location.hash === "#workspace" ? "workspace" : "landing");
    },
  };

  window.FH = FH;
})();
