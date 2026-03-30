// dashboard.js - PermutApp

let usuarioActual = null;
let areas = [];
let tiposEscuela = [];
let escuelas = [];
let misEscuelas = [];
let cargos = [];
let cargoEditando = null;
let cargosPropuestosUsuario = [];
let submitListenerAgregado = false;

const CARGOS_CON_AÑO = ['Profesor/a', 'Maestr/a'];
const AREAS_MAESTRO = ['Inicial', 'Primaria'];

const GRUPOS_CARGO = {
    'Maestr/a': 'Maestr/a',
    'Rector': 'Conducción', 'Director': 'Conducción', 'Vicerrector': 'Conducción',
    'Vicedirector': 'Conducción', 'Secretario': 'Conducción', 'Prosecretario': 'Conducción',
    'Jefe de Preceptores': 'Preceptoría', 'Subjefe de Preceptores': 'Preceptoría', 'Preceptor': 'Preceptoría',
    'Bibliotecario': 'Biblioteca',
    'ACP': 'Laboratorio y prácticas', 'Ayudante de Laboratorio': 'Laboratorio y prácticas',
    'Jefe de Laboratorio': 'Laboratorio y prácticas',
    'Profesor/a': 'Profesores'
};

function obtenerGrupo(nombreCargo) {
    for (const [prefijo, grupo] of Object.entries(GRUPOS_CARGO)) {
        if (nombreCargo.startsWith(prefijo)) return grupo;
    }
    return 'Otros';
}

// ==========================================
// MODAL CONFIRMACIÓN (reemplaza confirm())
// ==========================================

let _confirmCallback = null;

function mostrarConfirm(mensaje, callback, titulo = '¿Estás seguro?', icono = '⚠️') {
    document.getElementById('confirmMensaje').textContent = mensaje;
    document.getElementById('confirmTitulo').textContent = titulo;
    document.getElementById('confirmIcon').textContent = icono;
    _confirmCallback = callback;
    document.getElementById('modalConfirm').style.display = 'flex';
}

function cerrarConfirm() {
    document.getElementById('modalConfirm').style.display = 'none';
    _confirmCallback = null;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirmAceptar').onclick = () => {
        cerrarConfirm();
        if (_confirmCallback) _confirmCallback();
    };
});

// ==========================================
// INIT
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    await cargarUsuario();
    await cargarDatosIniciales();
    await cargarMisEscuelas();
    await cargarMisCargos();
    await cargarMisCargosPropuestos();
    await cargarNotificaciones();

    if (!submitListenerAgregado) {
        document.getElementById('cargoForm').addEventListener('submit', guardarCargo);
        submitListenerAgregado = true;
    }
    document.getElementById('area').addEventListener('change', onAreaChange);
    document.getElementById('tipo').addEventListener('change', onTipoChange);
    document.getElementById('escuela').addEventListener('change', onEscuelaChange);
    document.getElementById('cargo').addEventListener('change', onCargoChange);
});

async function cargarUsuario() {
    try {
        const response = await fetch('/api/usuario', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            usuarioActual = await response.json();
            document.getElementById('userName').textContent = usuarioActual.nombre;
            if (usuarioActual.es_admin) {
                document.getElementById('adminLink').style.display = 'inline';
                cargarBadgeAdmin();
            }
        } else { logout(); }
    } catch (error) { logout(); }
}

async function cargarBadgeAdmin() {
    try {
        const res = await fetch('/api/admin/pendientes/count', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const total = (data.escuelas || 0) + (data.cargos || 0);
        const badge = document.getElementById('adminBadge');
        if (total > 0) { badge.textContent = total; badge.style.display = 'inline'; }
    } catch (e) {}
}

// ==========================================
// NOTIFICACIONES
// ==========================================

async function cargarNotificaciones() {
    try {
        const res = await fetch('/api/notificaciones', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) return;
        const notifs = await res.json();
        if (notifs.length === 0) return;

        // Agrupar por tipo para el banner
        const nombresEscuelas = notifs.filter(n => n.tipo === 'escuela_eliminada').map(n => n.nombre);
        const nombresCargos = notifs.filter(n => n.tipo === 'cargo_eliminado').map(n => n.nombre);

        let mensajeBanner = '⚠️ ';
        const partes = [];
        if (nombresEscuelas.length > 0) partes.push(`La escuela "${[...new Set(nombresEscuelas)].join('", "')}" fue eliminada`);
        if (nombresCargos.length > 0) partes.push(`El cargo "${[...new Set(nombresCargos)].join('", "')}" fue eliminado`);
        mensajeBanner += partes.join(' · ');

        const banner = document.createElement('div');
        banner.id = 'bannerNotificaciones';
        banner.style.cssText = 'background:#fff3cd;border:1px solid #ffc107;color:#856404;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;font-size:0.9rem;';
        banner.innerHTML = `
            <span>${mensajeBanner}</span>
            <button onclick="marcarTodasLeidas()" style="background:#856404;color:white;border:none;padding:5px 12px;border-radius:12px;cursor:pointer;font-size:0.85rem;white-space:nowrap;margin-left:10px;">Marcar como leídas</button>
        `;
        document.querySelector('.container').insertBefore(banner, document.querySelector('.content'));

        notifs.forEach(n => {
            window._notificaciones = window._notificaciones || {};
            window._notificaciones[n.cargo_intercambio_id] = n;
        });
    } catch (e) {}
}

async function marcarTodasLeidas() {
    await fetch('/api/notificaciones/leer-todas', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const banner = document.getElementById('bannerNotificaciones');
    if (banner) banner.remove();
    window._notificaciones = {};
    mostrarCargos();
}

// ==========================================
// DATOS INICIALES
// ==========================================

async function cargarDatosIniciales() {
    try {
        const areasRes = await fetch('/api/areas');
        areas = await areasRes.json();

        const areaSelect = document.getElementById('area');
        areaSelect.innerHTML = '<option value="">Seleccionar área...</option>';
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area.id; option.textContent = area.nombre;
            areaSelect.appendChild(option);
        });

        // Poblar también el selector de área del modal nueva escuela
        const areaModalSelect = document.getElementById('nuevaEscuelaAreaPaso1');
        if (areaModalSelect) {
            areaModalSelect.innerHTML = '<option value="">Seleccionar área...</option>';
            areas.forEach(area => {
                const option = document.createElement('option');
                option.value = area.id; option.textContent = area.nombre;
                areaModalSelect.appendChild(option);
            });
        }

        await cargarCargosDisponibles();
        await cargarTiposEnModal();
    } catch (error) { console.error('Error cargando datos iniciales:', error); }
}

async function cargarCargosDisponibles() {
    try {
        const res = await fetch('/api/cargos-disponibles', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const cargosDisponibles = await res.json();

        const resProp = await fetch('/api/mis-cargos-propuestos', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const propuestos = resProp.ok ? await resProp.json() : [];
        const pendientes = propuestos.filter(p => p.estado === 'pendiente');

        const select = document.getElementById('cargo');
        const grupos = {};
        cargosDisponibles.forEach(c => {
            const grupo = obtenerGrupo(c.nombre);
            if (!grupos[grupo]) grupos[grupo] = [];
            grupos[grupo].push(c.nombre);
        });

        select.innerHTML = '<option value="">Seleccionar cargo...</option>';

        if (grupos['Maestr/a']) {
            const og = document.createElement('optgroup');
            og.label = 'Maestr/a'; og.id = 'optgroupMaestro';
            grupos['Maestr/a'].forEach(nombre => {
                const opt = document.createElement('option');
                opt.value = nombre; opt.textContent = nombre;
                og.appendChild(opt);
            });
            select.appendChild(og);
            delete grupos['Maestr/a'];
        }

        const ordenGrupos = ['Conducción', 'Preceptoría', 'Biblioteca', 'Profesores', 'Laboratorio y prácticas'];
        const gruposOrdenados = [
            ...ordenGrupos.filter(g => grupos[g]),
            ...Object.keys(grupos).filter(g => !ordenGrupos.includes(g) && g !== 'Otros'),
            ...(grupos['Otros'] ? ['Otros'] : [])
        ];
        gruposOrdenados.forEach(nombreGrupo => {
            if (!grupos[nombreGrupo]) return;
            const og = document.createElement('optgroup');
            og.label = nombreGrupo;
            grupos[nombreGrupo].sort().forEach(nombre => {
                const opt = document.createElement('option');
                opt.value = nombre; opt.textContent = nombre;
                og.appendChild(opt);
            });
            select.appendChild(og);
        });

        if (pendientes.length > 0) {
            const ogPend = document.createElement('optgroup');
            ogPend.label = '🟡 Mis propuestas pendientes';
            pendientes.forEach(p => {
                const opt = document.createElement('option');
                opt.value = `propuesto_${p.id}__${p.nombre}`;
                opt.textContent = `🟡 ${p.nombre}`;
                ogPend.appendChild(opt);
            });
            select.appendChild(ogPend);
        }

        const ogExtra = document.createElement('optgroup');
        ogExtra.label = '─────────────';
        const optProponer = document.createElement('option');
        optProponer.value = 'proponer_cargo';
        optProponer.textContent = '📩 Proponer nuevo cargo...';
        ogExtra.appendChild(optProponer);
        select.appendChild(ogExtra);

    } catch (error) { console.error('Error cargando cargos disponibles:', error); }
}

async function cargarTiposEnModal() {
    try {
        const select = document.getElementById('propCargoTipo');
        select.innerHTML = '<option value="">Todos los tipos...</option>';
        for (const area of areas) {
            const res = await fetch(`/api/tipos/${area.id}`);
            const tipos = await res.json();
            if (tipos.length > 0) {
                const og = document.createElement('optgroup');
                og.label = area.nombre;
                tipos.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.nombre; opt.textContent = t.nombre;
                    og.appendChild(opt);
                });
                select.appendChild(og);
            }
        }
    } catch (e) {}
}

async function cargarMisEscuelas() {
    try {
        const response = await fetch('/api/mis-escuelas', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            misEscuelas = await response.json();
            actualizarListaMisEscuelas();
        }
    } catch (error) {}
}

// ==========================================
// CARTELES — localStorage
// ==========================================

function getCartelesOcultos() {
    try { return JSON.parse(localStorage.getItem('cartelesOcultos_' + (usuarioActual?.id || '')) || '[]'); }
    catch { return []; }
}

function ocultarCartel(tipo, id) {
    const ocultos = getCartelesOcultos();
    const key = `${tipo}_${id}`;
    if (!ocultos.includes(key)) ocultos.push(key);
    localStorage.setItem('cartelesOcultos_' + (usuarioActual?.id || ''), JSON.stringify(ocultos));
    actualizarListaMisEscuelas();
    renderSeccionPropuestos();
}

function limpiarCartelesObsoletos() {
    const ocultos = getCartelesOcultos();
    const idsEscuelasActivas = misEscuelas.filter(e => e.pendiente_revision !== 0).map(e => `escuela_${e.id}`);
    const idsCargosActivos = cargosPropuestosUsuario.filter(p => p.estado !== 'aprobado').map(p => `cargo_${p.id}`);
    const activos = [...idsEscuelasActivas, ...idsCargosActivos];
    const filtrados = ocultos.filter(k => activos.includes(k));
    localStorage.setItem('cartelesOcultos_' + (usuarioActual?.id || ''), JSON.stringify(filtrados));
}

// ==========================================
// SIDEBAR ESCUELAS
// ==========================================

function actualizarListaMisEscuelas() {
    const lista = document.getElementById('misEscuelasList');
    const ocultos = getCartelesOcultos();
    const aprobadas = misEscuelas.filter(e => e.pendiente_revision === 0);
    const notificaciones = misEscuelas.filter(e =>
        e.pendiente_revision !== 0 && !ocultos.includes(`escuela_${e.id}`)
    );

    if (aprobadas.length === 0 && misEscuelas.filter(e => e.pendiente_revision !== 0).length === 0) {
        lista.innerHTML = '<li style="border-left-color:#999;color:#999;">No tienes escuelas agregadas</li>';
        return;
    }

    lista.innerHTML = '';

    // Aprobadas — sin botón eliminar
    aprobadas.forEach(escuela => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${escuela.nombre}</span>`;
        lista.appendChild(li);
    });

    // Pendientes/rechazadas con cartel
    notificaciones.forEach(escuela => {
        let estadoHTML = '', borderColor = '#ffc107', bgColor = '#fff9e6';
        if (escuela.pendiente_revision === 1) {
            estadoHTML = '<span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:10px;font-size:0.75rem;">🟡 Pendiente</span>';
        } else if (escuela.pendiente_revision === 2) {
            borderColor = '#dc3545'; bgColor = '#fff5f5';
            estadoHTML = '<span style="background:#f8d7da;color:#721c24;padding:2px 8px;border-radius:10px;font-size:0.75rem;">❌ Rechazada</span>';
        }
        const li = document.createElement('li');
        li.style.cssText = `border-left-color:${borderColor};background:${bgColor};flex-direction:column;align-items:flex-start;gap:6px;`;
        li.innerHTML = `
            <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
                <strong style="font-size:0.9rem;">${escuela.nombre}</strong>
                <div style="display:flex;gap:6px;">
                    <button onclick="eliminarMiEscuela(${escuela.id})" title="Eliminar" style="background:none;border:none;cursor:pointer;font-size:1rem;">🗑️</button>
                    <button onclick="ocultarCartel('escuela', ${escuela.id})" title="Cerrar" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#999;">✕</button>
                </div>
            </div>
            <div>${estadoHTML}</div>
            ${escuela.pendiente_revision === 2 && escuela.motivo_rechazo ? `<div style="font-size:0.8rem;color:#721c24;">Motivo: ${escuela.motivo_rechazo}</div>` : ''}
        `;
        lista.appendChild(li);
    });
}

// ==========================================
// CARGOS
// ==========================================

async function cargarMisCargos() {
    try {
        const response = await fetch('/api/cargos', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            cargos = await response.json();
            mostrarCargos();
        }
    } catch (error) {}
}

async function cargarMisCargosPropuestos() {
    try {
        const res = await fetch('/api/mis-cargos-propuestos', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) return;
        cargosPropuestosUsuario = await res.json();
        limpiarCartelesObsoletos();
        renderSeccionPropuestos();
    } catch (e) {}
}

function renderSeccionPropuestos() {
    const seccionAnterior = document.getElementById('seccionPropuestos');
    if (seccionAnterior) seccionAnterior.remove();

    const ocultos = getCartelesOcultos();
    const visibles = cargosPropuestosUsuario.filter(p => !ocultos.includes(`cargo_${p.id}`));
    if (visibles.length === 0) return;

    const container = document.getElementById('cargosList');
    const seccion = document.createElement('div');
    seccion.id = 'seccionPropuestos';
    seccion.style.marginTop = '20px';
    seccion.innerHTML = `<h3 style="color:#667eea;margin-bottom:15px;font-size:1rem;border-bottom:2px solid #e0e0e0;padding-bottom:8px;">📩 Mis cargos propuestos</h3>`;

    visibles.forEach(p => {
        const card = document.createElement('div');
        card.className = 'cargo-card';
        let borderColor = '#ffc107';
        let estadoHTML = p.estado === 'pendiente'
            ? '<span style="background:#fff3cd;color:#856404;padding:3px 10px;border-radius:10px;font-size:0.8rem;">🟡 Pendiente de aprobación</span>'
            : '<span style="background:#f8d7da;color:#721c24;padding:3px 10px;border-radius:10px;font-size:0.8rem;">❌ Rechazado</span>';
        if (p.estado === 'rechazado') borderColor = '#dc3545';

        card.style.borderColor = borderColor;
        card.innerHTML = `
            <div class="cargo-header" style="align-items:flex-start;">
                <div>
                    <div class="cargo-title">${p.nombre}</div>
                    ${p.tipo_escuela_descripcion ? `<div class="cargo-details" style="font-size:0.85rem;">Aplica en: ${p.tipo_escuela_descripcion}</div>` : ''}
                </div>
                <button onclick="ocultarCartel('cargo', ${p.id})" title="Cerrar" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:#999;margin-left:10px;">✕</button>
            </div>
            <div style="margin-top:8px;">${estadoHTML}</div>
            ${p.estado === 'rechazado' && p.motivo_rechazo ? `<div class="cargo-details" style="color:#721c24;margin-top:6px;"><strong>Motivo:</strong> ${p.motivo_rechazo}</div>` : ''}
            <div class="cargo-details" style="font-size:0.8rem;color:#999;margin-top:4px;">Propuesto el ${new Date(p.fecha_propuesta).toLocaleDateString('es-AR')}</div>
        `;
        seccion.appendChild(card);
    });
    container.appendChild(seccion);
}

function getEstadoValidacionCargo(cargo) {
    if (!cargo.escuela_nombre) return 'escuela_eliminada';
    if (cargo.escuela_pendiente === 2) return 'escuela_rechazada';
    if (cargo.escuela_pendiente === 1) return 'escuela_pendiente';
    if (cargo.cargo_propuesto_estado === 'rechazado') return 'cargo_rechazado';
    if (cargo.cargo_propuesto_estado === 'pendiente') return 'cargo_pendiente';
    return 'aprobado';
}

function mostrarCargos() {
    const container = document.getElementById('cargosList');
    if (cargos.length === 0) {
        container.innerHTML = '<div class="empty-state">No tienes cargos registrados. ¡Agrega tu primer cargo!</div>';
        return;
    }
    container.innerHTML = '';

    const cargosOrdenados = [...cargos].sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro));

    cargosOrdenados.forEach(cargo => {
        const estado = getEstadoValidacionCargo(cargo);
        const card = document.createElement('div');
        card.className = 'cargo-card';

        let borderColor = '#28a745';
        let estadoBanner = '';
        let soloEliminar = false;

        const notif = window._notificaciones && window._notificaciones[cargo.id];

        if (estado === 'escuela_eliminada' || notif?.tipo === 'escuela_eliminada') {
            borderColor = '#dc3545'; soloEliminar = true;
            const nombreEscuela = notif?.nombre || 'la escuela';
            estadoBanner = `<div style="background:#f8d7da;color:#721c24;padding:10px 12px;border-radius:6px;margin-bottom:10px;font-size:0.85rem;"><strong>❌ La escuela "${nombreEscuela}" fue eliminada de la base de datos.</strong><br><span style="font-size:0.8rem;">Este registro ya no es válido. Solo podés eliminarlo.</span></div>`;
        } else if (notif?.tipo === 'cargo_eliminado') {
            borderColor = '#dc3545'; soloEliminar = true;
            estadoBanner = `<div style="background:#f8d7da;color:#721c24;padding:10px 12px;border-radius:6px;margin-bottom:10px;font-size:0.85rem;"><strong>❌ El cargo "${notif.nombre}" fue eliminado de la base de datos.</strong><br><span style="font-size:0.8rem;">Este registro ya no es válido. Solo podés eliminarlo.</span></div>`;
        } else if (estado === 'cargo_rechazado') {
            borderColor = '#dc3545'; soloEliminar = true;
            const motivo = cargo.cargo_propuesto_motivo;
            estadoBanner = `<div style="background:#f8d7da;color:#721c24;padding:10px 12px;border-radius:6px;margin-bottom:10px;font-size:0.85rem;"><strong>❌ El cargo no fue validado.</strong>${motivo ? `<br><span>Motivo: ${motivo}</span>` : ''}<br><span style="font-size:0.8rem;">Este registro ya no es válido. Solo podés eliminarlo.</span></div>`;
        } else if (estado === 'escuela_rechazada') {
            borderColor = '#dc3545'; soloEliminar = true;
            const motivo = cargo.escuela_motivo_rechazo;
            estadoBanner = `<div style="background:#f8d7da;color:#721c24;padding:10px 12px;border-radius:6px;margin-bottom:10px;font-size:0.85rem;"><strong>❌ La escuela no fue validada.</strong>${motivo ? `<br><span>Motivo: ${motivo}</span>` : ''}<br><span style="font-size:0.8rem;">Este registro ya no es válido. Solo podés eliminarlo.</span></div>`;
        } else if (estado === 'cargo_pendiente') {
            borderColor = '#ffc107';
            estadoBanner = `<div style="background:#fff3cd;color:#856404;padding:8px 12px;border-radius:6px;margin-bottom:10px;font-size:0.85rem;">🟡 El cargo está pendiente de aprobación</div>`;
        } else if (estado === 'escuela_pendiente') {
            borderColor = '#ffc107';
            estadoBanner = `<div style="background:#fff3cd;color:#856404;padding:8px 12px;border-radius:6px;margin-bottom:10px;font-size:0.85rem;">🟡 La escuela está pendiente de aprobación</div>`;
        }

        card.style.borderColor = borderColor;
        card.style.borderWidth = '2px';

        let turnos = [];
        try { turnos = JSON.parse(cargo.turno); if (!Array.isArray(turnos)) turnos = [cargo.turno]; }
        catch { turnos = [cargo.turno]; }

        card.innerHTML = `
            ${estadoBanner}
            <div class="cargo-header">
                <div class="cargo-title">${cargo.cargo}</div>
                <div class="cargo-area">${cargo.area_nombre || '—'}</div>
            </div>
            <div class="cargo-details">
                <strong>Escuela:</strong> ${cargo.escuela_nombre || '<em style="color:#dc3545;">Escuela eliminada</em>'}<br>
                <strong>Turno:</strong> ${turnos.join(', ')}
                ${cargo.horario ? `<br><strong>Horario:</strong> ${cargo.horario}` : ''}
                <br><small style="color:#999;">Registrado el ${new Date(cargo.fecha_registro).toLocaleDateString('es-AR')}</small>
            </div>
            <div class="cargo-actions">
                ${!soloEliminar ? `<button class="btn-small btn-match" onclick="buscarCoincidencias(${cargo.id})">🔍 Buscar Coincidencias</button>` : ''}
                ${!soloEliminar ? `<button class="btn-small btn-edit" onclick="editarCargo(${cargo.id})">✏️ Editar</button>` : ''}
                <button class="btn-small btn-delete" onclick="pedirEliminarCargo(${cargo.id})">🗑️ Eliminar</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// ==========================================
// MENÚ CASCADA
// ==========================================

function getNombreArea(areaId) {
    const area = areas.find(a => a.id == areaId);
    return area ? area.nombre : '';
}

function onAreaChange() {
    const areaId = document.getElementById('area').value;
    const tipoSelect = document.getElementById('tipo');
    const escuelaSelect = document.getElementById('escuela');
    tipoSelect.innerHTML = '<option value="">Seleccionar tipo...</option>';
    escuelaSelect.innerHTML = '<option value="">Seleccionar escuela...</option>';
    escuelaSelect.disabled = true;
    if (!areaId) { tipoSelect.disabled = true; actualizarOpcionesCargo(''); return; }
    actualizarOpcionesCargo(getNombreArea(areaId));

    fetch(`/api/tipos/${areaId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    .then(res => res.json())
    .then(tipos => {
        tiposEscuela = tipos;
        const tiposUnicos = tiposEscuela.filter((t, i, self) => i === self.findIndex(x => x.nombre === t.nombre));
        tiposUnicos.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.id; option.textContent = tipo.nombre;
            tipoSelect.appendChild(option);
        });
        const optAgregar = document.createElement('option');
        optAgregar.value = 'nuevo'; optAgregar.textContent = '➕ Agregar nuevo tipo';
        tipoSelect.appendChild(optAgregar);
        tipoSelect.disabled = false;
    })
    .catch(() => { tipoSelect.disabled = true; });
}

function onTipoChange() {
    const areaId = document.getElementById('area').value;
    const tipoId = document.getElementById('tipo').value;
    const escuelaSelect = document.getElementById('escuela');
    if (tipoId === 'nuevo') {
        mostrarModalNuevoTipo();
        document.getElementById('tipo').value = '';
        escuelaSelect.innerHTML = '<option value="">Seleccionar escuela...</option>';
        escuelaSelect.disabled = true;
        return;
    }
    escuelaSelect.innerHTML = '<option value="">Seleccionar escuela...</option>';
    if (!tipoId) { escuelaSelect.disabled = true; return; }

    const params = new URLSearchParams();
    params.append('area_id', areaId);
    params.append('tipo_id', tipoId);

    fetch(`/api/escuelas?${params}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    .then(res => res.json())
    .then(escuelasData => {
        escuelas = escuelasData.filter((e, i, self) => i === self.findIndex(x => x.nombre === e.nombre));
        escuelas.forEach(escuela => {
            const option = document.createElement('option');
            option.value = escuela.id;
            option.textContent = escuela.nombre + (escuela.pendiente_revision === 1 ? ' 🟡' : '');
            escuelaSelect.appendChild(option);
        });
        const optAgregar = document.createElement('option');
        optAgregar.value = 'nueva'; optAgregar.textContent = '➕ Agregar otra escuela';
        escuelaSelect.appendChild(optAgregar);
        escuelaSelect.disabled = false;
    })
    .catch(() => { escuelaSelect.disabled = true; });
}

function onEscuelaChange() {
    if (document.getElementById('escuela').value === 'nueva') {
        document.getElementById('modalNuevaEscuela').style.display = 'flex';
        document.getElementById('escuela').value = '';
    }
}

function actualizarOpcionesCargo(areaNombre) {
    const esMaestroDisponible = AREAS_MAESTRO.includes(areaNombre);
    const optgroupMaestro = document.getElementById('optgroupMaestro');
    if (optgroupMaestro) {
        Array.from(optgroupMaestro.querySelectorAll('option')).forEach(opt => { opt.disabled = !esMaestroDisponible; });
        optgroupMaestro.style.color = esMaestroDisponible ? '' : '#aaa';
    }
    const cargoSelect = document.getElementById('cargo');
    if (cargoSelect.value.startsWith('Maestr/a') && !esMaestroDisponible) { cargoSelect.value = ''; onCargoChange(); }
}

function onCargoChange() {
    const valor = document.getElementById('cargo').value;
    const anioGroup = document.getElementById('anioGroup');
    if (valor === 'proponer_cargo') {
        document.getElementById('cargo').value = '';
        document.getElementById('modalProponerCargo').style.display = 'flex';
        return;
    }
    const nombreCargo = valor.startsWith('propuesto_') ? valor.split('__').slice(1).join('__') : valor;
    const requiereAnio = CARGOS_CON_AÑO.some(c => nombreCargo.startsWith(c));
    anioGroup.style.display = requiereAnio ? 'block' : 'none';
    if (!requiereAnio) document.getElementById('anio').value = '';
}

// ==========================================
// GUARDAR CARGO
// ==========================================

async function guardarCargo(e) {
    e.preventDefault();

    const turnosSeleccionados = [];
    if (document.getElementById('turno-manana').checked) turnosSeleccionados.push('Mañana');
    if (document.getElementById('turno-tarde').checked) turnosSeleccionados.push('Tarde');
    if (document.getElementById('turno-vespertino').checked) turnosSeleccionados.push('Vespertino');
    if (document.getElementById('turno-noche').checked) turnosSeleccionados.push('Noche');

    if (turnosSeleccionados.length === 0) { mostrarModal('advertencia', 'Seleccioná al menos un turno'); return; }

    let cargoValor = document.getElementById('cargo').value;
    if (!cargoValor || cargoValor === 'proponer_cargo') { mostrarModal('advertencia', 'Seleccioná un cargo'); return; }
    if (cargoValor.startsWith('propuesto_')) cargoValor = cargoValor.split('__').slice(1).join('__');

    const escuelaId = document.getElementById('escuela').value;
    if (!escuelaId || escuelaId === 'nueva') { mostrarModal('advertencia', 'Seleccioná una escuela válida'); return; }

    const cargoData = {
        cargo: cargoValor,
        area_id: document.getElementById('area').value,
        escuela_id: escuelaId,
        turno: JSON.stringify(turnosSeleccionados),
        horario: document.getElementById('horario').value
    };

    const requiereAnio = CARGOS_CON_AÑO.some(c => cargoValor.startsWith(c));
    if (requiereAnio) cargoData.anio = document.getElementById('anio').value;

    try {
        const url = cargoEditando ? `/api/cargos/${cargoEditando}` : '/api/cargos';
        const method = cargoEditando ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify(cargoData)
        });

        if (response.ok) {
            document.getElementById('cargoForm').reset();
            document.getElementById('anioGroup').style.display = 'none';
            ['turno-manana','turno-tarde','turno-vespertino','turno-noche'].forEach(id => document.getElementById(id).checked = false);
            document.getElementById('tipo').disabled = true;
            document.getElementById('escuela').disabled = true;
            document.getElementById('submitBtn').textContent = 'Registrar Cargo';
            const wasEditing = cargoEditando;
            cargoEditando = null;
            await cargarMisCargos();
            await cargarMisCargosPropuestos();
            mostrarModal('exito', wasEditing ? 'Cargo actualizado correctamente' : 'Cargo registrado correctamente');
        } else {
            const error = await response.json();
            mostrarModal('error', error.error || 'No se pudo guardar el cargo');
        }
    } catch (error) { mostrarModal('error', 'Error al guardar el cargo'); }
}

// ==========================================
// EDITAR Y ELIMINAR
// ==========================================

function editarCargo(id) {
    const cargo = cargos.find(c => c.id === id);
    if (!cargo) return;
    const select = document.getElementById('cargo');
    const optionExists = Array.from(select.options).some(opt => opt.value === cargo.cargo);
    if (optionExists) { select.value = cargo.cargo; } else { select.value = ''; }

    const anioGroup = document.getElementById('anioGroup');
    const requiereAnio = CARGOS_CON_AÑO.some(c => cargo.cargo.startsWith(c));
    if (requiereAnio) { anioGroup.style.display = 'block'; document.getElementById('anio').value = cargo.anio || ''; }
    else { anioGroup.style.display = 'none'; document.getElementById('anio').value = ''; }

    document.getElementById('area').value = cargo.area_id;
    onAreaChange();
    setTimeout(() => {
        document.getElementById('tipo').value = cargo.tipo_id || '';
        onTipoChange();
        setTimeout(() => { document.getElementById('escuela').value = cargo.escuela_id; }, 100);
    }, 100);

    let turnos = [];
    try { turnos = JSON.parse(cargo.turno); if (!Array.isArray(turnos)) turnos = [cargo.turno]; }
    catch { turnos = [cargo.turno]; }
    document.getElementById('turno-manana').checked = turnos.includes('Mañana');
    document.getElementById('turno-tarde').checked = turnos.includes('Tarde');
    document.getElementById('turno-vespertino').checked = turnos.includes('Vespertino');
    document.getElementById('turno-noche').checked = turnos.includes('Noche');
    document.getElementById('horario').value = cargo.horario || '';
    document.getElementById('submitBtn').textContent = 'Actualizar Cargo';
    cargoEditando = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function pedirEliminarCargo(id) {
    mostrarConfirm('¿Estás seguro de que querés eliminar este cargo?', () => eliminarCargo(id), 'Eliminar cargo', '🗑️');
}

async function eliminarCargo(id) {
    try {
        const response = await fetch(`/api/cargos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            const notif = window._notificaciones && window._notificaciones[id];
            if (notif) {
                await fetch(`/api/notificaciones/${notif.id}/leer`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                delete window._notificaciones[id];
            }
            await cargarMisCargos();
            await cargarMisCargosPropuestos();
            mostrarModal('exito', 'Cargo eliminado correctamente');
        } else { mostrarModal('error', 'Error al eliminar el cargo'); }
    } catch (error) { mostrarModal('error', 'Error al eliminar el cargo'); }
}

// ==========================================
// COINCIDENCIAS
// ==========================================

async function buscarCoincidencias(cargoId) {
    document.getElementById('modalCoincidencias').style.display = 'flex';
    document.getElementById('coincidenciasContent').innerHTML = '<div class="no-coincidencias">Buscando coincidencias...</div>';
    try {
        const response = await fetch(`/api/coincidencias/${cargoId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) { mostrarCoincidencias(await response.json()); }
        else { document.getElementById('coincidenciasContent').innerHTML = '<div class="no-coincidencias">Error buscando coincidencias</div>'; }
    } catch (error) {
        document.getElementById('coincidenciasContent').innerHTML = '<div class="no-coincidencias">Error de conexión</div>';
    }
}

function mostrarCoincidencias(coincidencias) {
    const container = document.getElementById('coincidenciasContent');
    if (coincidencias.length === 0) { container.innerHTML = '<div class="no-coincidencias">No se encontraron coincidencias aún.</div>'; return; }
    container.innerHTML = '';
    coincidencias.forEach(coincidencia => {
        const div = document.createElement('div');
        div.className = 'coincidencia-item';
        const horarioHTML = (coincidencia.horario && coincidencia.horario.trim())
            ? `<p class="coincidencia-detalle"><strong>⏰ Horario:</strong> ${coincidencia.horario}</p>` : '';
        div.innerHTML = `
            <div class="coincidencia-header"><h4 class="coincidencia-cargo">📚 Cargo: ${coincidencia.cargo || coincidencia.materia}</h4></div>
            <div class="coincidencia-content">
                <p class="coincidencia-detalle"><strong>👤 Docente:</strong> ${coincidencia.docente_nombre}</p>
                <p class="coincidencia-email">
                    <strong>📧 Email:</strong>
                    <span class="email-text">${coincidencia.email}</span>
                    <button class="btn-copy" onclick="copiarEmailConFeedback(this, '${coincidencia.email}')">📋 Copiar</button>
                </p>
                <p class="coincidencia-detalle"><strong>🏫 Escuela:</strong> ${coincidencia.escuela_nombre}</p>
                <p class="coincidencia-detalle"><strong>🕐 Turno:</strong> ${coincidencia.turno}</p>
                ${horarioHTML}
            </div>`;
        container.appendChild(div);
    });
}

function copiarEmailConFeedback(button, email) {
    const textoOriginal = button.textContent;
    navigator.clipboard.writeText(email).then(() => {
        button.textContent = '✅ Copiado'; button.classList.add('btn-copy-success');
        setTimeout(() => { button.textContent = textoOriginal; button.classList.remove('btn-copy-success'); }, 2000);
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = email; document.body.appendChild(textArea); textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea);
        button.textContent = '✅ Copiado'; button.classList.add('btn-copy-success');
        setTimeout(() => { button.textContent = textoOriginal; button.classList.remove('btn-copy-success'); }, 2000);
    });
}

// ==========================================
// MODAL NUEVA ESCUELA — CUE + ÁREA
// ==========================================

function resetValidacionCUE() {
    document.getElementById('cueResultado').innerHTML = '';
    document.getElementById('formNuevaEscuela').style.display = 'none';
}

async function validarCUEyArea() {
    const cue = document.getElementById('nuevaEscuelaCUE').value.trim();
    const areaId = document.getElementById('nuevaEscuelaAreaPaso1').value;
    const resultado = document.getElementById('cueResultado');

    if (!cue || cue.length < 4) { mostrarModal('advertencia', 'Ingresá un CUE válido (mínimo 4 dígitos)'); return; }
    if (!areaId) { mostrarModal('advertencia', 'Seleccioná un área'); return; }

    try {
        const res = await fetch(`/api/escuelas/buscar-cue/${cue}?area_id=${areaId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        if (data.encontrada) {
            resultado.innerHTML = `<div class="alert alert-warning">⚠️ Ya existe una escuela con ese CUE en esta área: <strong>${data.escuela.nombre}</strong></div>`;
            document.getElementById('formNuevaEscuela').style.display = 'none';
        } else {
            // Mostrar CUE y área confirmados (bloqueados)
            const areaNombre = areas.find(a => a.id == areaId)?.nombre || '';
            document.getElementById('cueConfirmado').textContent = cue;
            document.getElementById('areaConfirmada').textContent = areaNombre;

            // Cargar tipos del área seleccionada
            const resTipos = await fetch(`/api/tipos/${areaId}`);
            const tipos = await resTipos.json();
            const selectTipo = document.getElementById('nuevaEscuelaTipoPaso2');
            selectTipo.innerHTML = '<option value="">Seleccionar tipo...</option>';
            tipos.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id; opt.textContent = t.nombre;
                selectTipo.appendChild(opt);
            });

            resultado.innerHTML = `<div class="alert alert-info">✅ Disponible. Completá los datos de la escuela.</div>`;
            document.getElementById('formNuevaEscuela').style.display = 'block';

            // Bloquear el CUE y área para que no se puedan modificar
            document.getElementById('nuevaEscuelaCUE').disabled = true;
            document.getElementById('nuevaEscuelaAreaPaso1').disabled = true;
        }
    } catch (e) {
        resultado.innerHTML = '';
        document.getElementById('formNuevaEscuela').style.display = 'block';
    }
}

function cerrarModalEscuela() {
    document.getElementById('modalNuevaEscuela').style.display = 'none';
    document.getElementById('nuevaEscuelaCUE').value = '';
    document.getElementById('nuevaEscuelaCUE').disabled = false;
    document.getElementById('nuevaEscuelaAreaPaso1').value = '';
    document.getElementById('nuevaEscuelaAreaPaso1').disabled = false;
    document.getElementById('cueResultado').innerHTML = '';
    document.getElementById('formNuevaEscuela').style.display = 'none';
    document.getElementById('nuevaEscuelaNombreInput').value = '';
    document.getElementById('nuevaEscuelaNumero').value = '';
    document.getElementById('nuevaEscuelaDE').value = '';
    document.getElementById('nuevaEscuelaDireccion').value = '';
    document.getElementById('nuevaEscuelaBarrio').value = '';
    document.getElementById('sugerenciasEscuela').style.display = 'none';
}

async function guardarNuevaEscuela() {
    const cue = document.getElementById('nuevaEscuelaCUE').value.trim();
    const areaId = document.getElementById('nuevaEscuelaAreaPaso1').value;
    const tipoId = document.getElementById('nuevaEscuelaTipoPaso2').value;
    const nombre = document.getElementById('nuevaEscuelaNombreInput').value.trim();

    if (!nombre) { mostrarModal('advertencia', 'Ingresá el nombre de la escuela'); return; }
    if (!tipoId) { mostrarModal('advertencia', 'Seleccioná el tipo de escuela'); return; }

    try {
        const response = await fetch('/api/escuelas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({
                nombre, area_id: areaId, tipo_id: tipoId, cue,
                numero_escuela: document.getElementById('nuevaEscuelaNumero').value.trim(),
                distrito_escolar: document.getElementById('nuevaEscuelaDE').value.trim(),
                direccion: document.getElementById('nuevaEscuelaDireccion').value.trim(),
                barrio: document.getElementById('nuevaEscuelaBarrio').value.trim(),
            })
        });
        if (response.ok) {
            const data = await response.json();
            await cargarMisEscuelas();

            // Recargar escuelas en el selector del formulario principal si coincide área/tipo
            const areaActual = document.getElementById('area').value;
            const tipoActual = document.getElementById('tipo').value;
            if (areaActual === areaId && tipoActual === tipoId) {
                const params = new URLSearchParams();
                params.append('area_id', areaId);
                params.append('tipo_id', tipoId);
                const resEsc = await fetch(`/api/escuelas?${params}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
                const escuelasData = await resEsc.json();
                escuelas = escuelasData.filter((e, i, self) => i === self.findIndex(x => x.nombre === e.nombre));
                const escuelaSelect = document.getElementById('escuela');
                escuelaSelect.innerHTML = '<option value="">Seleccionar escuela...</option>';
                escuelas.forEach(esc => {
                    const option = document.createElement('option');
                    option.value = esc.id;
                    option.textContent = esc.nombre + (esc.pendiente_revision === 1 ? ' 🟡' : '');
                    escuelaSelect.appendChild(option);
                });
                const optAgregar = document.createElement('option');
                optAgregar.value = 'nueva'; optAgregar.textContent = '➕ Agregar otra escuela';
                escuelaSelect.appendChild(optAgregar);
                escuelaSelect.disabled = false;
                escuelaSelect.value = data.id;
            }

            cerrarModalEscuela();
            mostrarModal('info', 'Escuela enviada para revisión. Aparece con 🟡 en el selector — podés continuar con la carga.');
        } else {
            const error = await response.json();
            mostrarModal('error', error.error || 'No se pudo agregar la escuela');
        }
    } catch (error) { mostrarModal('error', 'Error al guardar la escuela'); }
}

function eliminarMiEscuela(id) {
    const escuela = misEscuelas.find(e => e.id === id);
    if (escuela && escuela.pendiente_revision === 0) {
        mostrarModal('advertencia', 'Las escuelas aprobadas solo pueden ser eliminadas por el administrador.');
        return;
    }
    mostrarConfirm('¿Estás seguro de que querés eliminar esta escuela?', async () => {
        try {
            const response = await fetch(`/api/escuelas/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                misEscuelas = misEscuelas.filter(e => e.id !== id);
                actualizarListaMisEscuelas();
                await cargarMisCargos();
                mostrarModal('exito', 'Escuela eliminada correctamente');
            } else { mostrarModal('error', 'Error al eliminar la escuela'); }
        } catch (error) { mostrarModal('error', 'Error al eliminar la escuela'); }
    }, 'Eliminar escuela', '🗑️');
}

// ==========================================
// FUZZY SEARCH
// ==========================================

let timeoutBusqueda = null;

async function buscarSimilares() {
    const q = document.getElementById('nuevaEscuelaNombreInput').value.trim();
    const sugerencias = document.getElementById('sugerenciasEscuela');
    clearTimeout(timeoutBusqueda);
    if (q.length < 3) { sugerencias.style.display = 'none'; return; }
    timeoutBusqueda = setTimeout(async () => {
        try {
            const res = await fetch(`/api/escuelas/buscar-nombre?q=${encodeURIComponent(q)}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const encontradas = await res.json();
            if (encontradas.length === 0) { sugerencias.style.display = 'none'; return; }
            sugerencias.innerHTML = '';
            encontradas.forEach(e => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `<div class="suggestion-nombre">${e.nombre}</div><div class="suggestion-meta">${e.tipo_nombre || ''} — ${e.barrio || ''} ${e.distrito_escolar ? '(DE ' + e.distrito_escolar + ')' : ''}</div>`;
                div.onclick = () => {
                    document.getElementById('cueResultado').innerHTML = `<div class="alert alert-warning">⚠️ Esta escuela ya existe: <strong>${e.nombre}</strong>. Si es la misma, no la dupliques.</div>`;
                    sugerencias.style.display = 'none';
                };
                sugerencias.appendChild(div);
            });
            sugerencias.style.display = 'block';
        } catch (e) { sugerencias.style.display = 'none'; }
    }, 300);
}

// ==========================================
// OTROS MODALES
// ==========================================

function cerrarModalCoincidencias() { document.getElementById('modalCoincidencias').style.display = 'none'; }

function cerrarModalProponerCargo() {
    document.getElementById('modalProponerCargo').style.display = 'none';
    document.getElementById('propCargoNombre').value = '';
    document.getElementById('propCargoTipo').value = '';
}

async function enviarPropuestaCargo() {
    const nombre = document.getElementById('propCargoNombre').value.trim();
    const tipo = document.getElementById('propCargoTipo').value.trim();
    if (!nombre) { mostrarModal('advertencia', 'Ingresá el nombre del cargo'); return; }
    try {
        const res = await fetch('/api/cargos-propuestos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ nombre, tipo_escuela_descripcion: tipo })
        });
        if (res.ok) {
            const data = await res.json();
            cerrarModalProponerCargo();
            await cargarCargosDisponibles();
            await cargarMisCargosPropuestos();
            const select = document.getElementById('cargo');
            const valor = `propuesto_${data.id}__${nombre}`;
            const opt = Array.from(select.options).find(o => o.value === valor);
            if (opt) { select.value = valor; onCargoChange(); }
            mostrarModal('info', 'Propuesta enviada. El cargo ya está seleccionado — completá el resto de la carga.');
        } else {
            const err = await res.json();
            mostrarModal('error', err.error || 'No se pudo enviar la propuesta');
        }
    } catch (e) { mostrarModal('error', 'Error de conexión'); }
}

async function mostrarModalNuevoTipo() {
    const m = document.getElementById('modalNuevoTipo');
    if (m) m.style.display = 'flex';
}

async function guardarNuevoTipo() {
    const nombre = document.getElementById('nuevoTipoNombre')?.value.trim();
    if (!nombre) { mostrarModal('advertencia', 'Ingresá el nombre del tipo'); return; }
    const areaId = document.getElementById('area').value;
    if (!areaId) { mostrarModal('advertencia', 'Seleccioná primero un área'); return; }
    try {
        const response = await fetch('/api/tipos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ nombre, area_id: areaId })
        });
        if (response.ok) {
            const data = await response.json();
            await onAreaChange();
            document.getElementById('tipo').value = data.id;
            const m = document.getElementById('modalNuevoTipo');
            if (m) m.style.display = 'none';
            mostrarModal('exito', 'Tipo agregado correctamente');
        } else {
            const error = await response.json();
            mostrarModal('error', error.error || 'No se pudo guardar el tipo');
        }
    } catch (error) { mostrarModal('error', 'Error al guardar el tipo'); }
}

window.onclick = function(event) {
    ['modalNuevaEscuela', 'modalCoincidencias', 'modalProponerCargo'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && event.target === modal) modal.style.display = 'none';
    });
}

// ==========================================
// SISTEMA UNIFICADO DE MODALES
// ==========================================

function mostrarModal(tipo, msg) {
    const config = {
        exito:       { id: 'modalExito',       msgId: 'mensajeExito' },
        error:       { id: 'modalError',       msgId: 'mensajeError' },
        advertencia: { id: 'modalAdvertencia', msgId: 'mensajeAdvertencia' },
        info:        { id: 'modalInfo',        msgId: 'mensajeInfo' }
    };
    const c = config[tipo];
    if (!c) return;
    document.getElementById(c.msgId).textContent = msg;
    document.getElementById(c.id).style.display = 'flex';
}

function mostrarExito(msg) { mostrarModal('exito', msg); }
function mostrarError(msg) { mostrarModal('error', msg); }
function mostrarAdvertencia(msg) { mostrarModal('advertencia', msg); }
function mostrarInfo(msg) { mostrarModal('info', msg); }
function cerrarModalFeedback(id) { document.getElementById(id).style.display = 'none'; }

function abrirTutorial() { document.getElementById('modalTutorial').style.display = 'flex'; }
function cerrarTutorial() { document.getElementById('modalTutorial').style.display = 'none'; }


// ==========================================
// PDF Y LOGOUT
// ==========================================

function generarPDF() {
    if (cargos.length === 0) { mostrarModal('advertencia', 'No tenés cargos para exportar'); return; }
    if (typeof window.jspdf === 'undefined') {
        const ventana = window.open('', '_blank');
        let html = `<html><head><title>Mis Cargos - PermutApp</title><style>body{font-family:Arial,sans-serif;padding:20px;}h1{color:#667eea;text-align:center;}.cargo{border:1px solid #ddd;margin:10px 0;padding:15px;border-radius:8px;}.cargo-titulo{color:#667eea;font-size:18px;font-weight:bold;margin-bottom:10px;}.cargo-detalle{margin:5px 0;color:#555;}</style></head><body><h1>📚 Mis Cargos - PermutApp</h1><p><strong>Usuario:</strong> ${usuarioActual.nombre}</p><p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p><hr>`;
        cargos.forEach((cargo, index) => {
            let turnos = [];
            try { turnos = JSON.parse(cargo.turno); if (!Array.isArray(turnos)) turnos = [cargo.turno]; } catch { turnos = [cargo.turno]; }
            html += `<div class="cargo"><div class="cargo-titulo">${index + 1}. ${cargo.cargo}</div><div class="cargo-detalle"><strong>Área:</strong> ${cargo.area_nombre || '—'}</div><div class="cargo-detalle"><strong>Escuela:</strong> ${cargo.escuela_nombre || 'Eliminada'}</div><div class="cargo-detalle"><strong>Turno:</strong> ${turnos.join(', ')}</div>${cargo.horario ? `<div class="cargo-detalle"><strong>Horario:</strong> ${cargo.horario}</div>` : ''}</div>`;
        });
        html += '</body></html>';
        ventana.document.write(html); ventana.document.close(); ventana.print();
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const colorPrincipal = [102, 126, 234];
    doc.setFontSize(20); doc.setTextColor(...colorPrincipal);
    doc.text('Mis Cargos Registrados - PermutApp', 105, 25, { align: 'center' });
    doc.setDrawColor(...colorPrincipal); doc.line(20, 32, 190, 32);
    doc.setFontSize(11); doc.setTextColor(60, 60, 60);
    doc.text(`Usuario: ${usuarioActual.nombre}`, 20, 42);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 20, 50);
    let y = 62;
    const pageHeight = doc.internal.pageSize.height;
    cargos.forEach((cargo, index) => {
        if (y > pageHeight - 40) { doc.addPage(); y = 20; }
        doc.setFontSize(12); doc.setTextColor(...colorPrincipal);
        doc.text(`${index + 1}. ${cargo.cargo}`, 20, y); y += 8;
        doc.setFontSize(10); doc.setTextColor(60, 60, 60);
        doc.text(`Área: ${cargo.area_nombre || '—'}`, 25, y); y += 6;
        doc.text(`Escuela: ${cargo.escuela_nombre || 'Eliminada'}`, 25, y); y += 6;
        let turnos = [];
        try { turnos = JSON.parse(cargo.turno); if (!Array.isArray(turnos)) turnos = [cargo.turno]; } catch { turnos = [cargo.turno]; }
        doc.text(`Turno: ${turnos.join(', ')}`, 25, y); y += 6;
        if (cargo.horario) { doc.text(`Horario: ${cargo.horario}`, 25, y); y += 6; }
        y += 8;
    });
    doc.save(`Mis-Cargos-${usuarioActual.nombre.replace(/\s+/g, '-')}.pdf`);
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}
