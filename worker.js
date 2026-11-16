const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TextDrop</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#16202a;--mute:#5d6b78;--line:#d9dee4;--accent:#0b6e4f;--accent-ink:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#10151a;--card:#182027;--ink:#e8edf1;--mute:#93a1ae;--line:#2b3640;--accent:#3fb98a;--accent-ink:#08150f}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif;padding:16px}
main{max-width:640px;margin:0 auto;display:grid;gap:16px}
h1{font-size:1.4rem;margin:8px 0 0}
p.sub{margin:0;color:var(--mute)}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;display:grid;gap:10px}
h2{font-size:1rem;margin:0}
textarea,input{width:100%;font:inherit;color:inherit;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:10px}
textarea{min-height:140px;resize:vertical}
button{font:inherit;font-weight:600;border:0;border-radius:6px;padding:12px 16px;background:var(--accent);color:var(--accent-ink);cursor:pointer}
button.alt{background:transparent;color:var(--ink);border:1px solid var(--line)}
button:disabled{opacity:.5}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.code{font:700 2rem/1 ui-monospace,monospace;letter-spacing:.15em}
.msg{color:var(--mute);min-height:1.5em;margin:0}
.err{color:#c0392b}
pre{margin:0;max-height:160px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:10px;font-size:.85rem}
.row{display:flex;gap:8px}.row>*{flex:1}
[hidden]{display:none!important}
</style>
</head>
<body>
<main>
  <div>
    <h1>TextDrop</h1>
    <p class="sub">Paste text here, open it on another device. Deleted after 30 minutes.</p>
  </div>

  <section>
    <h2>Password</h2>
    <input id="pw" type="password" placeholder="Your password" autocomplete="current-password">
  </section>

  <section>
    <h2>Send text</h2>
    <textarea id="text" placeholder="Paste text here (up to 25 MB)"></textarea>
    <button id="save">Save text</button>
    <p class="msg" id="saveMsg" role="status"></p>
    <div id="result" hidden>
      <div class="code" id="codeOut"></div>
      <p class="msg">Enter this code on your other device.</p>
    </div>
  </section>

  <section>
    <h2>Get text</h2>
    <div class="row">
      <input id="codeIn" placeholder="Code" autocapitalize="characters" autocomplete="off" maxlength="6">
      <button id="load" style="flex:0 0 auto">Get text</button>
    </div>
    <p class="msg" id="loadMsg" role="status"></p>
    <div id="got" hidden>
      <pre id="preview"></pre>
      <button id="copy" style="margin-top:10px;width:100%">Copy all text</button>
    </div>
  </section>
</main>

<script>
const $ = (id) => document.getElementById(id);
let loaded = "";
$("pw").value = localStorage.getItem("td_pw") || "";

const fmt = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.ceil(n / 1024) + " KB";
const say = (el, text, bad) => { el.textContent = text; el.classList.toggle("err", !!bad); };

async function gzip(str) {
  const stream = new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"));
  return await new Response(stream).arrayBuffer();
}
function toB64(buf) {
  const u = new Uint8Array(buf); let s = "";
  for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
  return btoa(s);
}
function fromB64(str) {
  const s = atob(str); const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
async function gunzip(buf) {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}
function pw() {
  const v = $("pw").value;
  localStorage.setItem("td_pw", v);
  return v;
}

$("save").onclick = async () => {
  const text = $("text").value;
  if (!text) return say($("saveMsg"), "Paste some text first.", true);
  $("save").disabled = true; $("result").hidden = true;
  try {
    say($("saveMsg"), "Compressing...");
    const body = toB64(await gzip(text));
    say($("saveMsg"), "Uploading " + fmt(body.length) + "...");
    const r = await fetch("/api/save", { method: "PUT", headers: { "x-password": pw(), "content-type": "text/plain" }, body });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    $("codeOut").textContent = d.code; $("result").hidden = false;
    say($("saveMsg"), "Saved. Expires in 30 minutes.");
  } catch (e) { say($("saveMsg"), e.message, true); }
  $("save").disabled = false;
};

$("load").onclick = async () => {
  const c = $("codeIn").value.trim();
  if (!c) return say($("loadMsg"), "Enter the code.", true);
  $("load").disabled = true; $("got").hidden = true;
  try {
    say($("loadMsg"), "Downloading...");
    const r = await fetch("/api/load?code=" + encodeURIComponent(c), { headers: { "x-password": pw() } });
    if (!r.ok) throw new Error((await r.json()).error);
    loaded = await gunzip(fromB64(await r.text()));
    $("preview").textContent = loaded.slice(0, 2000) + (loaded.length > 2000 ? "\\n\\n... (preview only)" : "");
    $("got").hidden = false;
    say($("loadMsg"), "Loaded " + loaded.length.toLocaleString() + " characters.");
  } catch (e) { say($("loadMsg"), e.message, true); }
  $("load").disabled = false;
};

$("copy").onclick = async () => {
  try { await navigator.clipboard.writeText(loaded); say($("loadMsg"), "Copied to clipboard."); }
  catch { say($("loadMsg"), "Copy was blocked by the browser. Tap Get text again, then Copy.", true); }
};
</script>
</body>
</html>
`;

const TTL = 30 * 60; // 30 minutes
const MAX_BYTES = 25 * 1024 * 1024; // KV value limit
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

function code() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return new Response(PAGE, { headers: { "content-type": "text/html;charset=utf-8" } });

    if (!env.PASSWORD || req.headers.get("x-password") !== env.PASSWORD)
      return json({ error: "Wrong password." }, 401);

    if (url.pathname === "/api/save" && req.method === "PUT") {
      const body = await req.text();
      if (body.length === 0) return json({ error: "Nothing to save." }, 400);
      if (body.length > MAX_BYTES)
        return json({ error: "Text is too large even after compression (25 MB limit)." }, 413);
      const id = code();
      await env.TEXTS.put(id, body, { expirationTtl: TTL });
      return json({ code: id, expiresInSeconds: TTL });
    }

    if (url.pathname === "/api/load" && req.method === "GET") {
      const id = (url.searchParams.get("code") || "").toUpperCase().trim();
      const data = await env.TEXTS.get(id, { type: "text" });
      if (!data) return json({ error: "Code not found or expired. KV can take up to a minute to sync, so try again shortly." }, 404);
      return new Response(data, { headers: { "content-type": "text/plain" } });
    }

    return json({ error: "Not found." }, 404);
  },
};
