const {db} = require('./database');
db.all("SELECT DISTINCT tipo_original FROM escuelas WHERE tipo_original LIKE '%Normal%'", (err, rows) => {
    if(err) console.error(err);
    else console.table(rows);
});