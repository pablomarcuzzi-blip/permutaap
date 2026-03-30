// catalogo.js - Catálogo de Escuelas PermutApp

let todasLasEscuelas = [];
let escuelasFiltradas = [];
let areas = [];
let tipos = [];
let paginaActual = 1;
const escuelasPorPagina = 20;
let ordenActual = { columna: 'nombre', direccion: 'asc' };

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    await cargarUsuario();
    await cargarDatosIniciales();
    await cargarEscuelas();

    // Event listeners
    document.getElementById('search').addEventListener('input', filtrarEscuelas);
    document.getElementById('areaFilter').addEventListener('change', onAreaFilterChange);
    document.getElementById('tipoFilter').addEventListener('change', filtrarEscuelas);
    document.getElementById('comunaFilter').addEventListener('change', filtrarEscuelas);
});

// Cargar usuario actual
async function cargarUsuario() {
    try {
        const response = await fetch('/api/usuario', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const usuario = await response.json();
            document.getElementById('userName').textContent = usuario.nombre;
        } else {
            logout();
        }
    } catch (error) {
        console.error('Error cargando usuario:', error);
    }
}

// Cargar áreas y tipos
async function cargarDatosIniciales() {
    try {
        const areasRes = await fetch('/api/areas');
        areas = await areasRes.json();

        // Cargar áreas en el select
        const areaSelect = document.getElementById('areaFilter');
        areaSelect.innerHTML = '<option value="">Todas las áreas</option>';
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

// Cargar todas las escuelas
async function cargarEscuelas() {
    try {
        const response = await fetch('/api/catalogo-escuelas', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            todasLasEscuelas = await response.json();
            escuelasFiltradas = [...todasLasEscuelas];
            mostrarEscuelas();
        } else {
            console.error('Error cargando escuelas');
        }
    } catch (error) {
        console.error('Error cargando escuelas:', error);
    }
}

// Filtrar escuelas
function filtrarEscuelas() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const areaId = document.getElementById('areaFilter').value;
    const tipoId = document.getElementById('tipoFilter').value;
    const comuna = document.getElementById('comunaFilter').value;

    escuelasFiltradas = todasLasEscuelas.filter(escuela => {
        const matchSearch = !searchTerm ||
            escuela.nombre.toLowerCase().includes(searchTerm) ||
            (escuela.direccion && escuela.direccion.toLowerCase().includes(searchTerm)) ||
            (escuela.cue && escuela.cue.toLowerCase().includes(searchTerm));

        const matchArea = !areaId || escuela.area_id == areaId;
        const matchTipo = !tipoId || escuela.tipo_id == tipoId;
        const matchComuna = !comuna || escuela.comuna == comuna;

        return matchSearch && matchArea && matchTipo && matchComuna;
    });

    paginaActual = 1;
    mostrarEscuelas();
}

// Aplicar filtros (botón)
function aplicarFiltros() {
    filtrarEscuelas();
}

// Evento cambio de área en filtros
async function onAreaFilterChange() {
    const areaId = document.getElementById('areaFilter').value;
    const tipoSelect = document.getElementById('tipoFilter');

    tipoSelect.innerHTML = '<option value="">Todos los tipos</option>';
    tipoSelect.disabled = true;

    if (!areaId) {
        filtrarEscuelas();
        return;
    }

    try {
        const response = await fetch(`/api/tipos/${areaId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const tiposData = await response.json();
            tipos = tiposData;

            tipos.forEach(tipo => {
                const option = document.createElement('option');
                option.value = tipo.id;
                option.textContent = tipo.nombre;
                tipoSelect.appendChild(option);
            });

            tipoSelect.disabled = false;
        }
    } catch (error) {
        console.error('Error cargando tipos:', error);
    }

    filtrarEscuelas();
}

// Mostrar escuelas en la tabla
function mostrarEscuelas() {
    const tbody = document.getElementById('escuelasBody');
    const totalEscuelas = escuelasFiltradas.length;
    const inicio = (paginaActual - 1) * escuelasPorPagina;
    const fin = inicio + escuelasPorPagina;
    const escuelasPagina = escuelasFiltradas.slice(inicio, fin);

    if (totalEscuelas === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No se encontraron escuelas</td></tr>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    tbody.innerHTML = escuelasPagina.map(escuela => `
        <tr>
            <td>${escuela.cue || ''}</td>
            <td>${escuela.nombre}</td>
            <td>${escuela.direccion || ''}</td>
            <td>${escuela.area}</td>
            <td>${escuela.tipo}</td>
            <td>${escuela.comuna || ''}</td>
        </tr>
    `).join('');

    generarPaginacion(totalEscuelas);
}

// Generar paginación
function generarPaginacion(total) {
    const totalPaginas = Math.ceil(total / escuelasPorPagina);
    const pagination = document.getElementById('pagination');

    if (totalPaginas <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    // Anterior
    html += `<button onclick="cambiarPagina(${paginaActual - 1})" ${paginaActual === 1 ? 'disabled' : ''}>Anterior</button>`;

    // Páginas
    const inicio = Math.max(1, paginaActual - 2);
    const fin = Math.min(totalPaginas, paginaActual + 2);

    for (let i = inicio; i <= fin; i++) {
        html += `<button onclick="cambiarPagina(${i})" class="${i === paginaActual ? 'active' : ''}">${i}</button>`;
    }

    // Siguiente
    html += `<button onclick="cambiarPagina(${paginaActual + 1})" ${paginaActual === totalPaginas ? 'disabled' : ''}>Siguiente</button>`;

    pagination.innerHTML = html;
}

// Cambiar página
function cambiarPagina(pagina) {
    paginaActual = pagina;
    mostrarEscuelas();
    window.scrollTo(0, 0);
}

// Ordenar tabla
function ordenarTabla(columna) {
    if (ordenActual.columna === columna) {
        ordenActual.direccion = ordenActual.direccion === 'asc' ? 'desc' : 'asc';
    } else {
        ordenActual.columna = columna;
        ordenActual.direccion = 'asc';
    }

    escuelasFiltradas.sort((a, b) => {
        let valorA = a[columna] || '';
        let valorB = b[columna] || '';

        if (columna === 'comuna') {
            valorA = parseInt(valorA) || 0;
            valorB = parseInt(valorB) || 0;
        } else {
            valorA = valorA.toString().toLowerCase();
            valorB = valorB.toString().toLowerCase();
        }

        if (ordenActual.direccion === 'asc') {
            return valorA > valorB ? 1 : valorA < valorB ? -1 : 0;
        } else {
            return valorA < valorB ? 1 : valorA > valorB ? -1 : 0;
        }
    });

    mostrarEscuelas();
}

// Logout
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}