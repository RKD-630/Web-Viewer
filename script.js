// ==================== GLOBAL VARIABLES ====================
        let htmlEditor, cssEditor, jsEditor;
        let editMode = false;
        let inspectMode = false;
        let mobileCoding = false;
        let currentTab = 'html';
        let historyStack = { html: [], css: [], javascript: [] };
        let historyIndex = { html: -1, css: -1, javascript: -1 };
        let selectedElement = null;
        let currentImageFilter = { brightness: 100, contrast: 100, sharpness: 100, hue: 0 };

        // ==================== INITIALIZE EDITORS ====================
        document.addEventListener('DOMContentLoaded', function() {
            // HTML Editor
            htmlEditor = CodeMirror.fromTextArea(document.getElementById('htmlCode'), {
                mode: 'htmlmixed',
                theme: 'dracula',
                lineNumbers: true,
                autoCloseTags: true,
                autoCloseBrackets: true,
                matchBrackets: true,
                indentUnit: 2,
                tabSize: 2,
                lineWrapping: true
            });

            // CSS Editor
            cssEditor = CodeMirror.fromTextArea(document.getElementById('cssCode'), {
                mode: 'css',
                theme: 'dracula',
                lineNumbers: true,
                autoCloseBrackets: true,
                matchBrackets: true,
                indentUnit: 2,
                tabSize: 2,
                lineWrapping: true
            });

            // JavaScript Editor
            jsEditor = CodeMirror.fromTextArea(document.getElementById('javascriptCode'), {
                mode: 'javascript',
                theme: 'dracula',
                lineNumbers: true,
                autoCloseBrackets: true,
                matchBrackets: true,
                indentUnit: 2,
                tabSize: 2,
                lineWrapping: true
            });

            // Save initial state to history
            saveToHistory('html');
            saveToHistory('css');
            saveToHistory('javascript');

            // Update preview on change
            htmlEditor.on('change', function() {
                saveToHistory('html');
                updatePreview();
            });
            cssEditor.on('change', function() {
                saveToHistory('css');
                updatePreview();
            });
            jsEditor.on('change', function() {
                saveToHistory('javascript');
                updatePreview();
            });

            // Add cursorActivity listeners for color preview
            htmlEditor.on('cursorActivity', handleColorPreview);
            cssEditor.on('cursorActivity', handleColorPreview);
            jsEditor.on('cursorActivity', handleColorPreview);

            // Initial preview
            updatePreview();
        });

        // ==================== COLOR PREVIEW ====================
        function handleColorPreview(cm) {
            let tooltip = document.getElementById('colorPreviewTooltip');
            if (!tooltip) return;

            let selectedText = cm.getSelection().trim();
            if (!selectedText) {
                tooltip.style.display = 'none';
                return;
            }

            let colorRegex = /^(#([0-9a-fA-F]{3}){1,2}|(rgb|hsl)a?\([\d\s,%.]+\)|red|blue|green|yellow|black|white|purple|orange|pink|gray|cyan|magenta|transparent)$/i;
            
            if (colorRegex.test(selectedText)) {
                let cursor = cm.getCursor('to');
                let coords = cm.charCoords(cursor, 'window');
                
                tooltip.style.backgroundColor = selectedText;
                tooltip.style.display = 'block';
                tooltip.style.left = (coords.right + 10) + 'px';
                tooltip.style.top = (coords.top - 15) + 'px';
            } else {
                tooltip.style.display = 'none';
            }
        }

        // ==================== TAB SWITCHING ====================
        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.code-editor').forEach(e => e.classList.remove('active'));

            event.target.classList.add('active');
            document.getElementById(tab + 'Editor').classList.add('active');
            
            // Refresh editor to fix sizing issues when unhidden
            setTimeout(() => {
                let editor = getEditor(tab);
                if (editor) editor.refresh();
            }, 10);
        }

        // ==================== HISTORY (UNDO/REDO) ====================
        function saveToHistory(type) {
            let editor = getEditor(type);
            let content = editor.getValue();
            
            if (historyIndex[type] < historyStack[type].length - 1) {
                historyStack[type] = historyStack[type].slice(0, historyIndex[type] + 1);
            }
            
            historyStack[type].push(content);
            historyIndex[type] = historyStack[type].length - 1;

            // Limit history size
            if (historyStack[type].length > 100) {
                historyStack[type].shift();
                historyIndex[type]--;
            }
        }

        function getEditor(type) {
            switch(type) {
                case 'html': return htmlEditor;
                case 'css': return cssEditor;
                case 'javascript': return jsEditor;
            }
        }

        function getCurrentType() {
            return currentTab;
        }

        function undoCode() {
            let type = getCurrentType();
            let editor = getEditor(type);
            
            if (historyIndex[type] > 0) {
                historyIndex[type]--;
                editor.setValue(historyStack[type][historyIndex[type]]);
            }
        }

        function redoCode() {
            let type = getCurrentType();
            let editor = getEditor(type);
            
            if (historyIndex[type] < historyStack[type].length - 1) {
                historyIndex[type]++;
                editor.setValue(historyStack[type][historyIndex[type]]);
            }
        }

        // ==================== LIVE PREVIEW ====================
        function updatePreview() {
            let html = htmlEditor.getValue();
            let css = cssEditor.getValue();
            let js = jsEditor.getValue();

            // Inject CSS into HTML if not already present
            if (html.includes('</head>')) {
                html = html.replace('</head>', `<style>${css}</style></head>`);
            } else if (html.includes('<body>')) {
                html = html.replace('<body>', `<style>${css}</style><body>`);
            } else {
                html = `<style>${css}</style>` + html;
            }

            // Inject JS
            if (html.includes('</body>')) {
                html = html.replace('</body>', `<script>${js}<\/script></body>`);
            } else {
                html += `<script>${js}<\/script>`;
            }

            const frame = document.getElementById('previewFrame');
            const doc = frame.contentDocument || frame.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();

            // Add inspect mode listeners if active
            if (inspectMode) {
                enableInspectMode();
            }

            // Add edit mode listeners if active
            if (editMode) {
                enableEditMode();
            }
        }

        // ==================== SEARCH FUNCTIONALITY ====================
        function toggleSearch() {
            document.getElementById('searchBar').classList.toggle('active');
            if (document.getElementById('searchBar').classList.contains('active')) {
                document.getElementById('searchInput').focus();
            }
        }

        function closeSearch() {
            document.getElementById('searchBar').classList.remove('active');
            document.getElementById('searchInput').value = '';
            document.getElementById('searchCount').textContent = '';
            clearSearchHighlights();
        }

        function searchInCode(e) {
            if (e.key === 'Enter') {
                findText();
            }
        }

        function findText() {
            let searchTerm = document.getElementById('searchInput').value;
            if (!searchTerm) {
                document.getElementById('searchCount').textContent = '';
                return;
            }

            let editor = getEditor(currentTab);
            let content = editor.getValue();
            let regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            let matches = content.match(regex);
            let count = matches ? matches.length : 0;

            document.getElementById('searchCount').textContent = `${count} match${count !== 1 ? 'es' : ''} found`;

            // Clear previous highlights
            clearSearchHighlights();

            // Highlight matches
            if (count > 0) {
                let cursor = editor.getSearchCursor(searchTerm, { line: 0, ch: 0 }, { caseFold: true });
                let marks = [];
                
                while (cursor.findNext()) {
                    marks.push(editor.markText(cursor.from(), cursor.to(), {
                        className: 'cm-search-highlight'
                    }));
                }

                // Scroll to first match
                if (marks.length > 0) {
                    let firstCursor = editor.getSearchCursor(searchTerm, { line: 0, ch: 0 }, { caseFold: true });
                    if (firstCursor.findNext()) {
                        editor.setSelection(firstCursor.from(), firstCursor.to());
                        editor.scrollIntoView({ from: firstCursor.from(), to: firstCursor.to() }, 100);
                    }
                }
            }
        }

        function clearSearchHighlights() {
            let editor = getEditor(currentTab);
            // CodeMirror doesn't have a direct way to clear marks, 
            // so we rely on the built-in search highlighting
        }

        // ==================== FORMAT CODE ====================
        function formatCode() {
            let editor = getEditor(currentTab);
            let content = editor.getValue();
            
            if (currentTab === 'html') {
                content = formatHTML(content);
            } else if (currentTab === 'css') {
                content = formatCSS(content);
            } else if (currentTab === 'javascript') {
                content = formatJS(content);
            }
            
            editor.setValue(content);
        }

        function formatHTML(html) {
            let formatted = '';
            let indent = '';
            html.split(/>\s*</).forEach(function(element) {
                if (element.match(/^\/\w/)) {
                    indent = indent.substring(2);
                }
                formatted += indent + '<' + element + '>\r\n';
                if (element.match(/^<?\w[^>]*[^\/]$/) && !element.startsWith("input") && !element.startsWith("img") && !element.startsWith("br") && !element.startsWith("hr") && !element.startsWith("meta") && !element.startsWith("link")) {
                    indent += '  ';
                }
            });
            return formatted.substring(1, formatted.length - 3);
        }

        function formatCSS(css) {
            return css.replace(/\s*{\s*/g, ' {\n  ')
                     .replace(/\s*}\s*/g, '\n}\n\n')
                     .replace(/;\s*/g, ';\n  ')
                     .replace(/\n\s*\n/g, '\n');
        }

        function formatJS(js) {
            return js; // Basic formatting - could be enhanced
        }

        // ==================== DEVICE VIEW ====================
        let currentDeviceIndex = 0;
        const devices = [
            { name: 'desktop', icon: 'fa-desktop', label: 'Desktop' },
            { name: 'tablet', icon: 'fa-tablet-alt', label: 'Tablet' },
            { name: 'mobile', icon: 'fa-mobile-alt', label: 'Mobile' }
        ];

        function toggleDeviceView() {
            currentDeviceIndex = (currentDeviceIndex + 1) % devices.length;
            let device = devices[currentDeviceIndex];
            let nextDevice = devices[(currentDeviceIndex + 1) % devices.length];

            let wrapper = document.getElementById('previewWrapper');
            wrapper.className = 'preview-frame-wrapper ' + device.name;
            
            let btn = document.getElementById('toggleDeviceBtn');
            btn.innerHTML = `<i class="fas ${device.icon}"></i> ${device.label}`;
            btn.setAttribute('title', `Switch to ${nextDevice.label} View`);
        }

        // ==================== NEW PROJECT ====================
        function newProject() {
            if (confirm('Create a new project? Current work will be cleared.')) {
                htmlEditor.setValue(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Project</title>
</head>
<body>
    <h1>Hello World!</h1>
</body>
</html>`);
                cssEditor.setValue(`body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background: #f5f5f5;
}`);
                jsEditor.setValue(`// JavaScript code here
console.log('New project created!');`);

                updatePreview();
            }
        }

        // ==================== IMPORT ====================
        function importFile() {
            document.getElementById('importModal').classList.add('active');
        }

        function closeImportModal() {
            document.getElementById('importModal').classList.remove('active');
        }

        function importAsHTML() {
            let code = document.getElementById('importCode').value;
            htmlEditor.setValue(code);
            closeImportModal();
            updatePreview();
        }

        function importAsCSS() {
            let code = document.getElementById('importCode').value;
            cssEditor.setValue(code);
            closeImportModal();
            updatePreview();
        }

        function importAsJS() {
            let code = document.getElementById('importCode').value;
            jsEditor.setValue(code);
            closeImportModal();
            updatePreview();
        }

        function handleFileUpload(event) {
            let file = event.target.files[0];
            if (!file) return;

            let reader = new FileReader();
            reader.onload = function(e) {
                let content = e.target.result;
                let ext = file.name.split('.').pop().toLowerCase();

                if (ext === 'html' || ext === 'htm') {
                    htmlEditor.setValue(content);
                } else if (ext === 'css') {
                    cssEditor.setValue(content);
                } else if (ext === 'js') {
                    jsEditor.setValue(content);
                } else {
                    htmlEditor.setValue(content);
                }

                closeImportModal();
                updatePreview();
            };
            reader.readAsText(file);
        }

        function handleProjectFileUpload(event) {
            let file = event.target.files[0];
            if (!file) return;

            let reader = new FileReader();
            reader.onload = function(e) {
                let content = e.target.result;
                let ext = file.name.split('.').pop().toLowerCase();

                if (ext === 'html' || ext === 'htm') {
                    htmlEditor.setValue(content);
                } else if (ext === 'css') {
                    cssEditor.setValue(content);
                } else if (ext === 'js') {
                    jsEditor.setValue(content);
                }

                updatePreview();
            };
            reader.readAsText(file);
        }

        // ==================== EXPORT ====================
        function exportHTML() {
            let html = htmlEditor.getValue();
            let css = cssEditor.getValue();
            let js = jsEditor.getValue();

            // Combine into single HTML file
            let fullHTML = html;
            if (fullHTML.includes('</head>')) {
                fullHTML = fullHTML.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
            } else if (fullHTML.includes('<body>')) {
                fullHTML = fullHTML.replace('<body>', `<style>\n${css}\n</style>\n<body>`);
            } else {
                fullHTML = `<style>\n${css}\n</style>\n` + fullHTML;
            }

            if (fullHTML.includes('</body>')) {
                fullHTML = fullHTML.replace('</body>', `<script>\n${js}\n<\/script>\n</body>`);
            } else {
                fullHTML += `\n<script>\n${js}\n<\/script>`;
            }

            let blob = new Blob([fullHTML], { type: 'text/html' });
            saveAs(blob, 'Vikyweb.html');
        }

        async function exportZIP() {
            let zip = new JSZip();
            
            let html = htmlEditor.getValue();
            
            // Auto-link CSS if not present
            if (!html.includes('style.css')) {
                if (html.includes('</head>')) {
                    html = html.replace('</head>', '    <link rel="stylesheet" href="style.css">\n</head>');
                } else if (html.includes('<body>')) {
                    html = html.replace('<body>', '    <link rel="stylesheet" href="style.css">\n<body>');
                } else {
                    html = '<link rel="stylesheet" href="style.css">\n' + html;
                }
            }
            
            // Auto-link JS if not present
            if (!html.includes('script.js')) {
                if (html.includes('</body>')) {
                    html = html.replace('</body>', '    <script src="script.js"><\/script>\n</body>');
                } else {
                    html += '\n<script src="script.js"><\/script>';
                }
            }

            zip.file('index.html', html);
            zip.file('style.css', cssEditor.getValue());
            zip.file('script.js', jsEditor.getValue());

            let content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, 'Vikyweb.zip');
        }

        // ==================== INSPECT ELEMENT ====================
        function toggleInspect() {
            inspectMode = !inspectMode;
            document.getElementById('inspectBtn').classList.toggle('active', inspectMode);
            document.getElementById('inspectPanel').classList.toggle('active', inspectMode);

            if (inspectMode) {
                enableInspectMode();
            } else {
                disableInspectMode();
            }
        }

        function enableInspectMode() {
            let frame = document.getElementById('previewFrame');
            let doc = frame.contentDocument || frame.contentWindow.document;

            doc.querySelectorAll('*').forEach(el => {
                el.addEventListener('mouseenter', inspectHighlight);
                el.addEventListener('mouseleave', inspectUnhighlight);
                el.addEventListener('click', inspectClick, true);
            });
        }

        function disableInspectMode() {
            let frame = document.getElementById('previewFrame');
            let doc = frame.contentDocument || frame.contentWindow.document;

            doc.querySelectorAll('*').forEach(el => {
                el.removeEventListener('mouseenter', inspectHighlight);
                el.removeEventListener('mouseleave', inspectUnhighlight);
                el.removeEventListener('click', inspectClick, true);
                el.style.outline = '';
            });
        }

        function inspectHighlight(e) {
            e.target.style.outline = '2px solid #e94560';
        }

        function inspectUnhighlight(e) {
            e.target.style.outline = '';
        }

        function inspectClick(e) {
            e.preventDefault();
            e.stopPropagation();
            
            let el = e.target;
            let info = `
<strong>Element:</strong> ${el.tagName.toLowerCase()}
<strong>Class:</strong> ${el.className || '(none)'}
<strong>ID:</strong> ${el.id || '(none)'}
<strong>Dimensions:</strong> ${el.offsetWidth}x${el.offsetHeight}
<strong>Position:</strong> ${el.offsetTop}px from top
<strong>Styles:</strong>
${Object.entries(window.getComputedStyle(el)).slice(0, 30).map(([k, v]) => `${k}: ${v}`).join('\n')}
<strong>InnerHTML:</strong>
${el.innerHTML.substring(0, 200)}...
            `;
            
            document.getElementById('inspectInfo').innerHTML = `<pre>${info}</pre>`;
        }

        // ==================== EDIT MODE ====================
        function toggleEditMode() {
            editMode = !editMode;
            document.getElementById('editBtn').classList.toggle('active', editMode);
            document.getElementById('propertiesPanel').classList.toggle('active', editMode);

            if (editMode) {
                enableEditMode();
            } else {
                disableEditMode();
            }
        }

        function enableEditMode() {
            let frame = document.getElementById('previewFrame');
            let doc = frame.contentDocument || frame.contentWindow.document;

            doc.body.contentEditable = 'true';
            doc.designMode = 'on';

            doc.querySelectorAll('*').forEach(el => {
                el.addEventListener('click', selectElement, true);
                el.style.cursor = 'pointer';
            });
        }

        function disableEditMode() {
            let frame = document.getElementById('previewFrame');
            let doc = frame.contentDocument || frame.contentWindow.document;

            doc.body.contentEditable = 'false';
            doc.designMode = 'off';

            doc.querySelectorAll('*').forEach(el => {
                el.removeEventListener('click', selectElement, true);
                el.style.cursor = '';
                el.style.outline = '';
            });
        }

        function selectElement(e) {
            if (!editMode) return;
            e.preventDefault();
            e.stopPropagation();

            // Remove previous selection
            if (selectedElement) {
                selectedElement.style.outline = '';
            }

            selectedElement = e.target;
            selectedElement.style.outline = '3px solid #e94560';

            // Update properties panel based on element type
            updatePropertiesForElement(selectedElement);
        }

        function updatePropertiesForElement(el) {
            let styles = window.getComputedStyle(el);
            let tagName = el.tagName.toLowerCase();

            // Show/hide relevant sections
            document.getElementById('textProperties').style.display = 
                ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'div', 'li', 'td'].includes(tagName) ? 'block' : 'none';
            
            document.getElementById('imageProperties').style.display = 
                tagName === 'img' ? 'block' : 'none';
            
            document.getElementById('buttonProperties').style.display = 
                (tagName === 'button' || tagName === 'a' || el.classList.contains('cta-button')) ? 'block' : 'none';

            // Populate text properties
            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'div', 'li', 'td'].includes(tagName)) {
                document.getElementById('fontFamily').value = styles.fontFamily.replace(/"/g, '').split(',')[0].trim();
                document.getElementById('textSize').value = parseInt(styles.fontSize);
                document.getElementById('textColor1').value = rgbToHex(styles.color);
                
                document.getElementById('boldBtn').classList.toggle('active', styles.fontWeight >= 700);
                document.getElementById('italicBtn').classList.toggle('active', styles.fontStyle === 'italic');
                document.getElementById('underlineBtn').classList.toggle('active', styles.textDecoration.includes('underline'));
            }

            // Populate image properties
            if (tagName === 'img') {
                let filter = styles.filter;
                // Parse filter values
            }

            // Populate button properties
            if (tagName === 'button' || tagName === 'a') {
                document.getElementById('btnBgColor1').value = rgbToHex(styles.backgroundColor);
                document.getElementById('btnRadius').value = parseInt(styles.borderRadius) || 0;
                document.getElementById('btnRadiusVal').textContent = (parseInt(styles.borderRadius) || 0) + 'px';
            }
        }

        // ==================== TEXT PROPERTIES ====================
        function applyTextProperty(prop, value) {
            if (!selectedElement) return;
            selectedElement.style[prop] = value;
            syncToEditor();
        }

        function toggleStyle(style) {
            if (!selectedElement) return;
            
            switch(style) {
                case 'bold':
                    selectedElement.style.fontWeight = selectedElement.style.fontWeight === 'bold' || selectedElement.style.fontWeight >= 700 ? 'normal' : 'bold';
                    document.getElementById('boldBtn').classList.toggle('active');
                    break;
                case 'italic':
                    selectedElement.style.fontStyle = selectedElement.style.fontStyle === 'italic' ? 'normal' : 'italic';
                    document.getElementById('italicBtn').classList.toggle('active');
                    break;
                case 'underline':
                    selectedElement.style.textDecoration = selectedElement.style.textDecoration === 'underline' ? 'none' : 'underline';
                    document.getElementById('underlineBtn').classList.toggle('active');
                    break;
            }
            syncToEditor();
        }

        function updateTextShadow() {
            if (!selectedElement) return;
            let blur = document.getElementById('textShadowBlur').value;
            if (blur > 0) {
                selectedElement.style.textShadow = `${blur/10}px ${blur/10}px ${blur}px rgba(0,0,0,0.5)`;
            } else {
                selectedElement.style.textShadow = 'none';
            }
            syncToEditor();
        }

        function updateTextColor() {
            if (!selectedElement) return;
            let isGradient = document.getElementById('textGradient').checked;
            let color1 = document.getElementById('textColor1').value;
            let color2 = document.getElementById('textColor2').value;

            if (isGradient) {
                selectedElement.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
                selectedElement.style.webkitBackgroundClip = 'text';
                selectedElement.style.webkitTextFillColor = 'transparent';
                selectedElement.style.backgroundClip = 'text';
            } else {
                selectedElement.style.background = '';
                selectedElement.style.webkitBackgroundClip = '';
                selectedElement.style.webkitTextFillColor = '';
                selectedElement.style.backgroundClip = '';
                selectedElement.style.color = color1;
            }
            syncToEditor();
        }

        function updateBgColor() {
            if (!selectedElement) return;
            let isGradient = document.getElementById('bgGradient').checked;
            let isTransparent = document.getElementById('bgTransparent').checked;
            let color1 = document.getElementById('bgColor1').value;
            let color2 = document.getElementById('bgColor2').value;

            if (isTransparent) {
                selectedElement.style.background = 'transparent';
            } else if (isGradient) {
                selectedElement.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
            } else {
                selectedElement.style.background = color1;
            }
            syncToEditor();
        }

        function applyAlignment(align) {
            if (!selectedElement) return;
            selectedElement.style.textAlign = align;
            
            document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
            event.target.closest('.align-btn').classList.add('active');
            
            syncToEditor();
        }

        // ==================== TEXT TEMPLATES ====================
        function applyTextTemplate(template) {
            if (!selectedElement) return;

            switch(template) {
                case 'gradient':
                    selectedElement.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
                    selectedElement.style.webkitBackgroundClip = 'text';
                    selectedElement.style.webkitTextFillColor = 'transparent';
                    selectedElement.style.backgroundClip = 'text';
                    break;
                case 'shadow':
                    selectedElement.style.textShadow = '3px 3px 6px rgba(0,0,0,0.5)';
                    break;
                case 'outline':
                    selectedElement.style.webkitTextStroke = '1px #333';
                    selectedElement.style.color = 'transparent';
                    break;
                case 'glow':
                    selectedElement.style.textShadow = '0 0 10px #667eea, 0 0 20px #667eea, 0 0 30px #667eea';
                    break;
                case '3d':
                    selectedElement.style.textShadow = '1px 1px 0 #999, 2px 2px 0 #888, 3px 3px 0 #777, 4px 4px 0 #666';
                    break;
                case 'neon':
                    selectedElement.style.textShadow = '0 0 5px #fff, 0 0 10px #fff, 0 0 20px #667eea, 0 0 30px #667eea, 0 0 40px #667eea';
                    selectedElement.style.color = '#fff';
                    break;
            }
            syncToEditor();
        }

        // ==================== IMAGE PROPERTIES ====================
        function importImage() {
            document.getElementById('imageInput').click();
        }

        function handleImageUpload(event) {
            let file = event.target.files[0];
            if (!file || !selectedElement || selectedElement.tagName !== 'IMG') return;

            let reader = new FileReader();
            reader.onload = function(e) {
                selectedElement.src = e.target.result;
                syncToEditor();
            };
            reader.readAsDataURL(file);
        }

        function applyImageFilter(type, value) {
            if (!selectedElement || selectedElement.tagName !== 'IMG') return;

            currentImageFilter[type] = value;
            
            let brightness = currentImageFilter.brightness;
            let contrast = currentImageFilter.contrast;
            let sharpness = currentImageFilter.sharpness;
            let hue = currentImageFilter.hue;

            selectedElement.style.filter = `brightness(${brightness}%) contrast(${contrast}%) hue-rotate(${hue}deg)`;
            
            if (sharpness != 100) {
                // Note: sharpness requires SVG filter or canvas manipulation
                // Using CSS filter as approximation
            }
        }

        function cropImage() {
            if (!selectedElement || selectedElement.tagName !== 'IMG') return;
            
            let clipValue = prompt('Enter clip percentage (e.g., 10% 20% 10% 20% for top right bottom left):', '0% 0% 0% 0%');
            if (clipValue) {
                selectedElement.style.clipPath = `inset(${clipValue})`;
                syncToEditor();
            }
        }

        function applyImageFrame(frame) {
            if (!selectedElement) return;

            switch(frame) {
                case 'rounded':
                    selectedElement.style.borderRadius = '15px';
                    selectedElement.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
                    break;
                case 'circle':
                    selectedElement.style.borderRadius = '50%';
                    selectedElement.style.objectFit = 'cover';
                    break;
                case 'polaroid':
                    selectedElement.style.padding = '15px 15px 50px 15px';
                    selectedElement.style.background = 'white';
                    selectedElement.style.boxShadow = '0 5px 20px rgba(0,0,0,0.3)';
                    selectedElement.style.borderRadius = '0';
                    break;
                case 'shadow':
                    selectedElement.style.boxShadow = '0 10px 30px rgba(0,0,0,0.4)';
                    selectedElement.style.borderRadius = '8px';
                    break;
                case 'border':
                    selectedElement.style.border = '5px solid #e94560';
                    selectedElement.style.borderRadius = '8px';
                    break;
                case 'none':
                    selectedElement.style.borderRadius = '';
                    selectedElement.style.boxShadow = '';
                    selectedElement.style.padding = '';
                    selectedElement.style.background = '';
                    selectedElement.style.border = '';
                    break;
            }
            syncToEditor();
        }

        // ==================== BUTTON PROPERTIES ====================
        function updateButtonStyle() {
            if (!selectedElement) return;

            let isGradient = document.getElementById('btnGradient').checked;
            let color1 = document.getElementById('btnBgColor1').value;
            let color2 = document.getElementById('btnBgColor2').value;
            let radius = document.getElementById('btnRadius').value;
            let size = document.getElementById('btnSize').value;
            let padding = document.getElementById('btnPadding').value;

            document.getElementById('btnRadiusVal').textContent = radius + 'px';

            if (isGradient) {
                selectedElement.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
            } else {
                selectedElement.style.background = color1;
            }

            selectedElement.style.borderRadius = radius + 'px';
            selectedElement.style.fontSize = size + 'px';
            selectedElement.style.padding = padding + 'px ' + (padding * 2) + 'px';

            syncToEditor();
        }

        function applyButtonTemplate(template) {
            if (!selectedElement) return;

            switch(template) {
                case 'primary':
                    selectedElement.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
                    selectedElement.style.color = 'white';
                    selectedElement.style.border = 'none';
                    selectedElement.style.borderRadius = '25px';
                    selectedElement.style.padding = '12px 25px';
                    selectedElement.style.fontWeight = 'bold';
                    break;
                case 'outline':
                    selectedElement.style.background = 'transparent';
                    selectedElement.style.color = '#667eea';
                    selectedElement.style.border = '2px solid #667eea';
                    selectedElement.style.borderRadius = '25px';
                    selectedElement.style.padding = '10px 23px';
                    break;
                case 'rounded':
                    selectedElement.style.borderRadius = '50px';
                    selectedElement.style.padding = '15px 30px';
                    break;
                case 'square':
                    selectedElement.style.borderRadius = '0';
                    selectedElement.style.padding = '10px 20px';
                    break;
                case 'ghost':
                    selectedElement.style.background = 'rgba(102, 126, 234, 0.1)';
                    selectedElement.style.color = '#667eea';
                    selectedElement.style.border = 'none';
                    selectedElement.style.borderRadius = '8px';
                    break;
                case 'gradient':
                    selectedElement.style.background = 'linear-gradient(135deg, #f093fb, #f5576c)';
                    selectedElement.style.color = 'white';
                    selectedElement.style.border = 'none';
                    selectedElement.style.borderRadius = '30px';
                    break;
            }
            syncToEditor();
        }

        // ==================== MOBILE CODING ====================
        function toggleMobileCoding() {
            mobileCoding = !mobileCoding;
            document.getElementById('mobileBtn').classList.toggle('active', mobileCoding);
            document.getElementById('mobileCodingPanel').classList.toggle('active', mobileCoding);
        }

        function applyMobileCode() {
            let mobileCSS = document.getElementById('mobileCode').value;
            let currentCSS = cssEditor.getValue();

            // Check if mobile media query already exists
            if (currentCSS.includes('@media (max-width: 768px)')) {
                // Replace existing mobile styles
                let regex = /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*\}/;
                currentCSS = currentCSS.replace(regex, mobileCSS);
            } else {
                currentCSS += '\n\n' + mobileCSS;
            }

            cssEditor.setValue(currentCSS);
            updatePreview();
            
            // Show confirmation
            showNotification('Mobile styles applied!');
        }

        // ==================== SYNC CHANGES TO EDITOR ====================
        function syncToEditor() {
            // This function would sync visual changes back to the code editor
            // For a full implementation, you'd need to parse the HTML and update the CSS
            // This is a simplified version that updates the preview
            
            updatePreview();
        }

        // ==================== UTILITY FUNCTIONS ====================
        function rgbToHex(rgb) {
            if (rgb.startsWith('#')) return rgb;
            let match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (!match) return '#000000';
            return '#' + 
                parseInt(match[1]).toString(16).padStart(2, '0') +
                parseInt(match[2]).toString(16).padStart(2, '0') +
                parseInt(match[3]).toString(16).padStart(2, '0');
        }

        function showNotification(message) {
            let notif = document.createElement('div');
            notif.style.cssText = `
                position: fixed;
                top: 60px;
                right: 20px;
                background: linear-gradient(135deg, #533483, #e94560);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                z-index: 1000;
                font-size: 14px;
                animation: slideIn 0.3s ease;
            `;
            notif.textContent = message;
            document.body.appendChild(notif);
            
            setTimeout(() => {
                notif.style.opacity = '0';
                notif.style.transition = 'opacity 0.3s';
                setTimeout(() => notif.remove(), 300);
            }, 2000);
        }

        function togglePreview() {
            updatePreview();
            
            let modal = document.getElementById('fullPagePreviewModal');
            let frame = document.getElementById('fullPreviewFrame');
            
            let html = htmlEditor.getValue();
            let css = cssEditor.getValue();
            let js = jsEditor.getValue();

            if (html.includes('</head>')) {
                html = html.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
            } else if (html.includes('<body>')) {
                html = html.replace('<body>', `<style>\n${css}\n</style>\n<body>`);
            } else {
                html = `<style>\n${css}\n</style>\n` + html;
            }

            if (html.includes('</body>')) {
                html = html.replace('</body>', `<script>\n${js}\n<\/script>\n</body>`);
            } else {
                html += `\n<script>\n${js}\n<\/script>`;
            }

            modal.style.display = 'block';
            let doc = frame.contentDocument || frame.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();
        }

        let editModeFull = false;
        function toggleEditModeFull() {
            editModeFull = !editModeFull;
            let btn = document.getElementById('editBtnFull');
            
            if (editModeFull) {
                btn.style.display = 'none';
            } else {
                btn.style.display = 'flex';
            }
            
            let panel = document.getElementById('propertiesPanel');
            panel.classList.toggle('active', editModeFull);
            panel.style.zIndex = editModeFull ? '100001' : '';
            
            let frame = document.getElementById('fullPreviewFrame');
            let doc = frame.contentDocument || frame.contentWindow.document;

            doc.body.contentEditable = editModeFull ? 'true' : 'false';
            doc.designMode = editModeFull ? 'on' : 'off';

            if (editModeFull) {
                doc.querySelectorAll('*').forEach(el => {
                    el.addEventListener('click', selectElement, true);
                    el.style.cursor = 'pointer';
                });
            } else {
                doc.querySelectorAll('*').forEach(el => {
                    el.removeEventListener('click', selectElement, true);
                    el.style.cursor = '';
                    el.style.outline = '';
                });
                if (selectedElement) {
                    selectedElement.style.outline = '';
                    selectedElement = null;
                }
            }
        }

        function closeFullPreview() {
            document.getElementById('fullPagePreviewModal').style.display = 'none';
            if (editModeFull) {
                toggleEditModeFull();
            }
        }

        function closeProperties() {
            if (typeof editMode !== 'undefined' && editMode) {
                toggleEditMode();
            }
            if (typeof editModeFull !== 'undefined' && editModeFull) {
                toggleEditModeFull();
            }
        }

        // Add animation styles
        let style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .cm-search-highlight {
                background: #e94560 !important;
                color: white !important;
            }
        `;
        document.head.appendChild(style);