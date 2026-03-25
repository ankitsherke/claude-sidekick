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
    } catch { /* fall through to return null, caller will try DOM extraction */ }
  }
  return null;
}

// ─── Content Cache ───
const contentCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCachedContent(tabId) {
  const entry = contentCache.get(tabId);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  contentCache.delete(tabId);
  return null;
}

// Invalidate cache on navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'loading') contentCache.delete(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => contentCache.delete(tabId));

// ─── Page Content Extraction ───
async function getPageContent(tabId) {
  // Check cache first
  const cached = getCachedContent(tabId);
  if (cached) return cached;

  try {
    // Special-case Google Workspace apps: DOM is canvas-based, use export URL instead
    const tab = await chrome.tabs.get(tabId);
    const gwContent = await getGoogleWorkspaceContent(tab);
    if (gwContent) {
      contentCache.set(tabId, { data: gwContent, timestamp: Date.now() });
      return gwContent;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','META','LINK','HEAD']);

        // ── Noise removal selectors (expanded) ──────────────────────
        const noiseSelectors = [
          'script','style','noscript','iframe','svg',
          'nav','footer','header',
          '[role="banner"]','[role="navigation"]','[role="complementary"]',
          '[aria-hidden="true"]',
          '.ad','.ads','.advert','.advertisement','[data-ad]','[data-testid="ad"]',
          '.sidebar','.popup','.modal','.overlay',
          '.cookie-banner','.cookie-consent','#cookie-consent','#gdpr',
          '.social-share','.share-buttons','.social-links',
          '.newsletter-signup','.subscribe-form',
          '.related-posts','.recommended','.suggestions',
          '.breadcrumb','.breadcrumbs',
          '.comment-form','.comments-section',
          '#comments','.disqus',
        ];

        // ── Method 1: Markdown-aware content extraction ─────────────
        function domToMarkdown(root, maxLen) {
          let md = '';
          const append = (s) => { if (md.length < maxLen) md += s; };

          function walk(node) {
            if (md.length >= maxLen) return;
            if (node.nodeType === 3) { // Text node
              const t = node.textContent.replace(/[ \t]+/g, ' ');
              if (t.trim()) append(t);
              return;
            }
            if (node.nodeType !== 1) return;
            if (SKIP.has(node.tagName)) return;
            if (node.hidden || node.getAttribute('aria-hidden') === 'true') return;

            const tag = node.tagName;

            // Headings → markdown headings
            if (/^H[1-6]$/.test(tag)) {
              const level = parseInt(tag[1]);
              append('\n\n' + '#'.repeat(level) + ' ' + node.textContent.trim() + '\n\n');
              return;
            }

            // Links → [text](url)
            if (tag === 'A') {
              const href = node.getAttribute('href') || '';
              const text = node.textContent.trim();
              if (text && href && !href.startsWith('javascript:')) {
                append(`[${text}](${href})`);
              } else if (text) {
                append(text);
              }
              return;
            }

            // Images → ![alt](src)
            if (tag === 'IMG') {
              const alt = node.getAttribute('alt') || '';
              if (alt) append(`[Image: ${alt}]`);
              return;
            }

            // Code blocks
            if (tag === 'PRE') {
              const code = node.querySelector('code');
              const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
              append('\n\n```' + lang + '\n' + node.textContent.trim() + '\n```\n\n');
              return;
            }
            if (tag === 'CODE' && node.parentElement?.tagName !== 'PRE') {
              append('`' + node.textContent + '`');
              return;
            }

            // Blockquotes
            if (tag === 'BLOCKQUOTE') {
              const lines = node.textContent.trim().split('\n');
              append('\n\n' + lines.map(l => '> ' + l.trim()).join('\n') + '\n\n');
              return;
            }

            // Tables → markdown tables
            if (tag === 'TABLE') {
              const rows = [...node.querySelectorAll('tr')].slice(0, 50);
              let tableStr = '\n\n';
              rows.forEach((row, i) => {
                const cells = [...row.querySelectorAll('th, td')].map(c => c.textContent.trim().replace(/\|/g, '\\|'));
                tableStr += '| ' + cells.join(' | ') + ' |\n';
                if (i === 0) tableStr += '| ' + cells.map(() => '---').join(' | ') + ' |\n';
              });
              append(tableStr + '\n');
              return;
            }

            // Lists
            if (tag === 'UL' || tag === 'OL') {
              append('\n');
              [...node.children].forEach((li, i) => {
                if (li.tagName === 'LI') {
                  const prefix = tag === 'OL' ? `${i + 1}. ` : '- ';
                  append(prefix + li.textContent.trim().replace(/\n+/g, ' ') + '\n');
                }
              });
              append('\n');
              return;
            }

            // Paragraphs and divs
            if (tag === 'P' || tag === 'DIV') {
              append('\n\n');
              for (const child of node.childNodes) walk(child);
              append('\n');
              return;
            }

            // Line breaks
            if (tag === 'BR') { append('\n'); return; }
            if (tag === 'HR') { append('\n\n---\n\n'); return; }

            // Bold / italic / strong / em
            if (tag === 'STRONG' || tag === 'B') {
              append('**' + node.textContent.trim() + '**');
              return;
            }
            if (tag === 'EM' || tag === 'I') {
              append('*' + node.textContent.trim() + '*');
              return;
            }

            // Default: recurse into children
            for (const child of node.childNodes) walk(child);
          }

          walk(root);
          // Clean up excessive whitespace
          return md.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
        }

        // ── Remove noise elements ───────────────────────────────────
        const clone = document.body.cloneNode(true);
        noiseSelectors.forEach(s => {
          try { clone.querySelectorAll(s).forEach(el => el.remove()); } catch {}
        });

        // ── Find main content region ────────────────────────────────
        const mainEl = clone.querySelector(
          'main, article, [role="main"], .post-content, .article-body, ' +
          '.entry-content, .post-body, .story-body, .content-body, ' +
          '#content, .content, .post, .entry-content'
        );

        const contentRoot = mainEl || clone;

        // ── Extract structured markdown ──────────────────────────────
        const markdownText = domToMarkdown(contentRoot, 50000);

        // ── Fallback: plain innerText if markdown is too short ───────
        let text;
        const plainText = contentRoot.innerText
          .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim().slice(0, 30000);
        // Use markdown if it captured meaningful content, else fallback
        text = markdownText.length > plainText.length * 0.3 ? markdownText : plainText;

        // ── Metadata (expanded) ─────────────────────────────────────
        const meta = {
          title: document.title,
          url: window.location.href,
          description: document.querySelector('meta[name="description"]')?.content || '',
          ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
          ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
          canonical: document.querySelector('link[rel="canonical"]')?.href || '',
          h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()).slice(0, 5),
          headings: [...document.querySelectorAll('h1, h2, h3')].map(h => ({
            level: parseInt(h.tagName[1]),
            text: h.textContent.trim()
          })).slice(0, 20),
          hasCanvas: document.querySelectorAll('canvas').length > 0,
          lang: document.documentElement.lang || '',
          type: document.querySelector('meta[property="og:type"]')?.content || '',
          author: document.querySelector('meta[name="author"]')?.content
                  || document.querySelector('[rel="author"]')?.textContent?.trim() || '',
          publishedDate: document.querySelector('meta[property="article:published_time"]')?.content
                  || document.querySelector('time[datetime]')?.getAttribute('datetime') || '',
        };

        return { text, meta, charCount: text.length };
      }
    });
    const result = results[0]?.result || { error: "No content" };
    if (!result.error) contentCache.set(tabId, { data: result, timestamp: Date.now() });
    return result;
  } catch (e) {
    return { error: e.message };
  }
}
