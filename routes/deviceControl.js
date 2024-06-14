// Importar módulos
const express = require('express');
const router = express.Router();    // Importar router para definir nuevas rutas dentro del servidor principal
const bonescript = require('bonescript');
const { startControl, stopControl, setSetpoint, setHysteresis,setKp, setKi, setKd } = require('../scripts/levelControl');
const pinReader = require('../scripts/pinReader');



// Pines a utilizar
const pumpOutput = "P9_12";
const solenoidValveOutput = "P9_15";
const servoValveOutput = "P9_16";

let clients = []; // Array para guardar los clientes SSE

let currentMode = 'manual'; // Modo inicial

bonescript.pinMode(pumpOutput, bonescript.OUTPUT);                  // Declarado como salida digital
bonescript.pinMode(solenoidValveOutput, bonescript.OUTPUT);         // Declarado como salida digital
bonescript.pinMode(servoValveOutput, bonescript.ANALOG_OUTPUT);     // Declarado como salida analógica

console.log('Pines configurados:');
console.log(`Pump: ${pumpOutput}, Solenoid: ${solenoidValveOutput}, Servo: ${servoValveOutput}`);

// Función para enviar eventos a todos los clientes
function sendEventToAllClients(data) {
    clients.forEach(client => client.res.write(`data: ${JSON.stringify(data)}\n\n`));
}

// Ruta SSE para las actualizaciones
router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Enviar inmediatamente los datos

    // Agregar el cliente a la lista
    clients.push({ id: Date.now(), res });

    // Eliminar el cliente cuando la conexión se cierra
    req.on('close', () => {
        clients = clients.filter(client => client.res !== res);
    });
});

// Ruta para configurar el modo
router.post('/set-mode', (req, res) => {
    const { mode } = req.body;
    console.log(`Cambiando a modo: ${mode}`);
    currentMode = mode;

    if (mode === 'manual') {
        stopControl(); // Detener el control ON/OFF o PID
        // Apagar la bomba y abrir la servoválvula en modo manual
        bonescript.digitalWrite(pumpOutput, bonescript.LOW);
        bonescript.digitalWrite(solenoidValveOutput, bonescript.LOW);
    } else if (mode === 'onoff' || mode === 'pid') {
        startControl(mode); // Iniciar el control basado en el modo seleccionado
    }
    res.json({ message: `Modo cambiado a ${mode}`, currentMode: mode });
});

// Ruta para actualizar el setpoint
router.post('/set-setpoint', (req, res) => {
    const { newSetpoint } = req.body;
    setSetpoint(newSetpoint);
    pinReader.setSetpoint(newSetpoint); // Actualizar el setpoint en pinReader.js
    res.json({ message: `Setpoint cambiado a ${newSetpoint}` });
});

// Ruta para actualizar la histéresis
router.post('/set-hysteresis', (req, res) => {
    const { newHysteresis } = req.body;
    setHysteresis(newHysteresis);
    res.json({ message: `Histéresis cambiado a ${newHysteresis}` });
});

// Ruta para actualizar Kp
router.post('/set-kp', (req, res) => {
    const { newKp } = req.body;
    console.log(`Recibido nuevo Kp: ${newKp}`);
    setKp(newKp);
    res.json({ message: `Kp cambiado a ${newKp}` });
});

// Ruta para actualizar Ki
router.post('/set-ki', (req, res) => {
    const { newKi } = req.body;
    console.log(`Recibido nuevo Ki: ${newKi}`);
    setKi(newKi);
    res.json({ message: `Ki cambiado a ${newKi}` });
});

// Ruta para actualizar Kd
router.post('/set-kd', (req, res) => {
    const { newKd } = req.body;
    console.log(`Recibido nuevo Kd: ${newKd}`);
    setKd(newKd);
    res.json({ message: `Kd cambiado a ${newKd}` });
});

// Ruta para obtener el modo actual
router.get('/current-mode', (req, res) => {
    res.json({ currentMode });
});

// Ruta para el botón de emergencia
router.post('/emergency-stop', (req, res) => {
    console.log('Emergencia activada: apagando la bomba, cerrando válvula de drenaje rápido y cambiando a modo manual...');
    stopControl(); // Detener el control ON/OFF o PID
    bonescript.digitalWrite(pumpOutput, bonescript.LOW);
    bonescript.digitalWrite(solenoidValveOutput, bonescript.LOW);
    currentMode = 'manual';
    res.json({ message: 'Modo de emergencia activado.' });
    pinReader.setPumpStatus(0); // Actualizar el estado de la bomba
    let message = 'Bomba apagada';
    sendEventToAllClients({ message });
    pinReader.setSolenoidStatus(0); // Actualizar el estado de la válvula solenoide
    message = 'Válvula solenoide apagada';
    sendEventToAllClients({ message });
});

// Ruta para controlar la bomba
router.post('/pump', (req, res) => {
    const { status } = req.body; // Espera un booleano: true para encender, false para apagar
    console.log(`Recibida solicitud para bomba: ${status}`);
    bonescript.digitalWrite(pumpOutput, status ? bonescript.HIGH : bonescript.LOW);
    pinReader.setPumpStatus(status ? 1 : 0); // Actualizar el estado de la bomba
    const message = `Bomba ${status ? 'encendida' : 'apagada'}`;
    sendEventToAllClients({ message });
    res.json({ message });
});

// Ruta para controlar la válvula solenoide
router.post('/solenoid', (req, res) => {
    const { status } = req.body; // Espera un booleano: true para abrir, false para cerrar
    console.log(`Recibida solicitud para válvula solenoide: ${status}`);
    bonescript.digitalWrite(solenoidValveOutput, status ? bonescript.HIGH : bonescript.LOW);
    pinReader.setSolenoidStatus(status ? 1 : 0); // Actualizar el estado de la válvula solenoide
    const message = `Válvula solenoide ${status ? 'encendida' : 'apagada'}`;
    sendEventToAllClients({ message });
    res.json({ message });
});

// Ruta para controlar la válvula servo
router.post('/servo', (req, res) => {
    let { status } = req.body; // Espera un valor entre 0 y 1
    console.log(`Recibida solicitud para válvula servo: ${status}`);
    
    // Asegurarse de que el valor esté entre 0.05 y 0.95
    let statusCorrected = Math.max(0.05, Math.min(status, 0.95));
    
    bonescript.analogWrite(servoValveOutput, statusCorrected);
    pinReader.setServoValveStatus(status); // Actualizar el valor del servo
    res.json({ message: `Válvula servo ajustada a ${status}` });
});

module.exports = router;
