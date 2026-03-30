const { db } = require('./database');
const bcrypt = require('bcryptjs');

const email = 'pablo@bue.edu.ar';
const password = 'solo2715';
const nombre = 'pablo.admin';
const dni = '12345678';

bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
        console.error('Error hasheando password:', err);
        process.exit(1);
    }

    db.run(
        `INSERT INTO usuarios (email, password, nombre, dni, es_admin, email_verificado) VALUES (?, ?, ?, ?, 1, 1)`,
        [email, hash, nombre, dni],
        function(err) {
            if (err) {
                console.error('Error creando admin:', err.message);
                process.exit(1);
            }
            console.log('✅ Admin creado:', email);
            process.exit(0);
        }
    );
});
