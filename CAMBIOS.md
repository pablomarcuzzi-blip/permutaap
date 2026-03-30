# 📋 RESUMEN DE CAMBIOS - REESTRUCTURA DE BASE DE DATOS PERMUTAPP

**Fecha**: 11 de marzo de 2026  
**Objetivo**: Importar escuelas desde Excel y reestructurar la base de datos

---

## 🔄 CAMBIOS REALIZADOS

### 1. ✏️ Modificaciones en `database.js`

#### Cambios en las Tablas

**Tabla `escuelas` - NUEVA ESTRUCTURA**
```sql
DROP TABLE IF EXISTS escuelas;

CREATE TABLE IF NOT EXISTS escuelas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    nivel TEXT NOT NULL CHECK (nivel IN ('Inicial', 'Primaria', 'Secundaria', 'Formación Docente')),
    area_modalidad TEXT NOT NULL,
    direccion TEXT,
    barrio TEXT,
    cue TEXT,
    tipo_original TEXT,
    origen TEXT DEFAULT 'oficial' CHECK (origen IN ('oficial', 'docente')),
    creado_por INTEGER,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creado_por) REFERENCES usuarios(id)
);
```

**Cambios principales en `escuelas`:**
- ❌ Eliminado: `area_id`, `tipo_id`
- ✅ Agregado: `nivel`, `area_modalidad`, `direccion`, `barrio`, `cue`, `tipo_original`

**Tabla `cargos_intercambio` - NUEVA ESTRUCTURA**
```sql
DROP TABLE IF EXISTS cargos_intercambio;

CREATE TABLE IF NOT EXISTS cargos_intercambio (
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
);
```

**Cambios principales en `cargos_intercambio`:**
- ❌ Eliminado: `area_id`
- ✅ Agregado: `nivel`, `area_modalidad`

#### Cambios en Funciones

**Funciones ELIMINADAS:**
- `obtenerAreas()` - Ya no necesario con la nueva estructura
- `obtenerTiposPorArea()` - Ya no se usan tipos de escuelas
- `crearTipo()` - Ya no se crean tipos
- `insertarDatosIniciales()` - Vacía (datos vienes desde Excel)
- `insertarEscuelasOficiales()` - Vacía (datos vienen desde Excel)

**Funciones MODIFICADAS:**

```javascript
// ANTES
registrarCargo(usuarioId, cargo, areaId, escuelaId, turno, horario, callback)

// AHORA
registrarCargo(usuarioId, materia, nivel, area_modalidad, escuelaId, turno, horario, callback)
```

```javascript
// ANTES
obtenerEscuelas(areaId, tipoId, usuarioId, callback)

// AHORA
obtenerEscuelas(nivel, usuarioId, callback)
```

```javascript
// ANTES
crearEscuelaDocente(nombre, areaId, tipoId, usuarioId, callback)

// AHORA
crearEscuelaDocente(nombre, nivel, area_modalidad, usuarioId, callback)
```

```javascript
// ANTES
actualizarCargo(cargoId, usuarioId, cargo, areaId, escuelaId, turno, horario, callback)

// AHORA
actualizarCargo(cargoId, usuarioId, materia, nivel, area_modalidad, escuelaId, turno, horario, callback)
```

**Funciones ACTUALIZADAS (sin cambio de firma):**
- `buscarCoincidencias()` - Ahora busca por `nivel` y `area_modalidad` en lugar de `area_id`
- `obtenerMisEscuelas()` - Devuelve una estructura más simple sin `area_id` ni `tipo_id`
- `obtenerCargosPorUsuario()` - Ya no joinea con tabla `areas`
- `obtenerCargoPorId()` - Ya no joinea con tabla `areas`

---

### 2. 📁 Archivos CREADOS

#### `importarEscuelas.js`
Función para importar escuelas desde archivos Excel (.xlsx)

**Características:**
- Valida estructura del Excel
- Verifica campos requeridos
- Valida valores de `nivel`
- Ignora duplicados automáticamente
- Reporta errores por fila
- Genera estadísticas de importación

**Uso:**
```bash
node importarEscuelas.js escuelas.xlsx
```

**Funciones exportadas:**
```javascript
importarEscuelasDesdeExcel(rutaArchivo, callback)
obtenerEstadisticasEscuelas(callback)
```

#### `IMPORTAR_ESCUELAS.md`
Documentación completa sobre:
- Estructura del archivo Excel requerido
- Valores válidos para cada campo
- Instrucciones de uso
- Ejemplos de código
- Validaciones y errores comunes
- Verificación de importación

#### `plantilla_escuelas.csv`
Plantilla de ejemplo con 12 escuelas para testing

**Columnas:**
- nombre (requerido)
- nivel (requerido) - Inicial, Primaria, Secundaria, Formación Docente
- area_modalidad (requerido)
- direccion (opcional)
- barrio (opcional)
- cue (opcional)
- tipo_original (opcional)

---

### 3. 📦 Actualizaciones en `package.json`

**Dependencia agregada:**
```json
"xlsx": "^0.18.5"
```

Instalar con:
```bash
npm install xlsx
```

---

## 🔧 ACCIONES NECESARIAS DESPUÉS DE LA ACTUALIZACIÓN

### Paso 1: Instalar nuevas dependencias
```bash
npm install xlsx
```

### Paso 2: Recrear la base de datos
```bash
# Opción 1: Eliminar archivos de BD (desarrollo)
rm permutapp.db
node server.js

# Opción 2: Sistema se resetea automáticamente al detectar DROP TABLE
node server.js
```

### Paso 3: Importar escuelas desde Excel
```bash
# Usando la plantilla de ejemplo (testing)
node importarEscuelas.js plantilla_escuelas.csv

# Usando archivo personalizado
node importarEscuelas.js tu_archivo_escuelas.xlsx
```

### Paso 4: Actualizar código cliente (frontend)
Es necesario revisar y actualizar:
- ✅ `Public/dashboard.js` - Llamadas a `obtenerAreas()` y `obtenerTiposPorArea()`
- ✅ `Public/app.js` - Selección de escuelas (ahora por `nivel`)
- ✅ Endpoints en `server.js` que usen las funciones modificadas

---

## 📊 MAPEO DE DATOS ANTIGUOS A NUEVOS

Si tienes datos existentes, considera esta migración:

| Dato Antiguo | Nuevo Campo |
|------|---|
| `areas.nombre` | `nivel` (mapear a uno de: Inicial, Primaria, Secundaria, Formación Docente) |
| `tipos_escuela.nombre` | `area_modalidad` |
| Cargos sin `area_id` | Usar `nivel` y `area_modalidad` del cargo anterior |

---

## ⚠️ CAMBIOS IMPORTANTES PARA DESARROLLADORES

### API Database

```javascript
// ❌ YA NO FUNCIONA
db.obtenerAreas(callback)
db.obtenerTiposPorArea(areaId, callback)
db.obtenerEscuelas(areaId, tipoId, usuarioId, callback)
db.registrarCargo(usuarioId, cargo, areaId, escuelaId, turno, horario, callback)
db.actualizarCargo(cargoId, usuarioId, cargo, areaId, escuelaId, turno, horario, callback)

// ✅ HAY QUE USAR
db.obtenerEscuelas(nivel, usuarioId, callback)
db.registrarCargo(usuarioId, materia, nivel, area_modalidad, escuelaId, turno, horario, callback)
db.actualizarCargo(cargoId, usuarioId, materia, nivel, area_modalidad, escuelaId, turno, horario, callback)
```

### Búsquedas de Coincidencias

Ahora busca escuelas con las mismas:
- `materia`
- `nivel`
- `area_modalidad`

(Antes buscaba por `materia` y `area_id`)

---

## 📝 NOTAS

- Las tablas `areas` y `tipos_escuela` quedan en la BD pero no se usan
- Todos los datos importados tendrán `origen = 'oficial'`
- Los docentes aún pueden crear escuelas propias con `origen = 'docente'`
- La BD es totalmente reversible - cualquier punto anterior al DROP se puede restaurar
- Los cambios se aplicarán cuando se reinicie el servidor

---

## 🆘 TROUBLESHOOTING

### Error: "Archivo Excel está vacío"
- Verificar que el Excel tiene datos en la primera hoja
- Asegurarse de que tiene al menos una fila data

### Error: "Nivel inválido"
- Verificar que el nivel es exactamente: `Inicial`, `Primaria`, `Secundaria`, o `Formación Docente`
- Revisar mayúsculas y espacios

### Error: "Nombre de escuela vacío"
- Verificar que todas las filas tienen un nombre en la columna A

### BD marcando errores de FK (Foreign Key)
- Ejecutar `npm install sqlite3` nuevamente
- Si persiste, eliminar `permutapp.db` y reiniciar servidor
