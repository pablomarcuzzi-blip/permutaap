const XLSX = require('xlsx');
const path = require('path');
const { db } = require('./database');

/**
 * Clasifica una escuela según su nen_mde y tip.
 * Devuelve un array de { nivel, area } — una escuela puede aparecer en múltiples niveles.
 */
function clasificarEscuela(nen_mde, tip) {
    const nen = str(nen_mde);
    const tipStr = str(tip);
    const niveles = [];

    // Excluir modalidad especial/domiciliaria/hospitalaria
    const excluir = ['especial', 'domiciliaria', 'hospitalaria'];
    const partes = nen.split('|').map(p => p.trim()).filter(p => !excluir.some(x => p.toLowerCase().includes(x)));
    const nenLimpio = partes.join(' | ');

    if (!nenLimpio) return [];

    const esESEA = tipStr.includes('Escuelas Superiores de Educación Artística') || tipStr.includes('ESEA');
    const esConservatorio = tipStr.toLowerCase().includes('conservatorio');
    const esTeatro = tipStr.includes('Escuela de Teatro') || tipStr.includes('EMAD') || tipStr.includes('Arte Dramático');
    const esArtistico = esESEA || esConservatorio || esTeatro;

    const esTecnica = tipStr.includes('Técnica') || tipStr.includes('Tecnica');
    const esComercial = tipStr.includes('Comercial') || tipStr.includes('Comercio');
    const esCENS = tipStr.includes('CENS');
    const esBOA = tipStr.includes('Bachilleratos con Orientación Artística');
    const esCFP = tipStr.includes('CFP') || tipStr.includes('UGEE') || tipStr.includes('Centro de Formación');
    const esEPA = tipStr.includes('Escuelas Primarias para Adultos') || tipStr.includes('CENP') ||
                  tipStr.includes('Centros Educativos de Nivel Primario') ||
                  tipStr.includes('Prog. de Alfabetización') || tipStr.includes('Contextos de Encierro');

    // INICIAL
    if (nenLimpio.includes('Nivel inicial común - Jardín maternal')) {
        niveles.push({ nivel: 'Inicial', area: 'Jardín Maternal' });
    }
    if (nenLimpio.includes('Nivel inicial común - Jardín de infantes')) {
        niveles.push({ nivel: 'Inicial', area: 'Jardín de Infantes' });
    }

    // PRIMARIA
    if (nenLimpio.includes('Nivel primario común')) {
        niveles.push({ nivel: 'Primaria', area: 'Primaria Común' });
    }
    if (nenLimpio.includes('Nivel primario de jóvenes y adultos')) {
        niveles.push({ nivel: 'Primaria', area: 'Primaria de Adultos (EPA/CENP)' });
    }

    // SECUNDARIA
    if (nenLimpio.includes('Nivel secundario común')) {
        if (esArtistico) {
            niveles.push({ nivel: 'Secundaria', area: 'Artística' });
        } else if (esTecnica) {
            niveles.push({ nivel: 'Secundaria', area: 'Técnica' });
        } else if (esComercial) {
            niveles.push({ nivel: 'Secundaria', area: 'Comercial' });
        } else {
            niveles.push({ nivel: 'Secundaria', area: 'Común (EEM, Liceo, Colegio, Normal)' });
        }
    }

    if (nenLimpio.includes('Nivel secundario de jóvenes y adultos')) {
        if (esCENS) {
            niveles.push({ nivel: 'Secundaria', area: 'CENS' });
        } else if (esBOA) {
            niveles.push({ nivel: 'Secundaria', area: 'Artística' });
        } else if (!niveles.some(n => n.nivel === 'Secundaria')) {
            niveles.push({ nivel: 'Secundaria', area: 'Común (EEM, Liceo, Colegio, Normal)' });
        }
    }

    // CFP/UGEE — solo si no es EPA (las EPA también tienen "Formación profesional" en nen pero son primaria de adultos)
    if ((nenLimpio.includes('Formación profesional') || esCFP) && !esEPA) {
        if (!niveles.some(n => n.area === 'CFP/UGEE')) {
            niveles.push({ nivel: 'Secundaria', area: 'CFP/UGEE' });
        }
    }

    // FORMACIÓN DOCENTE / TERCIARIOS
    if (nenLimpio.includes('Nivel superior no universitario común') || nenLimpio.includes('Ciclos de enseñanza artística')) {
        if (esArtistico) {
            if (!niveles.some(n => n.nivel === 'Formación Docente/Terciarios' && n.area === 'Artística')) {
                niveles.push({ nivel: 'Formación Docente/Terciarios', area: 'Artística' });
            }
        } else if (tipStr.includes('Normal') || tipStr.includes('ISFD')) {
            niveles.push({ nivel: 'Formación Docente/Terciarios', area: 'Normal/ISFD' });
        } else {
            niveles.push({ nivel: 'Formación Docente/Terciarios', area: 'INST' });
        }
    }

    // Eliminar duplicados
    const vistos = new Set();
    return niveles.filter(n => {
        const key = `${n.nivel}|${n.area}`;
        if (vistos.has(key)) return false;
        vistos.add(key);
        return true;
    });
}

function str(val) {
    return (val || '').toString().trim();
}

function limpiarNombre(nam) {
    if (!nam) return '';
    return nam.toString()
        .replace(/^Establecimiento educativo\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

/**
 * Importa escuelas desde el Excel oficial.
 */
const importarEscuelasDesdeExcel = (rutaArchivo, callback) => {
    try {
        console.log('📊 Leyendo Excel...');
        const workbook = XLSX.readFile(rutaArchivo);
        const hoja = workbook.Sheets[workbook.SheetNames[0]];
        const datos = XLSX.utils.sheet_to_json(hoja);

        if (!datos || datos.length === 0) {
            return callback(new Error('El archivo Excel está vacío'), null);
        }

        console.log(`📋 Total filas en Excel: ${datos.length}`);

        db.all('SELECT id, nombre FROM areas', (err, areas) => {
            if (err) return callback(err, null);

            const areaMap = {};
            areas.forEach(a => areaMap[a.nombre] = a.id);

            db.all('SELECT id, nombre, area_id FROM tipos_escuela', (err, tipos) => {
                if (err) return callback(err, null);

                const tipoMap = {};
                tipos.forEach(t => {
                    tipoMap[`${t.area_id}_${t.nombre}`] = t.id;
                });

                db.run('DELETE FROM escuelas WHERE origen = "oficial"', (err) => {
                    if (err) console.error('Error limpiando escuelas:', err);

                    console.log('⬆️ Insertando escuelas...');

                    const stmt = db.prepare(`INSERT INTO escuelas 
                        (nombre, area_id, tipo_id, nivel, area_modalidad, direccion, barrio, cue, tipo_original, origen) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'oficial')`);

                    let insertados = 0;
                    let omitidos = 0;
                    const errores = [];
                    const inserciones = [];

                    datos.forEach((fila, index) => {
                        const tipo_inst = str(fila.tipo_institucion);

                        if (tipo_inst.includes('IFTS')) {
                            omitidos++;
                            return;
                        }

                        const nombre = limpiarNombre(fila.nam);
                        if (!nombre) {
                            omitidos++;
                            return;
                        }

                        const clasificaciones = clasificarEscuela(fila.nen_mde, fila.tip);

                        if (clasificaciones.length === 0) {
                            omitidos++;
                            return;
                        }

                        clasificaciones.forEach(({ nivel, area }) => {
                            const areaId = areaMap[nivel];
                            const tipoId = tipoMap[`${areaId}_${area}`];

                            if (!areaId || !tipoId) {
                                errores.push(`Fila ${index + 2} [${nombre}]: no se encontró área/tipo para "${nivel}" > "${area}"`);
                                return;
                            }

                            inserciones.push([
                                nombre,
                                areaId,
                                tipoId,
                                nivel,
                                area,
                                str(fila.dir) || null,
                                str(fila.bar) || null,
                                str(fila.cue) || null,
                                tipo_inst || null
                            ]);
                        });
                    });

                    let pendientes = inserciones.length;

                    if (pendientes === 0) {
                        stmt.finalize();
                        return callback(null, { total: datos.length, insertados: 0, omitidos, errores });
                    }

                    inserciones.forEach(params => {
                        stmt.run(params, function(err) {
                            pendientes--;
                            if (err) {
                                if (!err.message.includes('UNIQUE')) {
                                    errores.push(err.message);
                                }
                            } else {
                                insertados++;
                            }
                            if (pendientes === 0) {
                                stmt.finalize();
                                callback(null, { total: datos.length, insertados, omitidos, errores });
                            }
                        });
                    });
                });
            });
        });

    } catch (error) {
        callback(error, null);
    }
};

const ejecutarImportacion = () => {
    const rutaArchivo = process.argv[2];

    if (!rutaArchivo) {
        console.error('❌ Uso: node importarEscuelas.js <ruta_archivo.xlsx>');
        process.exit(1);
    }

    const rutaCompleta = path.resolve(rutaArchivo);
    console.log(`📁 Importando desde: ${rutaCompleta}`);

    importarEscuelasDesdeExcel(rutaCompleta, (err, resultado) => {
        if (err) {
            console.error('❌ Error:', err.message);
            process.exit(1);
        }

        console.log('\n✅ IMPORTACIÓN COMPLETADA');
        console.log('═══════════════════════════════════════');
        console.log(`📊 Filas en Excel:       ${resultado.total}`);
        console.log(`✔️  Registros insertados: ${resultado.insertados}`);
        console.log(`⏭️  Omitidos:             ${resultado.omitidos}`);

        if (resultado.errores.length > 0) {
            console.log(`\n⚠️ Errores (${resultado.errores.length}):`);
            resultado.errores.slice(0, 20).forEach(e => console.log(`   • ${e}`));
            if (resultado.errores.length > 20) {
                console.log(`   ... y ${resultado.errores.length - 20} más`);
            }
        }
        console.log('═══════════════════════════════════════');
        process.exit(0);
    });
};

if (require.main === module) {
    ejecutarImportacion();
}

module.exports = { importarEscuelasDesdeExcel };
