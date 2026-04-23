const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { writeAuditLog } = require("../utils/audit");

function buildAdminToken(admin) {
    return jwt.sign(
        {
            id: admin.id,
            username: admin.username,
            fullName: admin.full_name,
            role: admin.role,
            cargo: admin.cargo,
            assignedCenter: admin.assigned_center,
            mustChangePassword: admin.must_change_password
        },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
    );
}

function getCookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000,
        path: "/"
    };
}

async function login(req, res) {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                ok: false,
                message: "Usuario y contraseña son obligatorios"
            });
        }

        const result = await pool.query(
            `SELECT
                id,
                username,
                password_hash,
                full_name,
                role,
                cargo,
                assigned_center,
                must_change_password,
                is_active
             FROM admins
             WHERE username = $1
             LIMIT 1`,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                ok: false,
                message: "Credenciales inválidas"
            });
        }

        const admin = result.rows[0];

        if (!admin.is_active) {
            return res.status(403).json({
                ok: false,
                message: "Usuario inactivo"
            });
        }

        const isValid = await bcrypt.compare(password, admin.password_hash);

        if (!isValid) {
            return res.status(401).json({
                ok: false,
                message: "Credenciales inválidas"
            });
        }

        await pool.query(
            `UPDATE admins
             SET last_login_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [admin.id]
        );

        req.admin = {
            id: admin.id,
            username: admin.username,
            role: admin.role
        };

        await writeAuditLog(req, {
            module: "auth",
            action: "login",
            description: "Inicio de sesión exitoso",
            target_id: admin.id
        });

        const token = buildAdminToken(admin);

        res.cookie("adminToken", token, getCookieOptions());

        return res.json({
            ok: true,
            token,
            mustChangePassword: admin.must_change_password,
            admin: {
                id: admin.id,
                username: admin.username,
                fullName: admin.full_name,
                role: admin.role,
                cargo: admin.cargo,
                assignedCenter: admin.assigned_center
            }
        });
    } catch (error) {
        console.error("Error en login:", error);
        return res.status(500).json({
            ok: false,
            message: "Error interno en login"
        });
    }
}

async function changeOwnPassword(req, res) {
    try {
        const adminId = req.admin?.id;
        const {
            currentPassword,
            newPassword,
            confirmPassword
        } = req.body;

        if (!adminId) {
            return res.status(401).json({
                ok: false,
                message: "No autenticado"
            });
        }

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                ok: false,
                message: "Todos los campos de contraseña son obligatorios"
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                ok: false,
                message: "La nueva contraseña debe tener al menos 8 caracteres"
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                ok: false,
                message: "La confirmación de contraseña no coincide"
            });
        }

        const result = await pool.query(
            `SELECT id, password_hash
             FROM admins
             WHERE id = $1
             LIMIT 1`,
            [adminId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Admin no encontrado"
            });
        }

        const admin = result.rows[0];

        const currentMatches = await bcrypt.compare(currentPassword, admin.password_hash);

        if (!currentMatches) {
            return res.status(400).json({
                ok: false,
                message: "La contraseña actual es incorrecta"
            });
        }

        const newHash = await bcrypt.hash(newPassword, 10);

        await pool.query(
            `UPDATE admins
             SET password_hash = $1,
                 must_change_password = FALSE,
                 updated_at = NOW()
             WHERE id = $2`,
            [newHash, adminId]
        );

        await writeAuditLog(req, {
            module: "auth",
            action: "change_password",
            description: "Cambio de contraseña propia",
            target_id: adminId
        });

        return res.json({
            ok: true,
            message: "Contraseña actualizada correctamente"
        });
    } catch (error) {
        console.error("Error cambiando contraseña propia:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al actualizar la contraseña"
        });
    }
}

async function logout(req, res) {
    try {
        const adminId = req.admin?.id;

        if (!adminId) {
            return res.status(401).json({
                ok: false,
                message: "No autenticado"
            });
        }

        await writeAuditLog(req, {
            module: "auth",
            action: "logout",
            description: "Cierre de sesión",
            target_id: adminId
        });

        res.clearCookie("adminToken", {
            path: "/"
        });

        return res.json({
            ok: true,
            message: "Sesión cerrada correctamente"
        });
    } catch (error) {
        console.error("Error cerrando sesión:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al cerrar sesión"
        });
    }
}

async function me(req, res) {
    try {
        const adminId = req.admin?.id;

        if (!adminId) {
            return res.status(401).json({
                ok: false,
                message: "No autenticado"
            });
        }

        const result = await pool.query(
            `SELECT
                id,
                username,
                full_name,
                role,
                cargo,
                assigned_center,
                must_change_password,
                is_active,
                created_at,
                updated_at,
                last_login_at
             FROM admins
             WHERE id = $1
             LIMIT 1`,
            [adminId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                message: "Admin no encontrado"
            });
        }

        return res.json({
            ok: true,
            admin: result.rows[0]
        });
    } catch (error) {
        console.error("Error obteniendo perfil admin:", error);
        return res.status(500).json({
            ok: false,
            message: "Error al obtener información del admin"
        });
    }
}

module.exports = {
    login,
    logout,
    changeOwnPassword,
    me
};