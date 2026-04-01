const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const {
    db, initDatabase,
    registrarUsuario, buscarUsuarioPorEmail, buscarUsuarioPorDni,
    buscarUsuarioPorToken, verificarEmailUsuario, actualizarTokenVerificacion,
    registrarCargo, obtenerCargosPorUsuario, obtenerCargoPorId, actualizarCargo, eliminarCargo,
    obtenerAreas, obtenerTiposPorArea, crearTipo,
    obtenerEscuelas, buscarEscuelaPorCUE, buscarEscuelasPorNombre, obtenerEscuelasCatalogo,
    obtenerEscuelasAprobadas, crearEscuelaDocente, obtenerMisEscuelas, actualizarEscuelaDocente,
    proponerCargo, obtenerCargosPropuestosPendientes, resolverCargoPropuesto,
    obtenerCargosDisponibles, obtenerMisCargosPropuestos,
    obtenerNotificaciones, marcarNotificacionLeida, marcarTodasNotificacionesLeidas,
    obtenerEscuelasPendientes, aprobarEscuela, rechazarEscuela,
    contarPendientes, obtenerPendientesViejos,
    agregarEscuelaAdmin, agregarCargoAdmin, editarCargoAdmin, eliminarCargoAdmin,
    editarEscuelaAdmin, eliminarEscuelaAdmin,
    buscarCoincidencias
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'permutapp_secret_key';
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_QfoByixD_pWcnffJzDo2Dbs3FoBvpGi27';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());
app.use(express.static('publico'));

initDatabase();

// ==================== EMAIL (RESEND) ====================

async function enviarEmail(to, subject, html) {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'PermutApp <onboarding@resend.dev>',
            to,
            subject,
            html
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al enviar email');
    return data;
}

async function enviarEmailVerificacion(email, nombre, token) {
    const link = `${BASE_URL}/verificar-email.html?token=${token}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px;">
            <h2 style="color: #667eea;">📚 PermutApp</h2>
            <p>Hola <strong>${nombre}</strong>,</p>
            <p>Gracias por registrarte. Para activar tu cuenta, hacé clic en el siguiente botón:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${link}" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                    Verificar mi cuenta
                </a>
            </div>
            <p style="color: #666; font-size: 14px;">Este enlace vence en 48 horas. Si no te registraste en PermutApp, ignorá este mensaje.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">PermutApp — Intercambio de Cargos Docentes CABA</p>
        </div>
    `;
    return enviarEmail(email, 'Verificá tu cuenta en PermutApp', html);
}

// ==================== MIDDLEWARE ====================

const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) { res.status(401).json({ error: 'Token inválido' }); }
};

const adminMiddleware = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
        req.userId = decoded.userId;
        db.get('SELECT es_admin FROM usuarios WHERE id = ?', [req.userId], (err, user) => {
            if (err || !user || user.es_admin !== 1) return res.status(403).json({ error: 'Acceso denegado' });
            next();
        });
    } catch (err) { res.status(401).json({ error: 'Token inválido' }); }
};

// ==================== AUTH ====================

app.post('/api/registro', async (req, res) => {
    const { email, password, nombre, telefono } = req.body;
    if (!email || !password || !nombre) return res.status(400).json({ error: 'Faltan datos obligatorios' });

    // Validar dominio @bue.edu.ar
    if (!email.toLowerCase().endsWith('@bue.edu.ar')) {
        return res.status(400).json({ error: 'Solo se permite el correo institucional (@bue.edu.ar)' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        buscarUsuarioPorEmail(email, async (err, user) => {
            if (user) return res.status(409).json({ error: 'Email ya registrado' });

            // Generar token de verificación
            const token = crypto.randomBytes(32).toString('hex');
            const tokenExpira = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

            registrarUsuario(email, hashedPassword, nombre, 'TEMP_' + Date.now(), telefono, token, tokenExpira, async (err, userId) => {
                if (err) return res.status(500).json({ error: err.message });

                // Enviar email de verificación
                try {
                    await enviarEmailVerificacion(email, nombre, token);
                } catch (emailErr) {
                    console.error('Error al enviar email de verificación:', emailErr.message);
                    // No bloquear el registro si falla el email, pero avisamos
                }

                res.status(201).json({ message: 'Cuenta creada. Revisá tu correo para verificar tu cuenta.' });
            });
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    buscarUsuarioPorEmail(email, async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Credenciales inválidas' });
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Credenciales inválidas' });

        // Verificar si el email fue confirmado
        if (!user.email_verificado) {
            return res.status(403).json({ error: 'email_no_verificado', userId: user.id });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, usuario: { id: user.id, nombre: user.nombre, email: user.email, es_admin: user.es_admin === 1 } });
    });
});

// ==================== VERIFICACIÓN DE EMAIL ====================

app.get('/api/verificar-email', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    buscarUsuarioPorToken(token, (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Token inválido' });

        // Verificar si venció
        if (new Date(user.token_expira) < new Date()) {
            return res.status(410).json({ error: 'token_vencido', userId: user.id });
        }

        verificarEmailUsuario(user.id, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Email verificado correctamente' });
        });
    });
});

app.post('/api/reenviar-verificacion', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    buscarUsuarioPorEmail(email, async (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (user.email_verificado) return res.status(400).json({ error: 'Este correo ya fue verificado' });

        const token = crypto.randomBytes(32).toString('hex');
        const tokenExpira = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        actualizarTokenVerificacion(user.id, token, tokenExpira, async (err) => {
            if (err) return res.status(500).json({ error: err.message });
            try {
                await enviarEmailVerificacion(user.email, user.nombre, token);
                res.json({ message: 'Email de verificación reenviado' });
            } catch (emailErr) {
                res.status(500).json({ error: 'No se pudo enviar el email. Intentá más tarde.' });
            }
        });
    });
});

app.get('/api/usuario', authMiddleware, (req, res) => {
    db.get('SELECT id, email, nombre, dni, telefono, es_admin FROM usuarios WHERE id = ?', [req.userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(user);
    });
});

// ==================== NOTIFICACIONES ====================

app.get('/api/notificaciones', authMiddleware, (req, res) => {
    obtenerNotificaciones(req.userId, (err, notifs) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(notifs);
    });
});

app.post('/api/notificaciones/:id/leer', authMiddleware, (req, res) => {
    marcarNotificacionLeida(req.params.id, req.userId, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'OK' });
    });
});

app.post('/api/notificaciones/leer-todas', authMiddleware, (req, res) => {
    marcarTodasNotificacionesLeidas(req.userId, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'OK' });
    });
});

// ==================== CARGOS ====================

app.post('/api/cargos', authMiddleware, (req, res) => {
    const { cargo, area_id, escuela_id, turno, horario } = req.body;
    const usuarioId = req.userId;
    if (!cargo || !area_id || !escuela_id || !turno) return res.status(400).json({ error: 'Faltan datos obligatorios' });

    db.get('SELECT nivel, area_modalidad FROM escuelas WHERE id = ?', [escuela_id], (err, escuela) => {
        if (err || !escuela) return res.status(500).json({ error: 'Error al obtener datos de la escuela' });

        db.get(`SELECT id FROM cargos_intercambio WHERE usuario_id = ? AND materia = ? AND escuela_id = ? AND activo = 1`,
            [usuarioId, cargo, escuela_id], (err, existingCargo) => {
                if (err) return res.status(500).json({ error: err.message });
                if (existingCargo) return res.status(409).json({ error: 'Ya tienes registrado este cargo en esta escuela' });

                registrarCargo(usuarioId, cargo, escuela.nivel, escuela.area_modalidad, escuela_id, turno, horario, (err, cargoId) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.status(201).json({ message: 'Cargo registrado', id: cargoId });
                });
            });
    });
});

app.get('/api/cargos', authMiddleware, (req, res) => {
    obtenerCargosPorUsuario(req.userId, (err, cargos) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(cargos);
    });
});

app.get('/api/cargos/:id', authMiddleware, (req, res) => {
    obtenerCargoPorId(req.params.id, req.userId, (err, cargo) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!cargo) return res.status(404).json({ error: 'Cargo no encontrado' });
        res.json(cargo);
    });
});

app.put('/api/cargos/:id', authMiddleware, (req, res) => {
    const { cargo, area_id, escuela_id, turno, horario } = req.body;
    if (!cargo || !area_id || !escuela_id || !turno) return res.status(400).json({ error: 'Faltan datos obligatorios' });
    db.get('SELECT nivel, area_modalidad FROM escuelas WHERE id = ?', [escuela_id], (err, escuela) => {
        if (err || !escuela) return res.status(500).json({ error: 'Error al obtener datos de la escuela' });
        actualizarCargo(req.params.id, req.userId, cargo, escuela.nivel, escuela.area_modalidad, escuela_id, turno, horario, (err, changes) => {
            if (err) return res.status(500).json({ error: err.message });
            if (changes === 0) return res.status(404).json({ error: 'Cargo no encontrado' });
            res.json({ message: 'Cargo actualizado' });
        });
    });
});

app.delete('/api/cargos/:id', authMiddleware, (req, res) => {
    eliminarCargo(req.params.id, req.userId, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Cargo eliminado' });
    });
});

// ==================== CARGOS DISPONIBLES ====================

app.get('/api/cargos-disponibles', authMiddleware, (req, res) => {
    obtenerCargosDisponibles((err, cargos) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(cargos);
    });
});

app.get('/api/mis-cargos-propuestos', authMiddleware, (req, res) => {
    obtenerMisCargosPropuestos(req.userId, (err, cargos) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(cargos);
    });
});

// ==================== ÁREAS Y TIPOS ====================

app.get('/api/areas', (req, res) => {
    obtenerAreas((err, areas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(areas);
    });
});

app.get('/api/tipos/:areaId', (req, res) => {
    obtenerTiposPorArea(req.params.areaId, (err, tipos) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(tipos);
    });
});

// ==================== ESCUELAS ====================

app.get('/api/escuelas', authMiddleware, (req, res) => {
    const { area_id, tipo_id } = req.query;
    if (!area_id) return res.status(400).json({ error: 'area_id requerido' });
    obtenerEscuelas(area_id, tipo_id, req.userId, (err, escuelas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(escuelas);
    });
});

app.get('/api/escuelas/buscar-cue/:cue', authMiddleware, (req, res) => {
    const { area_id } = req.query;
    const cue = req.params.cue;

    if (area_id) {
        db.get(`SELECT e.*, a.nombre as area_nombre, t.nombre as tipo_nombre 
                FROM escuelas e 
                JOIN areas a ON e.area_id = a.id 
                LEFT JOIN tipos_escuela t ON e.tipo_id = t.id 
                WHERE e.cue = ? AND e.area_id = ? AND e.pendiente_revision != 2`,
            [cue.trim(), area_id], (err, escuela) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!escuela) return res.json({ encontrada: false });
                res.json({ encontrada: true, escuela });
            });
    } else {
        buscarEscuelaPorCUE(cue, (err, escuela) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!escuela) return res.json({ encontrada: false });
            res.json({ encontrada: true, escuela });
        });
    }
});

app.get('/api/escuelas/buscar-nombre', authMiddleware, (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 3) return res.json([]);
    buscarEscuelasPorNombre(q, (err, escuelas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(escuelas);
    });
});

app.get('/api/catalogo-escuelas', authMiddleware, (req, res) => {
    const filtros = { area_id: req.query.area_id, tipo_id: req.query.tipo_id, search: req.query.search };
    obtenerEscuelasCatalogo(filtros, (err, escuelas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(escuelas);
    });
});

app.post('/api/escuelas', authMiddleware, (req, res) => {
    const { nombre, area_id, tipo_id, cue, direccion, barrio, distrito_escolar, numero_escuela } = req.body;
    if (!nombre || !area_id || !tipo_id || !cue) return res.status(400).json({ error: 'Nombre, área, tipo y CUE son obligatorios' });

    db.get(`SELECT e.*, a.nombre as area_nombre FROM escuelas e JOIN areas a ON e.area_id = a.id WHERE e.cue = ? AND e.area_id = ? AND e.pendiente_revision != 2`,
        [cue, area_id], (err, existente) => {
            if (err) return res.status(500).json({ error: err.message });
            if (existente) {
                return res.status(409).json({
                    error: `Ya existe una escuela con ese CUE en el área ${existente.area_nombre}: ${existente.nombre}`,
                    escuela: existente
                });
            }

            crearEscuelaDocente(nombre, area_id, tipo_id, cue, direccion, barrio, distrito_escolar, numero_escuela, req.userId, (err, escuelaId) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: 'Escuela enviada para revisión', id: escuelaId });
            });
        });
});

app.post('/api/tipos', authMiddleware, (req, res) => {
    const { nombre, area_id } = req.body;
    if (!nombre || !area_id) return res.status(400).json({ error: 'Nombre y área requeridos' });
    crearTipo(nombre, area_id, (err, tipoId) => {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Tipo ya existe' });
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Tipo creado', id: tipoId });
    });
});

app.get('/api/mis-escuelas', authMiddleware, (req, res) => {
    obtenerMisEscuelas(req.userId, (err, escuelas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(escuelas);
    });
});

app.put('/api/escuelas/:id', authMiddleware, (req, res) => {
    const { nombre } = req.body;
    actualizarEscuelaDocente(req.params.id, nombre, req.userId, (err, changes) => {
        if (err) return res.status(500).json({ error: err.message });
        if (changes === 0) return res.status(403).json({ error: 'No autorizado' });
        res.json({ message: 'Escuela actualizada' });
    });
});

app.delete('/api/escuelas/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM escuelas WHERE id = ? AND creado_por = ?', [req.params.id, req.userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(403).json({ error: 'No autorizado o escuela no encontrada' });
        res.json({ message: 'Escuela eliminada' });
    });
});

// ==================== CARGOS PROPUESTOS ====================

app.post('/api/cargos-propuestos', authMiddleware, (req, res) => {
    const { nombre, tipo_escuela_descripcion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre del cargo requerido' });
    proponerCargo(nombre, tipo_escuela_descripcion, req.userId, (err, id) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Cargo propuesto', id });
    });
});

// ==================== COINCIDENCIAS ====================

app.get('/api/coincidencias/:cargoId', authMiddleware, (req, res) => {
    buscarCoincidencias(req.params.cargoId, req.userId, (err, resultado) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!resultado) return res.status(404).json({ error: 'Cargo no encontrado' });
        res.json(resultado.coincidencias);
    });
});

// ==================== ADMIN ====================

app.get('/api/admin/pendientes/count', adminMiddleware, (req, res) => {
    contarPendientes((err, conteo) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(conteo);
    });
});

app.get('/api/admin/escuelas-pendientes', adminMiddleware, (req, res) => {
    obtenerEscuelasPendientes((err, escuelas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(escuelas);
    });
});

app.post('/api/admin/escuelas/:id/aprobar', adminMiddleware, (req, res) => {
    aprobarEscuela(req.params.id, (err, changes) => {
        if (err) return res.status(500).json({ error: err.message });
        if (changes === 0) return res.status(404).json({ error: 'Escuela no encontrada' });
        res.json({ message: 'Escuela aprobada' });
    });
});

app.post('/api/admin/escuelas/:id/rechazar', adminMiddleware, (req, res) => {
    const { motivo } = req.body;
    rechazarEscuela(req.params.id, motivo, (err, changes) => {
        if (err) return res.status(500).json({ error: err.message });
        if (changes === 0) return res.status(404).json({ error: 'Escuela no encontrada' });
        res.json({ message: 'Escuela rechazada' });
    });
});

app.get('/api/admin/cargos-propuestos', adminMiddleware, (req, res) => {
    obtenerCargosPropuestosPendientes((err, cargos) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(cargos);
    });
});

app.post('/api/admin/cargos-propuestos/:id/aprobar', adminMiddleware, (req, res) => {
    db.get('SELECT * FROM cargos_propuestos WHERE id = ?', [req.params.id], (err, cargo) => {
        if (err || !cargo) return res.status(404).json({ error: 'Cargo no encontrado' });

        db.get(`SELECT id FROM cargos_propuestos WHERE nombre = ? AND estado = 'aprobado'`,
            [cargo.nombre], (err, existente) => {
                if (err) return res.status(500).json({ error: err.message });
                if (existente) return res.status(409).json({ error: `Ya existe un cargo aprobado con el nombre "${cargo.nombre}"` });

                resolverCargoPropuesto(req.params.id, 'aprobado', null, (err, changes) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (changes === 0) return res.status(404).json({ error: 'Cargo no encontrado' });
                    res.json({ message: 'Cargo aprobado y disponible en el selector' });
                });
            });
    });
});

app.post('/api/admin/cargos-propuestos/:id/rechazar', adminMiddleware, (req, res) => {
    const { motivo } = req.body;
    resolverCargoPropuesto(req.params.id, 'rechazado', motivo, (err, changes) => {
        if (err) return res.status(500).json({ error: err.message });
        if (changes === 0) return res.status(404).json({ error: 'Cargo no encontrado' });
        res.json({ message: 'Cargo rechazado' });
    });
});

// ABM Escuelas
app.get('/api/admin/escuelas', adminMiddleware, (req, res) => {
    obtenerEscuelasAprobadas((err, escuelas) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(escuelas);
    });
});

app.post('/api/admin/escuelas', adminMiddleware, (req, res) => {
    const { nombre, area_id, tipo_id, cue, direccion, barrio, distrito_escolar, numero_escuela } = req.body;
    if (!nombre || !area_id || !tipo_id) return res.status(400).json({ error: 'Nombre, área y tipo son obligatorios' });
    agregarEscuelaAdmin(nombre, area_id, tipo_id, cue, direccion, barrio, distrito_escolar, numero_escuela, (err, id) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Escuela agregada', id });
    });
});

app.put('/api/admin/escuelas/:id', adminMiddleware, (req, res) => {
    const { nombre, cue, direccion, barrio, distrito_escolar, numero_escuela } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    editarEscuelaAdmin(req.params.id, nombre, cue, direccion, barrio, distrito_escolar, numero_escuela, (err, changes) => {
        if (err) return res.status(500).json({ error: err.message });
        if (changes === 0) return res.status(404).json({ error: 'Escuela no encontrada' });
        res.json({ message: 'Escuela actualizada' });
    });
});

app.delete('/api/admin/escuelas/:id', adminMiddleware, (req, res) => {
    eliminarEscuelaAdmin(req.params.id, (err, changes) => {
        if (err) return res.status(500).json({ error: err.message });
        if (changes === 0) return res.status(404).json({ error: 'Escuela no encontrada' });
        res.json({ message: 'Escuela eliminada' });
    });
});

// ABM Cargos
app.get('/api/admin/cargos', adminMiddleware, (req, res) => {
    obtenerCargosDisponibles((err, cargos) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(cargos);
    });
});

app.post('/api/admin/cargos', adminMiddleware, (req, res) => {
    const { nombre, tipo_escuela_descripcion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre del cargo requerido' });
    agregarCargoAdmin(nombre, tipo_escuela_descripcion, (err, id) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Cargo agregado', id });
    });
});

app.put('/api/admin/cargos/:id', adminMiddleware, (req, res) => {
    const { nombre, tipo_escuela_descripcion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    editarCargoAdmin(req.params.id, nombre, tipo_escuela_descripcion, (err, changes) => {
        if (err) return res.status(500).json({ error: err.message });
        if (changes === 0) return res.status(404).json({ error: 'Cargo no encontrado' });
        res.json({ message: 'Cargo actualizado' });
    });
});

app.delete('/api/admin/cargos/:id', adminMiddleware, (req, res) => {
    db.get('SELECT nombre FROM cargos_propuestos WHERE id = ?', [req.params.id], (err, cargo) => {
        if (err || !cargo) return res.status(404).json({ error: 'Cargo no encontrado' });
        eliminarCargoAdmin(cargo.nombre, req.params.id, (err, changes) => {
            if (err) return res.status(500).json({ error: err.message });
            if (changes === 0) return res.status(404).json({ error: 'Cargo no encontrado' });
            res.json({ message: 'Cargo eliminado' });
        });
    });
});

app.get('/api/admin/pendientes-viejos', adminMiddleware, (req, res) => {
    obtenerPendientesViejos((err, pendientes) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(pendientes);
    });
});

// ==================== RUTA PRINCIPAL ====================

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// ==================== INICIAR SERVIDOR ====================

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
