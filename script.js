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
