CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS avisos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    resumen TEXT NOT NULL,
    contenido TEXT,
    categoria VARCHAR(100) DEFAULT 'General',
    enlace VARCHAR(255),
    destacado BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_publicacion DATE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fechas_importantes (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    fecha DATE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS docentes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    cargo VARCHAR(150),
    correo VARCHAR(150),
    telefono VARCHAR(50),
    descripcion TEXT,
    foto_url VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jefatura_coordinacion (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    cargo VARCHAR(150) NOT NULL,
    correo VARCHAR(150),
    telefono VARCHAR(50),
    descripcion TEXT,
    foto_url VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autoridades_estudiantiles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    cargo VARCHAR(150) NOT NULL,
    periodo VARCHAR(100),
    correo VARCHAR(150),
    telefono VARCHAR(50),
    descripcion TEXT,
    foto_url VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO admins (username, password_hash, full_name)
VALUES ('admin', $2b$10$wYcnytLztKNVF3oza6OI8OkEsRjdp7PhMJxw0nKZpYe5VeRUl0IDG, 'Administrador Principal')

//--------------------------------------------------------------------------------------------------------------//

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
    cargo VARCHAR(20) CHECK (cargo IN ('directiva', 'docente')),
    assigned_center VARCHAR(20) NOT NULL DEFAULT 'vs' CHECK (assigned_center IN ('vs', 'cu', 'danli', 'global')),
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_admin_id INTEGER NULL REFERENCES admins(id) ON DELETE SET NULL,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS avisos (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL DEFAULT 'vs' CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL,
    resumen TEXT NOT NULL,
    contenido TEXT,
    categoria VARCHAR(100) DEFAULT 'General',
    enlace VARCHAR(255),
    destacado BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_publicacion DATE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fechas_importantes (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL DEFAULT 'vs' CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    fecha DATE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS docentes (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL DEFAULT 'vs' CHECK (centro IN ('vs', 'cu', 'danli')),
    nombre VARCHAR(150) NOT NULL,
    cargo VARCHAR(150),
    correo VARCHAR(150),
    telefono VARCHAR(50),
    descripcion TEXT,
    foto_url VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jefatura_coordinacion (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL DEFAULT 'vs' CHECK (centro IN ('vs', 'cu', 'danli')),
    nombre VARCHAR(150) NOT NULL,
    cargo VARCHAR(150) NOT NULL,
    correo VARCHAR(150),
    telefono VARCHAR(50),
    descripcion TEXT,
    foto_url VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jefatura_ubicacion (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL UNIQUE CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL DEFAULT 'Ubicación del departamento',
    descripcion TEXT,
    imagen_url VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autoridades_estudiantiles (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL DEFAULT 'vs' CHECK (centro IN ('vs', 'cu', 'danli')),
    nombre VARCHAR(150) NOT NULL,
    cargo VARCHAR(150) NOT NULL,
    periodo VARCHAR(100),
    correo VARCHAR(150),
    telefono VARCHAR(50),
    descripcion TEXT,
    foto_url VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autoridades_info (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL UNIQUE CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL DEFAULT 'Directiva estudiantil',
    descripcion TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reglamentos_fragmentos (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL DEFAULT 'vs' CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL,
    fragmento TEXT NOT NULL,
    enlace VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recursos_descargables (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL DEFAULT 'global' CHECK (centro IN ('global', 'vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    archivo_url VARCHAR(255),
    archivo_nombre_original VARCHAR(255),
    tipo_archivo VARCHAR(30),
    enlace_externo VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tutoriales (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL DEFAULT 'global' CHECK (centro IN ('global', 'vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    video_url VARCHAR(255),
    video_nombre_original VARCHAR(255),
    tipo_video VARCHAR(30),
    enlace_video VARCHAR(500),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comites_grupos (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL DEFAULT 'vs' CHECK (centro IN ('vs', 'cu', 'danli')),
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    encargados TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iiicap_info (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL UNIQUE CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL DEFAULT 'IIICAP-IA',
    descripcion TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iiicap_encargados (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL CHECK (centro IN ('vs', 'cu', 'danli')),
    nombre VARCHAR(150) NOT NULL,
    cargo VARCHAR(150) NOT NULL,
    correo VARCHAR(150),
    telefono VARCHAR(50),
    descripcion TEXT,
    foto_url VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iiicap_investigaciones (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    fecha DATE NOT NULL,
    archivo_url VARCHAR(255),
    archivo_nombre_original VARCHAR(255),
    tipo_archivo VARCHAR(30),
    enlace_externo VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maestria_info (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL UNIQUE CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL DEFAULT 'Maestría',
    descripcion TEXT NOT NULL,
    mensaje_final_titulo VARCHAR(200),
    mensaje_final_descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maestria_avisos (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL,
    resumen TEXT NOT NULL,
    contenido TEXT,
    categoria VARCHAR(100) DEFAULT 'General',
    enlace VARCHAR(255),
    destacado BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_publicacion DATE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maestria_fechas (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    fecha DATE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maestria_encargados (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL CHECK (centro IN ('vs', 'cu', 'danli')),
    nombre VARCHAR(150) NOT NULL,
    cargo VARCHAR(150),
    correo VARCHAR(150),
    telefono VARCHAR(50),
    descripcion TEXT,
    foto_url VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maestria_reglamentos (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL,
    fragmento TEXT NOT NULL,
    enlace VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maestria_recursos (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    archivo_url VARCHAR(255),
    archivo_nombre_original VARCHAR(255),
    tipo_archivo VARCHAR(30),
    enlace_externo VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maestria_tutoriales (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL CHECK (centro IN ('vs', 'cu', 'danli')),
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    video_url VARCHAR(255),
    video_nombre_original VARCHAR(255),
    tipo_video VARCHAR(30),
    enlace_video VARCHAR(500),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visual INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contactos (
    id SERIAL PRIMARY KEY,
    centro VARCHAR(20) NOT NULL CHECK (centro IN ('vs', 'cu', 'danli')),
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150) NOT NULL,
    telefono VARCHAR(50) NOT NULL,
    destinatario VARCHAR(30) NOT NULL CHECK (destinatario IN ('jefatura', 'coordinacion', 'directiva')),
    asunto VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'leido', 'respondido')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NULL REFERENCES admins(id) ON DELETE SET NULL,
    username VARCHAR(120),
    role VARCHAR(50),
    module VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    target_id INTEGER NULL,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id
ON audit_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_module
ON audit_logs(module);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
ON audit_logs(action);

CREATE TABLE IF NOT EXISTS page_visits (
    id SERIAL PRIMARY KEY,
    page_key VARCHAR(120) NOT NULL,
    centro VARCHAR(20),
    path VARCHAR(255),
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_visits_created_at
ON page_visits(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_visits_page_key
ON page_visits(page_key);

CREATE INDEX IF NOT EXISTS idx_page_visits_centro
ON page_visits(centro);