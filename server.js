const http = require("http");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { IncomingForm } = require("formidable");
const archiver = require("archiver");

const uploadsDir = path.join(__dirname, "uploads");
const outputsDir = path.join(__dirname, "outputs");

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(outputsDir, { recursive: true });

const cleanDir = async (dir) => {
  try {
    await fsPromises.rm(dir, { recursive: true, force: true });
    await fsPromises.mkdir(dir, { recursive: true });
    console.log(`✅ Cleaned folder ${dir}`);
  } catch (err) {
    console.warn(`⚠️ Failed to remove ${dir}, trying file-by-file:`, err.code);
    try {
      const files = await fsPromises.readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          await fsPromises.unlink(filePath);
          console.log(`🗑️ Deleted ${file}`);
        } catch (fileErr) {
          console.error(`❌ Could not delete ${filePath}:`, fileErr.code);
        }
      }
      await fsPromises.mkdir(dir, { recursive: true });
      console.log(`✅ Folder ${dir} cleaned manually.`);
    } catch (finalErr) {
      console.error(`❌ Final failure cleaning ${dir}:`, finalErr);
    }
  }
};

const server = http.createServer((req, res) => {
  // Archivos estáticos
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

  // Página principal
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

  // Conversión de imágenes
  if (req.method === "POST" && req.url === "/convert") {
    const form = new IncomingForm({
      uploadDir: uploadsDir,
      keepExtensions: true,
      multiples: true,
      maxFiles: 100,
      filename: (name, ext, part, form) => {
        return path.basename(part.originalFilename).replace(/\s+/g, "_");
      },
    });

    form.parse(req, async (err, fields, files) => {
      let imageFiles = files.image;
      if (err || !imageFiles) {
        res.writeHead(400);
        return res.end("File processing error.");
      }

      if (!Array.isArray(imageFiles)) imageFiles = [imageFiles];

      const zipPath = path.join(outputsDir, `webp_images_${Date.now()}.zip`);
      const outputZip = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.pipe(outputZip);

      try {
        for (const file of imageFiles) {
          const inputPath = file.filepath;
          const originalName = path.parse(file.originalFilename).name;
          const outputFileName = `${originalName}.webp`;
          const outputFilePath = path.join(outputsDir, outputFileName);

          const metadata = await sharp(inputPath).metadata();
          if (!metadata.format)
            throw new Error(`Invalid file: ${file.originalFilename}`);

          await sharp(inputPath).webp({ quality: 80 }).toFile(outputFilePath);
          archive.file(outputFilePath, { name: outputFileName });

          // 🔒 Forzar cierre del archivo en Windows
          try {
            await new Promise((resolve, reject) => {
              const s = fs.createReadStream(inputPath);
              s.on("open", () => s.close(resolve));
              s.on("error", reject);
            });
          } catch (closeErr) {
            console.warn(`⚠️ Failed to force-close ${inputPath}:`, closeErr);
          }
        }

        archive.finalize();

        outputZip.on("close", () => {
          res.writeHead(200, {
            "Content-Type": "application/zip",
            "Content-Disposition":
              'attachment; filename="converted_images.zip"',
          });

          const zipStream = fs.createReadStream(zipPath);
          zipStream.pipe(res);

          zipStream.on("end", async () => {
            zipStream.destroy();
            await cleanDir(uploadsDir);
            await cleanDir(outputsDir);
            console.log("🧹 Temporary folders cleaned after download.");
          });
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

  // Limpieza manual
  if (req.method === "POST" && req.url === "/clear-data") {
    (async () => {
      await cleanDir(uploadsDir);
      await cleanDir(outputsDir);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          deleted: 1,
          message: "✅ Uploads and outputs were deleted and recreated.",
        })
      );
    })();
    return;
  }

  // Ruta no encontrada
  res.writeHead(404);
  res.end("Route not found");
});

server.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
