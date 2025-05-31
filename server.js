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
    const files = await fsPromises.readdir(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        await fsPromises.unlink(filePath);
        console.log(`🗑️ Deleted ${file}`);
      } catch (err) {
        console.error(`❌ Cannot delete ${filePath}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(`❌ Cannot read directory ${dir}: ${err.message}`);
  }
};

const server = http.createServer((req, res) => {
  if (
    req.method === "GET" &&
    req.url.match(/\.(css|js|png|jpg|jpeg|webp|svg|ico)$/)
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
      ico: "image/x-icon",
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

  if (req.method === "POST" && req.url === "/convert") {
    const form = new IncomingForm({
      uploadDir: uploadsDir,
      keepExtensions: true,
      multiples: true,
      maxFiles: 100,
      filename: (name, ext, part) =>
        path.basename(part.originalFilename).replace(/\s+/g, "_"),
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

          try {
            await sharp(inputPath).webp({ quality: 80 }).toFile(outputFilePath);
            archive.file(outputFilePath, { name: outputFileName });
          } catch (err) {
            console.error(
              `❌ Failed to convert ${file.originalFilename}: ${err.message}`
            );
          }

          try {
            await fsPromises.unlink(inputPath);
          } catch (err) {
            console.warn(`⚠️ Could not remove temp upload: ${inputPath}`);
          }
        }

        archive.finalize();

        outputZip.on("close", async () => {
          res.writeHead(200, {
            "Content-Type": "application/zip",
            "Content-Disposition":
              'attachment; filename="converted_images.zip"',
          });

          const stream = fs.createReadStream(zipPath);
          stream.pipe(res);

          stream.on("close", async () => {
            await cleanDir(uploadsDir);
            await cleanDir(outputsDir);
            console.log("🧹 Uploads and outputs cleaned.");
          });
        });

        archive.on("error", (err) => {
          console.error("❌ Archiver error:", err.message);
          res.writeHead(500);
          res.end("Error creating archive.");
        });
      } catch (e) {
        console.error("❌ Unexpected error:", e.message);
        res.writeHead(500);
        res.end("Internal error.");
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/clear-data") {
    (async () => {
      await cleanDir(uploadsDir);
      await cleanDir(outputsDir);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          deleted: true,
          message: "🧼 Uploads and outputs cleaned.",
        })
      );
    })();
    return;
  }

  res.writeHead(404);
  res.end("Route not found.");
});

server.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
