const bonescript = require('bonescript');
const db = require('../database'); // Importar la base de datos desde el nuevo módulo

// Configuración de los pines
const waterLevelInput = "P9_36";

// Función para leer el valor del pin
function readWaterLevel() {
    bonescript.analogRead(waterLevelInput, (err, value) => {
        if (err) {
            console.error('Error leyendo el valor analógico:', err);
            return;
        }
        const waterLevel = value * 100; // Suponiendo que el valor es de 0 a 1
        
        if (isNaN(waterLevel) || waterLevel < 0 || waterLevel > 100) {
            console.error('Valor analógico inválido:', waterLevel);
            return;
        }
        
        saveWaterLevel(waterLevel);
    });
}

// Función para guardar el nivel de agua en la base de datos
function saveWaterLevel(level) {
    const timestamp = new Date().toISOString();
    const sql = 'INSERT INTO water_levels (level, timestamp) VALUES (?, ?)';
    const params = [level, timestamp];
    
    db.run(sql, params, function(err) {
        if (err) {
            console.error('Error al guardar el nivel de agua en la base de datos:', err);
            return;
        }
        console.log('Nivel de agua guardado:', { id: this.lastID, level, timestamp });
    });
}

// Leer el nivel de agua cada 2 segundos
setInterval(readWaterLevel, 2000);
