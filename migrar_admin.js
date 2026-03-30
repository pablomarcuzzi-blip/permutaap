const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'permutapp.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Ejecutando migración de admin...\n');

db.serialize(() => {
    // 1. Verificar si la columna es_admin existe
    db.all("PRAGMA table_info(usuarios)", (err, columns) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        const hasEsAdmin = columns.some(col => col.name === 'es_admin');
        
        if (hasEsAdmin) {
            console.log('✅ La columna es_admin ya existe');
        } else {
            console.log('➕ Agregando columna es_admin...');
            db.run("ALTER TABLE usuarios ADD COLUMN es_admin INTEGER DEFAULT 0", (err) => {
                if (err) {
                    console.error('Error al agregar columna:', err);
                } else {
                    console.log('✅ Columna es_admin agregada');
                }
            });
        }
        
        // 2. Hacer admin a pablo.marcuzzi@bue.edu.ar
        console.log('\n👤 Configurando usuario admin...');
        db.run(
            "UPDATE usuarios SET es_admin = 1 WHERE email = ?",
            ['pablo.marcuzzi@bue.edu.ar'],
            function(err) {
                if (err) {
                    console.error('Error al actualizar usuario:', err);
                } else if (this.changes === 0) {
                    console.log('⚠️ Usuario pablo.marcuzzi@bue.edu.ar no encontrado');
                } else {
                    console.log('✅ Usuario pablo.marcuzzi@bue.edu.ar ahora es admin');
                }
                
                // 3. Verificar
                db.get(
                    "SELECT id, email, es_admin FROM usuarios WHERE email = ?",
                    ['pablo.marcuzzi@bue.edu.ar'],
                    (err, row) => {
                        if (err) {
                            console.error('Error al verificar:', err);
                        } else if (row) {
                            console.log('\n📋 Usuario actual:');
                            console.log(`   ID: ${row.id}`);
                            console.log(`   Email: ${row.email}`);
                            console.log(`   Es admin: ${row.es_admin === 1 ? 'SÍ' : 'NO'}`);
                        }
                        
                        console.log('\n🎉 Migración completada');
                        db.close();
                    }
                );
            }
        );
    });
});