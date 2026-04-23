const pool = require("../config/db");
const nodemailer = require("nodemailer");

const VALID_CENTERS = ["vs", "cu", "danli"];
const VALID_DESTINATIONS = ["jefatura", "coordinacion", "directiva"];

const DESTINATION_CONFIG = {
    jefatura: {
        email: "jorge.fuentes@unah.edu.hn",
        label: "Jefatura"
    },
    coordinacion: {
        email: "coordinacion.infovs@unah.edu.hn",
        label: "Coordinación"
    },
    directiva: {
        email: "asociacion.iavs@unah.edu.hn",
        label: "Directiva"
    }
};

function normalizeCenter(value) {
    const centro = String(value || "").trim().toLowerCase();
    return VALID_CENTERS.includes(centro) ? centro : null;
}

function normalizeDestination(value) {
    const destinatario = String(value || "").trim().toLowerCase();
    return VALID_DESTINATIONS.includes(destinatario) ? destinatario : null;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function sanitizeText(value) {
    return String(value || "").trim();
}

function buildTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

async function sendContacto(req, res) {
    try {
        const {
            centro,
            nombre,
            correo,
            telefono,
            destinatario,
            asunto,
            mensaje
        } = req.body;

        const centroNormalizado = normalizeCenter(centro);
        const destinatarioNormalizado = normalizeDestination(destinatario);

        const nombreLimpio = sanitizeText(nombre);
        const correoLimpio = sanitizeText(correo);
        const telefonoLimpio = sanitizeText(telefono);
        const asuntoLimpio = sanitizeText(asunto);
        const mensajeLimpio = sanitizeText(mensaje);

        if (!centroNormalizado) {
            return res.status(400).json({
                ok: false,
                message: "Centro inválido"
            });
        }

        if (!nombreLimpio || nombreLimpio.length < 5) {
            return res.status(400).json({
                ok: false,
                message: "El nombre completo es obligatorio y debe tener al menos 5 caracteres"
            });
        }

        if (!correoLimpio || !isValidEmail(correoLimpio)) {
            return res.status(400).json({
                ok: false,
                message: "El correo electrónico no es válido"
            });
        }

        if (!telefonoLimpio || telefonoLimpio.length < 8) {
            return res.status(400).json({
                ok: false,
                message: "El teléfono es obligatorio"
            });
        }

        if (!destinatarioNormalizado) {
            return res.status(400).json({
                ok: false,
                message: "Debes seleccionar un destinatario válido"
            });
        }

        if (!asuntoLimpio || asuntoLimpio.length < 4) {
            return res.status(400).json({
                ok: false,
                message: "El asunto es obligatorio"
            });
        }

        if (!mensajeLimpio || mensajeLimpio.length < 10) {
            return res.status(400).json({
                ok: false,
                message: "El mensaje debe tener al menos 10 caracteres"
            });
        }

        const destination = DESTINATION_CONFIG[destinatarioNormalizado];

        const insertResult = await pool.query(
            `INSERT INTO contactos
             (centro, nombre, correo, telefono, destinatario, asunto, mensaje, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
             RETURNING id, centro, nombre, correo, telefono, destinatario, asunto, mensaje, estado, created_at`,
            [
                centroNormalizado,
                nombreLimpio,
                correoLimpio,
                telefonoLimpio,
                destinatarioNormalizado,
                asuntoLimpio,
                mensajeLimpio
            ]
        );

        const transporter = buildTransporter();

        const mailSubject = `[Portal Informática Administrativa] ${asuntoLimpio}`;

        const mailText = [
            `Se ha recibido una nueva consulta desde el portal web.`,
            ``,
            `Centro: ${centroNormalizado.toUpperCase()}`,
            `Área seleccionada: ${destination.label}`,
            `Nombre completo: ${nombreLimpio}`,
            `Correo electrónico: ${correoLimpio}`,
            `Teléfono: ${telefonoLimpio}`,
            ``,
            `Asunto: ${asuntoLimpio}`,
            `Mensaje:`,
            mensajeLimpio
        ].join("\n");

        const mailHtml = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2d3d;">
                <h2 style="color:#004080; margin-bottom: 12px;">Nueva consulta desde el portal web</h2>

                <p><strong>Centro:</strong> ${centroNormalizado.toUpperCase()}</p>
                <p><strong>Área seleccionada:</strong> ${destination.label}</p>
                <p><strong>Nombre completo:</strong> ${nombreLimpio}</p>
                <p><strong>Correo electrónico:</strong> ${correoLimpio}</p>
                <p><strong>Teléfono:</strong> ${telefonoLimpio}</p>
                <p><strong>Asunto:</strong> ${asuntoLimpio}</p>

                <hr style="border:none; border-top:1px solid #d9e3ef; margin:16px 0;">

                <p><strong>Mensaje:</strong></p>
                <div style="background:#f8fbff; border:1px solid #dbe8f5; border-radius:10px; padding:14px;">
                    ${mensajeLimpio.replace(/\n/g, "<br>")}
                </div>
            </div>
        `;

        await transporter.sendMail({
            from: `"${process.env.CONTACT_FROM_NAME || "Portal Informática Administrativa"}" <${process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER}>`,
            to: destination.email,
            replyTo: correoLimpio,
            subject: mailSubject,
            text: mailText,
            html: mailHtml
        });

        return res.status(201).json({
            ok: true,
            message: "Tu consulta fue enviada correctamente",
            item: insertResult.rows[0]
        });
    } catch (error) {
        console.error("Error enviando contacto:", error);
        return res.status(500).json({
            ok: false,
            message: "No se pudo enviar la consulta en este momento"
        });
    }
}

module.exports = {
    sendContacto
};