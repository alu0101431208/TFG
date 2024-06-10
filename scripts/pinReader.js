const bonescript = require('bonescript');
const db = require('../database'); // Importar la base de datos desde el nuevo módulo

// Configuración de los pines
const waterLevelInput = "P9_36";

let currentWaterLevel = 0; // Variable global para almacenar el nivel de agua
let pumpStatus = 0; // Variable global para almacenar el estado de la bomba
let solenoidStatus = 0; // Variable global para almacenar el estado de la válvula solenoide
let servoValveStatus = 0; // Variable global para almacenar el estado de la válvula servo
let setpoint = 50; // Variable global para almacenar el setpoint

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
        
        currentWaterLevel = waterLevel; // Actualizar el nivel de agua
        saveWaterLevel(waterLevel, pumpStatus, solenoidStatus, servoValveStatus, setpoint);
    });
}

// Función para guardar el nivel de agua en la base de datos
function saveWaterLevel(level, pump, solenoid, servoValve, setpoint) {
    const timestamp = new Date().toISOString();
    const sql = 'INSERT INTO water_levels (level, timestamp, pump, solenoid, servovalve, setpoint) VALUES (?, ?, ?, ?, ?, ?)';
    const params = [level, timestamp, pump, solenoid, servoValve, setpoint];
    
    db.run(sql, params, function(err) {
        if (err) {
            console.error('Error al guardar el nivel de agua en la base de datos:', err);
            return;
        }
        console.log('Nivel de agua y estados guardados:', { id: this.lastID, level, timestamp, pump, solenoid, servoValve, setpoint });
    });
}

// Función para obtener el nivel de agua actual
function getCurrentWaterLevel() {
    return currentWaterLevel;
}

// Función para actualizar el estado de la bomba
function setPumpStatus(status) {
    pumpStatus = status;
    console.log('Estado de la bomba actualizado a:', status);
}

// Función para actualizar el estado de la válvula solenoide
function setSolenoidStatus(status) {
    solenoidStatus = status;
    console.log('Estado de la válvula solenoide actualizado a:', status);
}

// Función para actualizar el estado de la válvula servo
function setServoValveStatus(status) {
    servoValveStatus = status;
    console.log('Estado de la válvula servo actualizado a:', status);
}

// Función para actualizar el setpoint
function setSetpoint(newSetpoint) {
    setpoint = newSetpoint;
    console.log('Setpoint actualizado a:', newSetpoint);
}

// Leer el nivel de agua cada 2 segundos
setInterval(readWaterLevel, 2000);

module.exports = {
    getCurrentWaterLevel,
    setPumpStatus,
    setSolenoidStatus,
    setServoValveStatus,
    setSetpoint
};