// Import configuration
import config from './config.js';

// === Configure this ===
const DEFAULT_WEBHOOK_URL = config.webhookUrl; // optional fallback
// =======================

const els = {
  messages: document.getElementById("messages"),
  form: document.getElementById("composerForm"),
  input: document.getElementById("userInput"),
  send: document.getElementById("sendBtn"),
  stop: document.getElementById("stopBtn"),
  threads: document.getElementById("threads"),
  newChat: document.getElementById("newChatBtn"),
  title: document.getElementById("chatTitle"),
  toggleSidebar: document.getElementById("toggleSidebar"),
  sidebar: document.getElementById("sidebar"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  exportBtn: document.getElementById("exportBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
};

let controller = null;
let typingTimeout = null;
let typingInterval = null;
let state = {
  chats: load("codify_chats", []),
  activeId: null,
};

// Initialize
(function init(){
  newChat();
  els.form.addEventListener("submit", onSubmit);
  els.input.addEventListener("keydown", autoGrowAndEnter);
  els.newChat.addEventListener("click", () => newChat());
  els.toggleSidebar.addEventListener("click", () => els.sidebar.classList.toggle("open"));
  els.sidebarOverlay.addEventListener("click", () => els.sidebar.classList.remove("open"));
  els.stop.addEventListener("click", () => abortIfRunning());
  // Show stop button when pending
  const observer = new MutationObserver(() => {
    const pending = document.querySelector('.msg.pending');
    els.stop.style.display = pending ? 'block' : 'none';
  });
  observer.observe(els.messages, { childList: true, subtree: true });
  els.exportBtn.addEventListener("click", exportActive);
  els.clearAllBtn.addEventListener("click", clearAll);
  renderThreads();
  // Load shared chat from URL hash
  if (window.location.hash) {
    try {
      const data = decodeURIComponent(window.location.hash.slice(1));
      const sharedChat = JSON.parse(data);
      state.chats.unshift(sharedChat);
      state.activeId = sharedChat.id;
      renderThreads();
      renderMessages();
    } catch (e) {
      console.error('Failed to load shared chat:', e);
    }
  }
})();

function onSubmit(e){
  e.preventDefault();
  const text = els.input.value.trim();
  const webhook = DEFAULT_WEBHOOK_URL;
  if(!text) return;

  addMsg({role:"user", content:text});
  els.input.value = "";
  els.input.style.height = "auto";

  // Send to n8n webhook
  controller = new AbortController();
  const payload = buildPayload();

  addMsg({role:"assistant", content:"…", pending:true});
  fetch(webhook, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).then(async (res)=>{
    const text = await res.text();
    let data = safeJson(text);
    const reply = extractReply(data, text);
    replacePending(reply || "(No reply received)");
  }).catch(err=>{
    replacePending("Request failed: " + err.message);
  }).finally(()=>{ controller = null; persist(); });
}

function buildPayload(){
  const chat = current();
  // Common patterns your n8n workflow can expect
  return {
    source: "codify-frontend",
    thread_id: chat.id,
    timestamp: Date.now(),
    messages: chat.messages.map(m => ({role:m.role, content:m.content})),
    latest: chat.messages.at(-1)?.content || "",
    meta: { user: "Anusha", app: "Codify" }
  };
}

function extractReply(jsonOrNull, fallbackText){
  // Try a few common shapes
  if (jsonOrNull){
    if (typeof jsonOrNull.reply === 'string') return jsonOrNull.reply;
    if (jsonOrNull.data && typeof jsonOrNull.data.reply === 'string') return jsonOrNull.data.reply;
    if (jsonOrNull.choices && jsonOrNull.choices[0]?.message?.content)
      return jsonOrNull.choices[0].message.content;
    if (jsonOrNull.output) return String(jsonOrNull.output);
  }
  // If webhook returned plain text
  if (fallbackText) return fallbackText;
  return null;
}

function safeJson(str){
  try{ return JSON.parse(str); } catch{ return null; }
}

function abortIfRunning(){
  if(controller){ controller.abort(); controller = null; }
  // Stop typing animation if running
  if(typingTimeout){ clearTimeout(typingTimeout); typingTimeout = null; }
  if(typingInterval){ clearInterval(typingInterval); typingInterval = null; }
  // Remove pending state and hide thinking indicator
  const pendingMsg = document.querySelector('.msg.pending');
  if(pendingMsg){
    pendingMsg.classList.remove('pending');
    const chat = current();
    const pending = chat.messages.findLast(m=>m.pending);
    if(pending){
      pending.pending = false;
      persist();
    }
  }
}

function newChat(){
  const id = "t_"+Date.now();
  state.chats.unshift({ id, title: "New chat", messages: [] });
  state.activeId = id;
  renderThreads();
  renderMessages();
}

function current(){
  return state.chats.find(c => c.id === state.activeId);
}

function addMsg(m){
  const chat = current();
  chat.messages.push({...m});
  // Set title from first user line
  if (chat.title === "New chat" && m.role === "user") {
    chat.title = (m.content || "New chat").slice(0, 40);
    renderThreads();
  }
  renderMessages();
  persist();
}

function replacePending(text){
  const chat = current();
  const pending = chat.messages.findLast(m=>m.pending);
  if(pending){
    const node = document.querySelector('.msg.pending .content');
    if(node){
      // Simulate thinking delay
      typingTimeout = setTimeout(() => {
        // For assistant messages, render markdown instantly without typing animation
        node.innerHTML = renderMarkdown(text);
        pending.pending = false;
        pending.content = text;
        // Remove pending class to hide thinking indicator
        const msgEl = node.closest('.msg');
        if(msgEl) msgEl.classList.remove('pending');
        persist();
      }, 1000 + Math.random() * 2000); // Random delay 1-3 seconds
    } else {
      pending.pending = false;
      pending.content = text;
      renderMessages();
      persist();
    }
  }
}

function typeText(element, text, callback){
  element.textContent = '';
  let i = 0;
  typingInterval = setInterval(() => {
    element.textContent += text[i];
    i++;
    if(i >= text.length){
      clearInterval(typingInterval);
      typingInterval = null;
      if(callback) callback();
    }
  }, 10); // Faster typing for final reveal
}

function renderMessages(){
  const chat = current();
  els.messages.innerHTML = "";
  chat.messages.forEach(m => els.messages.appendChild(msgNode(m)));
  els.messages.scrollTop = els.messages.scrollHeight;
  els.title.textContent = chat.title;
}

function msgNode(m){
  const tpl = document.getElementById("msgTpl");
  const node = tpl.content.cloneNode(true);
  const art = node.querySelector('.msg');
  art.classList.add(m.role);
  if(m.pending) art.classList.add('pending');
  const content = node.querySelector('.content');
  if(m.role === 'assistant'){
    content.innerHTML = renderMarkdown(m.content || "");
    // Add event listeners for code block copy buttons
    content.querySelectorAll('.copy-code').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.previousElementSibling.textContent;
        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = 'Copy', 2000);
        });
      });
    });
  } else {
    content.textContent = m.content || "";
  }
  node.querySelector('.copy').addEventListener('click', ()=>{
    navigator.clipboard.writeText(stripMd(m.content || ""));
  });
  return node;
}

function renderThreads(){
  els.threads.innerHTML = "";
  state.chats.forEach(c => {
    const b = document.createElement('button');
    b.className = 'thread' + (c.id===state.activeId?' active':'');
    b.textContent = c.title || 'Chat';
    b.onclick = ()=>{ state.activeId=c.id; renderThreads(); renderMessages(); };
    els.threads.appendChild(b);
  });
}

function persist(){ save("codify_chats", state.chats); }

function exportActive(){
  const chat = current();
  const data = encodeURIComponent(JSON.stringify(chat));
  const url = window.location.origin + window.location.pathname + '#' + data;
  navigator.clipboard.writeText(url).then(() => alert('Shareable link copied to clipboard!'));
}

function clearAll(){
  if(!confirm('Delete all chats?')) return;
  state.chats = [];
  newChat();
  persist();
}

// --- Utilities ---
function load(k, fallback){
  try{ return JSON.parse(localStorage.getItem(k)) ?? fallback; }catch{ return fallback; }
}
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function autoGrowAndEnter(e){
  const ta = e.currentTarget;
  ta.style.height = 'auto';
  ta.style.height = Math.min(220, ta.scrollHeight) + 'px';
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    els.form.requestSubmit();
  }
}

// Minimal Markdown to HTML (headers, bold, italics, code blocks, inline code, links, line breaks)
function renderMarkdown(t){
  return (t || '')
    .replace(/&/g,'&amp;').replace(/</g,'<').replace(/>/g,'>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, '<div class="code-block"><pre><code class="language-$1">$2</code></pre><button class="copy-code">Copy</button></div>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\n/g,'<br/>')
    .replace(/\[(.*?)\]\((.*?)\)/g,'<a href="$2" target="_blank" rel="noopener">$1<\/a>');
}
function stripMd(t){ return t; }
