const multer = require("multer");
const path = require("path");
const fs = require("fs");

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function createUploader(folderName, options = {}) {
    const {
        allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"],
        maxFileSizeMB = 5
    } = options;

    const destinationPath = path.join(__dirname, "..", "..", "uploads", folderName);
    ensureDir(destinationPath);

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, destinationPath);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname || "");
            const safeName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
            cb(null, safeName);
        }
    });

    return multer({
        storage,
        limits: {
            fileSize: maxFileSizeMB * 1024 * 1024
        },
        fileFilter: (req, file, cb) => {
            if (!allowedMimeTypes.includes(file.mimetype)) {
                return cb(new Error("Formato de archivo no permitido"));
            }
            cb(null, true);
        }
    });
}

module.exports = {
    createUploader
};