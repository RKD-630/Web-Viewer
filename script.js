// Initialize CodeMirror (STARTS EMPTY)
    const editors = {
      html: CodeMirror.fromTextArea(document.getElementById('html-editor'), { mode: 'htmlmixed', theme: 'dracula', lineNumbers: true, lineWrapping: true }),
      css: CodeMirror.fromTextArea(document.getElementById('css-editor'), { mode: 'css', theme: 'dracula', lineNumbers: true, lineWrapping: true }),
      js: CodeMirror.fromTextArea(document.getElementById('js-editor'), { mode: 'javascript', theme: 'dracula', lineNumbers: true, lineWrapping: true })
    };
    editors.html.setValue(''); editors.css.setValue(''); editors.js.setValue('');

    let currentTab = 'html';
    let searchMarks = [], searchMatches = [], currentMatchIdx = -1;

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        ['html','css','js'].forEach(k => document.getElementById(`${k}-editor`).style.display = k === currentTab ? 'block' : 'none');
        setTimeout(() => editors[currentTab].refresh(), 10);
        hideSearch();
      });
    });

    // Undo/Redo
    document.getElementById('undo-btn').onclick = () => editors[currentTab].undo();
    document.getElementById('redo-btn').onclick = () => editors[currentTab].redo();

    // Search
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');
    const searchCount = document.getElementById('search-count');
    document.getElementById('find-btn').onclick = () => searchBar.classList.toggle('show');
    document.getElementById('search-close').onclick = hideSearch;
    
    function hideSearch() { searchBar.classList.remove('show'); clearSearch(); searchInput.value = ''; }
    function clearSearch() { searchMarks.forEach(m => m.clear()); searchMarks = []; searchMatches = []; currentMatchIdx = -1; updateCount(); }
    function updateCount() { searchCount.textContent = currentMatchIdx > -1 ? `${currentMatchIdx + 1}/${searchMatches.length}` : `0/${searchMatches.length}`; }

    document.getElementById('search-next').onclick = () => { if (searchMatches.length) { currentMatchIdx = (currentMatchIdx + 1) % searchMatches.length; scrollToMatch(currentMatchIdx); } };
    document.getElementById('search-prev').onclick = () => { if (searchMatches.length) { currentMatchIdx = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length; scrollToMatch(currentMatchIdx); } };
    function scrollToMatch(idx) {
      editors[currentTab].setSelection(searchMatches[idx][0], searchMatches[idx][1]);
      editors[currentTab].scrollIntoView({from: searchMatches[idx][0], to: searchMatches[idx][1]}, 200);
      updateCount();
    }

    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const q = searchInput.value;
        if (!q) return clearSearch();
        clearSearch();
        const editor = editors[currentTab];
        const text = editor.getValue();
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          const from = editor.posFromIndex(match.index);
          const to = editor.posFromIndex(match.index + match[0].length);
          searchMatches.push([from, to]);
          searchMarks.push(editor.markText(from, to, {className: 'cm-search-match'}));
        }
        if (searchMatches.length) { currentMatchIdx = 0; scrollToMatch(0); }
        else updateCount();
      }, 300);
    });

    // Preview & Console/Inspect
    const iframe = document.getElementById('preview-frame');
    const consoleContent = document.getElementById('console-content');
    const inspectContent = document.getElementById('inspect-content');
    const fontScale = document.getElementById('font-scale');
    const imgScale = document.getElementById('img-scale');
    let updateTimer;

    function updatePreview() {
      const html = editors.html.getValue();
      const css = editors.css.getValue();
      const js = editors.js.getValue();
      
      // Show placeholder if completely empty
      if (!html.trim() && !css.trim() && !js.trim()) {
        iframe.srcdoc = `<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#64748b;background:#f8fafc}</style><div style="text-align:center;padding:20px"><p style="font-size:1.5rem;margin-bottom:8px">📱 Ready to Edit</p><p>Import files or paste code to see preview</p></div>`;
        clearConsole(); inspectContent.innerHTML = '<div style="color:#64748b">Preview DOM will appear here...</div>';
        return;
      }

      const consoleScript = `
        <script>
          (function(){
            const send = (m,a) => window.parent.postMessage({type:'console', method:m, args:a.map(String)}, '*');
            ['log','warn','error','info'].forEach(m => { const old = console[m]; console[m] = (...args) => { send(m, args); old.apply(console, args); }; });
            window.onerror = (msg, url, line) => send('error', [msg, 'Line: '+line]);
          })();
        <\/script>`;

      const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>:root{--font-s:${fontScale.value};--img-s:${imgScale.value}} html{font-size:calc(16px*var(--font-s))} img,svg,picture{transform:scale(var(--img-s));transform-origin:top left;max-width:calc(100%/var(--img-s))} *{box-sizing:border-box} ${css}</style>
        ${consoleScript}</head><body>${html}<script>${js}<\/script></body></html>`;
      
      iframe.srcdoc = doc;
      iframe.onload = () => { refreshInspect(); clearConsole(); };
    }

    function scheduleUpdate() { clearTimeout(updateTimer); updateTimer = setTimeout(updatePreview, 350); }
    Object.values(editors).forEach(ed => ed.on('change', scheduleUpdate));
    fontScale.addEventListener('input', scheduleUpdate);
    imgScale.addEventListener('input', scheduleUpdate);

    // Console
    function clearConsole() { consoleContent.innerHTML = '<div class="log-entry" style="color:#64748b">Ready. Logs will appear here...</div>'; }
    clearConsole();
    document.getElementById('clear-console').onclick = clearConsole;

    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'console') {
        const div = document.createElement('div');
        div.className = `log-entry ${e.data.method}`;
        div.textContent = `> ${e.data.args.join(' ')}`;
        consoleContent.appendChild(div);
        consoleContent.scrollTop = consoleContent.scrollHeight;
      }
    });

    // Inspect
    function refreshInspect() {
      if (!iframe.contentDocument || !iframe.contentDocument.body) return;
      inspectContent.innerHTML = '';
      const tree = buildTree(iframe.contentDocument.body);
      if (tree) inspectContent.appendChild(tree);
      else inspectContent.innerHTML = '<div style="color:#64748b">No DOM to inspect.</div>';
    }
    document.getElementById('refresh-inspect').onclick = refreshInspect;

    function buildTree(node) {
      if (node.nodeType !== 1) return null;
      const tag = node.tagName.toLowerCase();
      const cls = node.className ? ` .${node.className}` : '';
      const id = node.id ? ` #${node.id}` : '';
      
      const div = document.createElement('div');
      div.className = 'dom-node';
      
      const tagEl = document.createElement('span');
      tagEl.className = 'dom-tag';
      tagEl.textContent = `<${tag}${id}${cls}>`;
      tagEl.onclick = () => highlightInPreview(node);
      
      const children = Array.from(node.children).filter(c => c.nodeType === 1);
      if (children.length > 0) {
        const toggle = document.createElement('span');
        toggle.className = 'dom-toggle';
        toggle.textContent = '▶';
        toggle.onclick = (e) => { e.stopPropagation(); const childBox = div.querySelector('.dom-children'); if(childBox) { childBox.classList.toggle('hidden'); toggle.textContent = childBox.classList.contains('hidden') ? '▶' : '▼'; }};
        div.appendChild(toggle);
        
        const childBox = document.createElement('div');
        childBox.className = 'dom-children';
        children.forEach(c => { const childTree = buildTree(c); if(childTree) childBox.appendChild(childTree); });
        div.appendChild(childBox);
      }
      
      div.prepend(tagEl);
      return div;
    }

    function highlightInPreview(el) {
      const style = document.createElement('style');
      style.id = 'inspector-highlight';
      style.textContent = `.__inspector-hl { outline: 2px solid #38bdf8 !important; outline-offset: 2px; background: #38bdf820 !important; transition: 0.2s; }`;
      const old = iframe.contentDocument.getElementById('inspector-highlight');
      if (old) old.remove();
      iframe.contentDocument.head.appendChild(style);
      el.classList.add('__inspector-hl');
      setTimeout(() => el.classList.remove('__inspector-hl'), 2000);
    }

    // Panels
    document.getElementById('inspect-btn').onclick = () => togglePanel('inspect-panel');
    document.getElementById('console-btn').onclick = () => togglePanel('console-panel');
    function togglePanel(id) { document.getElementById(id).classList.toggle('open'); document.querySelectorAll('.side-panel').forEach(p => p !== document.getElementById(id) && p.classList.remove('open')); }
    document.querySelectorAll('.close-panel').forEach(b => b.onclick = () => b.closest('.side-panel').classList.remove('open'));

    // Device
    document.getElementById('device-select').addEventListener('change', e => { document.getElementById('frame').className = 'frame-wrapper device-' + e.target.value; });

    // URL Load
    document.getElementById('load-url').onclick = () => {
      const url = document.getElementById('url-input').value.trim();
      if (!url || !url.startsWith('http')) return alert('Please include https:// or http://');
      iframe.srcdoc = ''; iframe.src = url;
      editors.html.setValue('<!-- External site loaded. Editing/Inspect disabled by browser security. -->');
    };

    // IMPORT LOGIC (Auto-Detect & Route)
    const fileInput = document.getElementById('file-import');
    document.getElementById('import-btn').onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const files = Array.from(e.target.files); if (!files.length) return;
      const read = f => new Promise(res => { const r = new FileReader(); r.onload = () => res({n:f.name, x:f.name.split('.').pop().toLowerCase(), c:r.result}); r.readAsText(f); });
      const res = await Promise.all(files.map(read));
      const html=[], css=[], js=[];
      res.forEach(({n,x,c}) => { const s = x==='js'?`\n// --- ${n} ---\n`:`\n/* --- ${n} --- */\n`; if(['html','htm'].includes(x)) html.push(s+c); else if(x==='css') css.push(s+c); else if(x==='js') js.push(s+c); });
      
      // Auto-route to correct boxes
      if(html.length) { editors.html.setValue(html.join('\n').trim()); showTab('html'); }
      if(css.length) { editors.css.setValue(css.join('\n').trim()); showTab('css'); }
      if(js.length) { editors.js.setValue(js.join('\n').trim()); showTab('js'); }
      
      setTimeout(() => Object.values(editors).forEach(ed => ed.refresh()), 10);
      updatePreview(); toast('✅ Files imported & routed'); e.target.value = '';
    };

    // Export
    document.getElementById('export-btn').onclick = async () => {
      const zip = new JSZip();
      zip.file('index.html', `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Exported Project</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n${editors.html.getValue()}\n  <script src="script.js"><\/script>\n</body>\n</html>`);
      zip.file('style.css', editors.css.getValue());
      zip.file('script.js', editors.js.getValue());
      saveAs(await zip.generateAsync({type:'blob'}), 'mobile-website.zip');
    };

    function showTab(t) { document.querySelector(`[data-tab="${t}"]`).click(); }
    function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }

    // Initial
    updatePreview();