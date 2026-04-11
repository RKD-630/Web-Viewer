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
    ${htmlCode}
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

    // Console receiver
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'console') {
            appendConsole(event.data.message, event.data.level);
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

    // Export Single HTML button
    document.getElementById('btn-export').addEventListener('click', () => {
        const htmlCode = htmlEditor.value;
        const cssCode = cssEditor.value;
        const jsCode = jsEditor.value;
        
        const finalExport = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Exported Project</title>
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
        a.download = 'project.html';
        a.click();
        URL.revokeObjectURL(url);
        appendConsole("Code exported as project.html", "info");
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

    // Initial render
    updatePreview();
});
