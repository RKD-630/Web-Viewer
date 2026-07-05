document.addEventListener('DOMContentLoaded', () => {
    const htmlEditor = document.getElementById('html-editor');
    const cssEditor = document.getElementById('css-editor');
    const jsEditor = document.getElementById('js-editor');
    const jsonEditor = document.getElementById('json-editor');
    const previewFrame = document.getElementById('preview-frame');
    const consoleOutput = document.getElementById('console-output');
    
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    const codeAreas = document.querySelectorAll('.code-area');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            codeAreas.forEach(a => a.style.display = 'none');
            
            const previewPane = document.getElementById('preview-pane');
            const consolePane = document.getElementById('console-pane');
            const iframeContainer = document.getElementById('iframe-container');
            const resizer = document.getElementById('console-resizer');
            const editorPane = document.querySelector('.editor-pane');
            
            if (window.innerWidth <= 768) {
                if (previewPane) previewPane.style.display = 'none';
            }
            
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            
            if (window.innerWidth <= 768) {
                if (targetId === 'preview-pane') {
                    if (previewPane) previewPane.style.display = 'flex';
                    if (iframeContainer) iframeContainer.style.display = 'flex';
                    if (consolePane) consolePane.style.display = 'none';
                    if (resizer) resizer.style.display = 'none';
                    if (editorPane) editorPane.style.flex = 'none';
                } else if (targetId === 'console-pane') {
                    if (previewPane) previewPane.style.display = 'flex';
                    if (iframeContainer) iframeContainer.style.display = 'none';
                    if (consolePane) consolePane.style.display = 'flex';
                    if (resizer) resizer.style.display = 'none';
                    if (editorPane) editorPane.style.flex = 'none';
                } else {
                    if (targetEl) targetEl.style.display = 'block';
                    if (editorPane) editorPane.style.flex = '1';
                    // Reset to desktop view just in case
                    if (iframeContainer) iframeContainer.style.display = 'flex';
                    if (consolePane) consolePane.style.display = 'flex';
                    if (resizer) resizer.style.display = 'block';
                }
            } else {
                if (targetEl) targetEl.style.display = 'block';
            }
            
            // Refresh preview for JSON view
            updatePreview();
        });
    });

    // Auto-run on change with debounce
    let timeout;
    const triggerUpdate = () => {
        clearTimeout(timeout);
        timeout = setTimeout(updatePreview, 600);
    };

    htmlEditor.addEventListener('input', triggerUpdate);
    cssEditor.addEventListener('input', triggerUpdate);
    jsEditor.addEventListener('input', triggerUpdate);
    jsonEditor.addEventListener('input', triggerUpdate);

    function updatePreview() {
        const htmlCode = htmlEditor.value;
        const cssCode = cssEditor.value;
        const jsCode = jsEditor.value;
        const jsonCode = jsonEditor.value;
        
        const activeTab = document.querySelector('.tab.active');
        const isJsonTab = activeTab && activeTab.getAttribute('data-target') === 'json-editor';
        
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        
        // Intercept console inside iframe
        const scriptInject = `
            <script>
                const _log = console.log;
                const _error = console.error;
                const _warn = console.warn;
                const _info = console.info;

                console.log = function(...args) {
                    window.parent.postMessage({ type: 'console', level: 'log', message: args.join(' ') }, '*');
                    _log.apply(console, args);
                };
                console.error = function(...args) {
                    window.parent.postMessage({ type: 'console', level: 'error', message: args.join(' ') }, '*');
                    _error.apply(console, args);
                };
                console.warn = function(...args) {
                    window.parent.postMessage({ type: 'console', level: 'warn', message: args.join(' ') }, '*');
                    _warn.apply(console, args);
                };
                console.info = function(...args) {
                    window.parent.postMessage({ type: 'console', level: 'info', message: args.join(' ') }, '*');
                    _info.apply(console, args);
                };
                
                window.onerror = function(message, source, lineno, colno, error) {
                    window.parent.postMessage({ type: 'console', level: 'error', message: message + ' at line ' + lineno }, '*');
                };
            </script>
        `;
        
        // Inject inspection offsets if mode is active
        let processedHtml = htmlCode;
        if (isInspectMode) {
            processedHtml = htmlCode.replace(/<([a-z1-6]+)([^>]*)>/gi, (match, p1, p2, offset) => {
                // Avoid injecting into close tags or script/style contents if possible
                // (This simple regex works for standard HTML structures in this editor)
                return `<${p1} data-editor-offset="${offset}" ${p2}>`;
            });
        }

        iframeDoc.open();
        
        if (isJsonTab) {
            let jsonHtml = "";
            try {
                const jsonObj = JSON.parse(jsonCode);
                const prettyJson = JSON.stringify(jsonObj, null, 2);
                jsonHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { background: #0d1117; color: #58a6ff; font-family: 'Courier New', monospace; padding: 20px; font-size: 14px; line-height: 1.5; }
                            pre { white-space: pre-wrap; word-wrap: break-word; }
                            .string { color: #79c0ff; }
                            .number { color: #d2a8ff; }
                            .boolean { color: #ffa657; }
                            .null { color: #ffa657; }
                            .key { color: #7ee787; }
                        </style>
                    </head>
                    <body>
                        <pre>${syntaxHighlight(prettyJson)}</pre>
                    </body>
                    </html>
                `;
            } catch (e) {
                jsonHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { background: #0d1117; color: #ff7b72; font-family: sans-serif; padding: 20px; }
                            .error-box { border: 1px solid #ff7b72; padding: 15px; border-radius: 6px; background: rgba(255, 123, 114, 0.1); }
                        </style>
                    </head>
                    <body>
                        <div class="error-box">
                            <h3>❌ Invalid JSON</h3>
                            <p>${e.message}</p>
                        </div>
                    </body>
                    </html>
                `;
            }
            iframeDoc.write(jsonHtml);
        } else {
            let finalCode = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Preview</title>
    <style>${cssCode}</style>
    ${scriptInject}
</head>
<body>
    ${processedHtml}
    <script>${jsCode}</script>
`;
            
            if (isInspectMode) {
                 finalCode += getInspectorScript();
            }
            
            if (isVisualEditMode) {
                finalCode += getVisualEditorScript();
            }
            
            finalCode += "</body></html>";
            iframeDoc.write(finalCode);
        }
        
        iframeDoc.close();
        
        // After update, if in visual edit mode, we might need to re-apply some states
        if (isVisualEditMode) {
            document.body.classList.add('visual-editor-active');
        } else {
            document.body.classList.remove('visual-editor-active');
        }
    }

    function syntaxHighlight(json) {
        if (!json) return "";
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            var cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    // Message receiver
    window.addEventListener('message', (event) => {
        if (!event.data) return;

        if (event.data.type === 'console') {
            appendConsole(event.data.message, event.data.level);
        } else if (event.data.type === 'inspect-select') {
            const offset = event.data.offset;
            const length = event.data.length;
            
            // Switch to HTML tab
            tabs[0].click();
            
            // Focus and select the element in the editor
            htmlEditor.focus();
            htmlEditor.setSelectionRange(offset, offset + (length || 0));
            
            // Visual feedback
            htmlEditor.classList.remove('flash-highlight');
            void htmlEditor.offsetWidth; // Trigger reflow
            htmlEditor.classList.add('flash-highlight');

            // Scroll to the selected line
            const textBefore = htmlEditor.value.substring(0, offset);
            const linesBefore = textBefore.split('\n').length;
            const lineHeight = 20; // Estimated line height
            htmlEditor.scrollTop = (linesBefore - 5) * lineHeight;
            
            appendConsole(`Selected element at offset ${offset} in HTML.`, "info");
        } else if (event.data.type === 'visual-editor-select') {
            handleVisualElementSelect(event.data);
        } else if (event.data.type === 'visual-editor-change') {
            // Sync back to editor
            syncVisualToCode();
            debouncedSaveHistory();
        }
    });

    function appendConsole(msg, level) {
        const div = document.createElement('div');
        div.className = `console-msg console-${level}`;
        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        div.textContent = `[${time}] ${msg}`;
        consoleOutput.appendChild(div);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    document.getElementById('btn-clear-console').addEventListener('click', () => {
        consoleOutput.innerHTML = '';
    });

    // Mobile Template button
    document.getElementById('btn-mobile-template').addEventListener('click', () => {
        if(confirm("Load Mobile App template? This will replace your current code.")) {
            htmlEditor.value = `<div class="app-container">
  <nav class="mobile-nav">
    <div class="app-logo">AppLogo</div>
    <div class="nav-actions">
      <div class="theme-toggle" onclick="toggleTheme()" title="Toggle Theme">🌓</div>
      <div class="menu-icon" onclick="toggleMenu()">☰</div>
    </div>
  </nav>
  
  <header class="hero">
    <h1>Mobile Ready</h1>
    <p>Modern. Responsive. Fast.</p>
    <button class="cta-btn">Get Started</button>
  </header>

  <section class="features">
    <div class="card">
      <div class="icon">📱</div>
      <h3>Mobile First</h3>
      <p>Designed for the thumb.</p>
    </div>
    <div class="card">
      <div class="icon">⚡</div>
      <h3>Fast Load</h3>
      <p>Optimized for performance.</p>
    </div>
  </section>
</div>`;
            
            cssEditor.value = `:root {
  --primary: #58a6ff;
  --bg: #0d1117;
  --surface: #161b22;
  --text: #e6edf3;
  --card-bg: #21262d;
  --border: #30363d;
}

body.light-theme {
  --bg: #f6f8fa;
  --surface: #ffffff;
  --text: #1f2328;
  --card-bg: #ffffff;
  --border: #d0d7de;
}

body {
  margin: 0;
  font-family: 'Inter', sans-serif;
  background: var(--bg);
  color: var(--text);
  transition: background 0.3s, color 0.3s;
}

.app-container {
  max-width: 500px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--surface);
  box-shadow: 0 0 50px rgba(0,0,0,0.5);
}

.mobile-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-actions {
  display: flex;
  gap: 15px;
  align-items: center;
}

.theme-toggle, .menu-icon {
  font-size: 1.2rem;
  cursor: pointer;
  user-select: none;
}

.hero {
  padding: 60px 20px;
  text-align: center;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

body.light-theme .hero {
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
}

.hero h1 { font-size: 2.5rem; margin: 0; color: var(--primary); }

.cta-btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 25px;
  font-weight: 600;
  margin-top: 20px;
  cursor: pointer;
}

.features {
  padding: 20px;
  display: grid;
  gap: 20px;
}

.card {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--border);
  transition: transform 0.2s, background 0.3s;
}

.card:hover { transform: translateY(-5px); }

.icon { font-size: 2rem; margin-bottom: 10px; }`;
            
            jsEditor.value = `function toggleMenu() {
  alert("Menu toggled!");
}

function toggleTheme() {
  document.body.classList.toggle('light-theme');
  console.log("Theme switched");
}

// Initial check
console.info("Mobile App template with Theme Toggle loaded.");`;
            
            updatePreview();
            appendConsole("Mobile App template with Theme Toggle loaded.", "info");
            
            // Switch to HTML tab
            tabs[0].click();
        }
    });

    // Save HTML button
    document.getElementById('btn-save-html').addEventListener('click', () => {
        if (isVisualEditMode) syncVisualToCode();
        const htmlCode = htmlEditor.value;
        const cssCode = cssEditor.value;
        const jsCode = jsEditor.value;
        
        const finalExport = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Webitor Pro Export</title>
  <style>
${cssCode}
  </style>
</head>
<body>
${htmlCode}
  <script>
${jsCode}
  </script>
</body>
</html>`;
        
        const blob = new Blob([finalExport], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "index.html";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        appendConsole("HTML file saved as index.html", "info");
    });

    // New button
    document.getElementById('btn-new').addEventListener('click', () => {
        if(confirm("Start a new project? Unsaved changes will be lost.")) {
            htmlEditor.value = "<h1>New Web Project</h1><p>Start coding here...</p>";
            cssEditor.value = "body {\\n  font-family: sans-serif;\\n  padding: 20px;\\n}";
            jsEditor.value = "// Add logic here\\nconsole.log('New project started');";
            updatePreview();
            consoleOutput.innerHTML = '';
            appendConsole("New project created.", "info");
            
            // Switch to HTML tab
            tabs[0].click();
        }
    });

    // Run button
    document.getElementById('btn-run').addEventListener('click', () => {
        updatePreview();
        appendConsole("Code re-run manually.", "info");
    });

    // Full Preview button
    document.getElementById('btn-preview').addEventListener('click', () => {
        const htmlCode = htmlEditor.value;
        const cssCode = cssEditor.value;
        const jsCode = jsEditor.value;
        
        const finalExport = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Full Preview - Webitor Pro</title>
  <style>
${cssCode}
  </style>
</head>
<body>
${htmlCode}
  <script>
${jsCode}
  </script>
</body>
</html>`;
        
        const blob = new Blob([finalExport], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        appendConsole("Full preview opened in a new tab.", "info");
    });

    // Export ZIP Button
    document.getElementById('btn-export-zip').addEventListener('click', () => {
        if (isVisualEditMode) syncVisualToCode();
        if (typeof JSZip === 'undefined') {
            alert("JSZip library has not loaded properly. Please check your internet connection.");
            return;
        }
        
        const zip = new JSZip();
        
        const htmlCode = htmlEditor.value;
        const cssCode = cssEditor.value;
        const jsCode = jsEditor.value;
        
        // Build the HTML file pointing to external CSS and JS
        const htmlIndex = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported Project</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
${htmlCode}
    <script src="script.js"></script>
</body>
</html>`;

        zip.file("index.html", htmlIndex);
        zip.file("style.css", cssCode);
        zip.file("script.js", jsCode);
        
        zip.generateAsync({type:"blob"}).then(function(content) {
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = "project.zip";
            // Required to trigger download across various browsers securely
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            appendConsole("Project successfully exported as project.zip", "info");
        }).catch(function(err) {
            appendConsole("Error generating ZIP file: " + err.message, "error");
        });
    });

    // Import button
    document.getElementById('file-import').addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length === 0) return;
        
        let pendingFiles = files.length;
        
        for(let i=0; i<files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                if(file.name.endsWith('.html')) {
                    htmlEditor.value = text;
                } else if(file.name.endsWith('.css')) {
                    cssEditor.value += (cssEditor.value ? "\\n" : "") + text;
                } else if(file.name.endsWith('.js')) {
                    jsEditor.value += (jsEditor.value ? "\\n" : "") + text;
                } else if(file.name.endsWith('.json')) {
                    jsonEditor.value = text;
                }
                
                pendingFiles--;
                if(pendingFiles === 0) {
                    updatePreview();
                    updateTabVisibility();
                    appendConsole(`Successfully imported ${files.length} file(s).`, "info");
                }
            };
            reader.readAsText(file);
        }
        
        // Reset file input
        e.target.value = "";
    });

    // Console Input Execution Logic
    const consoleInput = document.getElementById('console-input');
    consoleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const code = consoleInput.value.trim();
            if (!code) return;
            
            // Echo input back to console
            const echoDiv = document.createElement('div');
            echoDiv.className = 'console-msg';
            echoDiv.style.color = '#fff';
            echoDiv.innerHTML = '<span style="color:#58a6ff; font-weight:bold;">&gt;</span> <span style="opacity:0.8;">' + code.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
            consoleOutput.appendChild(echoDiv);
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
            
            consoleInput.value = ''; // Clear prompt
            
            try {
                // Execute code directly within iframe's window scope
                const iframeWindow = previewFrame.contentWindow;
                const result = iframeWindow.eval(code);
                
                // If it successfully returns something defined, output it explicitly
                if (result !== undefined) {
                    // Output directly as log avoiding the interceptor
                    appendConsole(String(result), "log");
                }
            } catch (err) {
                // Return detailed error explicitly
                appendConsole(err.toString(), "error");
            }
        }
    });

    // Inspect Logic
    let isInspectMode = false;
    const btnInspect = document.getElementById('btn-inspect');
    
    btnInspect.addEventListener('click', () => {
        isInspectMode = !isInspectMode;
        btnInspect.style.backgroundColor = isInspectMode ? '#d63384' : '';
        btnInspect.style.borderColor = isInspectMode ? '#d63384' : '';
        btnInspect.textContent = isInspectMode ? 'Stop Inspecting' : 'Inspect Element';
        if (isInspectMode) {
            appendConsole("Inspect Mode enabled. Hover over elements in the preview.", "warn");
        } else {
            appendConsole("Inspect Mode disabled.", "info");
        }
        updatePreview();
    });
    
    function getInspectorScript() {
        return `
        <style>
            .editor-hover-inspect {
                outline: 2px dashed #d63384 !important;
                background-color: rgba(214, 51, 132, 0.2) !important;
                cursor: crosshair !important;
            }
        </style>
        <script>
            (function() {
                let lastHovered = null;
                document.body.addEventListener('mouseover', function(e) {
                    if (lastHovered) lastHovered.classList.remove('editor-hover-inspect');
                    lastHovered = e.target;
                    lastHovered.classList.add('editor-hover-inspect');
                });
                document.body.addEventListener('mouseout', function(e) {
                    if (lastHovered) lastHovered.classList.remove('editor-hover-inspect');
                    lastHovered = null;
                });
                document.body.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const el = e.target;
                    
                    const offset = el.getAttribute('data-editor-offset');
                    if (offset !== null) {
                        window.parent.postMessage({ 
                            type: 'inspect-select', 
                            offset: parseInt(offset),
                            length: el.outerHTML.split('>')[0].length + 1
                        }, '*');
                    }

                    let info = '<' + el.tagName.toLowerCase();
                    if (el.id) info += ' id="' + el.id + '"';
                    if (el.className && typeof el.className === 'string') {
                        const cleanClass = el.className.replace('editor-hover-inspect', '').trim();
                        if (cleanClass) info += ' class="' + cleanClass + '"';
                    }
                    info += '>';
                    console.info('🛠 Inspected Element:', info, '| Text:', el.textContent.substring(0, 30).trim() + (el.textContent.length > 30 ? '...' : ''));
                }, true);
            })();
        </script>
        `;
    }

    // Device Preview Selection
    const deviceBtns = document.querySelectorAll('.device-btn');
    deviceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            deviceBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const device = btn.getAttribute('data-device');
            previewFrame.className = ''; // reset classes
            if (device !== 'desktop') {
                previewFrame.classList.add(device);
            }
        });
    });

    // Console Resizer Logic
    const resizer = document.getElementById('console-resizer');
    const consolePane = document.getElementById('console-pane');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'ns-resize';
        resizer.classList.add('dragging');
        previewFrame.style.pointerEvents = 'none'; // Prevent iframe from stealing events
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const workspaceRect = document.querySelector('.preview-pane').getBoundingClientRect();
        const newHeight = workspaceRect.bottom - e.clientY;
        
        // Constrain height
        if (newHeight > 40 && newHeight < workspaceRect.height - 100) {
            consolePane.style.height = `${newHeight}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            resizer.classList.remove('dragging');
            previewFrame.style.pointerEvents = 'auto';
        }
    });

    // Color Preview Logic
    const colorTooltip = document.getElementById('color-preview-tooltip');
    
    function initColorPreview(editor) {
        editor.addEventListener('mousemove', (e) => {
            const rect = editor.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const offset = getCharOffsetAtPoint(editor, x, y);
            if (offset !== null) {
                const color = getColorAtOffset(editor.value, offset);
                if (color) {
                    showColorTooltip(color, e.clientX, e.clientY);
                    return;
                }
            }
            hideColorTooltip();
        });
        
        editor.addEventListener('mouseleave', hideColorTooltip);
    }

    function getCharOffsetAtPoint(textarea, x, y) {
        const style = window.getComputedStyle(textarea);
        const paddingLeft = parseFloat(style.paddingLeft);
        const paddingTop = parseFloat(style.paddingTop);
        const lineHeight = parseFloat(style.lineHeight) || 22.5;
        
        // Approximate character width for monospace font
        const fontSize = parseFloat(style.fontSize);
        const charWidth = fontSize * 0.6; // Heuristic for monospace
        
        const col = Math.floor((x - paddingLeft + textarea.scrollLeft) / charWidth);
        const row = Math.floor((y - paddingTop + textarea.scrollTop) / lineHeight);
        
        const lines = textarea.value.split('\n');
        if (row < 0 || row >= lines.length) return null;
        
        let offset = 0;
        for(let i = 0; i < row; i++) {
            offset += lines[i].length + 1; // +1 for newline
        }
        
        if (col < 0 || col >= lines[row].length) return null;
        return offset + col;
    }

    function getColorAtOffset(text, offset) {
        const colorRegex = /(#[a-f0-9]{3,8}|rgba?\([^\)]+\)|hsla?\([^\)]+\))/gi;
        let match;
        while ((match = colorRegex.exec(text)) !== null) {
            if (offset >= match.index && offset <= match.index + match[0].length) {
                return match[0];
            }
        }
        return null;
    }

    function showColorTooltip(color, x, y) {
        colorTooltip.style.display = 'block';
        colorTooltip.style.backgroundColor = color;
        colorTooltip.style.left = `${x + 15}px`;
        colorTooltip.style.top = `${y + 15}px`;
        
        // Validate if color is actually valid by the browser
        const temp = new Option().style;
        temp.color = color;
        if (temp.color === "") {
            hideColorTooltip();
        }
    }

    function hideColorTooltip() {
        colorTooltip.style.display = 'none';
    }

    // Modal Logic
    const infoModal = document.getElementById('info-modal');
    const btnInfo = document.getElementById('btn-info');
    const closeModal = document.querySelector('.close-modal');
    const langBtns = document.querySelectorAll('.lang-btn');
    const langContents = document.querySelectorAll('.lang-content');

    btnInfo.addEventListener('click', () => {
        infoModal.style.display = 'block';
    });

    closeModal.addEventListener('click', () => {
        infoModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            infoModal.style.display = 'none';
        }
    });

    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            
            // Update buttons
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update contents
            langContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `lang-${lang}`) {
                    content.classList.add('active');
                }
            });
        });
    });

    [htmlEditor, cssEditor, jsEditor, jsonEditor].forEach(initColorPreview);
    
    // --- New Editor Tools Logic ---
    
    // Search Logic
    const searchInput = document.getElementById('editor-search');
    const btnFind = document.getElementById('btn-find');
    const searchResults = document.getElementById('search-results');
    let lastSearch = "";
    let searchIndex = -1;
    let searchMatches = [];

    function performSearch() {
        const query = searchInput.value;
        const activeArea = document.querySelector('.code-area[style*="display: block"]') || htmlEditor;
        const text = activeArea.value;

        if (!query) {
            searchResults.textContent = "0/0";
            return;
        }

        if (query !== lastSearch) {
            lastSearch = query;
            searchMatches = [];
            let pos = text.indexOf(query);
            while (pos !== -1) {
                searchMatches.push(pos);
                pos = text.indexOf(query, pos + 1);
            }
            searchIndex = -1;
        }

        if (searchMatches.length > 0) {
            searchIndex = (searchIndex + 1) % searchMatches.length;
            const pos = searchMatches[searchIndex];
            activeArea.focus();
            activeArea.setSelectionRange(pos, pos + query.length);
            
            // Scroll into view
            const textBefore = text.substring(0, pos);
            const linesBefore = textBefore.split('\n').length;
            const lineHeight = parseFloat(window.getComputedStyle(activeArea).lineHeight);
            activeArea.scrollTop = (linesBefore - 5) * lineHeight;

            searchResults.textContent = `${searchIndex + 1}/${searchMatches.length}`;
        } else {
            searchResults.textContent = "0/0";
            appendConsole(`No matches found for "${query}"`, "info");
        }
    }

    btnFind.addEventListener('click', performSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Reset search when text changes or tab changes
    const resetSearch = () => {
        lastSearch = "";
        searchMatches = [];
        searchIndex = -1;
        searchResults.textContent = "0/0";
    };

    [htmlEditor, cssEditor, jsEditor, jsonEditor].forEach(area => area.addEventListener('input', resetSearch));
    tabs.forEach(tab => tab.addEventListener('click', resetSearch));

    // Undo/Redo Logic
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');

    btnUndo.addEventListener('click', () => {
        const activeArea = document.querySelector('.code-area[style*="display: block"]') || htmlEditor;
        activeArea.focus();
        document.execCommand('undo', false, null);
    });

    btnRedo.addEventListener('click', () => {
        const activeArea = document.querySelector('.code-area[style*="display: block"]') || htmlEditor;
        activeArea.focus();
        document.execCommand('redo', false, null);
    });

    // Zoom Logic
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    let currentZoom = 15;

    function updateZoom() {
        codeAreas.forEach(area => {
            area.style.fontSize = `${currentZoom}px`;
        });
        appendConsole(`Editor font size: ${currentZoom}px`, "info");
    }

    btnZoomIn.addEventListener('click', () => {
        if (currentZoom < 40) {
            currentZoom += 2;
            updateZoom();
        }
    });

    btnZoomOut.addEventListener('click', () => {
        if (currentZoom > 8) {
            currentZoom -= 2;
            updateZoom();
        }
    });

    // --- Visual Editor Implementation ---
    let isVisualEditMode = false;
    let selectedElementInfo = null;
    const btnEdit = document.getElementById('id-btn-edit');
    const propertyPanel = document.getElementById('property-panel');
    const imageImport = document.getElementById('image-import');

    btnEdit.addEventListener('click', () => {
        isVisualEditMode = !isVisualEditMode;
        btnEdit.textContent = isVisualEditMode ? 'Finish Editing' : 'Edit';
        btnEdit.style.backgroundColor = isVisualEditMode ? '#ffca28' : '';
        btnEdit.style.color = isVisualEditMode ? '#000' : '#ffca28';
        
        const consolePane = document.getElementById('console-pane');
        const editorPane = document.querySelector('.editor-pane');
        const resizerV = document.getElementById('console-resizer');

        if (isVisualEditMode) {
            appendConsole("Visual Edit Mode enabled. Click elements in preview to edit.", "warn");
            // Expand preview pane for full page feel
            editorPane.style.display = 'none';
            consolePane.style.display = 'none';
            resizerV.style.display = 'none';
        } else {
            appendConsole("Visual Edit Mode disabled.", "info");
            editorPane.style.display = 'flex';
            consolePane.style.display = 'flex';
            resizerV.style.display = 'flex';
            propertyPanel.classList.remove('active');
            syncVisualToCode();
        }
        updatePreview();
    });

    // Property Panel Tab Switching
    const panelTabs = document.querySelectorAll('.panel-tab');
    const panelContents = document.querySelectorAll('.tab-content');
    panelTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            panelTabs.forEach(t => t.classList.remove('active'));
            panelContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
        });
    });

    document.querySelector('.close-panel').addEventListener('click', () => {
        propertyPanel.classList.remove('active');
    });

    // Color Type Toggles
    document.querySelectorAll('.color-type-toggle').forEach(toggle => {
        toggle.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                toggle.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const type = btn.getAttribute('data-type');
                const isBg = toggle.classList.contains('bg-type');
                
                if (isBg) {
                    document.getElementById('bg-solid-wrap').style.display = type === 'solid' ? 'block' : 'none';
                    document.getElementById('bg-gradient-wrap').style.display = type === 'gradient' ? 'block' : 'none';
                } else {
                    document.getElementById('solid-color-wrap').style.display = type === 'solid' ? 'block' : 'none';
                    document.getElementById('gradient-color-wrap').style.display = type === 'gradient' ? 'block' : 'none';
                }
            });
        });
    });

    function handleVisualElementSelect(data) {
        selectedElementInfo = data;
        propertyPanel.classList.add('active');
        document.getElementById('target-element-name').textContent = `<${data.tagName.toLowerCase()}> Properties`;
        
        // Update inputs based on current styles
        const styles = data.styles;
        
        // Text Content
        document.getElementById('prop-text-content').value = data.textContent || '';
        
        // Link Content
        if (data.tagName === 'A') {
            document.getElementById('prop-link-wrap').style.display = 'block';
            document.getElementById('prop-link-url').value = data.href || '';
            document.getElementById('prop-link-target').checked = data.target === '_blank';
        } else {
            document.getElementById('prop-link-wrap').style.display = 'none';
        }
        
        // Font
        document.getElementById('prop-font-size').value = parseInt(styles.fontSize) || 16;
        document.getElementById('font-size-val').textContent = styles.fontSize;
        
        // Detect if gradient or solid for text
        const hasTextGradient = (styles.backgroundImage && styles.backgroundImage.includes('gradient')) && 
                              (styles.backgroundClip.includes('text') || styles.webkitBackgroundClip.includes('text'));
        
        if (hasTextGradient) {
            document.querySelector('.color-type-toggle:not(.bg-type) .type-btn[data-type="gradient"]').click();
        } else {
            document.querySelector('.color-type-toggle:not(.bg-type) .type-btn[data-type="solid"]').click();
            const hex = rgbToHex(styles.color);
            document.getElementById('prop-text-color').value = hex;
            document.getElementById('prop-text-color-code').value = hex;
        }

        // Detect if gradient or solid for background
        const noBg = styles.backgroundColor === 'rgba(0, 0, 0, 0)' || styles.backgroundColor === 'transparent';
        document.getElementById('prop-no-bg').checked = noBg;

        if (styles.backgroundImage && styles.backgroundImage.includes('gradient') && styles.backgroundClip !== 'text') {
            document.querySelector('.bg-type .type-btn[data-type="gradient"]').click();
        } else {
            document.querySelector('.bg-type .type-btn[data-type="solid"]').click();
            const hex = rgbToHex(styles.backgroundColor);
            document.getElementById('prop-bg-color').value = hex;
            document.getElementById('prop-bg-color-code').value = hex;
        }

        // Style buttons
        document.getElementById('prop-bold').classList.toggle('active', styles.fontWeight === 'bold' || parseInt(styles.fontWeight) >= 600);
        document.getElementById('prop-italic').classList.toggle('active', styles.fontStyle === 'italic');
        document.getElementById('prop-underline').classList.toggle('active', styles.textDecoration.includes('underline'));

        // Image props
        if (data.tagName === 'IMG') {
            panelTabs[1].click(); // Switch to Image tab
        } else {
            panelTabs[0].click(); // Switch to Text tab
        }
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent') return '#ffffff';
        if (rgb.startsWith('#')) return rgb;
        const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!match) return '#ffffff';
        function hex(x) {
            return ("0" + parseInt(x).toString(16)).slice(-2);
        }
        return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
    }

    // Apply Changes
    document.getElementById('btn-apply-props').addEventListener('click', () => {
        if (!selectedElementInfo) return;

        const props = {
            fontSize: document.getElementById('prop-font-size').value + 'px',
            fontFamily: document.getElementById('prop-font-family').value,
            fontWeight: document.getElementById('prop-bold').classList.contains('active') ? 'bold' : 'normal',
            fontStyle: document.getElementById('prop-italic').classList.contains('active') ? 'italic' : 'normal',
            textDecoration: document.getElementById('prop-underline').classList.contains('active') ? 'underline' : 'none',
            opacity: document.getElementById('prop-opacity').value / 100,
            borderRadius: document.getElementById('prop-radius').value + 'px',
            margin: document.getElementById('prop-margin').value + 'px',
        };

        // Text Color & Gradient
        const colorType = document.querySelector('.color-type-toggle:not(.bg-type) .type-btn.active').getAttribute('data-type');
        let textGrad = 'none';
        if (colorType === 'solid') {
            props.color = document.getElementById('prop-text-color').value;
            props.webkitTextFillColor = 'initial';
        } else {
            const g1 = document.getElementById('prop-grad-1').value;
            const g2 = document.getElementById('prop-grad-2').value;
            const dir = document.getElementById('prop-grad-dir').value;
            textGrad = `linear-gradient(${dir}, ${g1}, ${g2})`;
            props.webkitTextFillColor = 'transparent';
            props.color = 'transparent';
        }

        // Background Color & Gradient
        const bgType = document.querySelector('.bg-type .type-btn.active').getAttribute('data-type');
        const noBg = document.getElementById('prop-no-bg').checked;
        let bgGrad = 'none';

        if (noBg) {
            props.backgroundColor = 'transparent';
        } else if (bgType === 'solid') {
            props.backgroundColor = document.getElementById('prop-bg-color').value;
        } else {
            const g1 = document.getElementById('prop-bg-grad-1').value;
            const g2 = document.getElementById('prop-bg-grad-2').value;
            const dir = document.getElementById('prop-bg-grad-dir').value;
            bgGrad = `linear-gradient(${dir}, ${g1}, ${g2})`;
            props.backgroundColor = 'transparent';
        }

        // Combine Gradients & Handle Clipping
        if (textGrad !== 'none') {
            props.backgroundImage = textGrad;
            if (bgGrad !== 'none') {
                // If both exist, we can try stacking, but clipping will affect both.
                // Usually better to prioritize text gradient if clip is active.
                props.backgroundImage = `${textGrad}, ${bgGrad}`;
            }
            props.webkitBackgroundClip = 'text';
            props.backgroundClip = 'text';
            // Important: if text gradient is on, background-color might interfere 
            // depending on browser. Usually transparent is best.
        } else {
            props.backgroundImage = bgGrad;
            props.webkitBackgroundClip = 'border-box';
            props.backgroundClip = 'border-box';
        }

        // Text Shadow
        const shadowColor = document.getElementById('prop-shadow-color').value;
        const shadowBlur = document.getElementById('prop-shadow-blur').value;
        if (parseInt(shadowBlur) > 0) {
            props.textShadow = `0 0 ${shadowBlur}px ${shadowColor}`;
        } else {
            props.textShadow = 'none';
        }

        // Filters (for images)
        const contrast = document.getElementById('prop-contrast').value;
        const brightness = document.getElementById('prop-brightness').value;
        const hue = document.getElementById('prop-hue').value;
        const blur = document.getElementById('prop-blur').value;
        props.filter = `contrast(${contrast}%) brightness(${brightness}%) hue-rotate(${hue}deg) blur(${blur}px)`;

        // Link Properties
        let linkProps = null;
        if (selectedElementInfo.tagName === 'A') {
            linkProps = {
                href: document.getElementById('prop-link-url').value,
                target: document.getElementById('prop-link-target').checked ? '_blank' : '_self'
            };
        }

        // Text Content
        const textContent = document.getElementById('prop-text-content').value;

        // Send to iframe
        const activeFrame = document.querySelector('.frame-item.active');
        previewFrame.contentWindow.postMessage({
            type: 'visual-editor-apply',
            id: selectedElementInfo.id,
            props: props,
            textContent: textContent,
            linkProps: linkProps,
            frameClass: activeFrame ? activeFrame.getAttribute('data-frame') : 'none'
        }, '*');

        appendConsole("Changes applied to element.", "info");
    });

    // Live Updates
    const livePropInputs = [
        'prop-font-size', 'prop-font-family', 'prop-text-color', 'prop-grad-1', 'prop-grad-2', 'prop-grad-dir',
        'prop-bg-color', 'prop-bg-grad-1', 'prop-bg-grad-2', 'prop-bg-grad-dir',
        'prop-shadow-color', 'prop-shadow-blur', 'prop-contrast', 'prop-brightness', 'prop-hue', 'prop-blur',
        'prop-opacity', 'prop-radius', 'prop-margin', 'prop-no-bg', 'prop-text-color-code', 'prop-bg-color-code',
        'prop-link-url', 'prop-link-target', 'prop-text-content'
    ];

    livePropInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                // Sync color picker with text input
                if (id === 'prop-text-color') document.getElementById('prop-text-color-code').value = el.value.toUpperCase();
                if (id === 'prop-text-color-code') {
                    if (/^#[0-9A-F]{6}$/i.test(el.value)) document.getElementById('prop-text-color').value = el.value;
                }
                if (id === 'prop-bg-color') document.getElementById('prop-bg-color-code').value = el.value.toUpperCase();
                if (id === 'prop-bg-color-code') {
                    if (/^#[0-9A-F]{6}$/i.test(el.value)) document.getElementById('prop-bg-color').value = el.value;
                }

                document.getElementById('btn-apply-props').click();
                if (id === 'prop-font-size') {
                    document.getElementById('font-size-val').textContent = el.value + 'px';
                }
            });
        }
    });

    // Style button toggles
    ['prop-bold', 'prop-italic', 'prop-underline'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                document.getElementById('btn-apply-props').click();
            });
        }
    });

    // Frame selection
    document.querySelectorAll('.frame-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.frame-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            document.getElementById('btn-apply-props').click();
        });
    });

    // Image Replace
    document.getElementById('btn-replace-image').addEventListener('click', () => {
        imageImport.click();
    });

    imageImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            previewFrame.contentWindow.postMessage({
                type: 'visual-editor-replace-image',
                id: selectedElementInfo.id,
                src: event.target.result
            }, '*');
        };
        reader.readAsDataURL(file);
    });

    function syncVisualToCode() {
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        // Clean up editor specific classes and artifacts before syncing
        const cleanBody = iframeDoc.body.cloneNode(true);
        
        // Remove all editor-only classes
        const editorClasses = [
            'editor-selected-element', 
            've-hover-preview', 
            'editor-hover-inspect'
        ];
        
        editorClasses.forEach(cls => {
            cleanBody.querySelectorAll('.' + cls).forEach(el => el.classList.remove(cls));
        });

        // Clean up editor-specific attributes
        cleanBody.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
        cleanBody.querySelectorAll('[data-editor-offset]').forEach(el => el.removeAttribute('data-editor-offset'));
        
        // Remove any style artifacts that might have been stuck
        cleanBody.querySelectorAll('*').forEach(el => {
            if (el.style.outline && (el.style.outline.includes('dashed') || el.style.outline.includes('#ffca28'))) {
                el.style.outline = '';
            }
            // Remove empty class attributes
            if (el.classList.length === 0) el.removeAttribute('class');
            // Remove empty style attributes
            if (el.getAttribute('style') === '') el.removeAttribute('style');
        });
        
        htmlEditor.value = cleanBody.innerHTML.trim();
        triggerUpdate(); // This will refresh the internal state but keep the UI
    }

    function getVisualEditorScript() {
        return `
        <script>
            (function() {
                let selectedEl = null;
                let elementCounter = 0;

                // Assign IDs to all elements for reference if they don't have one
                document.querySelectorAll('body *').forEach(el => {
                    if (!el.id) el.id = 've-' + (++elementCounter);
                });

                const style = document.createElement('style');
                style.innerHTML = \`
                    .ve-hover-preview { outline: 1px dashed #ffca28 !important; }
                    .editor-selected-element { outline: 2px solid #58a6ff !important; outline-offset: 2px !important; }
                \`;
                document.head.appendChild(style);

                document.body.addEventListener('mouseover', function(e) {
                    if (e.target === document.body) return;
                    e.target.classList.add('ve-hover-preview');
                });

                document.body.addEventListener('mouseout', function(e) {
                    if (e.target === document.body) return;
                    e.target.classList.remove('ve-hover-preview');
                });

                document.body.addEventListener('click', function(e) {
                    if (e.target === document.body) return;
                    e.preventDefault();
                    e.stopPropagation();

                    if (selectedEl) {
                        selectedEl.classList.remove('editor-selected-element');
                        selectedEl.removeAttribute('contenteditable');
                    }

                    selectedEl = e.target;
                    selectedEl.classList.add('editor-selected-element');
                    
                    const computed = window.getComputedStyle(selectedEl);
                    window.parent.postMessage({
                        type: 'visual-editor-select',
                        id: selectedEl.id,
                        tagName: selectedEl.tagName,
                        textContent: selectedEl.innerText,
                        styles: {
                            fontSize: computed.fontSize,
                            color: computed.color,
                            backgroundColor: computed.backgroundColor,
                            fontFamily: computed.fontFamily,
                            fontWeight: computed.fontWeight,
                            fontStyle: computed.fontStyle,
                            textDecoration: computed.textDecoration,
                            backgroundImage: computed.backgroundImage,
                            backgroundClip: computed.backgroundClip || '',
                            webkitBackgroundClip: computed.webkitBackgroundClip || '',
                            textShadow: computed.textShadow,
                            href: selectedEl.href || '',
                            target: selectedEl.target || ''
                        }
                    }, '*');
                });

                window.addEventListener('message', function(event) {
                    if (event.data.type === 'visual-editor-apply') {
                        const el = document.getElementById(event.data.id);
                        if (!el) return;
                        
                        Object.assign(el.style, event.data.props);
                        
                        if (event.data.textContent !== undefined && !['IMG', 'VIDEO', 'IFRAME'].includes(el.tagName)) {
                            el.innerText = event.data.textContent;
                        }

                        // Handle frame classes
                        const frames = ['frame-rounded', 'frame-circle', 'frame-border', 'frame-shadow', 'frame-art'];
                        frames.forEach(f => el.classList.remove(f));
                        if (event.data.frameClass !== 'none') {
                            el.classList.add(event.data.frameClass);
                        }
                        
                        if (event.data.linkProps) {
                            el.href = event.data.linkProps.href;
                            el.target = event.data.linkProps.target;
                        }
                        
                        window.parent.postMessage({ type: 'visual-editor-change' }, '*');
                    } else if (event.data.type === 'visual-editor-replace-image') {
                        const el = document.getElementById(event.data.id);
                        if (el && el.tagName === 'IMG') {
                            el.src = event.data.src;
                            window.parent.postMessage({ type: 'visual-editor-change' }, '*');
                        }
                    }
                });

                // Monitor content changes
                document.body.addEventListener('input', function(e) {
                    window.parent.postMessage({ type: 'visual-editor-change' }, '*');
                });
            })();
        </script>
        `;
    }

    // --- Visual History Management ---
    let visualHistory = [];
    let historyIndex = -1;
    const MAX_HISTORY = 50;

    function saveVisualHistory() {
        const currentContent = htmlEditor.value;
        
        // Don't save if it's the same as the current index
        if (historyIndex >= 0 && visualHistory[historyIndex] === currentContent) return;

        // Remove any future history if we're in the middle of the stack
        if (historyIndex < visualHistory.length - 1) {
            visualHistory = visualHistory.slice(0, historyIndex + 1);
        }

        visualHistory.push(currentContent);
        
        if (visualHistory.length > MAX_HISTORY) {
            visualHistory.shift();
            // historyIndex remains at MAX_HISTORY - 1
        } else {
            historyIndex++;
        }
        
        updateHistoryButtons();
        console.log(`History saved. Index: ${historyIndex}, Total: ${visualHistory.length}`);
    }

    function updateHistoryButtons() {
        const btnUndo = document.getElementById('btn-prop-undo');
        const btnRedo = document.getElementById('btn-prop-redo');
        if (!btnUndo || !btnRedo) return;

        const canUndo = historyIndex > 0;
        const canRedo = historyIndex < visualHistory.length - 1;

        btnUndo.disabled = !canUndo;
        btnRedo.disabled = !canRedo;
        btnUndo.style.opacity = canUndo ? '1' : '0.3';
        btnRedo.style.opacity = canRedo ? '1' : '0.3';
        btnUndo.style.cursor = canUndo ? 'pointer' : 'not-allowed';
        btnRedo.style.cursor = canRedo ? 'pointer' : 'not-allowed';
    }

    document.getElementById('btn-prop-undo').addEventListener('click', (e) => {
        e.stopPropagation();
        if (historyIndex > 0) {
            historyIndex--;
            applyHistoryState();
            appendConsole("Undo: Reverted to previous visual state.", "info");
        }
    });

    document.getElementById('btn-prop-redo').addEventListener('click', (e) => {
        e.stopPropagation();
        if (historyIndex < visualHistory.length - 1) {
            historyIndex++;
            applyHistoryState();
            appendConsole("Redo: Re-applied visual state.", "info");
        }
    });

    function applyHistoryState() {
        const content = visualHistory[historyIndex];
        htmlEditor.value = content;
        
        // Update the preview without triggering a new history save
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        // We use updatePreview logic but need to be careful not to trigger saveVisualHistory again
        // triggerUpdate uses a timeout, so we should be fine if we don't call it here
        updatePreview();
        updateHistoryButtons();
    }

    // Save initial state when entering edit mode
    btnEdit.addEventListener('click', () => {
        // Use a small delay to ensure isVisualEditMode is updated and preview is ready
        setTimeout(() => {
            if (isVisualEditMode && visualHistory.length === 0) {
                saveVisualHistory();
            }
        }, 100);
    });

    // Save history on change (debounced)
    let historyTimeout;
    function debouncedSaveHistory() {
        clearTimeout(historyTimeout);
        historyTimeout = setTimeout(() => {
            if (isVisualEditMode) {
                saveVisualHistory();
            }
        }, 300); // Shorter debounce for better responsiveness
    }

    function updateTabVisibility() {
        const jsonTab = document.querySelector('.tab[data-target="json-editor"]');
        const hasJson = jsonEditor.value.trim().length > 0;
        
        if (hasJson) {
            jsonTab.style.display = 'block';
        } else {
            // Only hide if it's not the active tab, or if we want to force hide it
            const isActive = jsonTab.classList.contains('active');
            if (!isActive) {
                jsonTab.style.display = 'none';
            }
        }
    }

    // Monitor JSON editor for manual content addition
    jsonEditor.addEventListener('input', updateTabVisibility);

    // Initial render and visibility check
    updatePreview();
    updateTabVisibility();
});
