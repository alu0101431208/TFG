// Importar SQLite3 (verbose para mayor depuración)
const sqlite3 = require('sqlite3').verbose(); 

// Configurar la base de datos SQLite
const db = new sqlite3.Database('./waterLevelData.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos SQLite:', err);
    } else {
        console.log('Conexión exitosa con la base de datos SQLite.');
    }
});

// Crear tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS water_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level REAL,
    timestamp TEXT,
    pump INTEGER,
    solenoid INTEGER,
    servovalve REAL,
    setpoint REAL
)`, (err) => {
    if (err) {
        console.error('Error al crear la tabla water_levels:', err);
    } else {
        console.log('Tabla water_levels verificada o creada correctamente.');
    }
});

// Exportar la instancia de la base de datos
module.exports = db;
