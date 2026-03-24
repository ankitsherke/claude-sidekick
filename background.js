// ─── Background Service Worker ───
importScripts('claude-client.js');

// Open side panel on click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Context menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "ask-claude", title: "Ask Claude about this", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "summarize-page", title: "Summarize this page", contexts: ["page"] });
  chrome.contextMenus.create({ id: "explain-selection", title: "Explain this", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: "CONTEXT_MENU_ACTION",
      action: info.menuItemId.replace('ask-claude', 'ask').replace('summarize-page', 'summarize').replace('explain-selection', 'explain'),
      text: info.selectionText || '',
      pageTitle: tab.title,
      pageUrl: tab.url
    });
  }, 600);
});

// ─── Message Router ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "CHECK_SESSION") {
    claudeClient.checkSession().then(sendResponse);
    return true;
  }

  if (message.type === "LIST_CONVERSATIONS") {
    claudeClient.listConversations().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === "GET_CONVERSATION") {
    claudeClient.getConversation(message.conversationId).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === "CREATE_CONVERSATION") {
    claudeClient.createConversation(message.name || '').then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === "SEND_MESSAGE") {
    claudeClient.sendMessage(
      message.conversationId,
      message.text,
      message.attachments || [],
      null
    ).then(fullText => {
      sendResponse({ content: fullText });
    }).catch(e => {
      sendResponse({ error: e.message });
    });
    return true;
  }

  if (message.type === "LIST_PROJECTS") {
    claudeClient.listProjects().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === "DELETE_CONVERSATION") {
    claudeClient.deleteConversation(message.conversationId).then(ok => sendResponse({ ok })).catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === "RENAME_CONVERSATION") {
    claudeClient.renameConversation(message.conversationId, message.name).then(ok => sendResponse({ ok })).catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === "GET_PAGE_CONTENT") {
    getPageContent(message.tabId).then(sendResponse);
    return true;
  }

  if (message.type === "GET_ALL_TABS") {
    chrome.tabs.query({ currentWindow: true }).then(tabs => {
      sendResponse(tabs.map(t => ({ id: t.id, title: t.title, url: t.url, favIconUrl: t.favIconUrl, active: t.active })));
    });
    return true;
  }

  if (message.type === "GET_TAB_CONTENT") {
    getPageContent(message.tabId).then(sendResponse);
    return true;
  }

  if (message.type === "GET_SCREENSHOT") {
    chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 60 })
      .then(dataUrl => sendResponse({ dataUrl }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }
});

// ─── Google Workspace Export Extraction ───
const GW_PATTERNS = [
  {
    re: /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/,
    type: 'Google Doc',
    exportUrl: id => `https://docs.google.com/document/d/${id}/export?format=txt`,
  },
  {
    re: /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    type: 'Google Sheet',
    exportUrl: id => `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`,
  },
  {
    re: /docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    type: 'Google Slides',
    exportUrl: id => `https://docs.google.com/presentation/d/${id}/export/txt`,
  },
];

async function getGoogleWorkspaceContent(tab) {
  const url = tab.url || '';
  for (const { re, type, exportUrl } of GW_PATTERNS) {
    const match = url.match(re);
    if (!match) continue;
    try {
      const res = await fetch(exportUrl(match[1]), { credentials: 'include' });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      // If Google redirected to a login page, it returns HTML — bail out
      if (contentType.includes('text/html')) return null;
      const raw = await res.text();
      const text = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 30000);
      return {
        text,
        accessibilityTree: '',
        meta: { title: tab.title, url, description: `${type} — exported as plain text`, h1: [], hasCanvas: false },
        charCount: text.length,
        extractionMethod: type,
      };
    } catch { return null; }
  }
  return null;
}

// ─── Page Content Extraction ───
async function getPageContent(tabId) {
  try {
    // Special-case Google Workspace apps: DOM is canvas-based, use export URL instead
    const tab = await chrome.tabs.get(tabId);
    const gwContent = await getGoogleWorkspaceContent(tab);
    if (gwContent) return gwContent;

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // ── Method 1: Accessibility Tree ──────────────────────────────
        const ROLE_MAP = {
          A:'link', BUTTON:'button', INPUT:'textbox', TEXTAREA:'textbox',
          SELECT:'listbox', H1:'heading', H2:'heading', H3:'heading',
          H4:'heading', H5:'heading', H6:'heading', IMG:'image',
          TABLE:'table', TR:'row', TD:'cell', TH:'columnheader',
          FORM:'form', NAV:'navigation', MAIN:'main', ASIDE:'complementary',
          HEADER:'banner', FOOTER:'contentinfo', SECTION:'region',
          ARTICLE:'article', LI:'listitem', UL:'list', OL:'list',
          P:'paragraph', LABEL:'label', DETAILS:'group', SUMMARY:'button',
          DIALOG:'dialog', BLOCKQUOTE:'blockquote', CODE:'code', PRE:'code',
        };
        const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','META','LINK','HEAD','SVG']);

        function getAccessibleName(el) {
          return el.getAttribute('aria-label') ||
                 el.getAttribute('placeholder') ||
                 el.getAttribute('title') ||
                 el.getAttribute('alt') ||
                 (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent.trim() : '') ||
                 el.textContent.trim().slice(0, 120) || '';
        }

        function getRole(el) {
          return el.getAttribute('role') || ROLE_MAP[el.tagName] || el.tagName.toLowerCase();
        }

        let tree = '';
        let refId = 0;
        function walkTree(node, depth) {
          if (depth > 15 || tree.length > 50000) return;
          if (node.nodeType !== 1) return;
          if (SKIP.has(node.tagName)) return;
          if (node.hidden || node.getAttribute('aria-hidden') === 'true') return;
          const role = getRole(node);
          const name = getAccessibleName(node);
          if (name || ROLE_MAP[node.tagName]) {
            tree += '  '.repeat(depth) + `${role} "${name.slice(0,120)}" [${refId++}]\n`;
          }
          for (const child of node.children) walkTree(child, depth + 1);
        }
        try { walkTree(document.body, 0); } catch (e) { tree = ''; }

        // ── Method 2: Semantic Text ────────────────────────────────────
        const noiseSelectors = ['script','style','noscript','iframe','svg','nav','footer','header',
          '[role="banner"]','[role="navigation"]','.ad','.ads','.sidebar','.popup','.modal','.cookie-banner'];
        const clone = document.body.cloneNode(true);
        noiseSelectors.forEach(s => { try { clone.querySelectorAll(s).forEach(el => el.remove()); } catch {} });
        const main = clone.querySelector('main, article, [role="main"], .content, .post, .entry-content');
        const text = (main || clone).innerText
          .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim().slice(0, 30000);

        // ── Metadata ──────────────────────────────────────────────────
        const meta = {
          title: document.title,
          url: window.location.href,
          description: document.querySelector('meta[name="description"]')?.content || '',
          ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
          ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
          canonical: document.querySelector('link[rel="canonical"]')?.href || '',
          h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()).slice(0, 3),
          hasCanvas: document.querySelectorAll('canvas').length > 0,
        };

        return { text, accessibilityTree: tree.slice(0, 50000), meta, charCount: text.length };
      }
    });
    return results[0]?.result || { error: "No content" };
  } catch (e) {
    return { error: e.message };
  }
}
