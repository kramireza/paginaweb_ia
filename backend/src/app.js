const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const adminsRoutes = require("./routes/admins.routes");
const avisosRoutes = require("./routes/avisos.routes");
const fechasRoutes = require("./routes/fechas.routes");
const docentesRoutes = require("./routes/docentes.routes");
const jefaturaRoutes = require("./routes/jefatura.routes");
const autoridadesRoutes = require("./routes/autoridades.routes");
const comitesRoutes = require("./routes/comites.routes");
const iiicapRoutes = require("./routes/iiicap.routes");
const maestriaRoutes = require("./routes/maestria.routes");
const contactoRoutes = require("./routes/contacto.routes");
const contactoAdminRoutes = require("./routes/contacto.admin.routes");
const metricsRoutes = require("./routes/metrics.routes");
const logsRoutes = require("./routes/logs.routes");

const app = express();

app.set("trust proxy", 1);

const normalizePrefix = (value, fallback) => {
    const raw = (value || fallback || "").trim();
    if (!raw) return "";
    const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/+$/, "");
};

const API_PREFIX = normalizePrefix(process.env.API_PREFIX, "/informatica-api");
const UPLOADS_PREFIX = normalizePrefix(process.env.UPLOADS_PREFIX, "/informatica-uploads");

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.use(UPLOADS_PREFIX, express.static(path.join(__dirname, "..", "uploads")));

app.get(`${API_PREFIX}/health`, (req, res) => {
    res.json({ ok: true, message: "Backend funcionando" });
});

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/admins`, adminsRoutes);
app.use(`${API_PREFIX}/avisos`, avisosRoutes);
app.use(`${API_PREFIX}/fechas`, fechasRoutes);
app.use(`${API_PREFIX}/docentes`, docentesRoutes);
app.use(`${API_PREFIX}/jefatura`, jefaturaRoutes);
app.use(`${API_PREFIX}/autoridades`, autoridadesRoutes);
app.use(`${API_PREFIX}/comites`, comitesRoutes);
app.use(`${API_PREFIX}/iiicap`, iiicapRoutes);
app.use(`${API_PREFIX}/maestria`, maestriaRoutes);
app.use(`${API_PREFIX}/contacto`, contactoRoutes);
app.use(`${API_PREFIX}/admin/contactos`, contactoAdminRoutes);
app.use(`${API_PREFIX}/metrics`, metricsRoutes);
app.use(`${API_PREFIX}/logs`, logsRoutes);

app.use((req, res) => {
    res.status(404).json({
        ok: false,
        message: "Ruta no encontrada"
    });
});

app.use((err, req, res, next) => {
    console.error("ERROR:", err);

    res.status(err.status || 500).json({
        ok: false,
        message: err.message || "Error interno del servidor",
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
    });
});

module.exports = app;