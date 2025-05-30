const http = require("http");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const formidable = require("formidable");
const archiver = require("archiver");

const uploadsDir = path.join(__dirname, "uploads");
const outputsDir = path.join(__dirname, "outputs");

// Crear carpetas si no existen
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(outputsDir, { recursive: true });

const server = http.createServer((req, res) => {
  // 🔹 Archivos estáticos
  if (
    req.method === "GET" &&
    req.url.match(/\.(css|js|png|jpg|jpeg|webp|svg)$/)
  ) {
    const filePath = path.join(__dirname, "public", req.url);
    const ext = path.extname(filePath).slice(1);
    const mimeTypes = {
      css: "text/css",
      js: "application/javascript",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      svg: "image/svg+xml",
    };

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        return res.end("Static file not found.");
      }
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
      });
      res.end(content);
    });
    return;
  }

  // 🔹 Página principal
  if (req.method === "GET" && req.url === "/") {
    const filePath = path.join(__dirname, "public", "index.html");
    fs.createReadStream(filePath)
      .on("error", () => {
        res.writeHead(404);
        res.end("HTML file not found.");
      })
      .pipe(res);
    return;
  }

  // 🔹 Conversión de imágenes
  if (req.method === "POST" && req.url === "/convert") {
    const form = new formidable.IncomingForm({
      uploadDir: uploadsDir,
      keepExtensions: true,
      multiples: true,
    });

    form.parse(req, async (err, fields, files) => {
      if (err || !files.image || !Array.isArray(files.image)) {
        res.writeHead(400);
        return res.end("File processing error.");
      }

      const zipPath = path.join(outputsDir, `webp_images_${Date.now()}.zip`);
      const outputZip = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.pipe(outputZip);

      try {
        for (const file of files.image) {
          const inputPath = file.filepath;
          const originalName = path.parse(file.originalFilename).name;
          const outputFileName = `${originalName}.webp`;
          const outputFilePath = path.join(outputsDir, outputFileName);

          const metadata = await sharp(inputPath).metadata();
          if (!metadata.format)
            throw new Error(`Invalid file: ${file.originalFilename}`);

          await sharp(inputPath).webp({ quality: 80 }).toFile(outputFilePath);
          archive.file(outputFilePath, { name: outputFileName });

          await fsPromises.unlink(inputPath).catch(() => {});
        }

        archive.finalize();

        outputZip.on("close", async () => {
          const zipBuffer = await fsPromises.readFile(zipPath);

          res.writeHead(200, {
            "Content-Type": "application/zip",
            "Content-Disposition":
              'attachment; filename="converted_images.zip"',
            "Content-Length": zipBuffer.length,
          });
          res.end(zipBuffer);

          await fsPromises.unlink(zipPath).catch(() => {});
          const leftover = await fsPromises.readdir(outputsDir);
          for (const f of leftover.filter((f) => f.endsWith(".webp"))) {
            await fsPromises.unlink(path.join(outputsDir, f)).catch(() => {});
          }
        });

        archive.on("error", (err) => {
          throw err;
        });
      } catch (e) {
        res.writeHead(500);
        res.end("Internal error converting images.");
      }
    });
    return;
  }

  // 🔹 Eliminación de archivos
  if (req.method === "POST" && req.url === "/clear-data") {
    (async () => {
      const deletedFiles = [];

      const deleteFromDir = async (dir) => {
        try {
          const files = await fsPromises.readdir(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            try {
              await fsPromises.unlink(filePath);
              deletedFiles.push(file);
            } catch (err) {
              console.error(`❌ Could not delete ${filePath}:`, err.message);
            }
          }
        } catch (err) {
          console.error(`❌ Could not read folder ${dir}:`, err.message);
        }
      };

      await deleteFromDir(uploadsDir);
      await deleteFromDir(outputsDir);

      // ✅ Always return valid JSON
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          deleted: deletedFiles.length,
          message:
            deletedFiles.length > 0
              ? `${deletedFiles.length} file(s) deleted from 'uploads' and 'outputs'.`
              : "No files found to delete.",
        })
      );
    })();
    return;
  }

  // 🔹 Ruta no encontrada
  res.writeHead(404);
  res.end("Route not found");
});

server.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
