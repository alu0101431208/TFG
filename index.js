// Importación de módulos
const express = require('express');     
const path = require('path');           
const db = require('./database');       // database.js
const cors = require('cors'); 

// Iniciar express y definir el puerto de salida
const app = express();                  
const port = 3001;

// Configurar CORS
const corsOptions = {
    origin: '*', 
    methods: 'GET,POST', // Métodos HTTP permitidos
    allowedHeaders: 'Content-Type,Authorization' // Encabezados permitidos
};
app.use(cors(corsOptions));

// Parsear las requests y responses en formato .json
app.use(express.json());

// Configurar directorio public como frontend      
app.use(express.static(path.join(__dirname, 'public')));    

console.log('Configurando rutas...');

// Rutas para controlar dispositivos (servoválvula, bomba, etc.)
app.use('/api/device-control', require('./routes/deviceControl'));
console.log('Ruta /api/device-control configurada.');

// Rutas para solicitud de los datos
app.use('/api', require('./routes/data'));
console.log('Ruta /api configurada.');

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor ejecutándose en http://localhost:${port}`);
});

console.log('index.js completado.');