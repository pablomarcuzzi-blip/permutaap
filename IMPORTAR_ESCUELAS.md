# Guía de Importación de Escuelas desde Excel

## 📋 Estructura del Archivo Excel

El archivo Excel debe tener las siguientes columnas (sin encabezado o con encabezado en la primera fila):

| Columna | Campo | Tipo | Requerido | Ejemplo |
|---------|-------|------|-----------|---------|
| A | nombre | Texto | ✅ | ESCUELA PRIMARIA "ANA MARÍA CAMPOS" |
| B | nivel | Texto | ✅ | Primaria |
| C | area_modalidad | Texto | ✅ | Educación Rural |
| D | direccion | Texto | ❌ | Calle Principal 123 |
| E | barrio | Texto | ❌ | San Justo |
| F | cue | Texto | ❌ | 0700001 |
| G | tipo_original | Texto | ❌ | Común |

## ✅ Valores Válidos

### Nivel
Debe ser exactamente uno de estos valores:
- `Inicial`
- `Primaria`
- `Secundaria`
- `Formación Docente`

### Area_modalidad
Ejemplos:
- Educación Rural
- Educación Especial
- Bilingüe
- Técnica
- Artística

## 🚀 Cómo Importar

### Opción 1: Desde línea de comandos

```bash
node importarEscuelas.js <ruta_archivo.xlsx>
```

Ejemplo:
```bash
node importarEscuelas.js "C:\Descargas\escuelas.xlsx"
```

### Opción 2: Desde código JavaScript

```javascript
const { importarEscuelasDesdeExcel } = require('./importarEscuelas');

importarEscuelasDesdeExcel('escuelas.xlsx', (err, resultado) => {
    if (err) {
        console.error('Error:', err.message);
        return;
    }
    
    console.log(`✅ Importadas ${resultado.insertados} de ${resultado.total} escuelas`);
    if (resultado.errores.length > 0) {
        console.log('Errores:', resultado.errores);
    }
});
```

## 📊 Respuesta de Importación

```javascript
{
    total: 150,                    // Total de filas procesadas
    insertados: 145,               // Escuelas insertadas exitosamente
    errores: [],                   // Array de errores encontrados
    exitoso: true                  // Si la importación fue exitosa
}
```

## 🔍 Validaciones

### Campos Requeridos
- **nombre**: No puede estar vacío
- **nivel**: No puede estar vacío y debe ser un valor válido
- **area_modalidad**: No puede estar vacío

### Campos Opcionales
- Los campos vacíos (NULL) son permitidos para: dirección, barrio, cue, tipo_original

### Duplicados
- Las escuelas duplicadas (mismo nombre) se ignoran automáticamente

## ⚠️ Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| "Nivel inválido" | Nivel mal escrito o no es reconocido | Usar exactamente: Inicial, Primaria, Secundaria, Formación Docente |
| "Nombre de escuela vacío" | La columna nombre está vacía | Verificar que todas las filas tengan nombre |
| "Archivo Excel está vacío" | El archivo no tiene datos | Agregar al menos una fila de datos |

## 📁 Ejemplo de Archivo Excel

Guarda este contenido en un archivo `.xlsx`:

```
nombre,nivel,area_modalidad,direccion,barrio,cue,tipo_original
ESCUELA PRIMARIA N° 1,Primaria,Educación Rural,Calle Principal 123,San Justo,0700001,Común
ESCUELA SECUNDARIA "BELGRANO",Secundaria,Educación Técnica,Avenida Mitre 456,La Plata,0800002,Técnica
JARDÍN DE INFANTES "MARAVILLA",Inicial,Educación Especial,Calle 5 789,Centro,0900003,Especial
INSTITUTO SUPERIOR "JUAN V GONZALEZ",Formación Docente,Formación Docente,Calle 1 101,Barracas,1000004,Formación
```

## 🔄 Verificar Importación

Después de importar, puedes verificar los datos:

```javascript
const { obtenerEstadisticasEscuelas } = require('./importarEscuelas');

obtenerEstadisticasEscuelas((err, stats) => {
    console.log(stats);
    // Output:
    // [
    //   { nivel: 'Inicial', area_modalidad: 'Educación Especial', cantidad: 5 },
    //   { nivel: 'Primaria', area_modalidad: 'Educación Rural', cantidad: 142 },
    //   ...
    // ]
});
```

## 🛠️ Requisitos

Asegúrate de tener instalado:
```bash
npm install xlsx sqlite3
```

## 📝 Notas Importantes

- El archivo Excel se procesa fila por fila
- Se recomienda utilizar la función de validación de datos en Excel para evitar errores
- Todas las escuelas importadas tendrán `origen = 'oficial'`
- Los nombres se convertirán automáticamente a MAYÚSCULAS
- Las fechas de creación se registran automáticamente al importar
