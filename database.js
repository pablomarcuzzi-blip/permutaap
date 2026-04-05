const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.NODE_ENV === 'production'
    ? '/data/permutapp.db'
    : path.join(__dirname, 'permutapp.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
    db.serialize(() => {

        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            nombre TEXT NOT NULL,
            dni TEXT UNIQUE NOT NULL,
            telefono TEXT,
            fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
            activo INTEGER DEFAULT 1,
            es_admin INTEGER DEFAULT 0,
            email_verificado INTEGER DEFAULT 0,
            token_verificacion TEXT,
            token_expira DATETIME
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS areas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS tipos_escuela (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            area_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            FOREIGN KEY (area_id) REFERENCES areas(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS escuelas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            area_id INTEGER NOT NULL,
            tipo_id INTEGER NOT NULL,
            nivel TEXT NOT NULL,
            area_modalidad TEXT NOT NULL,
            direccion TEXT,
            barrio TEXT,
            distrito_escolar TEXT,
            numero_escuela TEXT,
            cue TEXT,
            tipo_original TEXT,
            origen TEXT DEFAULT 'oficial' CHECK (origen IN ('oficial', 'docente')),
            pendiente_revision INTEGER DEFAULT 0,
            motivo_rechazo TEXT,
            creado_por INTEGER,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (area_id) REFERENCES areas(id),
            FOREIGN KEY (tipo_id) REFERENCES tipos_escuela(id),
            FOREIGN KEY (creado_por) REFERENCES usuarios(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS cargos_intercambio (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            materia TEXT NOT NULL,
            año TEXT NOT NULL,
            nivel TEXT NOT NULL,
            area_modalidad TEXT NOT NULL,
            escuela_id INTEGER NOT NULL,
            turno TEXT NOT NULL,
            horario TEXT,
            activo INTEGER DEFAULT 1,
            fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
            FOREIGN KEY (escuela_id) REFERENCES escuelas(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS cargos_propuestos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            tipo_escuela_descripcion TEXT,
            propuesto_por INTEGER NOT NULL,
            estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
            motivo_rechazo TEXT,
            fecha_propuesta DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_resolucion DATETIME,
            FOREIGN KEY (propuesto_por) REFERENCES usuarios(id)
        )`);

        // Tabla de notificaciones para avisar escuelas/cargos eliminados
        db.run(`CREATE TABLE IF NOT EXISTS notificaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            tipo TEXT NOT NULL CHECK (tipo IN ('escuela_eliminada', 'cargo_eliminado')),
            nombre TEXT NOT NULL,
            cargo_intercambio_id INTEGER,
            leida INTEGER DEFAULT 0,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )`);

        // Migraciones para BDs existentes
        db.run(`ALTER TABLE cargos_propuestos ADD COLUMN motivo_rechazo TEXT`, () => {});
        db.run(`ALTER TABLE escuelas ADD COLUMN motivo_rechazo TEXT`, () => {});
        db.run(`ALTER TABLE usuarios ADD COLUMN email_verificado INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE usuarios ADD COLUMN token_verificacion TEXT`, () => {});
        db.run(`ALTER TABLE usuarios ADD COLUMN token_expira DATETIME`, () => {});
        db.run(`ALTER TABLE usuarios ADD COLUMN token_reset TEXT`, () => {});
        db.run(`ALTER TABLE usuarios ADD COLUMN token_reset_expira DATETIME`, () => {});

        console.log('✅ Base de datos inicializada');
        insertarAreasYTiposIniciales();
    });
}

function insertarAreasYTiposIniciales() {
    db.get('SELECT COUNT(*) as count FROM areas', (err, row) => {
        if (err || row.count > 0) return;

        const areas = ['Inicial', 'Primaria', 'Secundaria', 'Formación Docente/Terciarios'];
        const stmtAreas = db.prepare('INSERT INTO areas (nombre) VALUES (?)');
        areas.forEach(area => stmtAreas.run(area));
        stmtAreas.finalize(() => {
            db.all('SELECT id, nombre FROM areas', (err, areasRows) => {
                if (err) return;
                const areaMap = {};
                areasRows.forEach(a => areaMap[a.nombre] = a.id);

                const tipos = [
                    ['Jardín Maternal', areaMap['Inicial']],
                    ['Jardín de Infantes', areaMap['Inicial']],
                    ['Primaria Común', areaMap['Primaria']],
                    ['Primaria de Adultos (EPA/CENP)', areaMap['Primaria']],
                    ['Común (EEM, Liceo, Colegio, Normal)', areaMap['Secundaria']],
                    ['Técnica', areaMap['Secundaria']],
                    ['Comercial', areaMap['Secundaria']],
                    ['Artística', areaMap['Secundaria']],
                    ['CENS', areaMap['Secundaria']],
                    ['CFP/UGEE', areaMap['Secundaria']],
                    ['Normal/ISFD', areaMap['Formación Docente/Terciarios']],
                    ['Artística', areaMap['Formación Docente/Terciarios']],
                    ['INST', areaMap['Formación Docente/Terciarios']],
                ];

                const stmtTipos = db.prepare('INSERT INTO tipos_escuela (nombre, area_id) VALUES (?, ?)');
                tipos.forEach(tipo => stmtTipos.run(tipo[0], tipo[1]));
                stmtTipos.finalize(() => {
                    console.log('✅ Tipos de escuela insertados');
                    insertarCargosIniciales();
                });
            });
        });
    });
}

function insertarCargosIniciales() {
    db.get('SELECT COUNT(*) as count FROM cargos_propuestos WHERE estado = ?', ['aprobado'], (err, row) => {
        if (err || row.count > 0) return;

        const cargos = [
            ['Maestr/a Inicial', 'Inicial'], ['Maestr/a Maternal', 'Inicial'],
            ['Maestr/a de Primaria', 'Primaria Común'], ['Maestr/a CENP/EPA', 'Primaria de Adultos (EPA/CENP)'],
            ['Prosecretario', null], ['Rector / Director', null], ['Secretario', null], ['Vicerrector / Vicedirector', null],
            ['Jefe de Preceptores', null], ['Preceptor', null], ['Subjefe de Preceptores', null],
            ['Bibliotecario', null],
            ['Profesor/a de Análisis Matemático', null], ['Profesor/a de Matemática', null], ['Profesor/a de Matemática Aplicada', null],
            ['Profesor/a de Biología', null], ['Profesor/a de Ciencias Naturales', null], ['Profesor/a de Educación Ambiental', null],
            ['Profesor/a de Física', null], ['Profesor/a de Química', null],
            ['Profesor/a de Antropología', null], ['Profesor/a de Ciencia Política', null], ['Profesor/a de Ciencias Sociales', null],
            ['Profesor/a de Construcción de Ciudadanía', null], ['Profesor/a de Formación Ética y Ciudadana', null],
            ['Profesor/a de Geografía', null], ['Profesor/a de Historia', null], ['Profesor/a de Sociología', null],
            ['Profesor/a de Comunicación', null], ['Profesor/a de Lengua y Literatura', null], ['Profesor/a de Literatura', null],
            ['Profesor/a de Prácticas del Lenguaje', null], ['Profesor/a de Taller de Escritura', null],
            ['Profesor/a de Alemán', null], ['Profesor/a de Francés', null], ['Profesor/a de Inglés', null],
            ['Profesor/a de Italiano', null], ['Profesor/a de Portugués', null],
            ['Profesor/a de Computación', null], ['Profesor/a de Educación Tecnológica', null], ['Profesor/a de Informática', null],
            ['Profesor/a de Programación', null], ['Profesor/a de Robótica', null], ['Profesor/a de TIC', null],
            ['Profesor/a de Administración', null], ['Profesor/a de Contabilidad', null], ['Profesor/a de Derecho', null],
            ['Profesor/a de Economía', null], ['Profesor/a de Marketing', null], ['Profesor/a de Sistemas Administrativos', null],
            ['Profesor/a de Filosofía', null], ['Profesor/a de Psicología', null], ['Profesor/a de Educación Física', null],
            ['Profesor/a de Artes Visuales', null], ['Profesor/a de Danza', null], ['Profesor/a de Folklore', null],
            ['Profesor/a de Historia del Arte', null], ['Profesor/a de Música', null], ['Profesor/a de Plástica', null],
            ['Profesor/a de Producción Artística', null], ['Profesor/a de Teatro', null],
            ['Profesor/a de Automotores', 'Técnica'], ['Profesor/a de Construcciones', 'Técnica'],
            ['Profesor/a de Dibujo Técnico', 'Técnica'], ['Profesor/a de Electricidad', 'Técnica'],
            ['Profesor/a de Electrónica', 'Técnica'], ['Profesor/a de Maestro Mayor de Obras', 'Técnica'],
            ['Profesor/a de Mecánica', 'Técnica'], ['Profesor/a de Procesos Productivos', 'Técnica'],
            ['Profesor/a de Química Industrial', 'Técnica'], ['Profesor/a de Tecnología de los Materiales', 'Técnica'],
            ['ACP de Biología', null], ['ACP de Física', null], ['ACP de Informática', null],
            ['ACP de Química', null], ['ACP de Taller', null], ['Ayudante de Laboratorio', null], ['Jefe de Laboratorio', null],
        ];

        const stmt = db.prepare(`INSERT INTO cargos_propuestos (nombre, tipo_escuela_descripcion, propuesto_por, estado, fecha_resolucion) VALUES (?, ?, 1, 'aprobado', CURRENT_TIMESTAMP)`);
        cargos.forEach(([nombre, tipo]) => stmt.run(nombre, tipo));
        stmt.finalize(() => { console.log('✅ Cargos iniciales insertados'); });
    });
}

// ==================== USUARIOS ====================

const registrarUsuario = (email, password, nombre, dni, telefono, token, tokenExpira, callback) => {
    db.run(`INSERT INTO usuarios (email, password, nombre, dni, telefono, email_verificado, token_verificacion, token_expira) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        [email, password, nombre, dni, telefono, token, tokenExpira], function(err) { callback(err, this ? this.lastID : null); });
};
const buscarUsuarioPorEmail = (email, callback) => db.get(`SELECT * FROM usuarios WHERE email = ?`, [email], callback);
const buscarUsuarioPorDni = (dni, callback) => db.get(`SELECT * FROM usuarios WHERE dni = ?`, [dni], callback);

const buscarUsuarioPorToken = (token, callback) => db.get(`SELECT * FROM usuarios WHERE token_verificacion = ?`, [token], callback);

const verificarEmailUsuario = (userId, callback) => {
    db.run(`UPDATE usuarios SET email_verificado = 1, token_verificacion = NULL, token_expira = NULL WHERE id = ?`,
        [userId], function(err) { callback(err, this ? this.changes : 0); });
};

const actualizarTokenVerificacion = (userId, token, tokenExpira, callback) => {
    db.run(`UPDATE usuarios SET token_verificacion = ?, token_expira = ? WHERE id = ?`,
        [token, tokenExpira, userId], function(err) { callback(err, this ? this.changes : 0); });
};

const guardarTokenReset = (userId, token, tokenExpira, callback) => {
    db.run(`UPDATE usuarios SET token_reset = ?, token_reset_expira = ? WHERE id = ?`,
        [token, tokenExpira, userId], function(err) { callback(err, this ? this.changes : 0); });
};

const buscarUsuarioPorTokenReset = (token, callback) => {
    db.get(`SELECT * FROM usuarios WHERE token_reset = ?`, [token], callback);
};

const resetearPassword = (userId, hashedPassword, callback) => {
    db.run(`UPDATE usuarios SET password = ?, token_reset = NULL, token_reset_expira = NULL WHERE id = ?`,
        [hashedPassword, userId], function(err) { callback(err, this ? this.changes : 0); });
};

// ==================== CARGOS ====================

const registrarCargo = (usuarioId, materia, nivel, area_modalidad, escuelaId, turno, horario, callback) => {
    db.run(`INSERT INTO cargos_intercambio (usuario_id, materia, año, nivel, area_modalidad, escuela_id, turno, horario) VALUES (?, ?, '', ?, ?, ?, ?, ?)`,
        [usuarioId, materia, nivel, area_modalidad, escuelaId, turno, horario], function(err) {
            callback(err, this ? this.lastID : null);
        });
};

const obtenerCargosPorUsuario = (usuarioId, callback) => {
    const sql = `
        SELECT 
            c.*,
            e.nombre as escuela_nombre,
            e.pendiente_revision as escuela_pendiente,
            e.motivo_rechazo as escuela_motivo_rechazo,
            c.materia as cargo,
            a.nombre as area_nombre,
            cp.estado as cargo_propuesto_estado,
            cp.motivo_rechazo as cargo_propuesto_motivo
        FROM cargos_intercambio c
        LEFT JOIN escuelas e ON c.escuela_id = e.id
        LEFT JOIN areas a ON e.area_id = a.id
        LEFT JOIN cargos_propuestos cp ON cp.nombre = c.materia 
            AND cp.propuesto_por = c.usuario_id 
            AND cp.estado IN ('pendiente', 'rechazado')
        WHERE c.usuario_id = ? AND c.activo = 1
        ORDER BY c.fecha_registro DESC`;
    db.all(sql, [usuarioId], callback);
};

const obtenerCargoPorId = (cargoId, usuarioId, callback) => {
    db.get(`SELECT c.*, e.nombre as escuela_nombre, c.materia as cargo FROM cargos_intercambio c LEFT JOIN escuelas e ON c.escuela_id = e.id WHERE c.id = ? AND c.usuario_id = ?`,
        [cargoId, usuarioId], callback);
};

const actualizarCargo = (cargoId, usuarioId, materia, nivel, area_modalidad, escuelaId, turno, horario, callback) => {
    db.run(`UPDATE cargos_intercambio SET materia = ?, año = '', nivel = ?, area_modalidad = ?, escuela_id = ?, turno = ?, horario = ? WHERE id = ? AND usuario_id = ?`,
        [materia, nivel, area_modalidad, escuelaId, turno, horario, cargoId, usuarioId], function(err) {
            callback(err, this ? this.changes : 0);
        });
};

const eliminarCargo = (cargoId, usuarioId, callback) => {
    db.run(`DELETE FROM cargos_intercambio WHERE id = ? AND usuario_id = ?`, [cargoId, usuarioId], callback);
};

// ==================== ÁREAS Y TIPOS ====================

const obtenerAreas = (callback) => {
    db.all(`SELECT * FROM areas ORDER BY CASE nombre WHEN 'Inicial' THEN 1 WHEN 'Primaria' THEN 2 WHEN 'Secundaria' THEN 3 WHEN 'Formación Docente/Terciarios' THEN 4 END`, [], callback);
};

const obtenerTiposPorArea = (areaId, callback) => {
    db.all(`SELECT * FROM tipos_escuela WHERE area_id = ? ORDER BY CASE nombre WHEN 'Jardín Maternal' THEN 1 WHEN 'Jardín de Infantes' THEN 2 WHEN 'Primaria Común' THEN 3 WHEN 'Primaria de Adultos (EPA/CENP)' THEN 4 WHEN 'Común (EEM, Liceo, Colegio, Normal)' THEN 5 WHEN 'Técnica' THEN 6 WHEN 'Comercial' THEN 7 WHEN 'Artística' THEN 8 WHEN 'CENS' THEN 9 WHEN 'CFP/UGEE' THEN 10 WHEN 'Normal/ISFD' THEN 11 WHEN 'INST' THEN 12 ELSE 99 END`,
        [areaId], callback);
};

const crearTipo = (nombre, areaId, callback) => {
    db.run(`INSERT INTO tipos_escuela (nombre, area_id) VALUES (?, ?)`, [nombre, areaId], function(err) {
        callback(err, this ? this.lastID : null);
    });
};

// ==================== ESCUELAS ====================

const obtenerEscuelas = (areaId, tipoId, usuarioId, callback) => {
    const sql = `SELECT e.*, a.nombre as area_nombre, t.nombre as tipo_nombre
                 FROM escuelas e
                 JOIN areas a ON e.area_id = a.id
                 LEFT JOIN tipos_escuela t ON e.tipo_id = t.id
                 WHERE e.area_id = ? AND e.tipo_id = ?
                 AND (
                     (e.pendiente_revision = 0)
                     OR (e.origen = 'docente' AND e.creado_por = ? AND e.pendiente_revision = 1)
                 )
                 ORDER BY e.nombre`;
    db.all(sql, [areaId, tipoId, usuarioId], callback);
};

const buscarEscuelaPorCUE = (cue, callback) => {
    db.get(`SELECT e.*, a.nombre as area_nombre, t.nombre as tipo_nombre FROM escuelas e JOIN areas a ON e.area_id = a.id LEFT JOIN tipos_escuela t ON e.tipo_id = t.id WHERE e.cue = ? AND e.pendiente_revision = 0`,
        [cue.trim()], callback);
};

const buscarEscuelasPorNombre = (nombre, callback) => {
    const termino = `%${nombre.toUpperCase()}%`;
    db.all(`SELECT e.id, e.nombre, e.direccion, e.barrio, e.distrito_escolar, e.numero_escuela, e.cue, a.nombre as area_nombre, t.nombre as tipo_nombre FROM escuelas e JOIN areas a ON e.area_id = a.id LEFT JOIN tipos_escuela t ON e.tipo_id = t.id WHERE e.nombre LIKE ? AND e.pendiente_revision = 0 ORDER BY e.nombre LIMIT 10`,
        [termino], callback);
};

const obtenerEscuelasCatalogo = (filtros, callback) => {
    let sql = `SELECT e.id, e.area_id, e.tipo_id, e.nombre, e.direccion, e.barrio, e.distrito_escolar, e.numero_escuela, e.cue, e.tipo_original, a.nombre as area, t.nombre as tipo FROM escuelas e JOIN areas a ON e.area_id = a.id JOIN tipos_escuela t ON e.tipo_id = t.id WHERE e.pendiente_revision = 0`;
    const params = [];
    if (filtros.area_id) { sql += ' AND e.area_id = ?'; params.push(filtros.area_id); }
    if (filtros.tipo_id) { sql += ' AND e.tipo_id = ?'; params.push(filtros.tipo_id); }
    if (filtros.search) {
        sql += ' AND (e.nombre LIKE ? OR e.direccion LIKE ? OR e.cue LIKE ? OR e.barrio LIKE ?)';
        const s = `%${filtros.search}%`;
        params.push(s, s, s, s);
    }
    sql += ' ORDER BY e.nombre';
    db.all(sql, params, callback);
};

const obtenerEscuelasAprobadas = (callback) => {
    db.all(`SELECT e.*, a.nombre as area_nombre, t.nombre as tipo_nombre FROM escuelas e JOIN areas a ON e.area_id = a.id LEFT JOIN tipos_escuela t ON e.tipo_id = t.id WHERE e.pendiente_revision = 0 ORDER BY e.fecha_creacion DESC`,
        [], callback);
};

const crearEscuelaDocente = (nombre, areaId, tipoId, cue, direccion, barrio, distritoEscolar, numeroEscuela, usuarioId, callback) => {
    db.get(`SELECT nombre FROM areas WHERE id = ?`, [areaId], (err, area) => {
        if (err || !area) return callback(err || new Error('Área no encontrada'), null);
        db.get(`SELECT nombre FROM tipos_escuela WHERE id = ?`, [tipoId], (err, tipo) => {
            if (err || !tipo) return callback(err || new Error('Tipo no encontrado'), null);
            const nombreLimpio = nombre.toUpperCase().trim().replace(/\s+/g, ' ');
            db.run(`INSERT INTO escuelas (nombre, area_id, tipo_id, nivel, area_modalidad, cue, direccion, barrio, distrito_escolar, numero_escuela, origen, pendiente_revision, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'docente', 1, ?)`,
                [nombreLimpio, areaId, tipoId, area.nombre, tipo.nombre, cue || null, direccion || null, barrio || null, distritoEscolar || null, numeroEscuela || null, usuarioId],
                function(err) { callback(err, this ? this.lastID : null); });
        });
    });
};

const obtenerMisEscuelas = (usuarioId, callback) => {
    db.all(`SELECT e.*, a.nombre as area_nombre, t.nombre as tipo_nombre FROM escuelas e JOIN areas a ON e.area_id = a.id JOIN tipos_escuela t ON e.tipo_id = t.id WHERE e.creado_por = ? AND e.origen = 'docente' ORDER BY e.fecha_creacion DESC`,
        [usuarioId], callback);
};

const actualizarEscuelaDocente = (escuelaId, nombre, usuarioId, callback) => {
    const nombreLimpio = nombre.toUpperCase().trim().replace(/\s+/g, ' ');
    db.run(`UPDATE escuelas SET nombre = ? WHERE id = ? AND origen = 'docente' AND creado_por = ?`,
        [nombreLimpio, escuelaId, usuarioId], function(err) { callback(err, this ? this.changes : 0); });
};

// ==================== CARGOS PROPUESTOS ====================

const proponerCargo = (nombre, tipoEscuelaDescripcion, usuarioId, callback) => {
    db.run(`INSERT INTO cargos_propuestos (nombre, tipo_escuela_descripcion, propuesto_por) VALUES (?, ?, ?)`,
        [nombre.trim(), tipoEscuelaDescripcion || null, usuarioId], function(err) { callback(err, this ? this.lastID : null); });
};

const obtenerCargosPropuestosPendientes = (callback) => {
    db.all(`SELECT cp.*, u.nombre as usuario_nombre, u.email as usuario_email FROM cargos_propuestos cp JOIN usuarios u ON cp.propuesto_por = u.id WHERE cp.estado = 'pendiente' ORDER BY cp.fecha_propuesta ASC`, [], callback);
};

const resolverCargoPropuesto = (id, estado, motivo, callback) => {
    db.run(`UPDATE cargos_propuestos SET estado = ?, motivo_rechazo = ?, fecha_resolucion = CURRENT_TIMESTAMP WHERE id = ?`,
        [estado, motivo || null, id], function(err) { callback(err, this ? this.changes : 0); });
};

const obtenerCargosDisponibles = (callback) => {
    db.all(`SELECT id, nombre, tipo_escuela_descripcion as tipo FROM cargos_propuestos WHERE estado = 'aprobado' ORDER BY nombre`, [], callback);
};

const obtenerMisCargosPropuestos = (usuarioId, callback) => {
    db.all(`SELECT id, nombre, tipo_escuela_descripcion, estado, motivo_rechazo, fecha_propuesta, fecha_resolucion FROM cargos_propuestos WHERE propuesto_por = ? AND estado IN ('pendiente', 'rechazado') ORDER BY fecha_propuesta DESC`,
        [usuarioId], callback);
};

// ==================== NOTIFICACIONES ====================

const obtenerNotificaciones = (usuarioId, callback) => {
    db.all(`SELECT * FROM notificaciones WHERE usuario_id = ? AND leida = 0 ORDER BY fecha DESC`,
        [usuarioId], callback);
};

const marcarNotificacionLeida = (id, usuarioId, callback) => {
    db.run(`UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?`,
        [id, usuarioId], function(err) { callback(err, this ? this.changes : 0); });
};

const marcarTodasNotificacionesLeidas = (usuarioId, callback) => {
    db.run(`UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?`,
        [usuarioId], function(err) { callback(err); });
};

// Crear notificaciones cuando admin elimina escuela o cargo
const crearNotificacionEscuelaEliminada = (escuelaId, nombreEscuela, callback) => {
    db.all(`SELECT DISTINCT c.usuario_id, c.id as cargo_id FROM cargos_intercambio c WHERE c.escuela_id = ? AND c.activo = 1`,
        [escuelaId], (err, rows) => {
            if (err || !rows || rows.length === 0) { if (callback) callback(err); return; }
            const stmt = db.prepare(`INSERT INTO notificaciones (usuario_id, tipo, nombre, cargo_intercambio_id) VALUES (?, 'escuela_eliminada', ?, ?)`);
            rows.forEach(r => stmt.run(r.usuario_id, nombreEscuela, r.cargo_id));
            stmt.finalize(() => { if (callback) callback(null); });
        });
};

const crearNotificacionCargoEliminado = (nombreCargo, callback) => {
    db.all(`SELECT DISTINCT c.usuario_id, c.id as cargo_id FROM cargos_intercambio c WHERE c.materia = ? AND c.activo = 1`,
        [nombreCargo], (err, rows) => {
            if (err || !rows || rows.length === 0) { if (callback) callback(err); return; }
            const stmt = db.prepare(`INSERT INTO notificaciones (usuario_id, tipo, nombre, cargo_intercambio_id) VALUES (?, 'cargo_eliminado', ?, ?)`);
            rows.forEach(r => stmt.run(r.usuario_id, nombreCargo, r.cargo_id));
            stmt.finalize(() => { if (callback) callback(null); });
        });
};

// ==================== ADMIN — ESCUELAS PENDIENTES ====================

const obtenerEscuelasPendientes = (callback) => {
    db.all(`SELECT e.*, a.nombre as area_nombre, t.nombre as tipo_nombre, u.nombre as usuario_nombre, u.email as usuario_email FROM escuelas e JOIN areas a ON e.area_id = a.id LEFT JOIN tipos_escuela t ON e.tipo_id = t.id LEFT JOIN usuarios u ON e.creado_por = u.id WHERE e.pendiente_revision = 1 ORDER BY e.fecha_creacion ASC`, [], callback);
};

const aprobarEscuela = (id, callback) => {
    db.run(`UPDATE escuelas SET pendiente_revision = 0, motivo_rechazo = NULL WHERE id = ?`, [id], function(err) {
        callback(err, this ? this.changes : 0);
    });
};

const rechazarEscuela = (id, motivo, callback) => {
    db.run(`UPDATE escuelas SET pendiente_revision = 2, motivo_rechazo = ? WHERE id = ? AND pendiente_revision = 1`,
        [motivo || null, id], function(err) { callback(err, this ? this.changes : 0); });
};

const contarPendientes = (callback) => {
    db.get(`SELECT (SELECT COUNT(*) FROM escuelas WHERE pendiente_revision = 1) as escuelas, (SELECT COUNT(*) FROM cargos_propuestos WHERE estado = 'pendiente') as cargos`, [], callback);
};

const obtenerPendientesViejos = (callback) => {
    db.all(`SELECT 'escuela' as tipo, nombre, fecha_creacion as fecha FROM escuelas WHERE pendiente_revision = 1 AND julianday('now') - julianday(fecha_creacion) > 10 UNION ALL SELECT 'cargo' as tipo, nombre, fecha_propuesta as fecha FROM cargos_propuestos WHERE estado = 'pendiente' AND julianday('now') - julianday(fecha_propuesta) > 10`, [], callback);
};

// ==================== ADMIN — ABM ====================

const agregarEscuelaAdmin = (nombre, areaId, tipoId, cue, direccion, barrio, distritoEscolar, numeroEscuela, callback) => {
    db.get(`SELECT nombre FROM areas WHERE id = ?`, [areaId], (err, area) => {
        if (err || !area) return callback(err || new Error('Área no encontrada'), null);
        db.get(`SELECT nombre FROM tipos_escuela WHERE id = ?`, [tipoId], (err, tipo) => {
            if (err || !tipo) return callback(err || new Error('Tipo no encontrado'), null);
            const nombreLimpio = nombre.toUpperCase().trim().replace(/\s+/g, ' ');
            db.run(`INSERT INTO escuelas (nombre, area_id, tipo_id, nivel, area_modalidad, cue, direccion, barrio, distrito_escolar, numero_escuela, origen, pendiente_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'oficial', 0)`,
                [nombreLimpio, areaId, tipoId, area.nombre, tipo.nombre, cue || null, direccion || null, barrio || null, distritoEscolar || null, numeroEscuela || null],
                function(err) { callback(err, this ? this.lastID : null); });
        });
    });
};

const agregarCargoAdmin = (nombre, tipoEscuelaDescripcion, callback) => {
    db.run(`INSERT INTO cargos_propuestos (nombre, tipo_escuela_descripcion, propuesto_por, estado, fecha_resolucion) VALUES (?, ?, 1, 'aprobado', CURRENT_TIMESTAMP)`,
        [nombre.trim(), tipoEscuelaDescripcion || null], function(err) { callback(err, this ? this.lastID : null); });
};

const editarCargoAdmin = (id, nombre, tipoEscuelaDescripcion, callback) => {
    db.run(`UPDATE cargos_propuestos SET nombre = ?, tipo_escuela_descripcion = ? WHERE id = ? AND estado = 'aprobado'`,
        [nombre.trim(), tipoEscuelaDescripcion || null, id], function(err) { callback(err, this ? this.changes : 0); });
};

const eliminarCargoAdmin = (nombre_cargo, id, callback) => {
    crearNotificacionCargoEliminado(nombre_cargo, () => {
        db.run(`DELETE FROM cargos_propuestos WHERE id = ? AND estado = 'aprobado'`, [id], function(err) {
            callback(err, this ? this.changes : 0);
        });
    });
};

const editarEscuelaAdmin = (id, nombre, cue, direccion, barrio, distritoEscolar, numeroEscuela, callback) => {
    const nombreLimpio = nombre.toUpperCase().trim().replace(/\s+/g, ' ');
    db.run(`UPDATE escuelas SET nombre = ?, cue = ?, direccion = ?, barrio = ?, distrito_escolar = ?, numero_escuela = ? WHERE id = ? AND pendiente_revision = 0`,
        [nombreLimpio, cue || null, direccion || null, barrio || null, distritoEscolar || null, numeroEscuela || null, id],
        function(err) { callback(err, this ? this.changes : 0); });
};

const eliminarEscuelaAdmin = (id, callback) => {
    db.get(`SELECT nombre FROM escuelas WHERE id = ?`, [id], (err, escuela) => {
        if (err || !escuela) return callback(err || new Error('Escuela no encontrada'));
        crearNotificacionEscuelaEliminada(id, escuela.nombre, () => {
            db.run(`DELETE FROM escuelas WHERE id = ? AND pendiente_revision = 0`, [id], function(err) {
                callback(err, this ? this.changes : 0);
            });
        });
    });
};

// ==================== ADMIN — ABM USUARIOS ====================

const obtenerTodosUsuarios = (callback) => {
    db.all(`SELECT id, email, nombre, dni, telefono, fecha_registro, activo, es_admin, email_verificado FROM usuarios ORDER BY fecha_registro DESC`, [], callback);
};

const actualizarUsuarioAdmin = (id, activo, es_admin, email_verificado, callback) => {
    db.run(`UPDATE usuarios SET activo = ?, es_admin = ?, email_verificado = ? WHERE id = ?`,
        [activo, es_admin, email_verificado, id], function(err) { callback(err, this ? this.changes : 0); });
};

const eliminarUsuarioAdmin = (id, callback) => {
    // Primero eliminar cargos del usuario
    db.run(`DELETE FROM cargos_intercambio WHERE usuario_id = ?`, [id], (err) => {
        if (err) return callback(err);
        db.run(`DELETE FROM notificaciones WHERE usuario_id = ?`, [id], (err) => {
            if (err) return callback(err);
            db.run(`DELETE FROM usuarios WHERE id = ?`, [id], function(err) {
                callback(err, this ? this.changes : 0);
            });
        });
    });
};

// ==================== COINCIDENCIAS ====================

const buscarCoincidencias = (cargoId, usuarioId, callback) => {
    db.get(`SELECT c.*, e.nombre as escuela_nombre FROM cargos_intercambio c LEFT JOIN escuelas e ON c.escuela_id = e.id WHERE c.id = ? AND c.usuario_id = ? AND c.activo = 1`,
        [cargoId, usuarioId], (err, miCargo) => {
            if (err || !miCargo) return callback(err, null);
            db.all(`SELECT c.*, u.nombre as docente_nombre, u.email, e.nombre as escuela_nombre FROM cargos_intercambio c JOIN usuarios u ON c.usuario_id = u.id JOIN escuelas e ON c.escuela_id = e.id WHERE c.materia = ? AND c.nivel = ? AND c.escuela_id != ? AND c.usuario_id != ? AND c.activo = 1`,
                [miCargo.materia, miCargo.nivel, miCargo.escuela_id, usuarioId],
                (err, coincidencias) => { callback(err, { mi_cargo: miCargo, coincidencias }); });
        });
};

module.exports = {
    db, initDatabase,
    registrarUsuario, buscarUsuarioPorEmail, buscarUsuarioPorDni,
    buscarUsuarioPorToken, verificarEmailUsuario, actualizarTokenVerificacion,
    guardarTokenReset, buscarUsuarioPorTokenReset, resetearPassword,
    registrarCargo, obtenerCargosPorUsuario, obtenerCargoPorId, actualizarCargo, eliminarCargo,
    obtenerAreas, obtenerTiposPorArea, crearTipo,
    obtenerEscuelas, buscarEscuelaPorCUE, buscarEscuelasPorNombre, obtenerEscuelasCatalogo,
    obtenerEscuelasAprobadas, crearEscuelaDocente, obtenerMisEscuelas, actualizarEscuelaDocente,
    proponerCargo, obtenerCargosPropuestosPendientes, resolverCargoPropuesto,
    obtenerCargosDisponibles, obtenerMisCargosPropuestos,
    obtenerNotificaciones, marcarNotificacionLeida, marcarTodasNotificacionesLeidas,
    crearNotificacionEscuelaEliminada, crearNotificacionCargoEliminado,
    obtenerEscuelasPendientes, aprobarEscuela, rechazarEscuela,
    contarPendientes, obtenerPendientesViejos,
    agregarEscuelaAdmin, agregarCargoAdmin, editarCargoAdmin, eliminarCargoAdmin,
    editarEscuelaAdmin, eliminarEscuelaAdmin,
    obtenerTodosUsuarios, actualizarUsuarioAdmin, eliminarUsuarioAdmin,
    buscarCoincidencias
};
