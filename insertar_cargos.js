const { db, initDatabase } = require('./database');

initDatabase();

setTimeout(() => {
    const cargos = [
        'Maestr/a Inicial', 'Maestr/a Maternal', 'Maestr/a de Primaria', 'Maestr/a CENP/EPA',
        'Prosecretario', 'Rector / Director', 'Secretario', 'Vicerrector / Vicedirector',
        'Jefe de Preceptores', 'Preceptor', 'Subjefe de Preceptores', 'Bibliotecario',
        'Profesor/a de Análisis Matemático', 'Profesor/a de Matemática', 'Profesor/a de Matemática Aplicada',
        'Profesor/a de Biología', 'Profesor/a de Ciencias Naturales', 'Profesor/a de Educación Ambiental', 'Profesor/a de Física', 'Profesor/a de Química',
        'Profesor/a de Antropología', 'Profesor/a de Ciencia Política', 'Profesor/a de Ciencias Sociales', 'Profesor/a de Construcción de Ciudadanía', 'Profesor/a de Formación Ética y Ciudadana', 'Profesor/a de Geografía', 'Profesor/a de Historia', 'Profesor/a de Sociología',
        'Profesor/a de Comunicación', 'Profesor/a de Lengua y Literatura', 'Profesor/a de Literatura', 'Profesor/a de Prácticas del Lenguaje', 'Profesor/a de Taller de Escritura',
        'Profesor/a de Alemán', 'Profesor/a de Francés', 'Profesor/a de Inglés', 'Profesor/a de Italiano', 'Profesor/a de Portugués',
        'Profesor/a de Computación', 'Profesor/a de Educación Tecnológica', 'Profesor/a de Informática', 'Profesor/a de Programación', 'Profesor/a de Robótica', 'Profesor/a de TIC',
        'Profesor/a de Administración', 'Profesor/a de Contabilidad', 'Profesor/a de Derecho', 'Profesor/a de Economía', 'Profesor/a de Marketing', 'Profesor/a de Sistemas Administrativos',
        'Profesor/a de Filosofía', 'Profesor/a de Psicología', 'Profesor/a de Educación Física',
        'Profesor/a de Artes Visuales', 'Profesor/a de Danza', 'Profesor/a de Folklore', 'Profesor/a de Historia del Arte', 'Profesor/a de Música', 'Profesor/a de Plástica', 'Profesor/a de Producción Artística', 'Profesor/a de Teatro',
        'Profesor/a de Automotores', 'Profesor/a de Construcciones', 'Profesor/a de Dibujo Técnico', 'Profesor/a de Electricidad', 'Profesor/a de Electrónica', 'Profesor/a de Maestro Mayor de Obras', 'Profesor/a de Mecánica', 'Profesor/a de Procesos Productivos', 'Profesor/a de Química Industrial', 'Profesor/a de Tecnología de los Materiales',
        'ACP de Biología', 'ACP de Física', 'ACP de Informática', 'ACP de Química', 'ACP de Taller', 'Ayudante de Laboratorio', 'Jefe de Laboratorio'
    ];

    const stmt = db.prepare(
        "INSERT OR IGNORE INTO cargos_propuestos (nombre, tipo_escuela_descripcion, propuesto_por, estado, fecha_resolucion) VALUES (?, null, 1, 'aprobado', CURRENT_TIMESTAMP)"
    );
    cargos.forEach(n => stmt.run(n));
    stmt.finalize(() => {
        console.log('✅ Cargos insertados correctamente');
        process.exit();
    });
}, 1000);
