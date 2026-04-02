// ==========================================
// CONFIGURACIÓN
// ==========================================
const API_URL = '';

// ==========================================
// ESTADO DE LA APP
// ==========================================
let cargosAgregados = [];
let usuarioActual = null;
let datosCache = {
    niveles: [],
    tipos: [],
    distritos: [],
    cargos: []
};

// ==========================================
// ELEMENTOS DOM
// ==========================================
const elementos = {
    // Registro
    formRegistro: document.getElementById('form-registro'),
    email: document.getElementById('email'),
    nombre: document.getElementById('nombre'),
    aniosTitularidad: document.getElementById('anios-titularidad'),
    btnRegistrar: document.getElementById('btn-registrar'),
    mensajeError: document.getElementById('mensaje-error'),
    
    // Menú cascada registro
    selectNivel: document.getElementById('select-nivel'),
    grupoTipo: document.getElementById('grupo-tipo'),
    selectTipo: document.getElementById('select-tipo'),
    selectDistrito: document.getElementById('select-distrito'),
    grupoCargo: document.getElementById('grupo-cargo'),
    selectCargo: document.getElementById('select-cargo'),
    btnAgregarCargo: document.getElementById('btn-agregar-cargo'),
    
    // Lista cargos
    listaCargosContainer: document.getElementById('lista-cargos-container'),
    listaCargos: document.getElementById('lista-cargos'),
    
    // Búsqueda
    seccionRegistro: document.getElementById('seccion-registro'),
    seccionBusqueda: document.getElementById('seccion-busqueda'),
    nombreUsuario: document.getElementById('nombre-usuario'),
    formBusqueda: document.getElementById('form-busqueda'),
    busquedaNivel: document.getElementById('busqueda-nivel'),
    busquedaGrupoTipo: document.getElementById('busqueda-grupo-tipo'),
    busquedaTipo: document.getElementById('busqueda-tipo'),
    busquedaDistrito: document.getElementById('busqueda-distrito'),
    busquedaGrupoCargo: document.getElementById('busqueda-grupo-cargo'),
    busquedaCargo: document.getElementById('busqueda-cargo'),
    resultadosBusqueda: document.getElementById('resultados-busqueda'),
    
    // Modal listado
    modalListado: document.getElementById('modal-listado'),
    contenidoListado: document.getElementById('contenido-listado'),
    
    // Sistema
    mensajeSistema: document.getElementById('mensaje-sistema')
};

// ==========================================
// FUNCIONES UTILS
// ==========================================
function mostrarMensaje(mensaje, tipo = 'info') {
    const div = elementos.mensajeSistema;
    div.textContent = mensaje;
    div.className = `mensaje-sistema mensaje-${tipo}`;
    div.style.display = 'block';
    setTimeout(() => div.style.display = 'none', 5000);
}

function mostrarError(mensaje) {
    elementos.mensajeError.textContent = mensaje;
    elementos.mensajeError.style.display = 'block';
    setTimeout(() => elementos.mensajeError.style.display = 'none', 5000);
}

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}/api${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
        return data;
    } catch (error) {
        console.error('Error API:', error);
        throw error;
    }
}

// ==========================================
// CARGAR DATOS INICIALES
// ==========================================
async function cargarDatosIniciales() {
    try {
        // Cargar niveles
        const dataNiveles = await fetchAPI('/niveles');
        datosCache.niveles = dataNiveles.niveles;
        llenarSelect(elementos.selectNivel, dataNiveles.niveles, 'id', 'nombre');
        llenarSelect(elementos.busquedaNivel, dataNiveles.niveles, 'id', 'nombre');
        
        // Cargar tipos
        const dataTipos = await fetchAPI('/tipos-escuela');
        datosCache.tipos = dataTipos.tipos;
        
        // Cargar distritos
        const dataDistritos = await fetchAPI('/distritos');
        datosCache.distritos = dataDistritos.distritos;
        llenarSelect(elementos.selectDistrito, dataDistritos.distritos, 'id', 'nombre');
        llenarSelect(elementos.busquedaDistrito, dataDistritos.distritos, 'id', 'nombre');
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarError('Error cargando datos. Recargá la página.');
    }
}

function llenarSelect(select, datos, valueKey, textKey, defaultText = 'Seleccionar...') {
    select.innerHTML = `<option value="">${defaultText}</option>`;
    datos.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[textKey];
        select.appendChild(option);
    });
}

// ==========================================
// MENÚ CASCADA - REGISTRO
// ==========================================
function setupMenuCascada() {
    // Cambio de nivel
    elementos.selectNivel.addEventListener('change', async (e) => {
        const nivelId = e.target.value;
        const nivel = datosCache.niveles.find(n => n.id === nivelId);
        
        // Resetear todo lo siguiente
        elementos.selectTipo.value = '';
        elementos.selectCargo.value = '';
        elementos.grupoCargo.style.display = 'none';
        elementos.btnAgregarCargo.disabled = true;
        
        if (!nivelId) {
            elementos.grupoTipo.style.display = 'none';
            return;
        }
        
        // Si el nivel tiene tipos (secundaria), mostrar select de tipos
        if (nivel && nivel.tiene_tipo) {
            elementos.grupoTipo.style.display = 'block';
            llenarSelect(elementos.selectTipo, datosCache.tipos, 'id', 'nombre');
        } else {
            elementos.grupoTipo.style.display = 'none';
            // Cargar cargos directamente
            await cargarCargos(nivelId, null, elementos.selectCargo);
        }
    });
    
    // Cambio de tipo
    elementos.selectTipo.addEventListener('change', async (e) => {
        const tipoId = e.target.value;
        const nivelId = elementos.selectNivel.value;
        
        elementos.selectCargo.value = '';
        
        if (tipoId) {
            await cargarCargos(nivelId, tipoId, elementos.selectCargo);
        }
    });
    
    // Cambio de distrito o cargo
    elementos.selectDistrito.addEventListener('change', verificarCompleto);
    elementos.selectCargo.addEventListener('change', verificarCompleto);
}

async function cargarCargos(nivelId, tipoId, select) {
    try {
        const url = tipoId ? `/cargos?nivel=${nivelId}&tipo=${tipoId}` : `/cargos?nivel=${nivelId}`;
        const data = await fetchAPI(url);
        datosCache.cargos = data.cargos;
        
        llenarSelect(select, data.cargos, 'id', 'nombre');
        select.parentElement.style.display = 'block';
    } catch (error) {
        console.error('Error cargando cargos:', error);
    }
}

function verificarCompleto() {
    const nivel = elementos.selectNivel.value;
    const tipo = elementos.selectTipo.value;
    const distrito = elementos.selectDistrito.value;
    const cargo = elementos.selectCargo.value;
    
    const nivelObj = datosCache.niveles.find(n => n.id === nivel);
    const requiereTipo = nivelObj && nivelObj.tiene_tipo;
    
    const completo = nivel && distrito && cargo && (!requiereTipo || tipo);
    elementos.btnAgregarCargo.disabled = !completo;
}

// ==========================================
// AGREGAR CARGO A LISTA
// ==========================================
function agregarCargoALista() {
    const nivelId = elementos.selectNivel.value;
    const tipoId = elementos.selectTipo.value;
    const distritoId = elementos.selectDistrito.value;
    const cargoId = elementos.selectCargo.value;
    
    const nivel = datosCache.niveles.find(n => n.id === nivelId);
    const tipo = datosCache.tipos.find(t => t.id === tipoId);
    const distrito = datosCache.distritos.find(d => d.id == distritoId);
    const cargo = datosCache.cargos.find(c => c.id == cargoId);
    
    // Verificar duplicado
    const duplicado = cargosAgregados.some(c => 
        c.cargo_id == cargoId && c.distrito_id == distritoId
    );
    
    if (duplicado) {
        mostrarError('Ya agregaste este cargo en este distrito');
        return;
    }
    
    cargosAgregados.push({
        cargo_id: cargoId,
        nombre: cargo.nombre,
        nivel: nivel.nombre,
        tipo: tipo ? tipo.nombre : null,
        distrito_id: distritoId,
        distrito: distrito.nombre
    });
    
    actualizarListaCargos();
    limpiarFormularioCargo();
}

function actualizarListaCargos() {
    if (cargosAgregados.length === 0) {
        elementos.listaCargosContainer.style.display = 'none';
        elementos.btnRegistrar.disabled = true;
        return;
    }
    
    elementos.listaCargosContainer.style.display = 'block';
    elementos.listaCargos.innerHTML = '';
    
    cargosAgregados.forEach((cargo, index) => {
        const div = document.createElement('div');
        div.className = 'cargo-item';
        div.innerHTML = `
            <div class="cargo-info">
                <strong>${cargo.nombre}</strong>
                <div class="cargo-detalles">
                    ${cargo.nivel}${cargo.tipo ? ' - ' + cargo.tipo : ''} | ${cargo.distrito}
                </div>
            </div>
            <button type="button" class="btn-eliminar" onclick="eliminarCargo(${index})" title="Eliminar">✕</button>
        `;
        elementos.listaCargos.appendChild(div);
    });
    
    elementos.btnRegistrar.disabled = false;
}

function eliminarCargo(index) {
    cargosAgregados.splice(index, 1);
    actualizarListaCargos();
}

function limpiarFormularioCargo() {
    elementos.selectNivel.value = '';
    elementos.selectTipo.value = '';
    elementos.selectDistrito.value = '';
    elementos.selectCargo.value = '';
    elementos.grupoTipo.style.display = 'none';
    elementos.grupoCargo.style.display = 'none';
    elementos.btnAgregarCargo.disabled = true;
}

// ==========================================
// REGISTRO DE USUARIO
// ==========================================
async function registrar(e) {
    e.preventDefault();
    
    const email = elementos.email.value.trim();
    const nombre = elementos.nombre.value.trim();
    const anios = parseInt(elementos.aniosTitularidad.value);
    
    if (!email.endsWith('@bue.edu.ar')) {
        mostrarError('El email debe terminar en @bue.edu.ar');
        return;
    }
    
    if (cargosAgregados.length === 0) {
        mostrarError('Agregá al menos un cargo');
        return;
    }
    
    try {
        elementos.btnRegistrar.disabled = true;
        elementos.btnRegistrar.textContent = 'Registrando...';
        
        const data = await fetchAPI('/registro', {
            method: 'POST',
            body: JSON.stringify({
                email,
                nombre,
                aniosTitularidad: anios,
                cargos: cargosAgregados
            })
        });
        
        mostrarMensaje('¡Registro exitoso! Revisá tu email.', 'success');
        elementos.formRegistro.reset();
        cargosAgregados = [];
        actualizarListaCargos();
        
    } catch (error) {
        mostrarError(error.message);
    } finally {
        elementos.btnRegistrar.disabled = false;
        elementos.btnRegistrar.textContent = 'Registrarme';
    }
}

// ==========================================
// MENÚ CASCADA - BÚSQUEDA
// ==========================================
function setupBusqueda() {
    elementos.busquedaNivel.addEventListener('change', async (e) => {
        const nivelId = e.target.value;
        const nivel = datosCache.niveles.find(n => n.id === nivelId);
        
        elementos.busquedaTipo.value = '';
        elementos.busquedaCargo.value = '';
        elementos.busquedaGrupoCargo.style.display = 'none';
        
        if (!nivelId) {
            elementos.busquedaGrupoTipo.style.display = 'none';
            return;
        }
        
        if (nivel && nivel.tiene_tipo) {
            elementos.busquedaGrupoTipo.style.display = 'block';
            llenarSelect(elementos.busquedaTipo, datosCache.tipos, 'id', 'nombre');
        } else {
            elementos.busquedaGrupoTipo.style.display = 'none';
            await cargarCargos(nivelId, null, elementos.busquedaCargo);
        }
    });
    
    elementos.busquedaTipo.addEventListener('change', async (e) => {
        const tipoId = e.target.value;
        const nivelId = elementos.busquedaNivel.value;
        
        if (tipoId) {
            await cargarCargos(nivelId, tipoId, elementos.busquedaCargo);
        }
    });
}

async function buscarPermutas(e) {
    e.preventDefault();
    
    const cargoId = elementos.busquedaCargo.value;
    const distritoId = elementos.busquedaDistrito.value;
    
    if (!cargoId || !distritoId) {
        mostrarError('Seleccioná cargo y distrito');
        return;
    }
    
    try {
        const data = await fetchAPI('/buscar', {
            method: 'POST',
            body: JSON.stringify({
                cargoId,
                distritoId,
                usuarioId: usuarioActual?.id
            })
        });
        
        mostrarResultados(data.coincidencias);
        
    } catch (error) {
        mostrarError('Error buscando: ' + error.message);
    }
}

function mostrarResultados(coincidencias) {
    const div = elementos.resultadosBusqueda;
    
    if (coincidencias.length === 0) {
        div.innerHTML = `<div class="sin-resultados"><p>No hay coincidencias</p></div>`;
        return;
    }
    
    let html = `<div class="con-resultados"><h4>¡${coincidencias.length} coincidencia(s)!</h4><div class="lista-coincidencias">`;
    
    coincidencias.forEach(c => {
        html += `
            <div class="coincidencia-card">
                <h5>${c.nombre}</h5>
                <p>${c.cargo_nombre}</p>
                <p>${c.nivel_nombre} | ${c.distrito_nombre}</p>
                <p>📧 ${c.email}</p>
                <a href="mailto:${c.email}" class="btn-contactar">Contactar</a>
            </div>
        `;
    });
    
    html += '</div></div>';
    div.innerHTML = html;
}

// ==========================================
// MODAL LISTADO (PDF)
// ==========================================
async function abrirModalListado() {
    try {
        const data = await fetchAPI('/listado-completo');
        
        let html = '<table class="tabla-listado"><thead><tr>';
        html += '<th>Cargo</th><th>Nivel</th><th>Modalidad/Orientación</th><th>Docentes</th>';
        html += '</tr></thead><tbody>';
        
        data.listado.forEach(item => {
            html += `<tr>
                <td>${item.cargo}</td>
                <td>${item.nivel}</td>
                <td>${item.tipo || '-'}</td>
                <td>${item.cantidad_docentes}</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        elementos.contenidoListado.innerHTML = html;
        elementos.modalListado.style.display = 'flex';
        
    } catch (error) {
        mostrarError('Error cargando listado');
    }
}

function cerrarModalListado() {
    elementos.modalListado.style.display = 'none';
}

function imprimirListado() {
    window.print();
}

// ==========================================
// SESIÓN
// ==========================================
function verificarSesion() {
    const sesion = localStorage.getItem('permutapp_sesion');
    if (sesion) {
        try {
            usuarioActual = JSON.parse(sesion);
            mostrarPanelBusqueda();
        } catch (e) {
            localStorage.removeItem('permutapp_sesion');
        }
    }
}

function mostrarPanelBusqueda() {
    elementos.seccionRegistro.style.display = 'none';
    elementos.seccionBusqueda.style.display = 'block';
    elementos.nombreUsuario.textContent = usuarioActual?.nombre || 'Docente';
}

function cerrarSesion() {
    localStorage.removeItem('permutapp_sesion');
    usuarioActual = null;
    location.reload();
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarDatosIniciales();
    setupMenuCascada();
    setupBusqueda();
    verificarSesion();
    
    elementos.formRegistro.addEventListener('submit', registrar);
    elementos.formBusqueda.addEventListener('submit', buscarPermutas);
    
    console.log('✅ PermutApp con menú cascada iniciada');
});