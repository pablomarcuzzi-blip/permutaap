const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'permutapp.db');
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
            es_admin INTEGER DEFAULT 0
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
            cue TEXT,
            tipo_original TEXT,
            origen TEXT DEFAULT 'oficial' CHECK (origen IN ('oficial', 'docente')),
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

        console.log('✅ Base de datos inicializada');
        insertarAreasYTiposIniciales();
    });
}

function insertarAreasYTiposIniciales() {
    db.get('SELECT COUNT(*) as count FROM areas', (err, row) => {
        if (err || row.count > 0) return;

        const areas = [
            'Inicial',
            'Primaria',
            'Secundaria',
            'Formación Docente/Terciarios'
        ];

        const stmtAreas = db.prepare('INSERT INTO areas (nombre) VALUES (?)');
        areas.forEach(area => stmtAreas.run(area));
        stmtAreas.finalize(() => {
            console.log('✅ Áreas insertadas');

            db.all('SELECT id, nombre FROM areas', (err, areasRows) => {
                if (err) return;

                const areaMap = {};
                areasRows.forEach(a => areaMap[a.nombre] = a.id);

                const tipos = [
                    // Inicial
                    ['Jardín Maternal',                 areaMap['Inicial']],
                    ['Jardín de Infantes',               areaMap['Inicial']],
                    // Primaria
                    ['Primaria Común',                   areaMap['Primaria']],
                    ['Primaria de Adultos (EPA/CENP)',   areaMap['Primaria']],
                    // Secundaria
                    ['Común (EEM, Liceo, Colegio, Normal)', areaMap['Secundaria']],
                    ['Técnica',                          areaMap['Secundaria']],
                    ['Comercial',                        areaMap['Secundaria']],
                    ['Artística',                        areaMap['Secundaria']],
                    ['CENS',                             areaMap['Secundaria']],
                    ['CFP/UGEE',                         areaMap['Secundaria']],
                    // Formación Docente/Terciarios
                    ['Normal/ISFD',                      areaMap['Formación Docente/Terciarios']],
                    ['Artística',                        areaMap['Formación Docente/Terciarios']],
                    ['INST',                             areaMap['Formación Docente/Terciarios']],
                ];

                const stmtTipos = db.prepare('INSERT INTO tipos_escuela (nombre, area_id) VALUES (?, ?)');
                tipos.forEach(tipo => stmtTipos.run(tipo[0], tipo[1]));
                stmtTipos.finalize(() => {
                    console.log('✅ Tipos de escuela insertados');
                });
            });
        });
    });
}

// ==================== USUARIOS ====================

const registrarUsuario = (email, password, nombre, dni, telefono, callback) => {
    const sql = `INSERT INTO usuarios (email, password, nombre, dni, telefono) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [email, password, nombre, dni, telefono], function(err) {
        callback(err, this ? this.lastID : null);
    });
};

const buscarUsuarioPorEmail = (email, callback) => {
    db.get(`SELECT * FROM usuarios WHERE email = ?`, [email], callback);
};

const buscarUsuarioPorDni = (dni, callback) => {
    db.get(`SELECT * FROM usuarios WHERE dni = ?`, [dni], callback);
};

// ==================== CARGOS ====================

const registrarCargo = (usuarioId, materia, nivel, area_modalidad, escuelaId, turno, horario, callback) => {
    const sql = `INSERT INTO cargos_intercambio (usuario_id, materia, año, nivel, area_modalidad, escuela_id, turno, horario) 
                 VALUES (?, ?, '', ?, ?, ?, ?, ?)`;
    db.run(sql, [usuarioId, materia, nivel, area_modalidad, escuelaId, turno, horario], function(err) {
        callback(err, this ? this.lastID : null);
    });
};

const obtenerCargosPorUsuario = (usuarioId, callback) => {
    const sql = `SELECT c.*, e.nombre as escuela_nombre, c.materia as cargo, a.nombre as area_nombre
                 FROM cargos_intercambio c
                 JOIN escuelas e ON c.escuela_id = e.id
                 JOIN areas a ON e.area_id = a.id
                 WHERE c.usuario_id = ? AND c.activo = 1
                 ORDER BY c.fecha_registro DESC`;
    db.all(sql, [usuarioId], callback);
};

const obtenerCargoPorId = (cargoId, usuarioId, callback) => {
    const sql = `SELECT c.*, e.nombre as escuela_nombre, c.materia as cargo 
                 FROM cargos_intercambio c
                 JOIN escuelas e ON c.escuela_id = e.id
                 WHERE c.id = ? AND c.usuario_id = ?`;
    db.get(sql, [cargoId, usuarioId], callback);
};

const actualizarCargo = (cargoId, usuarioId, materia, nivel, area_modalidad, escuelaId, turno, horario, callback) => {
    const sql = `UPDATE cargos_intercambio 
                 SET materia = ?, año = '', nivel = ?, area_modalidad = ?, escuela_id = ?, turno = ?, horario = ?
                 WHERE id = ? AND usuario_id = ?`;
    db.run(sql, [materia, nivel, area_modalidad, escuelaId, turno, horario, cargoId, usuarioId], function(err) {
        callback(err, this ? this.changes : 0);
    });
};

const eliminarCargo = (cargoId, usuarioId, callback) => {
    db.run(`DELETE FROM cargos_intercambio WHERE id = ? AND usuario_id = ?`,
        [cargoId, usuarioId], callback);
};

// ==================== ÁREAS Y TIPOS ====================

const obtenerAreas = (callback) => {
    db.all(`SELECT * FROM areas ORDER BY 
        CASE nombre 
            WHEN 'Inicial' THEN 1 
            WHEN 'Primaria' THEN 2 
            WHEN 'Secundaria' THEN 3 
            WHEN 'Formación Docente/Terciarios' THEN 4 
        END`, [], callback);
};

const obtenerTiposPorArea = (areaId, callback) => {
    const sql = `SELECT * FROM tipos_escuela WHERE area_id = ? ORDER BY
        CASE nombre
            WHEN 'Jardín Maternal' THEN 1
            WHEN 'Jardín de Infantes' THEN 2
            WHEN 'Primaria Común' THEN 3
            WHEN 'Primaria de Adultos (EPA/CENP)' THEN 4
            WHEN 'Común (EEM, Liceo, Colegio, Normal)' THEN 5
            WHEN 'Técnica' THEN 6
            WHEN 'Comercial' THEN 7
            WHEN 'Artística' THEN 8
            WHEN 'CENS' THEN 9
            WHEN 'CFP/UGEE' THEN 10
            WHEN 'Normal/ISFD' THEN 11
            WHEN 'INST' THEN 12
            ELSE 99
        END`;
    db.all(sql, [areaId], callback);
};

const crearTipo = (nombre, areaId, callback) => {
    const sql = `INSERT INTO tipos_escuela (nombre, area_id) VALUES (?, ?)`;
    db.run(sql, [nombre, areaId], function(err) {
        callback(err, this ? this.lastID : null);
    });
};

// ==================== ESCUELAS ====================

const obtenerEscuelas = (areaId, tipoId, usuarioId, callback) => {
    const sql = `SELECT e.*, a.nombre as area_nombre, t.nombre as tipo_nombre
                 FROM escuelas e
                 JOIN areas a ON e.area_id = a.id
                 LEFT JOIN tipos_escuela t ON e.tipo_id = t.id
                 WHERE e.area_id = ?
                 AND e.tipo_id = ?
                 AND (e.origen = 'oficial' OR (e.origen = 'docente' AND e.creado_por = ?))
                 ORDER BY e.origen DESC, e.nombre`;
    db.all(sql, [areaId, tipoId, usuarioId], callback);
};

const obtenerEscuelasCatalogo = (filtros, callback) => {
    let sql = `SELECT e.id, e.nombre, e.direccion, e.barrio, e.cue, e.tipo_original,
                      a.nombre as area, t.nombre as tipo
               FROM escuelas e
               JOIN areas a ON e.area_id = a.id
               JOIN tipos_escuela t ON e.tipo_id = t.id
               WHERE 1=1`;
    const params = [];

    if (filtros.area_id) { sql += ' AND e.area_id = ?'; params.push(filtros.area_id); }
    if (filtros.tipo_id) { sql += ' AND e.tipo_id = ?'; params.push(filtros.tipo_id); }
    if (filtros.search) {
        sql += ' AND (e.nombre LIKE ? OR e.direccion LIKE ? OR e.cue LIKE ?)';
        const s = `%${filtros.search}%`;
        params.push(s, s, s);
    }

    sql += ' ORDER BY e.nombre';
    db.all(sql, params, callback);
};

const crearEscuelaDocente = (nombre, areaId, tipoId, usuarioId, callback) => {
    db.get(`SELECT nombre FROM areas WHERE id = ?`, [areaId], (err, area) => {
        if (err || !area) return callback(err || new Error('Área no encontrada'), null);

        db.get(`SELECT nombre FROM tipos_escuela WHERE id = ?`, [tipoId], (err, tipo) => {
            if (err || !tipo) return callback(err || new Error('Tipo no encontrado'), null);

            const nombreLimpio = nombre.toUpperCase().trim().replace(/\s+/g, ' ');
            const sql = `INSERT INTO escuelas (nombre, area_id, tipo_id, nivel, area_modalidad, origen, creado_por) 
                         VALUES (?, ?, ?, ?, ?, 'docente', ?)`;
            db.run(sql, [nombreLimpio, areaId, tipoId, area.nombre, tipo.nombre, usuarioId], function(err) {
                callback(err, this ? this.lastID : null);
            });
        });
    });
};

const obtenerMisEscuelas = (usuarioId, callback) => {
    const sql = `SELECT e.*, a.nombre as area_nombre, t.nombre as tipo_nombre
                 FROM escuelas e
                 JOIN areas a ON e.area_id = a.id
                 JOIN tipos_escuela t ON e.tipo_id = t.id
                 WHERE e.creado_por = ? AND e.origen = 'docente'
                 ORDER BY e.fecha_creacion DESC`;
    db.all(sql, [usuarioId], callback);
};

const actualizarEscuelaDocente = (escuelaId, nombre, usuarioId, callback) => {
    const nombreLimpio = nombre.toUpperCase().trim().replace(/\s+/g, ' ');
    const sql = `UPDATE escuelas SET nombre = ? 
                 WHERE id = ? AND origen = 'docente' AND creado_por = ?`;
    db.run(sql, [nombreLimpio, escuelaId, usuarioId], function(err) {
        callback(err, this ? this.changes : 0);
    });
};

// ==================== COINCIDENCIAS ====================

const buscarCoincidencias = (cargoId, usuarioId, callback) => {
    const sqlMiCargo = `SELECT c.*, e.nombre as escuela_nombre 
                        FROM cargos_intercambio c
                        JOIN escuelas e ON c.escuela_id = e.id
                        WHERE c.id = ? AND c.usuario_id = ? AND c.activo = 1`;

    db.get(sqlMiCargo, [cargoId, usuarioId], (err, miCargo) => {
        if (err || !miCargo) return callback(err, null);

        const sqlCoincidencias = `SELECT c.*, u.nombre as docente_nombre, u.email, 
                                         e.nombre as escuela_nombre
                                  FROM cargos_intercambio c
                                  JOIN usuarios u ON c.usuario_id = u.id
                                  JOIN escuelas e ON c.escuela_id = e.id
                                  WHERE c.materia = ? 
                                  AND c.nivel = ?
                                  AND c.area_modalidad = ?
                                  AND c.escuela_id != ?
                                  AND c.usuario_id != ?
                                  AND c.activo = 1`;

        db.all(sqlCoincidencias,
            [miCargo.materia, miCargo.nivel, miCargo.area_modalidad, miCargo.escuela_id, usuarioId],
            (err, coincidencias) => {
                callback(err, { mi_cargo: miCargo, coincidencias });
            });
    });
};

module.exports = {
    db,
    initDatabase,
    registrarUsuario,
    buscarUsuarioPorEmail,
    buscarUsuarioPorDni,
    registrarCargo,
    obtenerCargosPorUsuario,
    obtenerCargoPorId,
    actualizarCargo,
    eliminarCargo,
    obtenerAreas,
    obtenerTiposPorArea,
    obtenerEscuelas,
    obtenerEscuelasCatalogo,
    crearEscuelaDocente,
    crearTipo,
    obtenerMisEscuelas,
    actualizarEscuelaDocente,
    buscarCoincidencias
};
