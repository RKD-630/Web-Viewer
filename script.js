function downloadProject() {
  const zip = new JSZip();

  // Create files
  zip.file("index.html", `
<!DOCTYPE html>
<html>
<head>
  <title>My Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
${htmlCode.value}
<script src="script.js"><\/script>
</body>
</html>
  `);

  zip.file("style.css", cssCode.value);
  zip.file("script.js", jsCode.value);

  // Generate zip
  zip.generateAsync({ type: "blob" }).then(function(content) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "webproject.zip";
    link.click();
  });
}

async function saveToFolder() {
  try {
    // Ask user to pick a folder
    const dirHandle = await window.showDirectoryPicker();

    // 📄 index.html
    const htmlHandle = await dirHandle.getFileHandle("index.html", { create: true });
    const htmlWritable = await htmlHandle.createWritable();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>My Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
${htmlCode.value}
<script src="script.js"><\/script>
</body>
</html>
    `;

    await htmlWritable.write(htmlContent);
    await htmlWritable.close();

    // 🎨 style.css
    const cssHandle = await dirHandle.getFileHandle("style.css", { create: true });
    const cssWritable = await cssHandle.createWritable();
    await cssWritable.write(cssCode.value);
    await cssWritable.close();

    // ⚙️ script.js
    const jsHandle = await dirHandle.getFileHandle("script.js", { create: true });
    const jsWritable = await jsHandle.createWritable();
    await jsWritable.write(jsCode.value);
    await jsWritable.close();

    alert("Project saved to folder ✅");

  } catch (err) {
    alert("Error or permission denied ❌");
    console.error(err);
  }
}
function shareProject() {
  const project = {
    html: htmlCode.value,
    css: cssCode.value,
    js: jsCode.value
  };

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(project))));
  const url = `${location.origin}${location.pathname}?project=${encoded}`;

  navigator.clipboard.writeText(url);

  alert("Share link copied ✅");
}
