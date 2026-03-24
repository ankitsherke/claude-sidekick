let tooltip = null;
let tooltipTimer = null;

function removeTooltip() {
  clearTimeout(tooltipTimer);
  tooltipTimer = null;
  if (tooltip) { tooltip.remove(); tooltip = null; }
}

function isEditable(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable ||
    el.closest('[contenteditable="true"]') !== null ||
    el.getAttribute('role') === 'textbox';
}

document.addEventListener('mouseup', (e) => {
  if (isEditable(e.target)) return;
  const text = window.getSelection().toString().trim();
  removeTooltip();
  if (text.length > 3) {
    tooltipTimer = setTimeout(() => {
      tooltip = document.createElement('div');
      tooltip.className = 'claude-sk-tooltip';
      tooltip.innerHTML = `
        <button data-action="ask"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Ask</button>
        <button data-action="explain"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>Explain</button>
        <button data-action="summarize"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="15" y1="18" x2="3" y2="18"/></svg>Summarize</button>`;
      tooltip.style.left = `${e.pageX - 80}px`;
      tooltip.style.top = `${e.pageY - 50}px`;
      document.body.appendChild(tooltip);
      tooltip.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          chrome.runtime.sendMessage({ type: "SELECTION_ACTION", action: btn.dataset.action, text, pageTitle: document.title, pageUrl: location.href });
          removeTooltip();
        });
      });
    }, 200);
  }
});

document.addEventListener('mousedown', (e) => {
  if (tooltip && !tooltip.contains(e.target)) removeTooltip();
});

document.addEventListener('scroll', () => removeTooltip(), true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') removeTooltip();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_SELECTED_TEXT") sendResponse({ text: window.getSelection().toString().trim() });
});
