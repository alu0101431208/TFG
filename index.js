const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const db = require('./database');
const cors = require('cors'); 

const app = express();
const port = 3001;

const corsOptions = {
    origin: '*', // Reemplaza con el origen que necesitas permitir
    methods: 'GET,POST', // Métodos HTTP permitidos
    allowedHeaders: 'Content-Type,Authorization' // Encabezados permitidos
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

console.log('Configurando rutas...');

// Rutas para controlar dispositivos
app.use('/api/device-control', require('./routes/deviceControl'));
console.log('Ruta /api/device-control configurada.');

// Rutas para manejo de datos
app.use('/api', require('./routes/data'));
console.log('Ruta /api configurada.');

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor ejecutándose en http://localhost:${port}`);
    
    // Ejecutar pinReader.js y capturar los logs
    const pinReader = exec('node scripts/pinReader.js');

    pinReader.stdout.on('data', (data) => {
        console.log(`pinReader.js stdout: ${data}`);
    });

    pinReader.stderr.on('data', (data) => {
        console.error(`pinReader.js stderr: ${data}`);
    });

    pinReader.on('close', (code) => {
        console.log(`pinReader.js exited with code ${code}`);
    });

    console.log('Servidor inicializado completamente.');
});

// Exportar la instancia de la base de datos
module.exports = db;

console.log('index.js completado.');