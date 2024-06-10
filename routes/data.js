const express = require('express');
const router = express.Router();
const db = require('../database'); // Importar la base de datos desde el archivo principal
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Ruta para obtener el nivel de agua más reciente junto con todos los datos adicionales
router.get('/water-level/latest', (req, res) => {
    db.get("SELECT level, timestamp, pump, solenoid, servovalve, setpoint FROM water_levels ORDER BY id DESC LIMIT 1", [], (err, row) => {
        if (err) {
            console.error('Error al obtener el nivel de agua más reciente:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log('Datos más recientes:', row);
        res.json(row);
    });
});


// Ruta para obtener los datos históricos según las fechas seleccionadas
router.get('/download-data', (req, res) => {
    const { startDate, endDate } = req.query;

    // Log para depuración
    console.log(`Se recibió una solicitud para datos históricos con startDate: ${startDate} y endDate: ${endDate}`);

    // Verificar formato de las fechas
    const isoFormatRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    if (!isoFormatRegex.test(startDate) || !isoFormatRegex.test(endDate)) {
        console.warn(`Formato de fecha incorrecto. Se esperaba el formato YYYY-MM-DDTHH:mm:ss.sssZ y se obtuvo startDate: ${startDate}, endDate: ${endDate}`);
        res.status(400).json({ error: 'Formato de fecha incorrecto. Se espera el formato YYYY-MM-DDTHH:mm:ss.sssZ' });
        return;
    }

    // Verificar que las fechas están correctamente formateadas
    console.log(`startDate (verificado): ${startDate}, endDate (verificado): ${endDate}`);

    // Obtener todos los registros entre startDate y endDate
    const sql = `SELECT id, level, timestamp, pump, solenoid, servovalve, setpoint FROM water_levels WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp`;
    db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) {
            console.error('Error al obtener los datos históricos:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (rows.length > 0) {
            const firstRecord = rows[0];
            const lastRecord = rows[rows.length - 1];
            console.log(`Se ha solicitado desde la fecha ${startDate}, correspondiente al elemento con id ${firstRecord.id}, hasta la fecha ${endDate}, correspondiente al elemento con id ${lastRecord.id} de la base de datos.`);
            console.log(`Se han obtenido ${rows.length} registros en total.`);
            console.log('Datos históricos:', rows);
        } else {
            console.log('No se encontraron datos en el rango de fechas seleccionado.');
        }
        
        res.json(rows);
    });
});

// Nueva ruta para descargar datos como CSV
router.get('/download-csv', (req, res) => {
    const { startDate, endDate } = req.query;

    console.log(`Se recibió una solicitud para datos históricos en CSV con startDate: ${startDate} y endDate: ${endDate}`);

    const isoFormatRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    if (!isoFormatRegex.test(startDate) || !isoFormatRegex.test(endDate)) {
        console.warn(`Formato de fecha incorrecto. Se esperaba el formato YYYY-MM-DDTHH:mm:ss.sssZ y se obtuvo startDate: ${startDate}, endDate: ${endDate}`);
        res.status(400).json({ error: 'Formato de fecha incorrecto. Se espera el formato YYYY-MM-DDTHH:mm:ss.sssZ' });
        return;
    }

    console.log(`startDate (verificado): ${startDate}, endDate (verificado): ${endDate}`);

    const sql = `SELECT id, level, timestamp, pump, solenoid, servovalve, setpoint FROM water_levels WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp`;
    db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) {
            console.error('Error al obtener los datos históricos:', err);
            res.status(500).json({ error: err.message });
            return;
        }

        if (rows.length > 0) {
            // Formatear los valores de level para asegurarse de que se incluyan las comas
            const formattedRows = rows.map(row => ({
                id: row.id,
                level: row.level.toFixed(5).replace('.', ','), // Convertir a cadena de texto con cinco decimales
                timestamp: row.timestamp,
                pump: row.pump,
                solenoid: row.solenoid,
                servovalve: row.servovalve,
                setpoint: row.setpoint
            }));

            const csvWriter = createCsvWriter({
                path: 'water_levels.csv',
                header: [
                    { id: 'id', title: 'ID' },
                    { id: 'level', title: 'Level' },
                    { id: 'timestamp', title: 'Timestamp' },
                    { id: 'pump', title: 'Pump' },
                    { id: 'solenoid', title: 'Solenoid' },
                    { id: 'servovalve', title: 'ServoValve' },
                    { id: 'setpoint', title: 'Setpoint' }
                ],
                fieldDelimiter: ';' // Usar punto y coma como delimitador
            });

            csvWriter.writeRecords(formattedRows)
                .then(() => {
                    console.log('Archivo CSV creado con éxito.');

                    res.download('water_levels.csv', 'water_levels.csv', (err) => {
                        if (err) {
                            console.error('Error al enviar el archivo CSV:', err);
                            res.status(500).json({ error: 'Error al enviar el archivo CSV' });
                        }
                    });
                })
                .catch((error) => {
                    console.error('Error al escribir el archivo CSV:', error);
                    res.status(500).json({ error: 'Error al escribir el archivo CSV' });
                });
        } else {
            console.log('No se encontraron datos en el rango de fechas seleccionado.');
            res.status(404).json({ error: 'No se encontraron datos en el rango de fechas seleccionado.' });
        }
    });
});

module.exports = router;