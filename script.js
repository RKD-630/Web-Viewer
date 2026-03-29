document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // CodeMirror Initialization
    // ==========================================
    const cmConfigInit = {
        lineNumbers: true,
        theme: 'dracula', // Starts in dark mode
        autoCloseTags: true,
        autoCloseBrackets: true,
        tabSize: 2,
        indentUnit: 2,
        lineWrapping: true
    };

    const editors = {
        html: CodeMirror(document.getElementById('html-editor'), { ...cmConfigInit, mode: 'htmlmixed' }),
        css:  CodeMirror(document.getElementById('css-editor'), { ...cmConfigInit, mode: 'css' }),
        js:   CodeMirror(document.getElementById('js-editor'), { ...cmConfigInit, mode: 'javascript' }),
        json: CodeMirror(document.getElementById('json-editor'), { ...cmConfigInit, mode: { name: 'javascript', json: true } })
    };

    // ==========================================
    // Live Preview & State Management
    // ==========================================
    let updateTimeout;

    function triggerPreviewUpdate() {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            updateLivePreview();
            saveToLocal();
        }, 500);
    }

    Object.values(editors).forEach(editor => {
        editor.on('change', triggerPreviewUpdate);
    });

    const livePreviewFrame = document.getElementById('live-preview');
    const jsonPreviewBox = document.getElementById('json-preview');
    const activeTabElements = document.querySelectorAll('.tab');

    function updateLivePreview() {
        const activeTab = document.querySelector('.tab.active').dataset.target;

        if (activeTab === 'json') {
            livePreviewFrame.classList.add('hidden');
            jsonPreviewBox.classList.remove('hidden');
            validateJSON();
        } else {
            livePreviewFrame.classList.remove('hidden');
            jsonPreviewBox.classList.add('hidden');
            document.getElementById('json-status').classList.add('hidden');

            const html = editors.html.getValue();
            const css = editors.css.getValue();
            const js = editors.js.getValue();

            let combinedHTML = '';
            const isFullHtml = /<html/i.test(html) || /<!doctype/i.test(html);

            if (isFullHtml) {
                combinedHTML = html;
                if (css.trim()) {
                    if (/<\/head>/i.test(combinedHTML)) {
                        combinedHTML = combinedHTML.replace(/<\/head>/i, `<style>${css}</style>\n</head>`);
                    } else {
                        combinedHTML = `<style>${css}</style>\n` + combinedHTML;
                    }
                }
                if (js.trim()) {
                    if (/<\/body>/i.test(combinedHTML)) {
                        combinedHTML = combinedHTML.replace(/<\/body>/i, `<script>try{${js}}catch(e){console.error(e)}<\/script>\n</body>`);
                    } else {
                        combinedHTML += `\n<script>try{${js}}catch(e){console.error(e)}<\/script>`;
                    }
                }
            } else {
                combinedHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <style>
        /* Base reset so user preview doesn't rely entirely on browser defaults */
        body { margin: 0; padding: 1rem; font-family: sans-serif; }
        ${css}
    </style>
</head>
<body>
    ${html}
    <script>
        try {
            ${js}
        } catch(e) {
            console.error('User JS Error:', e);
        }
    <\/script>
</body>
</html>`;
            }

            // Using srcdoc is reliable and bypasses same-origin blocks
            livePreviewFrame.srcdoc = combinedHTML;
        }
    }

    // ==========================================
    // JSON Validation Logic
    // ==========================================
    const jsonStatus = document.getElementById('json-status');
    const jsonOutput = document.getElementById('json-output');

    function validateJSON() {
        const val = editors.json.getValue();
        jsonStatus.classList.remove('hidden');

        if (!val.trim()) {
            jsonStatus.textContent = 'Empty';
            jsonStatus.className = 'json-status';
            jsonOutput.textContent = '';
            return;
        }

        try {
            const parsed = JSON.parse(val);
            jsonStatus.textContent = 'Valid JSON';
            jsonStatus.className = 'json-status valid';
            jsonOutput.textContent = JSON.stringify(parsed, null, 2);
        } catch (e) {
            jsonStatus.textContent = 'Invalid JSON';
            jsonStatus.className = 'json-status invalid';
            jsonOutput.textContent = e.message;
        }
    }

    document.getElementById('btn-format-json').addEventListener('click', () => {
        try {
            const val = editors.json.getValue();
            if(!val.trim()) return;
            const parsed = JSON.parse(val);
            editors.json.setValue(JSON.stringify(parsed, null, 2));
            editors.json.clearHistory();
        } catch (e) {
            alert('Cannot format invalid JSON.');
        }
    });

    // ==========================================
    // Tab Switching
    // ==========================================
    const formatJsonBtn = document.getElementById('btn-format-json');

    activeTabElements.forEach(tab => {
        tab.addEventListener('click', () => {
            activeTabElements.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const target = tab.dataset.target;
            document.querySelectorAll('.editor-container').forEach(c => c.classList.remove('active'));
            document.getElementById(`${target}-editor`).classList.add('active');

            if (target === 'json') {
                formatJsonBtn.classList.remove('hidden');
            } else {
                formatJsonBtn.classList.add('hidden');
            }

            // Refresh CodeMirror layout to avoid rendering bugs when div was hidden
            setTimeout(() => {
                editors[target].refresh();
            }, 10);
            
            updateLivePreview();
        });
    });

    // ==========================================
    // Resizer Splitter Logic & Zoom Logic
    // ==========================================
    let currentZoom = 14;
    function applyZoom() {
        document.querySelectorAll('.CodeMirror').forEach(cm => {
            cm.style.fontSize = `${currentZoom}px`;
        });
        Object.values(editors).forEach(editor => editor.refresh());
    }

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
        if(currentZoom < 30) { currentZoom += 2; applyZoom(); }
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
        if(currentZoom > 8) { currentZoom -= 2; applyZoom(); }
    });

    const resizer = document.getElementById('resizer');
    const editorPane = document.querySelector('.editor-pane');
    let isResizing = false;

    function startResize(e) {
        isResizing = true;
        document.body.style.cursor = window.innerWidth <= 768 ? 'row-resize' : 'col-resize';
        resizer.classList.add('dragging');
        livePreviewFrame.style.pointerEvents = 'none';
    }

    function doResize(clientX, clientY) {
        if (!isResizing) return;
        if (window.innerWidth <= 768) {
            const headerHeight = document.querySelector('.app-header').offsetHeight;
            const height = clientY - headerHeight;
            const minHeight = 100;
            const maxHeight = window.innerHeight - headerHeight - 100;
            if (height > minHeight && height < maxHeight) {
                editorPane.style.height = `${height}px`;
                editorPane.style.width = '100%';
            }
        } else {
            const width = clientX;
            const minWidth = 250;
            const maxWidth = window.innerWidth - 250;
            if (width > minWidth && width < maxWidth) {
                editorPane.style.width = `${width}px`;
                editorPane.style.height = '100%';
            }
        }
    }

    function endResize() {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            resizer.classList.remove('dragging');
            livePreviewFrame.style.pointerEvents = 'all';
            Object.values(editors).forEach(editor => editor.refresh());
        }
    }

    resizer.addEventListener('mousedown', startResize);
    resizer.addEventListener('touchstart', startResize, {passive: true});

    document.addEventListener('mousemove', (e) => doResize(e.clientX, e.clientY));
    document.addEventListener('touchmove', (e) => {
        if (isResizing) {
            doResize(e.touches[0].clientX, e.touches[0].clientY);
            if (e.cancelable) e.preventDefault();
        }
    }, {passive: false});

    document.addEventListener('mouseup', endResize);
    document.addEventListener('touchend', endResize);

    // ==========================================
    // Download ZIP Logic (JSZip)
    // ==========================================
    document.getElementById('btn-download').addEventListener('click', () => {
        if (typeof JSZip === 'undefined') {
            alert("JSZip library has not loaded. Cannot generate zip.");
            return;
        }
        const zip = new JSZip();

        const html = editors.html.getValue();
        const css = editors.css.getValue();
        const js = editors.js.getValue();

        let indexFile = '';
        const isFullHtml = /<html/i.test(html) || /<!doctype/i.test(html);

        if (isFullHtml) {
            indexFile = html;
            if (css.trim()) {
                if (/<\/head>/i.test(indexFile) && !/style\.css/i.test(indexFile)) {
                    indexFile = indexFile.replace(/<\/head>/i, '    <link rel="stylesheet" href="style.css">\n</head>');
                } else if (!/<head>/i.test(indexFile) && !/style\.css/i.test(indexFile)) {
                    indexFile = `<link rel="stylesheet" href="style.css">\n` + indexFile;
                }
            }
            if (js.trim()) {
                if (/<\/body>/i.test(indexFile) && !/script\.js/i.test(indexFile)) {
                    indexFile = indexFile.replace(/<\/body>/i, '    <script src="script.js"><\/script>\n</body>');
                } else if (!/<body>/i.test(indexFile) && !/script\.js/i.test(indexFile)) {
                    indexFile += `\n<script src="script.js"><\/script>`;
                }
            }
        } else {
            let cssLink = css.trim() ? '\n    <link rel="stylesheet" href="style.css">' : '';
            let jsScript = js.trim() ? '\n    <script src="script.js"><\/script>' : '';

            indexFile = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported Project</title>${cssLink}
</head>
<body>
${html}${jsScript}
</body>
</html>`;
        }

        const folder = zip.folder('webproject');
        
        // Add HTML file if there's any content or structure
        if (html.trim() || css.trim() || js.trim()) {
            folder.file('index.html', indexFile);
        }
        
        // Only add files if they have code
        if (css.trim()) {
            folder.file('style.css', css);
        }
        if (js.trim()) {
            folder.file('script.js', js);
        }
        
        // Add JSON if user typed something
        const jsonVal = editors.json.getValue();
        if(jsonVal.trim()) {
            folder.file('data.json', jsonVal);
        }

        zip.generateAsync({ type: 'blob' }).then((content) => {
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'webproject.zip';
            a.click();
            URL.revokeObjectURL(url);
        });
    });

    // ==========================================
    // Preview in New Tab Logic (Blob)
    // ==========================================
    document.getElementById('btn-preview-tab').addEventListener('click', () => {
        const html = editors.html.getValue();
        const css = editors.css.getValue();
        const js = editors.js.getValue();

        let combinedHTML = '';
        const isFullHtml = /<html/i.test(html) || /<!doctype/i.test(html);

        if (isFullHtml) {
            combinedHTML = html;
            if (css.trim()) {
                if (/<\/head>/i.test(combinedHTML)) {
                    combinedHTML = combinedHTML.replace(/<\/head>/i, `<style>${css}</style>\n</head>`);
                } else {
                    combinedHTML = `<style>${css}</style>\n` + combinedHTML;
                }
            }
            if (js.trim()) {
                if (/<\/body>/i.test(combinedHTML)) {
                    combinedHTML = combinedHTML.replace(/<\/body>/i, `<script>${js}<\/script>\n</body>`);
                } else {
                    combinedHTML += `\n<script>${js}<\/script>`;
                }
            }
        } else {
            combinedHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview Page</title>
    <style>${css}</style>
</head>
<body>
    ${html}
    <script>${js}<\/script>
</body>
</html>`;
        }

        const blob = new Blob([combinedHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Optional: revoke after some time or let it persist for that tab Session
    });

    // ==========================================
    // Clear Code
    // ==========================================
    document.getElementById('btn-clear').addEventListener('click', () => {
        if(confirm("Are you sure you want to start a new file?")) {
            editors.html.setValue('<h1>Hello, Code Previewer!</h1>\n<p>Edit this code to see live changes.</p>');
            editors.css.setValue('body {\n  background: #f0f4f8;\n  color: #333;\n  font-family: sans-serif;\n  text-align: center;\n}\n\nh1 {\n  color: #0366d6;\n}');
            editors.js.setValue('console.log("Ready to build something awesome?");');
            editors.json.setValue('');
            
            Object.values(editors).forEach(editor => {
                editor.clearHistory();
            });
            updateLivePreview();
        }
    });

    // ==========================================
    // File Upload & Drag-and-Drop
    // ==========================================
    function handleFiles(files) {
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const lowerName = file.name.toLowerCase();
                
                if (lowerName.endsWith('.html')) {
                    editors.html.setValue(content);
                } else if (lowerName.endsWith('.css')) {
                    editors.css.setValue(content);
                } else if (lowerName.endsWith('.js')) {
                    editors.js.setValue(content);
                } else if (lowerName.endsWith('.json')) {
                    editors.json.setValue(content);
                }
            };
            reader.readAsText(file);
        });
    }

    const fileInput = document.getElementById('file-upload');
    fileInput.addEventListener('change', (e) => {
        if(e.target.files.length) {
            // Clear existing data so it opens a new file for editing
            Object.values(editors).forEach(editor => {
                editor.setValue('');
                editor.clearHistory();
            });
            handleFiles(e.target.files);
            e.target.value = ''; // Reset input
        }
    });

    const dragOverlay = document.getElementById('drag-overlay');
    // Using body for drop detection entering
    let dragCounter = 0; // Prevent child element flickering

    document.body.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        dragOverlay.classList.add('active');
    });

    document.body.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            dragOverlay.classList.remove('active');
        }
    });

    document.body.addEventListener('dragover', (e) => {
        e.preventDefault(); // Necessary to allow dropping
    });

    document.body.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        dragOverlay.classList.remove('active');
        
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            // Clear existing data so it opens a new file for editing
            Object.values(editors).forEach(editor => {
                editor.setValue('');
                editor.clearHistory();
            });
            handleFiles(e.dataTransfer.files);
        }
    });

    // ==========================================
    // Theme Toggling
    // ==========================================
    const themeBtn = document.getElementById('btn-theme');
    
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        
        // Switch CodeMirror themes
        const newTheme = isDark ? 'dracula' : 'neo';
        Object.values(editors).forEach(editor => {
            editor.setOption('theme', newTheme);
        });

        // Switch icon
        const sunPath = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
        const moonPath = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        
        themeBtn.querySelector('svg').innerHTML = isDark ? sunPath : moonPath;
    });

    // ==========================================
    // LocalStorage Initialization
    // ==========================================
    function saveToLocal() {
        localStorage.setItem('code_previewer_html', editors.html.getValue());
        localStorage.setItem('code_previewer_css', editors.css.getValue());
        localStorage.setItem('code_previewer_js', editors.js.getValue());
        localStorage.setItem('code_previewer_json', editors.json.getValue());
    }

    function loadFromLocal() {
        const h = localStorage.getItem('code_previewer_html');
        const c = localStorage.getItem('code_previewer_css');
        const j = localStorage.getItem('code_previewer_js');
        const js = localStorage.getItem('code_previewer_json');

        if(h !== null) editors.html.setValue(h);
        else editors.html.setValue('<h1>Hello, Code Previewer!</h1>\n<p>Edit this code to see live changes.</p>');
        
        if(c !== null) editors.css.setValue(c);
        else editors.css.setValue('body {\n  background: #f0f4f8;\n  color: #333;\n  font-family: sans-serif;\n  text-align: center;\n}\n\nh1 {\n  color: #0366d6;\n}');
        
        if(j !== null) editors.js.setValue(j);
        else editors.js.setValue('console.log("Ready to build something awesome?");');
        
        if(js !== null) editors.json.setValue(js);
    }

    // Initialize layout and state
    loadFromLocal();
    setTimeout(() => {
        Object.values(editors).forEach(editor => editor.refresh());
        updateLivePreview();
    }, 100);
});
