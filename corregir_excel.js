const XLSX = require('xlsx');
const fs = require('fs');

const archivoEntrada = 'establecimientos_educativos.xlsx';
const archivoSalida = 'establecimientos_educativos_corregido.xlsx';

console.log('📊 Leyendo Excel...');
const workbook = XLSX.readFile(archivoEntrada);
const nombreHoja = workbook.SheetNames[0];
const hoja = workbook.Sheets[nombreHoja];
const datos = XLSX.utils.sheet_to_json(hoja);

console.log(`📋 Total de filas: ${datos.length}`);

let modificadas = 0;
let yaEstabanBien = 0;

// Mapeo de correcciones
const correcciones = {
    'Escuelas Normales Superiores': 'Normal (Secundaria)',
    'Escuelas normales superiores': 'Normal (Secundaria)',
    'ESCUELAS NORMALES SUPERIORES': 'Normal (Secundaria)'
};

datos.forEach((fila, index) => {
    const valorActual = fila.tipo_institucion;
    
    if (correcciones[valorActual]) {
        fila.tipo_institucion = correcciones[valorActual];
        modificadas++;
        console.log(`✏️ Fila ${index + 2}: "${valorActual}" → "${fila.tipo_institucion}"`);
    } else if (valorActual === 'Normal (Secundaria)') {
        yaEstabanBien++;
    }
});

// Guardar nuevo Excel
const nuevaHoja = XLSX.utils.json_to_sheet(datos);
const nuevoWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(nuevoWorkbook, nuevaHoja, nombreHoja);
XLSX.writeFile(nuevoWorkbook, archivoSalida);

console.log('\n✅ EXCEL CORREGIDO');
console.log('═══════════════════════════════════════');
console.log(`📁 Archivo guardado: ${archivoSalida}`);
console.log(`✔️ Filas modificadas: ${modificadas}`);
console.log(`✔️ Filas que ya estaban bien: ${yaEstabanBien}`);
console.log(`📊 Total: ${datos.length}`);
console.log('═══════════════════════════════════════');

// Verificación final
const tiposUnicos = [...new Set(datos.map(f => f.tipo_institucion).filter(Boolean))];
console.log('\nValores únicos en tipo_institucion:');
tiposUnicos.forEach(t => {
    const cantidad = datos.filter(f => f.tipo_institucion === t).length;
    console.log(`  "${t}": ${cantidad}`);
});