const express = require('express');
const router = express.Router();
const bonescript = require('bonescript');

// Configuración de los pines
const pumpOutput = "P9_12";
const solenoidValveOutput = "P9_15";
const servoValveOutput = "P9_16";

bonescript.pinMode(pumpOutput, bonescript.OUTPUT);
bonescript.pinMode(solenoidValveOutput, bonescript.OUTPUT);
bonescript.pinMode(servoValveOutput, bonescript.ANALOG_OUTPUT);

console.log('Pines configurados:');
console.log(`Pump: ${pumpOutput}, Solenoid: ${solenoidValveOutput}, Servo: ${servoValveOutput}`);

// Ruta para controlar la bomba
router.post('/pump', (req, res) => {
    const { status } = req.body; // Espera un booleano: true para encender, false para apagar
    const isPumpOn = status; // Asigna el estado a isPumpOn
    console.log(`Recibida solicitud para bomba: ${status}`);
    bonescript.digitalWrite(pumpOutput, isPumpOn ? bonescript.HIGH : bonescript.LOW);
    res.json({ message: `Bomba ${status ? 'encendida' : 'apagada'}` });
});

// Ruta para controlar la válvula solenoide
router.post('/solenoid', (req, res) => {
    const { status } = req.body; // Espera un booleano: true para abrir, false para cerrar
    const isSolenoidOpen = status; // Asigna el estado a isSolenoidOpen
    console.log(`Recibida solicitud para drenaje rápido: ${status}`);
    bonescript.digitalWrite(solenoidValveOutput, isSolenoidOpen ? bonescript.HIGH : bonescript.LOW);
    res.json({ message: `Válvula solenoide ${status ? 'abierta' : 'cerrada'}` });
});

// Ruta para controlar la válvula servo
router.post('/servo', (req, res) => {
    const { value } = req.body; // Espera un valor entre 0 y 1
    console.log(`Recibida solicitud para válvula servo: ${value}`);
    bonescript.analogWrite(servoValveOutput, value);
    res.json({ message: `Válvula servo ajustada a ${value}` });
});

module.exports = router;
