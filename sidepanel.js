// ─── Parsely - Browser Copilot v2 — Session-Based ───

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

let state = {
  currentConvoId: null,
  pageContext: null,
  attachPage: true,
  referencedTabs: [],
  conversations: [],
  projects: [],
  isStreaming: false,
  customSkills: [],
  personalInstructions: '',
  chatContexts: {}, // convoId -> summary
  chatTokens: {}, // convoId -> number approx
  attachedFiles: [],
  totalTokens: 0,
  pendingTitle: null
};

const SKILLS = [
  { name:'Summarize', icon:'📋', cmd:'/summarize', prompt:'Summarize the following page content concisely:\n\n{{page}}' },
  { name:'Key Points', icon:'⭐', cmd:'/keypoints', prompt:'Extract key points as a bullet list:\n\n{{page}}' },
  { name:'ELI5', icon:'🧒', cmd:'/eli5', prompt:'Explain this in simple terms:\n\n{{page}}' },
  { name:'Fact Check', icon:'🔍', cmd:'/factcheck', prompt:'Analyze factual claims in this content:\n\n{{page}}' },
  { name:"Devil's Advocate", icon:'😈', cmd:'/devil', prompt:'Challenge the arguments in this content:\n\n{{page}}' },
  { name:'Action Items', icon:'✅', cmd:'/actions', prompt:'Extract action items and next steps:\n\n{{page}}' },
  { name:'Draft Reply', icon:'✍️', cmd:'/reply', prompt:'Draft a reply to this email/message:\n\n{{page}}' },
  { name:'Code Review', icon:'💻', cmd:'/codereview', prompt:'Review the code, find bugs and suggest improvements:\n\n{{page}}' },
  { name:'Translate', icon:'🌐', cmd:'/translate', prompt:'Translate this text to English (or Spanish if already English):\n\n{{selection}}' },
  { name:'Proofread', icon:'📝', cmd:'/proofread', prompt:'Fix grammar, spelling, punctuation:\n\n{{selection}}' }
];

function getAllSkills() {
  return [...SKILLS, ...state.customSkills];
}

// ─── Custom Skills & Personalization Storage ───
async function loadSettings() {
  const data = await chrome.storage.sync.get(['customSkills', 'personalInstructions', 'chatContexts', 'chatTokens']);
  state.customSkills = data.customSkills || [];
  state.personalInstructions = data.personalInstructions || '';
  state.chatContexts = data.chatContexts || {};
  state.chatTokens = data.chatTokens || {};
  
  // Update UI if present
  const piEl = $('#personal-instructions');
  if (piEl) piEl.value = state.personalInstructions;
  
  renderCustomSkillsList();
}

async function saveCustomSkills() {
  await chrome.storage.sync.set({ customSkills: state.customSkills });
  renderCustomSkillsList();
}

async function savePersonalInstructions() {
  state.personalInstructions = $('#personal-instructions').value;
  await chrome.storage.sync.set({ personalInstructions: state.personalInstructions });
}

async function saveChatContexts() {
  await chrome.storage.sync.set({ chatContexts: state.chatContexts });
}

async function saveChatTokens() {
  await chrome.storage.sync.set({ chatTokens: state.chatTokens });
}

function renderCustomSkillsList() {
  const list = $('#custom-skills-list');
  if (!list) return;
  list.innerHTML = '';
  if (!state.customSkills.length) {
    list.innerHTML = '<div class="no-custom-skills">No custom skills yet.</div>';
    return;
  }
  state.customSkills.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'custom-skill-item';
    item.innerHTML =
      `<span class="csi-icon">${s.icon}</span>` +
      `<span class="csi-name">${escHtml(s.name)}</span>` +
      `<span class="csi-cmd">${escHtml(s.cmd)}</span>` +
      `<button class="icon-btn csi-edit" data-idx="${i}" title="Edit">✏️</button>` +
      `<button class="icon-btn csi-delete" data-idx="${i}" title="Delete">🗑️</button>`;
    item.querySelector('.csi-edit').addEventListener('click', () => {
      const sk = state.customSkills[i];
      $('#skill-name').value = sk.name;
      $('#skill-icon').value = sk.icon;
      $('#skill-prompt').value = sk.prompt;
      $('#skill-editor').dataset.editingIndex = String(i);
      $('#skill-editor').classList.remove('hidden');
    });
    item.querySelector('.csi-delete').addEventListener('click', async () => {
      state.customSkills.splice(i, 1);
      await saveCustomSkills();
    });
    list.appendChild(item);
  });
}

// ─── Init ───
async function init() {
  const result = await claudeClient.init();
  if (result.success) {
    showMainScreen();
    await Promise.all([loadPageContext(), loadSettings()]);
    renderWelcome();
  } else {
    showLoginScreen();
  }
  setupEvents();
}

function showLoginScreen() {
  $('#login-screen').classList.remove('hidden');
  $('#main-screen').classList.add('hidden');
}

function showMainScreen() {
  $('#login-screen').classList.add('hidden');
  $('#main-screen').classList.remove('hidden');
}

// ─── Events ───
function setupEvents() {
  // Login check
  $('#btn-check-session').addEventListener('click', async () => {
    const status = $('#login-status');
    status.textContent = 'Checking...';
    status.className = 'login-status';
    const result = await claudeClient.init();
    if (result.success) {
      status.textContent = 'Connected!';
      status.className = 'login-status success';
      setTimeout(() => { showMainScreen(); loadPageContext(); loadCustomSkills(); renderWelcome(); }, 500);
    } else {
      status.textContent = 'Not connected. Please log into claude.ai first.';
      status.className = 'login-status error';
    }
  });

  // Send
  $('#btn-send').addEventListener('click', handleSend);
  $('#chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  // Input auto-resize + slash commands + @ trigger
  $('#chat-input').addEventListener('input', () => {
    const el = $('#chat-input');
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    $('#btn-send').disabled = !el.value.trim();
    if (el.value.startsWith('/')) {
      showSkillsDropdown(el.value);
      $('#tab-selector').classList.add('hidden');
    } else {
      $('#skills-dropdown').classList.add('hidden');
    }
    // @ trigger: show tab selector when user types @
    const lastChar = el.value.slice(-1);
    if (lastChar === '@') {
      $('#tab-selector').classList.remove('hidden');
      populateTabSelector();
    } else if (!el.value.includes('@')) {
      $('#tab-selector').classList.add('hidden');
    }
  });

  // New chat
  $('#btn-new-chat').addEventListener('click', () => {
    state.currentConvoId = null;
    state.referencedTabs = [];
    state.attachedFiles = [];
    state.pendingTitle = null;
    $('#tab-pills').classList.add('hidden');
    $('#tab-pills').innerHTML = '';
    renderAttachmentPills();
    renderWelcome();
  });

  // History
  $('#btn-history').addEventListener('click', openHistory);
  $('#btn-close-history').addEventListener('click', () => $('#history-drawer').classList.add('hidden'));
  $('#history-search').addEventListener('input', filterHistory);

  // Page attach toggle
  $('#btn-attach-page').addEventListener('click', () => {
    state.attachPage = !state.attachPage;
    $('#btn-attach-page').classList.toggle('active', state.attachPage);
    if (state.attachPage && !state.pageContext) loadPageContext();
  });

  // Clear page context (× button in toolbar)
  $('#btn-clear-page').addEventListener('click', () => {
    state.pageContext = null;
    state.attachPage = false;
    $('#btn-attach-page').classList.remove('active');
    $('#page-label').textContent = 'Page';
    $('#btn-clear-page').classList.add('hidden');
  });

  // Tab reference
  $('#btn-attach-tabs').addEventListener('click', () => {
    const sel = $('#tab-selector');
    sel.classList.toggle('hidden');
    if (!sel.classList.contains('hidden')) populateTabSelector();
  });

  // Skills menu
  $('#btn-skills-menu').addEventListener('click', () => {
    const dd = $('#skills-dropdown');
    if (dd.classList.contains('hidden')) showSkillsDropdown('/');
    else dd.classList.add('hidden');
  });

  // Quick actions (delegated)
  $('#chat-messages').addEventListener('click', e => {
    const btn = e.target.closest('.quick-action');
    if (!btn) return;
    const action = btn.dataset.action;
    const map = { summarize:'/summarize', 'key-points':'/keypoints', eli5:'/eli5' };
    if (map[action]) executeSkill(map[action]);
    else if (action === 'qa') { $('#chat-input').value = 'What are the key questions and answers from this page?'; handleSend(); }
  });

  // Settings
  $('#btn-settings').addEventListener('click', () => {
    $('#settings-panel').classList.toggle('hidden');
    // Update session status when opening
    const status = $('#session-status');
    status.textContent = 'Checking...';
    status.className = 'session-status';
    claudeClient.checkSession().then(r => {
      status.textContent = r.loggedIn ? `Connected (org: ${r.orgId?.slice(0,8)}…)` : 'Not connected';
      status.className = `session-status ${r.loggedIn ? 'ok' : 'err'}`;
    });
  });

  // Close overlay panels (delegated)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.close-panel');
    if (!btn) return;
    const panelId = btn.dataset.panel;
    if (panelId) $('#' + panelId)?.classList.add('hidden');
  });



  // Personal Instructions Manual Save
  const btnSavePI = $('#btn-save-personal');
  if (btnSavePI) {
    btnSavePI.addEventListener('click', async () => {
      const orig = btnSavePI.textContent;
      btnSavePI.textContent = 'Saving...';
      btnSavePI.disabled = true;
      await savePersonalInstructions();
      btnSavePI.textContent = 'Saved!';
      setTimeout(() => { btnSavePI.textContent = orig; btnSavePI.disabled = false; }, 2000);
    });
  }

  // Context menu / selection actions
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'CONTEXT_MENU_ACTION' || msg.type === 'SELECTION_ACTION') handleContextAction(msg);
  });

  // Skill editor
  $('#btn-add-skill').addEventListener('click', () => {
    $('#skill-name').value = '';
    $('#skill-icon').value = '';
    $('#skill-prompt').value = '';
    $('#skill-editor').dataset.editingIndex = '-1';
    $('#skill-editor').classList.remove('hidden');
  });

  $('#btn-save-skill').addEventListener('click', async () => {
    const name = $('#skill-name').value.trim();
    const icon = $('#skill-icon').value.trim() || '⚡';
    const prompt = $('#skill-prompt').value.trim();
    if (!name || !prompt) return;
    const cmd = '/' + name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const editingIdx = parseInt($('#skill-editor').dataset.editingIndex ?? '-1', 10);
    if (editingIdx >= 0) {
      state.customSkills[editingIdx] = { name, icon, cmd, prompt };
    } else {
      state.customSkills.push({ name, icon, cmd, prompt });
    }
    await saveCustomSkills();
    $('#skill-editor').classList.add('hidden');
  });

  $('#btn-cancel-skill').addEventListener('click', () => {
    $('#skill-editor').classList.add('hidden');
  });

  // File attachment
  $('#btn-attach-file').addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      try {
        const content = await readFileAsText(file);
        state.attachedFiles.push({ name: file.name, content, size: file.size });
      } catch {}
    }
    e.target.value = '';
    renderAttachmentPills();
  });

  // Auto-refresh page context when the active tab navigates or switches (500ms debounce)
  let contextDebounceTimer = null;
  function debouncedLoadPageContext() {
    clearTimeout(contextDebounceTimer);
    contextDebounceTimer = setTimeout(loadPageContext, 500);
  }

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.status === 'complete') debouncedLoadPageContext();
  });
  chrome.tabs.onActivated.addListener(() => debouncedLoadPageContext());
}

// ─── Page Context ───
async function loadPageContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    const resp = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT', tabId: tab.id });
    if (resp && !resp.error) {
      state.pageContext = resp;
      const pageTitle = resp.meta?.title || tab.title || 'Page';
      const truncated = pageTitle.length > 28 ? pageTitle.slice(0, 26) + '…' : pageTitle;
      $('#page-label').textContent = truncated;
      $('#btn-clear-page').classList.remove('hidden');
      if (state.attachPage) {
        $('#btn-attach-page').classList.add('active');
      }
    }
  } catch {}
}

// ─── Past Conversations ───
async function openHistory() {
  $('#history-drawer').classList.remove('hidden');
  $('#history-list').innerHTML = '<div class="history-loading">Loading...</div>';

  try {
    const [convos, projects] = await Promise.allSettled([
      claudeClient.listConversations(),
      claudeClient.listProjects()
    ]);
    state.conversations = (convos.status === 'fulfilled' ? convos.value : null) || [];
    state.projects = (projects.status === 'fulfilled' ? projects.value : null) || [];
    renderHistory(state.conversations);
  } catch (err) {
    $('#history-list').innerHTML = `<div class="history-empty">Failed to load: ${err.message}</div>`;
  }
}

function renderHistory(convos) {
  const list = $('#history-list');
  if (!convos.length) { list.innerHTML = '<div class="history-empty">No conversations yet</div>'; return; }

  // Build project lookup map
  const projectMap = {};
  (state.projects || []).forEach(p => { projectMap[p.uuid] = p.name || 'Project'; });

  // Group by time
  const now = Date.now();
  const day = 86400000;
  const groups = { today: [], yesterday: [], week: [], older: [] };

  convos.forEach(c => {
    const d = new Date(c.updated_at || c.created_at);
    const diff = now - d.getTime();
    if (diff < day) groups.today.push(c);
    else if (diff < 2 * day) groups.yesterday.push(c);
    else if (diff < 7 * day) groups.week.push(c);
    else groups.older.push(c);
  });

  let html = '';
  const renderGroup = (label, items) => {
    if (!items.length) return '';
    let h = `<div class="history-section-label">${label}</div>`;
    items.forEach(c => {
      const title = c.name || c.summary || 'Untitled';
      const date = new Date(c.updated_at || c.created_at).toLocaleDateString();
      const projectName = c.project_uuid ? (projectMap[c.project_uuid] || 'Project') : null;
      const projectBadge = projectName ? `<span class="hi-project">${escHtml(projectName)}</span>` : '';
      h += `<div class="history-item" data-id="${c.uuid}">
        <span class="hi-icon">💬</span>
        <div class="hi-info">
          <div class="hi-title">${escHtml(title)}</div>
          <div class="hi-date">${projectBadge}${date}</div>
        </div>
        <div class="hi-actions">
          <button class="hi-rename icon-btn" data-id="${c.uuid}" title="Rename"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="hi-delete icon-btn" data-id="${c.uuid}" title="Delete"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
        </div>
      </div>`;
    });
    return h;
  };

  html += renderGroup('Today', groups.today);
  html += renderGroup('Yesterday', groups.yesterday);
  html += renderGroup('This Week', groups.week);
  html += renderGroup('Older', groups.older);

  list.innerHTML = html;

  // Click to load conversation
  list.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.hi-actions')) return;
      loadConversation(item.dataset.id);
    });
  });

  // Inline delete (two-step confirmation)
  list.querySelectorAll('.hi-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (btn.dataset.confirming !== '1') {
        btn.dataset.confirming = '1';
        const origHTML = btn.innerHTML;
        btn.textContent = 'Delete?';
        btn.style.cssText = 'color:var(--error);font-size:10px;padding:2px 5px;border:1px solid var(--error);border-radius:3px;background:none;cursor:pointer;';
        const cancelFn = (ev) => {
          if (!btn.contains(ev.target)) {
            btn.dataset.confirming = '';
            btn.innerHTML = origHTML;
            btn.style.cssText = '';
            document.removeEventListener('click', cancelFn, true);
          }
        };
        setTimeout(() => document.addEventListener('click', cancelFn, true), 0);
        return;
      }
      const id = btn.dataset.id;
      await chrome.runtime.sendMessage({ type: 'DELETE_CONVERSATION', conversationId: id });
      state.conversations = state.conversations.filter(c => c.uuid !== id);
      renderHistory(state.conversations);
    });
  });

  // Inline rename (convert title to input)
  list.querySelectorAll('.hi-rename').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = btn.closest('.history-item');
      const titleEl = item.querySelector('.hi-title');
      if (titleEl.querySelector('input')) return;
      const currentName = titleEl.textContent.trim();
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = currentName;
      inp.className = 'hi-rename-input';
      titleEl.textContent = '';
      titleEl.appendChild(inp);
      inp.focus();
      inp.select();
      let saved = false;
      const save = async () => {
        if (saved) return;
        saved = true;
        const newName = inp.value.trim() || currentName;
        if (newName !== currentName) {
          await chrome.runtime.sendMessage({ type: 'RENAME_CONVERSATION', conversationId: id, name: newName });
          const convo = state.conversations.find(c => c.uuid === id);
          if (convo) convo.name = newName;
        }
        renderHistory(state.conversations);
      };
      inp.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); save(); }
        else if (ev.key === 'Escape') { saved = true; renderHistory(state.conversations); }
      });
      inp.addEventListener('blur', save);
    });
  });
}

function filterHistory() {
  const q = $('#history-search').value.toLowerCase();
  const filtered = state.conversations.filter(c =>
    (c.name || '').toLowerCase().includes(q) || (c.summary || '').toLowerCase().includes(q)
  );
  renderHistory(filtered);
}

async function loadConversation(convoId) {
  $('#history-drawer').classList.add('hidden');
  state.currentConvoId = convoId;

  const msgs = $('#chat-messages');
  msgs.innerHTML = '<div class="history-loading">Loading conversation...</div>';

  try {
    const convo = await claudeClient.getConversation(convoId);
    msgs.innerHTML = '';

    (convo.chat_messages || []).forEach(m => {
      const role = m.sender === 'human' ? 'user' : 'assistant';

      let parts = [];
      if (Array.isArray(m.content) && m.content.length) {
        for (const block of m.content) {
          if (block.type === 'text') {
            parts.push(block.text || '');
          } else if (block.type === 'tool_use' && block.input) {
            const inp = block.input;
            // Identify artifact blocks by their input structure
            if (typeof inp.content === 'string' || typeof inp.title === 'string') {
              parts.push(`\x01ARTIFACT${JSON.stringify(inp)}\x01`);
            }
          }
        }
      } else {
        parts.push(m.text || '');
      }

      let text = parts.join('\n\n');
      text = role === 'user' ? cleanUserMessage(text) : cleanMessageText(text);
      if (text.trim()) addMessage(role, text, false);
    });

    msgs.scrollTop = msgs.scrollHeight;
    
    // Refresh token usage display
    await updateUsageDisplay();
  } catch (err) {
    msgs.innerHTML = `<div class="history-empty">Failed to load conversation</div>`;
  }
}

// ─── Message Text Cleaner ───
// claude.ai returns "This block is not supported on your current device yet."
// for tool-use/artifact blocks — both inside code fences and standalone.
// Replace them with a sentinel so renderMarkdown can show a chip.
function cleanMessageText(text) {
  if (!text) return '';

  const T = '\x01TOOL\x01';
  let cleaned = text
    .replace(/```[\s\S]*?This block is not supported on your current device yet\.[\s\S]*?```/g, T)
    .replace(/\n*This block is not supported on your current device yet\.\n*/g, T);

  // Collapse consecutive tool sentinels (with only whitespace between) into one counted marker
  cleaned = cleaned.replace(/(\x01TOOL\x01[\s]*)+/g, match => {
    const n = (match.match(/\x01TOOL\x01/g) || []).length;
    return `\x01TOOLS:${n}\x01`;
  });

  return cleaned.trim();
}

// ─── Smart Truncation ───
// Truncates text at a paragraph or sentence boundary near the limit
function smartTruncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  // Try to cut at a paragraph boundary (double newline)
  const cut = text.lastIndexOf('\n\n', maxLen);
  if (cut > maxLen * 0.7) return text.slice(0, cut) + '\n\n[...content truncated]';
  // Try sentence boundary
  const sentEnd = text.lastIndexOf('. ', maxLen);
  if (sentEnd > maxLen * 0.7) return text.slice(0, sentEnd + 1) + '\n\n[...content truncated]';
  // Hard cut as last resort
  return text.slice(0, maxLen) + '\n\n[...content truncated]';
}

// ─── User Message Cleaner ───
// When loading history, strip the injected page/tab context from user messages
// so only the actual question is shown, not the full prompt blob.
function cleanUserMessage(text) {
  if (!text) return '';
  // Extract just the user's question from page-context-injected prompts
  const questionMatch = text.match(/\[My question:\]\n([\s\S]+)$/);
  if (questionMatch) return questionMatch[1].trim();
  // Strip the page context header block if no explicit question marker
  // Handles both old format [I'm on the page:...] and new format [Page:...]
  const stripped = text
    .replace(/^\[You are Parsely[\s\S]*?\[Page content:\][\s\S]*?\n\n/, '')
    .replace(/^\[I'm on the page:[\s\S]*?\[Page content:\][\s\S]*?\n\n/, '')
    .replace(/^\[Tab: "[^"]*"\][\s\S]*?\n\n/, '')
    .trim();
  return stripped || text.trim();
}


// ─── Token Usage Estimator ───
function estimateTokens(text) {
  if (!text) return 0;
  // Heuristic: ~4 chars per token for English
  return Math.max(1, Math.ceil(text.length / 4));
}



// ─── Send Message ───
async function handleSend() {
  const input = $('#chat-input').value.trim();
  if (!input || state.isStreaming) return;

  // Check for /commands
  if (input.startsWith('/')) {
    const cmd = input.split(' ')[0];
    const skill = getAllSkills().find(s => s.cmd === cmd);
    if (skill) { $('#chat-input').value = ''; $('#btn-send').disabled = true; $('#skills-dropdown').classList.add('hidden'); executeSkill(cmd); return; }
  }

  $('#skills-dropdown').classList.add('hidden');
  $('#chat-input').value = '';
  $('#chat-input').style.height = 'auto';
  $('#btn-send').disabled = true;

  // Remove welcome
  const welcome = $('#chat-messages').querySelector('.welcome-screen');
  if (welcome) welcome.remove();

  addMessage('user', input);

  // Track title for auto-naming new conversations
  if (!state.currentConvoId) state.pendingTitle = input.slice(0, 80);

  // Prepend Personalization/Memory
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let systemContext = `@Parsely time:${tz}`;
  if (state.personalInstructions) {
    systemContext += `\n@Instructions ${state.personalInstructions}`;
  }

  let fullPrompt = input;
  if (state.attachPage && state.pageContext) {
    const ctx = state.pageContext;
    const meta = ctx.meta || {};

    // Build metadata header with available info
    let metaBlock = `@Page ${meta.title}`;
    metaBlock += `\n@URL ${meta.url}`;
    if (meta.description) metaBlock += `\n@Desc ${meta.description}`;
    if (meta.author) metaBlock += `\n@Author ${meta.author}`;
    if (meta.publishedDate) metaBlock += `\n@Date ${meta.publishedDate}`;
    if (meta.type) metaBlock += `\n@Type ${meta.type}`;

    // Smart truncation: try to cut at paragraph boundary
    const pageText = smartTruncate(ctx.text || '', 20000);

    fullPrompt = `${systemContext}\n${metaBlock}\n@Content\n${pageText}\n\n@Input\n${input}`;
  } else {
    fullPrompt = `${systemContext}\n\n@Input\n${input}`;
  }

  // Add tab context
  for (const tab of state.referencedTabs) {
    try {
      const content = await chrome.runtime.sendMessage({ type: 'GET_TAB_CONTENT', tabId: tab.id });
      if (content && !content.error) {
        const tabText = smartTruncate(content.text || '', 10000);
        fullPrompt = `@Tab ${tab.title}\n${tabText}\n\n${fullPrompt}`;
      }
    } catch {}
  }

  // Add attached file content
  if (state.attachedFiles.length) {
    const fileBlocks = state.attachedFiles.map(f =>
      `@File ${escHtml(f.name)}\n${smartTruncate(f.content, 15000)}`
    ).join('\n\n');
    fullPrompt = `${fileBlocks}\n\n${fullPrompt}`;
    state.attachedFiles = [];
    renderAttachmentPills();
  }

  await sendToClaude(fullPrompt);
}

async function sendToClaude(message) {
  state.isStreaming = true;

  // ─── Injection ───
  // Prepend previous context if available
  let processedMessage = message;
  const currentContext = state.chatContexts[state.currentConvoId];
  if (currentContext) {
    processedMessage = `@Recap ${currentContext}\n\n${processedMessage}`;
  }

  // Append instruction to update context (hidden from user)
  processedMessage += `\n\n[IMPORTANT: At the end of your response, provide high-density context updates using TOON (Token Oriented Object Notation) like "@Recap key facts..." inside <context> tags.]`;


  // Create conversation if needed
  if (!state.currentConvoId) {
    try {
      const convo = await claudeClient.createConversation();
      state.currentConvoId = convo.uuid;
    } catch (err) {
      addMessage('assistant', `⚠️ Failed to create conversation: ${err.message}`);
      state.isStreaming = false;
      return;
    }
  }

  // Create streaming message element
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message message-assistant';
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  msgDiv.appendChild(contentDiv);
  $('#chat-messages').appendChild(msgDiv);
  $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;

  await claudeClient.sendMessage(state.currentConvoId, processedMessage, {
    onText: (fullText) => {
      contentDiv.innerHTML = renderMarkdown(fullText);
      $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
    },
    onDone: async (fullText) => {
      const rendered = fullText || 'No response received.';
      const stripped = renderMarkdown(rendered);
      contentDiv.innerHTML = stripped;
      addCopyButton(msgDiv, rendered); // We will strip it inside addCopyButton
      state.isStreaming = false;
      // Auto-name the conversation from the first message
      if (state.pendingTitle && state.currentConvoId) {
        const name = state.pendingTitle;
        state.pendingTitle = null;
        try {
          await claudeClient.renameConversation(state.currentConvoId, name);
        } catch {}
      }
      
      // ─── Extraction ───
      // Extract hidden context and save
      const ctxMatch = fullText.match(/<context>([\s\S]*?)<\/context>/);
      if (ctxMatch && state.currentConvoId) {
        state.chatContexts[state.currentConvoId] = ctxMatch[1].trim();
        saveChatContexts();
      }
      
      // Update tokens after done
      await updateUsageDisplay();
    },
    onError: (err) => {
      contentDiv.innerHTML = renderErrorCard(err);
      state.isStreaming = false;
    }
  });
}



function addCopyButton(msgDiv, rawText) {
  const btn = document.createElement('button');
  btn.className = 'msg-copy-btn';
  btn.title = 'Copy';
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  btn.addEventListener('click', () => {
    // Strip hidden context recap before copying
    const cleanText = rawText.replace(/<context>[\s\S]*?<\/context>/g, '').trim();
    navigator.clipboard.writeText(cleanText).then(() => {
      btn.innerHTML = '✓';
      setTimeout(() => {
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 1500);
    });
  });
  msgDiv.appendChild(btn);
}

// ─── Skills ───
async function executeSkill(cmd) {
  const skill = getAllSkills().find(s => s.cmd === cmd);
  if (!skill) return;
  $('#skills-dropdown').classList.add('hidden');
  $('#chat-input').value = '';

  const welcome = $('#chat-messages').querySelector('.welcome-screen');
  if (welcome) welcome.remove();

  addMessage('user', `${skill.icon} ${skill.name}`);

  let prompt = skill.prompt;
  if (prompt.includes('{{page}}') && state.pageContext) {
    prompt = prompt.replace(/\{\{page\}\}/g, smartTruncate(state.pageContext.text || '', 20000));
  }
  // {{url}} and {{title}} from current page context
  prompt = prompt.replace(/\{\{url\}\}/g, state.pageContext?.meta?.url || '');
  prompt = prompt.replace(/\{\{title\}\}/g, state.pageContext?.meta?.title || '');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTED_TEXT' });
      if (res?.text) prompt = prompt.replace(/\{\{selection\}\}/g, res.text);
      else prompt = prompt.replace(/\{\{selection\}\}/g, smartTruncate(state.pageContext?.text || '', 8000));
    }
  } catch { prompt = prompt.replace(/\{\{selection\}\}/g, smartTruncate(state.pageContext?.text || '', 8000)); }

  await sendToClaude(prompt);
}

function showSkillsDropdown(val) {
  const q = val.slice(1).toLowerCase();
  const all = getAllSkills();
  const filtered = q ? all.filter(s => s.cmd.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) : all;
  if (!filtered.length) { $('#skills-dropdown').classList.add('hidden'); return; }

  const list = $('#skills-dropdown-list');
  list.innerHTML = '';
  filtered.forEach(s => {
    const item = document.createElement('div');
    item.className = 'skills-dropdown-item';
    item.innerHTML = `<span class="sd-icon">${s.icon}</span><span class="sd-name">${s.name}</span><span class="sd-cmd">${s.cmd}</span>`;
    item.addEventListener('click', () => { $('#skills-dropdown').classList.add('hidden'); executeSkill(s.cmd); });
    list.appendChild(item);
  });
  $('#skills-dropdown').classList.remove('hidden');
}

// ─── Context Actions ───
async function handleContextAction(msg) {
  if (!state.pageContext) await loadPageContext();
  const welcome = $('#chat-messages').querySelector('.welcome-screen');
  if (welcome) welcome.remove();

  let prompt = '', display = '';
  if (msg.action === 'ask' || msg.action === 'ask_claude') {
    prompt = `About this text: "${msg.text}"\n\nProvide context and analysis.`;
    display = `Ask: "${msg.text?.slice(0, 60)}..."`;
  } else if (msg.action === 'explain' || msg.action === 'explain_selection') {
    prompt = `Explain simply: "${msg.text}"`;
    display = `Explain: "${msg.text?.slice(0, 60)}..."`;
  } else if (msg.action === 'summarize' || msg.action === 'summarize_page') {
    prompt = `Summarize this page:\n\n${state.pageContext?.text?.slice(0, 15000) || ''}`;
    display = `Summarize: ${msg.pageTitle}`;
  }
  addMessage('user', display);
  await sendToClaude(prompt);
}

// ─── Tab Selector ───
async function populateTabSelector() {
  const tabs = await chrome.runtime.sendMessage({ type: 'GET_ALL_TABS' });
  const list = $('#tab-selector-list');
  list.innerHTML = '';
  // Hide already-referenced tabs per spec
  const available = tabs.filter(t => !state.referencedTabs.some(r => r.id === t.id));
  if (!available.length) {
    list.innerHTML = '<div class="tab-selector-empty">All tabs added</div>';
    return;
  }
  available.forEach(tab => {
    const item = document.createElement('div');
    item.className = 'tab-selector-item';
    item.innerHTML = `<img src="${tab.favIconUrl || ''}" /><span>${escHtml(tab.title)}</span>`;
    item.addEventListener('click', () => {
      state.referencedTabs.push(tab);
      renderTabPills();
      $('#tab-selector').classList.add('hidden');
      // Strip the @ from input if it triggered the selector
      const input = $('#chat-input');
      if (input.value.endsWith('@')) input.value = input.value.slice(0, -1);
    });
    list.appendChild(item);
  });
}

function renderTabPills() {
  const pills = $('#tab-pills');
  pills.innerHTML = '';
  const hasItems = state.referencedTabs.length || state.attachedFiles.length;
  if (!hasItems) { pills.classList.add('hidden'); return; }
  pills.classList.remove('hidden');
  state.referencedTabs.forEach(tab => {
    const pill = document.createElement('div');
    pill.className = 'tab-pill';
    pill.innerHTML = `<img src="${tab.favIconUrl||''}" /><span>${escHtml(tab.title.slice(0,30))}</span><span class="rm" data-id="${tab.id}">×</span>`;
    pill.querySelector('.rm').addEventListener('click', () => {
      state.referencedTabs = state.referencedTabs.filter(t => t.id !== tab.id);
      renderTabPills();
    });
    pills.appendChild(pill);
  });
  state.attachedFiles.forEach((f, i) => {
    const pill = document.createElement('div');
    pill.className = 'tab-pill file-pill';
    pill.innerHTML = `<span class="file-pill-icon">📄</span><span>${escHtml(f.name.slice(0,28))}</span><span class="rm" data-idx="${i}">×</span>`;
    pill.querySelector('.rm').addEventListener('click', () => {
      state.attachedFiles.splice(i, 1);
      renderAttachmentPills();
    });
    pills.appendChild(pill);
  });
}

function renderAttachmentPills() {
  renderTabPills();
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ─── UI Helpers ───
function addMessage(role, content, animate = true) {
  const div = document.createElement('div');
  div.className = `message message-${role}`;
  if (!animate) div.style.animation = 'none';
  if (role === 'user') {
    const label = document.createElement('div');
    label.className = 'message-role-label';
    label.textContent = 'You';
    div.appendChild(label);
  }
  const c = document.createElement('div');
  c.className = 'message-content';
  if (role === 'assistant') {
    c.innerHTML = renderMarkdown(content);
    addCopyButton(div, content);
  } else {
    c.textContent = content;
  }
  div.appendChild(c);
  $('#chat-messages').appendChild(div);
  $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
}

function renderWelcome() {
  const msgs = $('#chat-messages');
  msgs.innerHTML = `
    <div class="welcome-screen">
      <div class="welcome-icon">
        <svg width="40" height="40" viewBox="0 0 360 360" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M138.21,360H241.53V231.8H360V128.48H302.07a148.93,148.93,0,0,0-106.35,44.66L180.8,188.36a149,149,0,0,0-42.59,104.27Z"/><path d="M236.91,0C225.25,120.58,123.65,214.82,0,214.82V112.34A135.61,135.61,0,0,0,133.59,0Z"/></svg>
      </div>
      <h2>What can I help with?</h2>
      <p class="welcome-sub">I can read this page, answer questions, and access your Claude conversations.</p>
      <div class="quick-actions">
        <button class="quick-action" data-action="summarize">Summarize page</button>
        <button class="quick-action" data-action="key-points">Key points</button>
        <button class="quick-action" data-action="eli5">ELI5</button>
        <button class="quick-action" data-action="qa">Q&amp;A this page</button>
      </div>
    </div>`;
}

// ─── Artifact Card ───
function renderArtifactCard(input) {
  if (!input) return '';
  const type = input.type || '';
  const title = input.title || 'Artifact';
  const content = input.content || '';
  const lang = input.language || '';

  let icon = '📄', badge = type || 'artifact';
  if (type.includes('code') || lang)  { icon = '💻'; badge = lang || 'code'; }
  else if (type.includes('html'))     { icon = '🌐'; badge = 'HTML'; }
  else if (type.includes('svg'))      { icon = '🎨'; badge = 'SVG'; }
  else if (type.includes('react'))    { icon = '⚛️'; badge = 'React'; }
  else if (type.includes('markdown')) { icon = '📝'; badge = 'Markdown'; }

  const escapedContent = content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  return `<div class="artifact-card">` +
    `<div class="artifact-header"><span class="artifact-icon">${icon}</span>` +
    `<span class="artifact-title">${escHtml(title)}</span>` +
    `<span class="artifact-badge">${escHtml(badge)}</span></div>` +
    `<pre class="artifact-body"><code>${escapedContent}</code></pre></div>`;
}

// ─── Markdown Renderer ───
function renderMarkdown(text) {
  if (!text) return '';
  
  // ─── Hiding context tags ───
  let s = text
    .replace(/<context>[\s\S]*?<\/context>/g, '') // strip complete tags
    .replace(/<context>[\s\S]*$/g, '')            // strip partial/trailing tags mid-stream
    .trim();

  // 0. Extract sentinels BEFORE HTML escaping so content isn't mangled.

  // Tool-use chips (from cleanMessageText)
  const toolCounts = [];
  // Artifact cards (from streaming / content blocks)
  const artifacts = [];
  const saved = [];

  s = s
    .replace(/\x01TOOLS:(\d+)\x01/g, (_, n) => {
      const i = toolCounts.length;
      toolCounts.push(parseInt(n, 10));
      return `\x00TOOLCHIP${i}\x00`;
    })
    .replace(/\x01ARTIFACT(\{[\s\S]*?\})\x01/g, (_, json) => {
      const i = artifacts.length;
      try { artifacts.push(JSON.parse(json)); } catch { artifacts.push(null); }
      return `\x00ART${i}\x00`;
    })
    .replace(/\x01ARTIFACT[\s\S]*$/, ''); // strip incomplete trailing sentinel (mid-stream)

  // 1. Escape HTML
  s = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // 2. Extract code blocks (protect content from further processing)
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    const i = saved.length;
    saved.push(`<pre><code>${code}</code></pre>`);
    return `\x00BLOCK${i}\x00`;
  });

  // 3. Extract tables
  s = s.replace(/((?:\|[^\n]+\n?)+)/g, match => {
    const lines = match.trim().split('\n').filter(l => l.trim());
    if (lines.length < 1) return match;
    const isSep = l => /^\|[\s\-:|]+\|/.test(l.trim());
    let head = null, body = lines;
    if (lines.length >= 2 && isSep(lines[1])) { head = lines[0]; body = lines.slice(2); }
    const makeRow = (line, tag) =>
      '<tr>' + line.split('|').slice(1,-1).map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
    let tbl = '<table class="md-table">';
    if (head) tbl += `<thead>${makeRow(head,'th')}</thead>`;
    if (body.length) tbl += `<tbody>${body.map(l => makeRow(l,'td')).join('')}</tbody>`;
    tbl += '</table>';
    const i = saved.length;
    saved.push(tbl);
    return `\x00BLOCK${i}\x00`;
  });

  // 4. Headings
  s = s
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>');

  // 5. Blockquotes
  s = s.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');

  // 6. Lists — processed BEFORE \n→<br> so items group without extra spacing.
  //    Ordered and unordered handled separately to preserve ol vs ul.
  s = s.replace(/((?:^\d+\. .+$\n?)+)/gm, m => {
    const items = m.trim().split('\n').filter(Boolean)
      .map(l => `<li>${l.replace(/^\d+\.\s*/,'')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });
  s = s.replace(/((?:^[*-] .+$\n?)+)/gm, m => {
    const items = m.trim().split('\n').filter(Boolean)
      .map(l => `<li>${l.replace(/^[*-]\s*/,'')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // 7. Inline formatting
  s = s
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');

  // 8. Paragraph wrapping
  s = s.replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br>');
  s = '<p>' + s + '</p>';

  // 9. Clean up: remove empty <p>, unwrap block elements from <p>
  s = s.replace(/<p>\s*<\/p>/g,'');
  s = s.replace(/<p>\s*(<(?:h[1-3]|pre|ul|ol|table|blockquote)[\s>])/g,'$1');
  s = s.replace(/(<\/(?:h[1-3]|pre|ul|ol|table|blockquote)>)\s*<\/p>/g,'$1');

  // 10. Strip <p> wrappers from block placeholders so restored HTML isn't nested in <p>
  s = s.replace(/<p>(<br>)*(\x00BLOCK\d+\x00)(<br>)*<\/p>/g,'$2');
  s = s.replace(/<p>(<br>)*(\x00BLOCK\d+\x00)/g,'$2');
  s = s.replace(/(\x00BLOCK\d+\x00)(<br>)*<\/p>/g,'$1');

  // 11. Strip <p> wrappers from artifact placeholders
  s = s.replace(/<p>(<br>)*(\x00ART\d+\x00)(<br>)*<\/p>/g,'$2');
  s = s.replace(/<p>(<br>)*(\x00ART\d+\x00)/g,'$2');
  s = s.replace(/(\x00ART\d+\x00)(<br>)*<\/p>/g,'$1');

  // 12. Strip <p> wrappers from tool-chip placeholders
  s = s.replace(/<p>(<br>)*(\x00TOOLCHIP\d+\x00)(<br>)*<\/p>/g,'$2');
  s = s.replace(/<p>(<br>)*(\x00TOOLCHIP\d+\x00)/g,'$2');
  s = s.replace(/(\x00TOOLCHIP\d+\x00)(<br>)*<\/p>/g,'$1');

  // 13. Restore saved code/table blocks
  saved.forEach((b, i) => { s = s.split(`\x00BLOCK${i}\x00`).join(b); });

  // 14. Restore artifact cards
  artifacts.forEach((input, i) => {
    s = s.split(`\x00ART${i}\x00`).join(renderArtifactCard(input));
  });

  // 15. Restore tool-use chips
  toolCounts.forEach((n, i) => {
    const label = n === 1 ? '1 tool use' : `${n} tool uses`;
    s = s.split(`\x00TOOLCHIP${i}\x00`).join(`<div class="tool-use-chip">🔧 ${label}</div>`);
  });

  return s;
}

// ─── Error Parsing ───
function parseApiError(raw) {
  const statusMatch = raw.match(/Send failed \((\d+)\)/);
  const status = statusMatch ? parseInt(statusMatch[1]) : 0;

  // Extract error type via regex — immune to JSON truncation
  const errTypeMatch = raw.match(/"type"\s*:\s*"([^"]+)"/g);
  const errorType = errTypeMatch?.map(m => m.match(/"([^"]+)"\s*$/)[1])
    .find(t => t !== 'error') || '';

  // Extract resetsAt
  const resetsAtMatch = raw.match(/"resetsAt"\s*:\s*(\d+)/);
  const resetsAt = resetsAtMatch ? parseInt(resetsAtMatch[1]) : null;

  // Rate limit
  if (status === 429 || errorType === 'rate_limit_error' || raw.includes('exceeded_limit')) {
    const resetStr = resetsAt
      ? new Date(resetsAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;
    return {
      type: 'rate_limit',
      message: "You've reached your Claude usage limit",
      detail: resetStr ? `Your limit resets at ${resetStr}. Visit claude.ai to upgrade.` : 'Your limit resets soon. Visit claude.ai for details.'
    };
  }

  // Auth error
  if (status === 401 || status === 403 || errorType === 'authentication_error') {
    return { type: 'auth', message: 'Session expired', detail: 'Please log into claude.ai and try again.' };
  }

  // Extract a human-readable message if available
  const msgMatch = raw.match(/"message"\s*:\s*"([^"]{0,200})"/);
  const humanMsg = msgMatch?.[1]?.replace(/\\"/g, '"') || null;

  return {
    type: 'api_error',
    message: humanMsg || `Request failed (${status || 'unknown'})`,
    detail: null
  };
}

function renderErrorCard(raw) {
  let parsed;
  try { parsed = parseApiError(raw); }
  catch { parsed = { type: 'unknown', message: 'Something went wrong', detail: null }; }

  const { type, message, detail } = parsed;
  const icons = { rate_limit: '⏳', auth: '🔒', api_error: '⚠️', unknown: '⚠️' };
  const icon = icons[type] || '⚠️';
  return `<div class="error-card">
    <div class="error-card-title">${icon} ${escHtml(message)}</div>
    ${detail ? `<div class="error-card-detail">${escHtml(detail)}</div>` : ''}
  </div>`;
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ─── Start ───
init();
