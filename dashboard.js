// dashboard.js - PermutApp

// Variables globales
let usuarioActual = null;
let areas = [];
let tiposEscuela = [];
let escuelas = [];
let misEscuelas = [];
let cargos = [];
let cargoEditando = null;

// Cargos que requieren año (Profesor/a y Maestr/a)
const CARGOS_CON_AÑO = ['Profesor/a', 'Maestr/a'];

// Maestr/a solo disponible en estos niveles (nombre del área)
const AREAS_MAESTRO = ['Inicial', 'Primaria'];

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    await cargarUsuario();
    await cargarDatosIniciales();
    await cargarMisEscuelas();
    await cargarMisCargos();

    document.getElementById('cargoForm').addEventListener('submit', guardarCargo);
    document.getElementById('area').addEventListener('change', onAreaChange);
    document.getElementById('tipo').addEventListener('change', onTipoChange);
    document.getElementById('escuela').addEventListener('change', onEscuelaChange);
    document.getElementById('cargo').addEventListener('change', onCargoChange);
    document.getElementById('cargoOtro').addEventListener('input', onCargoChange);
});

// Cargar usuario actual
async function cargarUsuario() {
    try {
        const response = await fetch('/api/usuario', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            usuarioActual = await response.json();
            document.getElementById('userName').textContent = usuarioActual.nombre;
        } else {
            logout();
        }
    } catch (error) {
        console.error('Error cargando usuario:', error);
        logout();
    }
}

// Cargar áreas
async function cargarDatosIniciales() {
    try {
        const areasRes = await fetch('/api/areas');
        areas = await areasRes.json();

        const areaSelect = document.getElementById('area');
        areaSelect.innerHTML = '<option value="">Seleccionar área...</option>';
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area.id;
            option.textContent = area.nombre;
            areaSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
    }
}

// Cargar escuelas del usuario
async function cargarMisEscuelas() {
    try {
        const response = await fetch('/api/mis-escuelas', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            misEscuelas = await response.json();
            actualizarListaMisEscuelas();
        }
    } catch (error) {
        console.error('Error cargando mis escuelas:', error);
    }
}

function actualizarListaMisEscuelas() {
    const lista = document.getElementById('misEscuelasList');
    if (misEscuelas.length === 0) {
        lista.innerHTML = '<li style="border-left-color: #999; color: #999;">No tienes escuelas agregadas</li>';
        return;
    }
    lista.innerHTML = '';
    misEscuelas.forEach(escuela => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${escuela.nombre}</span>
            <button onclick="eliminarMiEscuela(${escuela.id})" title="Eliminar">🗑️</button>
        `;
        lista.appendChild(li);
    });
}

// Cargar cargos del usuario
async function cargarMisCargos() {
    try {
        const response = await fetch('/api/cargos', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            cargos = await response.json();
            mostrarCargos();
        }
    } catch (error) {
        console.error('Error cargando cargos:', error);
    }
}

function mostrarCargos() {
    const container = document.getElementById('cargosList');
    if (cargos.length === 0) {
        container.innerHTML = '<div class="empty-state">No tienes cargos registrados. ¡Agrega tu primer cargo!</div>';
        return;
    }
    container.innerHTML = '';
    cargos.forEach(cargo => {
        const card = document.createElement('div');
        card.className = 'cargo-card';
        card.innerHTML = `
            <div class="cargo-header">
                <div class="cargo-title">${cargo.cargo}</div>
                <div class="cargo-area">${cargo.area_nombre}</div>
            </div>
            <div class="cargo-details">
                <strong>Escuela:</strong> ${cargo.escuela_nombre}<br>
                <strong>Turno:</strong> ${(() => {
                    try {
                        const turnos = JSON.parse(cargo.turno);
                        return Array.isArray(turnos) ? turnos.join(', ') : cargo.turno;
                    } catch { return cargo.turno; }
                })()}
                ${cargo.horario ? `<br><strong>Horario:</strong> ${cargo.horario}` : ''}
            </div>
            <div class="cargo-actions">
                <button class="btn-small btn-match" onclick="buscarCoincidencias(${cargo.id})">🔍 Buscar Coincidencias</button>
                <button class="btn-small btn-edit" onclick="editarCargo(${cargo.id})">✏️ Editar</button>
                <button class="btn-small btn-delete" onclick="eliminarCargo(${cargo.id})">🗑️ Eliminar</button>
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

    if (!areaId) {
        tipoSelect.disabled = true;
        // Actualizar opciones de cargo según área
        actualizarOpcionesCargo('');
        return;
    }

    // Actualizar opciones de cargo según área seleccionada
    actualizarOpcionesCargo(getNombreArea(areaId));

    fetch(`/api/tipos/${areaId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(tipos => {
        tiposEscuela = tipos;
        const tiposUnicos = tiposEscuela.filter((t, i, self) =>
            i === self.findIndex(x => x.nombre === t.nombre)
        );
        tiposUnicos.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.id;
            option.textContent = tipo.nombre;
            tipoSelect.appendChild(option);
        });
        const optAgregar = document.createElement('option');
        optAgregar.value = 'nuevo';
        optAgregar.textContent = '➕ Agregar nuevo tipo';
        tipoSelect.appendChild(optAgregar);
        tipoSelect.disabled = false;
    })
    .catch(error => {
        console.error('Error cargando tipos:', error);
        tipoSelect.disabled = true;
    });
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

    if (!tipoId) {
        escuelaSelect.disabled = true;
        return;
    }

    const params = new URLSearchParams();
    params.append('area_id', areaId);
    params.append('tipo_id', tipoId);

    fetch(`/api/escuelas?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(escuelasData => {
        const escuelasUnicas = escuelasData.filter((e, i, self) =>
            i === self.findIndex(x => x.nombre === e.nombre)
        );
        escuelas = escuelasUnicas;
        escuelas.forEach(escuela => {
            const option = document.createElement('option');
            option.value = escuela.id;
            option.textContent = escuela.nombre;
            escuelaSelect.appendChild(option);
        });
        const optAgregar = document.createElement('option');
        optAgregar.value = 'nueva';
        optAgregar.textContent = '➕ Agregar otra escuela';
        escuelaSelect.appendChild(optAgregar);
        escuelaSelect.disabled = false;
    })
    .catch(error => {
        console.error('Error cargando escuelas:', error);
        escuelaSelect.disabled = true;
    });
}

function onEscuelaChange() {
    const valor = document.getElementById('escuela').value;
    if (valor === 'nueva') {
        document.getElementById('modalNuevaEscuela').style.display = 'flex';
        document.getElementById('escuela').value = '';
    }
}

// ==========================================
// LÓGICA DE CARGO Y MAESTR/A
// ==========================================

// Muestra/oculta las opciones de Maestr/a según el área elegida
function actualizarOpcionesCargo(areaNombre) {
    const esMaestroDisponible = AREAS_MAESTRO.includes(areaNombre);
    const optgroupMaestro = document.getElementById('optgroupMaestro');
    if (optgroupMaestro) {
        // Habilitar/deshabilitar las opciones de Maestr/a
        Array.from(optgroupMaestro.options || optgroupMaestro.querySelectorAll('option')).forEach(opt => {
            opt.disabled = !esMaestroDisponible;
        });
        optgroupMaestro.style.color = esMaestroDisponible ? '' : '#aaa';
    }

    // Si el cargo seleccionado es Maestr/a y el área no lo permite, limpiar selección
    const cargoSelect = document.getElementById('cargo');
    const cargoValor = cargoSelect.value;
    if (cargoValor.startsWith('Maestr/a') && !esMaestroDisponible) {
        cargoSelect.value = '';
        onCargoChange();
    }
}

function onCargoChange() {
    const valor = document.getElementById('cargo').value;
    const inputOtro = document.getElementById('cargoOtro');
    const anioGroup = document.getElementById('anioGroup');

    if (valor === 'otro') {
        inputOtro.style.display = 'block';
        inputOtro.required = true;
    } else {
        inputOtro.style.display = 'none';
        inputOtro.required = false;
        inputOtro.value = '';
    }

    const cargoActual = valor === 'otro' ? inputOtro.value : valor;
    const requiereAnio = CARGOS_CON_AÑO.some(c => cargoActual.startsWith(c));

    if (requiereAnio) {
        anioGroup.style.display = 'block';
    } else {
        anioGroup.style.display = 'none';
        document.getElementById('anio').value = '';
    }
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

    if (turnosSeleccionados.length === 0) {
        alert('Por favor selecciona al menos un turno');
        return;
    }

    let cargoValor = document.getElementById('cargo').value;
    if (cargoValor === 'otro') {
        cargoValor = document.getElementById('cargoOtro').value.trim();
        if (!cargoValor) {
            alert('Por favor especifica el cargo');
            return;
        }
    }

    const cargoData = {
        cargo: cargoValor,
        area_id: document.getElementById('area').value,
        escuela_id: document.getElementById('escuela').value,
        turno: JSON.stringify(turnosSeleccionados),
        horario: document.getElementById('horario').value
    };

    const requiereAnio = CARGOS_CON_AÑO.some(c => cargoValor.startsWith(c));
    if (requiereAnio) {
        cargoData.anio = document.getElementById('anio').value;
    }

    if (!cargoData.escuela_id || cargoData.escuela_id === 'nueva') {
        alert('Por favor selecciona una escuela válida');
        return;
    }

    try {
        const url = cargoEditando ? `/api/cargos/${cargoEditando}` : '/api/cargos';
        const method = cargoEditando ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(cargoData)
        });

        if (response.ok) {
            document.getElementById('cargoForm').reset();
            document.getElementById('cargoOtro').style.display = 'none';
            document.getElementById('cargoOtro').required = false;
            document.getElementById('anioGroup').style.display = 'none';
            document.getElementById('turno-manana').checked = false;
            document.getElementById('turno-tarde').checked = false;
            document.getElementById('turno-vespertino').checked = false;
            document.getElementById('turno-noche').checked = false;
            document.getElementById('tipo').disabled = true;
            document.getElementById('escuela').disabled = true;
            document.getElementById('submitBtn').textContent = 'Registrar Cargo';
            const wasEditing = cargoEditando;
            cargoEditando = null;
            await cargarMisCargos();
            alert(wasEditing ? 'Cargo actualizado correctamente' : 'Cargo registrado correctamente');
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'No se pudo guardar el cargo'));
        }
    } catch (error) {
        console.error('Error guardando cargo:', error);
        alert('Error al guardar el cargo');
    }
}

// ==========================================
// EDITAR Y ELIMINAR
// ==========================================

function editarCargo(id) {
    const cargo = cargos.find(c => c.id === id);
    if (!cargo) return;

    const select = document.getElementById('cargo');
    const optionExists = Array.from(select.options).some(opt => opt.value === cargo.cargo);

    if (optionExists && cargo.cargo !== 'otro') {
        select.value = cargo.cargo;
        document.getElementById('cargoOtro').style.display = 'none';
        document.getElementById('cargoOtro').required = false;
        document.getElementById('cargoOtro').value = '';
    } else {
        select.value = 'otro';
        document.getElementById('cargoOtro').style.display = 'block';
        document.getElementById('cargoOtro').required = true;
        document.getElementById('cargoOtro').value = cargo.cargo;
    }

    const anioGroup = document.getElementById('anioGroup');
    const requiereAnio = CARGOS_CON_AÑO.some(c => cargo.cargo.startsWith(c));
    if (requiereAnio) {
        anioGroup.style.display = 'block';
        document.getElementById('anio').value = cargo.anio || '';
    } else {
        anioGroup.style.display = 'none';
        document.getElementById('anio').value = '';
    }

    document.getElementById('area').value = cargo.area_id;
    onAreaChange();

    setTimeout(() => {
        document.getElementById('tipo').value = cargo.tipo_id || '';
        onTipoChange();
        setTimeout(() => {
            document.getElementById('escuela').value = cargo.escuela_id;
        }, 100);
    }, 100);

    let turnos = [];
    try {
        turnos = JSON.parse(cargo.turno);
        if (!Array.isArray(turnos)) turnos = [cargo.turno];
    } catch { turnos = [cargo.turno]; }

    document.getElementById('turno-manana').checked = turnos.includes('Mañana');
    document.getElementById('turno-tarde').checked = turnos.includes('Tarde');
    document.getElementById('turno-vespertino').checked = turnos.includes('Vespertino');
    document.getElementById('turno-noche').checked = turnos.includes('Noche');

    document.getElementById('horario').value = cargo.horario || '';
    document.getElementById('submitBtn').textContent = 'Actualizar Cargo';
    cargoEditando = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function eliminarCargo(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este cargo?')) return;
    try {
        const response = await fetch(`/api/cargos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            await cargarMisCargos();
            alert('Cargo eliminado correctamente');
        } else {
            alert('Error al eliminar el cargo');
        }
    } catch (error) {
        console.error('Error eliminando cargo:', error);
        alert('Error al eliminar el cargo');
    }
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
        if (response.ok) {
            const coincidencias = await response.json();
            mostrarCoincidencias(coincidencias);
        } else {
            document.getElementById('coincidenciasContent').innerHTML = '<div class="no-coincidencias">Error buscando coincidencias</div>';
        }
    } catch (error) {
        console.error('Error buscando coincidencias:', error);
        document.getElementById('coincidenciasContent').innerHTML = '<div class="no-coincidencias">Error de conexión</div>';
    }
}

function mostrarCoincidencias(coincidencias) {
    const container = document.getElementById('coincidenciasContent');
    if (coincidencias.length === 0) {
        container.innerHTML = '<div class="no-coincidencias">No se encontraron coincidencias aún. ¡Te avisaremos cuando haya una!</div>';
        return;
    }
    container.innerHTML = '';
    coincidencias.forEach(coincidencia => {
        const div = document.createElement('div');
        div.className = 'coincidencia-item';
        const horarioHTML = (coincidencia.horario && coincidencia.horario.trim())
            ? `<p class="coincidencia-detalle"><strong>⏰ Horario:</strong> ${coincidencia.horario}</p>` : '';
        div.innerHTML = `
            <div class="coincidencia-header">
                <h4 class="coincidencia-cargo">📚 Cargo: ${coincidencia.cargo || coincidencia.materia}</h4>
            </div>
            <div class="coincidencia-content">
                <p class="coincidencia-detalle"><strong>👤 Docente:</strong> ${coincidencia.docente_nombre}</p>
                <p class="coincidencia-email">
                    <strong>📧 Email:</strong>
                    <span class="email-text">${coincidencia.email}</span>
                    <button class="btn-copy" onclick="copiarEmailConFeedback(this, '${coincidencia.email}')" title="Copiar email">📋 Copiar</button>
                </p>
                <p class="coincidencia-detalle"><strong>🏫 Escuela:</strong> ${coincidencia.escuela_nombre}</p>
                <p class="coincidencia-detalle"><strong>🕐 Turno:</strong> ${coincidencia.turno}</p>
                ${horarioHTML}
            </div>
        `;
        container.appendChild(div);
    });
}

function copiarEmailConFeedback(button, email) {
    const textoOriginal = button.textContent;
    navigator.clipboard.writeText(email).then(() => {
        button.textContent = '✅ Copiado';
        button.classList.add('btn-copy-success');
        setTimeout(() => {
            button.textContent = textoOriginal;
            button.classList.remove('btn-copy-success');
        }, 2000);
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = email;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        button.textContent = '✅ Copiado';
        button.classList.add('btn-copy-success');
        setTimeout(() => {
            button.textContent = textoOriginal;
            button.classList.remove('btn-copy-success');
        }, 2000);
    });
}

// ==========================================
// MODALES
// ==========================================

function cerrarModal() {
    document.getElementById('modalNuevaEscuela').style.display = 'none';
    document.getElementById('nuevaEscuelaNombre').value = '';
}

function cerrarModalNuevoTipo() {
    document.getElementById('modalNuevoTipo').style.display = 'none';
    document.getElementById('nuevoTipoNombre').value = '';
}

function cerrarModalCoincidencias() {
    document.getElementById('modalCoincidencias').style.display = 'none';
}

function cerrarModalExito() {
    document.getElementById('modalExito').style.display = 'none';
}

function cerrarModalAdvertencia() {
    document.getElementById('modalAdvertencia').style.display = 'none';
}

function cerrarModalError() {
    document.getElementById('modalError').style.display = 'none';
}

function cerrarModalInfo() {
    document.getElementById('modalInfo').style.display = 'none';
}

async function mostrarModalNuevoTipo() {
    document.getElementById('modalNuevoTipo').style.display = 'flex';
}

async function guardarNuevoTipo() {
    const nombre = document.getElementById('nuevoTipoNombre').value.trim();
    if (!nombre) { alert('Por favor ingresa el nombre del tipo'); return; }
    const areaId = document.getElementById('area').value;
    if (!areaId) { alert('Por favor selecciona primero un área'); return; }

    try {
        const response = await fetch('/api/tipos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ nombre, area_id: areaId })
        });
        if (response.ok) {
            const data = await response.json();
            await onAreaChange();
            document.getElementById('tipo').value = data.id;
            cerrarModalNuevoTipo();
            alert('Tipo agregado correctamente');
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'No se pudo guardar el tipo'));
        }
    } catch (error) {
        console.error('Error guardando tipo:', error);
        alert('Error al guardar el tipo');
    }
}

async function guardarNuevaEscuela() {
    const nombre = document.getElementById('nuevaEscuelaNombre').value.trim();
    if (!nombre) { alert('Por favor ingresa el nombre de la escuela'); return; }
    const areaId = document.getElementById('area').value;
    const tipoId = document.getElementById('tipo').value;
    if (!areaId || !tipoId) { alert('Por favor selecciona primero un área y un tipo de escuela'); return; }

    try {
        const response = await fetch('/api/escuelas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ nombre, area_id: areaId, tipo_id: tipoId })
        });
        if (response.ok) {
            const nuevaEscuela = await response.json();
            misEscuelas.push(nuevaEscuela);
            actualizarListaMisEscuelas();
            const escuelaSelect = document.getElementById('escuela');
            const option = document.createElement('option');
            option.value = nuevaEscuela.id;
            option.textContent = nuevaEscuela.nombre;
            const opcionAgregar = escuelaSelect.querySelector('option[value="nueva"]');
            escuelaSelect.insertBefore(option, opcionAgregar);
            escuelaSelect.value = nuevaEscuela.id;
            cerrarModal();
            alert('Escuela agregada correctamente');
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'No se pudo agregar la escuela'));
        }
    } catch (error) {
        console.error('Error guardando escuela:', error);
        alert('Error al guardar la escuela');
    }
}

async function eliminarMiEscuela(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta escuela de tu lista?')) return;
    try {
        const response = await fetch(`/api/escuelas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            misEscuelas = misEscuelas.filter(e => e.id !== id);
            actualizarListaMisEscuelas();
            await cargarMisCargos();
            alert('Escuela eliminada correctamente');
        } else {
            alert('Error al eliminar la escuela');
        }
    } catch (error) {
        console.error('Error eliminando escuela:', error);
        alert('Error al eliminar la escuela');
    }
}

window.onclick = function(event) {
    const modalNueva = document.getElementById('modalNuevaEscuela');
    const modalNuevoTipo = document.getElementById('modalNuevoTipo');
    const modalCoincidencias = document.getElementById('modalCoincidencias');
    if (event.target === modalNueva) cerrarModal();
    if (event.target === modalNuevoTipo) cerrarModalNuevoTipo();
    if (event.target === modalCoincidencias) cerrarModalCoincidencias();
}

// ==========================================
// PDF Y LOGOUT
// ==========================================

function generarPDF() {
    if (cargos.length === 0) { alert('No tienes cargos para exportar'); return; }

    if (typeof window.jspdf === 'undefined') {
        const ventana = window.open('', '_blank');
        let html = `
            <html><head><title>Mis Cargos - PermutApp</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #667eea; text-align: center; }
                .cargo { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 8px; }
                .cargo-titulo { color: #667eea; font-size: 18px; font-weight: bold; margin-bottom: 10px; }
                .cargo-detalle { margin: 5px 0; color: #555; }
            </style></head><body>
            <h1>📚 Mis Cargos Registrados - PermutApp</h1>
            <p><strong>Usuario:</strong> ${usuarioActual.nombre}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p><hr>`;

        cargos.forEach((cargo, index) => {
            let turnos = [];
            try { turnos = JSON.parse(cargo.turno); if (!Array.isArray(turnos)) turnos = [cargo.turno]; }
            catch { turnos = [cargo.turno]; }
            html += `<div class="cargo">
                <div class="cargo-titulo">${index + 1}. ${cargo.cargo}</div>
                <div class="cargo-detalle"><strong>Área:</strong> ${cargo.area_nombre}</div>
                <div class="cargo-detalle"><strong>Escuela:</strong> ${cargo.escuela_nombre}</div>
                <div class="cargo-detalle"><strong>Turno:</strong> ${turnos.join(', ')}</div>
                ${cargo.horario ? `<div class="cargo-detalle"><strong>Horario:</strong> ${cargo.horario}</div>` : ''}
            </div>`;
        });

        html += '</body></html>';
        ventana.document.write(html);
        ventana.document.close();
        ventana.print();
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const colorPrincipal = [102, 126, 234];

    doc.setFontSize(20);
    doc.setTextColor(...colorPrincipal);
    doc.text('Mis Cargos Registrados - PermutApp', 105, 25, { align: 'center' });
    doc.setDrawColor(...colorPrincipal);
    doc.line(20, 32, 190, 32);
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(`Usuario: ${usuarioActual.nombre}`, 20, 42);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 20, 50);

    let y = 62;
    const pageHeight = doc.internal.pageSize.height;

    cargos.forEach((cargo, index) => {
        if (y > pageHeight - 40) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setTextColor(...colorPrincipal);
        doc.text(`${index + 1}. ${cargo.cargo}`, 20, y); y += 8;
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(`Área: ${cargo.area_nombre}`, 25, y); y += 6;
        doc.text(`Escuela: ${cargo.escuela_nombre}`, 25, y); y += 6;
        let turnos = [];
        try { turnos = JSON.parse(cargo.turno); if (!Array.isArray(turnos)) turnos = [cargo.turno]; }
        catch { turnos = [cargo.turno]; }
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
