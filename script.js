document.addEventListener('DOMContentLoaded', () => {
    const htmlEditor = document.getElementById('html-editor');
    const cssEditor = document.getElementById('css-editor');
    const jsEditor = document.getElementById('js-editor');
    const previewFrame = document.getElementById('preview-frame');
    const consoleOutput = document.getElementById('console-output');
    
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    const codeAreas = document.querySelectorAll('.code-area');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            codeAreas.forEach(a => a.style.display = 'none');
            
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            document.getElementById(targetId).style.display = 'block';
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

    function updatePreview() {
        const htmlCode = htmlEditor.value;
        const cssCode = cssEditor.value;
        const jsCode = jsEditor.value;
        
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
        
        // Add inspector script if active
        if (isInspectMode) {
             finalCode += getInspectorScript();
        }
        
        finalCode += "</body></html>";
        
        iframeDoc.write(finalCode);
        iframeDoc.close();
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
                }
                
                pendingFiles--;
                if(pendingFiles === 0) {
                    updatePreview();
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

    [htmlEditor, cssEditor, jsEditor].forEach(initColorPreview);

    // Initial render
    updatePreview();
});
