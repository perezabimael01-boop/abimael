/* Help chat widget — My Computer tools
   Add this ONE line just before </body> on every page:
     <script src="help-chat.js"></script>
*/

// >>> Your Cloudflare worker address — the ONLY place you need to change it <<<
const HELP_CHAT_ENDPOINT = "https://abimael-help.perezabimael01.workers.dev";

(function(){
  const script = document.currentScript;
  const ENDPOINT = (script && script.dataset.endpoint) || HELP_CHAT_ENDPOINT;
  const isNL = ((script && script.dataset.lang) || document.documentElement.lang || "").toLowerCase().startsWith("nl");
  const T = isNL ? {
    button: "Hulp nodig?", title: "Hulp bij deze pagina",
    hello: "Hoi! Vraag me gerust hoe deze pagina werkt, bijvoorbeeld wat je in een veld moet invullen of waarom je een foutmelding krijgt.",
    placeholder: "Typ je vraag…", send: "Verstuur", thinking: "Even denken…",
    error: "Sorry, de hulp is nu niet bereikbaar. Probeer het straks opnieuw.", close: "Sluiten"
  } : {
    button: "Need help?", title: "Help with this page",
    hello: "Hi! Ask me how this page works — for example what to enter in a field, or why you see an error.",
    placeholder: "Type your question…", send: "Send", thinking: "Thinking…",
    error: "Sorry, help isn't available right now. Please try again in a moment.", close: "Close"
  };

  const css = `
  #mchat-root{--mc-blue:#1f8fe0;--mc-blue-dark:#0f5d94;--mc-orange:#f2810e;--mc-ink:#20262c;--mc-muted:#6b7480;--mc-line:#dfe4e8;
    position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:var(--mc-ink);}
  #mchat-root *{box-sizing:border-box;}
  .mchat-btn{display:flex;align-items:center;gap:8px;background:var(--mc-blue);color:#fff;border:none;border-radius:999px;
    padding:12px 18px;font:600 14px/1 inherit;font-family:inherit;cursor:pointer;box-shadow:0 4px 14px rgba(15,93,148,.3);}
  .mchat-btn:hover{background:var(--mc-blue-dark);}
  .mchat-btn:focus-visible,.mchat-panel button:focus-visible,.mchat-panel textarea:focus-visible{outline:3px solid var(--mc-orange);outline-offset:2px;}
  .mchat-panel{display:none;flex-direction:column;width:min(370px,calc(100vw - 32px));height:min(520px,calc(100vh - 100px));
    background:#fff;border:1px solid var(--mc-line);border-radius:12px;box-shadow:0 10px 32px rgba(20,30,40,.18);overflow:hidden;}
  #mchat-root.open .mchat-panel{display:flex;}
  #mchat-root.open .mchat-btn{display:none;}
  .mchat-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--mc-blue);color:#fff;}
  .mchat-head b{font-size:14.5px;}
  .mchat-x{background:none;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:2px 6px;}
  .mchat-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f6f9fb;}
  .mchat-msg{max-width:85%;padding:9px 12px;border-radius:10px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;}
  .mchat-bot{align-self:flex-start;background:#fff;border:1px solid var(--mc-line);}
  .mchat-user{align-self:flex-end;background:var(--mc-blue);color:#fff;}
  .mchat-wait{color:var(--mc-muted);font-style:italic;}
  .mchat-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--mc-line);background:#fff;}
  .mchat-form textarea{flex:1;resize:none;height:42px;max-height:110px;border:1px solid var(--mc-line);border-radius:8px;padding:10px;
    font:14px/1.4 inherit;font-family:inherit;color:var(--mc-ink);}
  .mchat-form button{background:var(--mc-orange);color:#fff;border:none;border-radius:8px;padding:0 14px;font-weight:600;font-family:inherit;cursor:pointer;}
  .mchat-form button:disabled{opacity:.5;cursor:default;}
  @media print{#mchat-root{display:none !important;}}
  @media (max-width:480px){#mchat-root{right:12px;bottom:12px;}}`;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "mchat-root";
  root.innerHTML = `
    <button class="mchat-btn" type="button" aria-expanded="false">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>
      ${T.button}
    </button>
    <div class="mchat-panel" role="dialog" aria-label="${T.title}">
      <div class="mchat-head"><b>${T.title}</b><button class="mchat-x" type="button" aria-label="${T.close}">&times;</button></div>
      <div class="mchat-log" aria-live="polite"></div>
      <div class="mchat-form">
        <textarea rows="1" placeholder="${T.placeholder}" aria-label="${T.placeholder}"></textarea>
        <button type="button">${T.send}</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const openBtn = root.querySelector(".mchat-btn");
  const closeBtn = root.querySelector(".mchat-x");
  const log = root.querySelector(".mchat-log");
  const input = root.querySelector("textarea");
  const sendBtn = root.querySelector(".mchat-form button");
  const history = [];
  let busy = false;

  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  function addMsg(text, who){
    const el = document.createElement("div");
    el.className = "mchat-msg " + (who === "user" ? "mchat-user" : who === "wait" ? "mchat-bot mchat-wait" : "mchat-bot");
    el.innerHTML = escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  // Tells the AI which page the user is on, which fields are visible and any error shown.
  function pageContext(){
    const visible = el => el.offsetParent !== null;
    const labels = [...document.querySelectorAll("label, h1, h2, h3, button, th")]
      .filter(el => visible(el) && !root.contains(el))
      .map(el => el.textContent.replace(/\s+/g, " ").trim())
      .filter(Boolean).slice(0, 60);
    const errors = [...document.querySelectorAll(".error, .invalid .error, #errorBox, .status")]
      .filter(el => visible(el) && el.textContent.trim())
      .map(el => el.textContent.replace(/\s+/g, " ").trim());
    return `Page title: ${document.title}\nPage file: ${location.pathname.split("/").pop() || "index.html"}\n` +
           `Visible labels/buttons: ${[...new Set(labels)].join(" | ")}\n` +
           `Visible error messages: ${errors.length ? [...new Set(errors)].join(" | ") : "none"}`;
  }

  async function send(){
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true;
    input.value = "";
    addMsg(text, "user");
    history.push({ role: "user", content: text });
    const wait = addMsg(T.thinking, "wait");
    try {
      if (!ENDPOINT) throw new Error("No data-endpoint set on the help-chat.js script tag");
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, page: pageContext() })
      });
      let data;
      try { data = await res.json(); }
      catch { throw new Error("The worker did not answer with chat data (is the worker.js code deployed?)"); }
      if (!res.ok || !data.reply) throw new Error(data.error || ("HTTP " + res.status));
      wait.remove();
      addMsg(data.reply, "bot");
      history.push({ role: "assistant", content: data.reply });
    } catch (err){
      console.error("Help chat:", err);
      wait.remove();
      const why = err && err.message && err.message !== "Failed to fetch" ? err.message
        : "Could not reach the worker (check the address in help-chat.js).";
      addMsg(T.error + "\n\n(" + why + ")", "bot");
      history.pop(); // let the user ask again
    }
    busy = false; sendBtn.disabled = false; input.focus();
  }

  openBtn.addEventListener("click", () => {
    root.classList.add("open"); openBtn.setAttribute("aria-expanded", "true");
    if (!log.children.length) addMsg(T.hello, "bot");
    input.focus();
  });
  closeBtn.addEventListener("click", () => {
    root.classList.remove("open"); openBtn.setAttribute("aria-expanded", "false"); openBtn.focus();
  });
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); send(); }
    if (e.key === "Escape") closeBtn.click();
  });
})();
