console.log('Comienza script página');

let setpoint = 50;
let servoValue = null;

document.addEventListener('DOMContentLoaded', function() {
    // Cargar el SVG
    fetch('img/tanqueAgua.svg')
        .then(response => response.text())
        .then(svgText => {
            document.getElementById('svgContainer').innerHTML = svgText;
        });
    
    // Abrir conexión con backend
    const eventSource = new EventSource('/api/device-control/events');

    eventSource.onopen = function() {
        console.log('Conexión establecida con el servidor SSE.');
    };

    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleServerMessage(data.message);
    };

    eventSource.onerror = function(event) {
        console.error('Error en la conexión con el servidor SSE.', event);
    };
    
    
    initializeChart();  // Inicializa el gráfico al cargar la página
    initializeHistoricalChart();  // Inicializa el gráfico histórico al cargar la página
    setInterval(fetchLatestWaterLevel, 2000); // Actualiza cada 2 segundos
    
    getCurrentMode();
});

// Solicita el modo actual del backend y actualiza la UI
async function getCurrentMode() {
    try {
        const response = await fetch('/api/device-control/current-mode');
        const data = await response.json();
        updateUI(data.currentMode);
    } catch (error) {
        console.error('Error fetching current mode:', error);
    }
}

// Actualiza la UI basada en el modo actual
function updateUI(mode) {
    const modeSelect = document.getElementById('modeSelect');
    modeSelect.value = mode;

    const controlsContainer = document.getElementById('controlsContainer');
    controlsContainer.innerHTML = '';

    if (mode === 'manual') {
        controlsContainer.innerHTML = `
            <div class="manual-controls">
                <div>Bomba: <input type="checkbox" class="toggle" id="pumpToggle"></div>
                <div>SV2 (Drenaje rápido): <input type="checkbox" class="toggle" id="drainToggle"></div>
                <div class="slider-container">
                    <label for="servoSlider">Servoválvula:</label>
                    <br>
                    <input type="range" id="servoSlider" min="0" max="100" value="50">
                </div>
            </div>
        `;

        // Event listeners para los controles en modo manual
        document.getElementById('pumpToggle').addEventListener('change', function() {
            controlDevice('/api/device-control/pump', this.checked);
        });

        document.getElementById('drainToggle').addEventListener('change', function() {
            controlDevice('/api/device-control/solenoid', this.checked);
        });

        document.getElementById('servoSlider').addEventListener('input', function() {
            const value = this.value / 100;
            console.log(`Ajuste de servoSlider: ${value}`);
            servoValue = value; // Actualiza la variable global con el nuevo valor del servo
        });
    } else if (mode === 'onoff') {
        controlsContainer.innerHTML = `
            <div class="onoff-controls">
                <div class="level activeLevel">Activo: <span id="activeLevel">50%</span></div>
                <button onclick="swapLevels()">&#x2194;</button>
                <div class="level standbyLevel">Standby: <input type="number" id="standbyLevel" value="50" min="0" max="100"/>%</div>
                <div class="level hysteresisLevel">Histeresis: <input type="number" id="hysteresisLevel" value="5" min="1" max="10"/>%</div>
                <div class="slider-container">
                    <label for="servoSlider">Servoválvula:</label>
                    <br>
                    <input type="range" id="servoSlider" min="0" max="100" value="50">
                </div>
                <button onclick="emergencyStop()">Emergencia</button>
            </div>
        `;
        document.getElementById('servoSlider').addEventListener('input', function() {
            const value = this.value / 100;
            console.log(`Ajuste de servoSlider: ${value}`);
            servoValue = value; // Actualiza la variable global con el nuevo valor del servo
        });

        // event listeners para los controles en modo onoff
        document.getElementById('standbyLevel').addEventListener('input', function() {
            let input = this;
            let value = parseInt(input.value, 10);

            // Comprobar si el valor está fuera del rango permitido
            if (value < 0 || value > 100) {
                // Corregir el valor al mínimo o máximo
                input.value = value < 0 ? 0 : 100;
                alert('El valor debe estar entre 0 y 100.');
            }
        });
        
        document.getElementById('hysteresisLevel').addEventListener('input', function() {
            let input = this;
            let value = parseInt(input.value, 10);

            if (value < 1 || value > 10) {
                input.value = value < 1 ? 1 : 10;
                alert('El valor debe estar entre 1 y 10.');
            } else {
                updateHysteresis(value);
            }
        });
    } else if (mode === 'pid') {
        controlsContainer.innerHTML = `
            <div class="manual-controls">
                <div class="level activeLevel">Activo: <span id="activeLevel">50%</span></div>
                <button onclick="swapLevels()">&#x2194;</button>
                <div class="level standbyLevel">Standby: <input type="number" id="standbyLevel" value="50" min="0" max="100"/>%</div>
                <div>Bomba: <input type="checkbox" class="toggle" id="pumpToggle"></div>
                <div>SV2 (Drenaje rápido): <input type="checkbox" class="toggle" id="drainToggle"></div>
                <p>Control PID activo.</p>
                <button onclick="emergencyStop()">Emergencia</button>
            </div>
            <div>
                <label for="kpInput">Kp:</label>
                <input type="number" id="kpInput" value="25" step="0.01"><br><br>
                <label for="kiInput">Ki:</label>
                <input type="number" id="kiInput" value="0.15" step="0.01"><br><br>
                <label for="kdInput">Kd:</label>
                <input type="number" id="kdInput" value="0.01" step="0.01">
            </div>
        `;
        
        document.getElementById('standbyLevel').addEventListener('input', function() {
            let input = this;
            let value = parseInt(input.value, 10);

            if (value < 0 || value > 100) {
                input.value = value < 0 ? 0 : 100;
                alert('El valor debe estar entre 0 y 100.');
            }
        });
        
        // event listeners para los controles en modo PID
        document.getElementById('pumpToggle').addEventListener('change', function() {
            controlDevice('/api/device-control/pump', this.checked);
        });

        document.getElementById('drainToggle').addEventListener('change', function() {
            controlDevice('/api/device-control/solenoid', this.checked);
        });
        
        document.getElementById('kpInput').addEventListener('change', function() {
        updatePIDParameter('/api/device-control/set-kp', this.value);
        });

        document.getElementById('kiInput').addEventListener('change', function() {
        updatePIDParameter('/api/device-control/set-ki', this.value);
        });

        document.getElementById('kdInput').addEventListener('change', function() {
        updatePIDParameter('/api/device-control/set-kd', this.value);
        });
    }
}
// Actualizar los parámetros PID
async function updatePIDParameter(url, value) {
    try {
        const convertedValue = parseFloat(value.replace(',', '.'));
        console.log(`Se ha enviado ${convertedValue} a ${url}`);
        const bodyContent = {};

        // Determinar qué parámetro se está actualizando basado en la URL
        if (url.includes('set-kp')) {
            bodyContent.newKp = convertedValue;
        } else if (url.includes('set-ki')) {
            bodyContent.newKi = convertedValue;
        } else if (url.includes('set-kd')) {
            bodyContent.newKd = convertedValue;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyContent)
        });
        const data = await response.json();
        console.log(data.message);
    } catch (error) {
        console.error(`Error updating PID parameter: ${error}`);
    }
}

async function updateMode() {
    const mode = document.getElementById('modeSelect').value;

    // Enviar la actualización del modo al backend
    try {
        const response = await fetch('/api/device-control/set-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });
        const data = await response.json();
        updateUI(data.currentMode); // Actualiza la UI con el modo actual devuelto por el backend
    } catch (error) {
        console.error('Error updating mode:', error);
    }
}

async function emergencyStop() {
    await fetch('/api/device-control/emergency-stop', { method: 'POST' });
    document.getElementById('modeSelect').value = 'manual';
    updateMode();
}

// Función para actualizar la histéresis
async function updateHysteresis(value) {
    try {
        const response = await fetch('/api/device-control/set-hysteresis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newHysteresis: value })
        });
        const data = await response.json();
        console.log(data.message);
    } catch (error) {
        console.error('Error updating hysteresis:', error);
    }
}

function swapLevels() {
    let activeLevel = document.getElementById('activeLevel');
    let standbyInput = document.getElementById('standbyLevel');

    // Guardar el nivel actual activo
    let currentActive = activeLevel.textContent.replace('%', '');

    // Establecer el nivel activo al valor standby
    activeLevel.textContent = standbyInput.value + '%';

    // Establecer el nivel standby al antiguo activo
    standbyInput.value = currentActive;
    updateSetpoint();
}

function updateSetpoint() {
    setpoint = parseFloat(document.getElementById('activeLevel').textContent);
    console.log('Setpoint actualizado: ', setpoint);
    // Enviar el nuevo setpoint al backend
    sendSetpointToServer(setpoint);
}

// Función para cambiar el setpoint (consigna) al hacer swaplevels
async function sendSetpointToServer(newSetpoint) {
    try {
        const response = await fetch('/api/device-control/set-setpoint', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newSetpoint })
        });
        const data = await response.json();
        console.log(data.message);
    } catch (error) {
        console.error('Error swapping levels:', error);
    }
}

// Función para enviar solicitudes de control al backend
async function controlDevice(url, status) {
    try {
        const response = await fetch(`http://192.168.7.2:3001${url}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status })
        });
        const result = await response.json();
        console.log(result.message);
    } catch (error) {
        console.error('Error controlling device:', error);
    }
}

// interpretar el mensaje que recibe del server
function handleServerMessage(message) {
    if (message.includes('Bomba encendida')) {
        colorWaterPump('green');
    } else if (message.includes('Bomba apagada')) {
        colorWaterPump('black');
    } else if (message.includes('Válvula solenoide encendida')) {
        colorSolenoidValve('green');
    } else if (message.includes('Válvula solenoide apagada')) {
        colorSolenoidValve('black');
    }
}

// colorear SVGs
function colorWaterPump(color) {
    let circleStroke = document.getElementById('svgContainer').querySelector('#waterPump .cls-2');
    let triangle = document.getElementById('svgContainer').querySelector('#waterPump .cls-5');
    gsap.to(circleStroke, { stroke: color, duration: 0.3 });
    gsap.to(triangle, { stroke: color, fill: color, duration: 0.3 });
}

function colorSolenoidValve(color) {
    let solenoidValveElements = document.getElementById('svgContainer').querySelectorAll('#solenoidValve .cls-2');
    gsap.to(solenoidValveElements, { stroke: color, duration: 0.3 });
}

function showSelectedSection(sectionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(function(section) {
        section.style.display = 'none';
    });

    // Mostrar sólo la sección correspondiente
    const section = document.getElementById(sectionId);
    section.style.display = 'block';

    // Asegurar que el canvas no se elimine, solo cambiar su visibilidad
    if (sectionId === 'scada') {
        if (!window.waterLevelChart) {
            //initializeChart();
        } else {
            // Asegurarse de que el canvas esté visible y actualizar el gráfico si es necesario
            document.getElementById('waterLevelChart').style.display = 'block';
            window.waterLevelChart.update();
        }
    } else {
        // Opcional: Puedes ocultar el canvas si quieres que deje de consumir recursos cuando no está visible
        document.getElementById('waterLevelChart').style.display = 'none';
    }
}

async function fetchLatestWaterLevel() {
    try {
        const response = await fetch('http://192.168.7.2:3001/api/water-level/latest', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log(data);

        const level = data.level;
        const pumpStatus = data.pump;
        const solenoidStatus = data.solenoid;
        const servoValveStatus = data.servovalve;
        const setpoint = data.setpoint;
        
        updateChart(level, setpoint, pumpStatus, solenoidStatus, servoValveStatus);
        updateUpperTank(level);
        
        // Formatear el nivel de agua a dos decimales y añadir el símbolo de porcentaje
        const formattedLevel = `${level.toFixed(2)}%`;

        // Actualizar el contenido del elemento span con el nivel de agua formateado
        document.getElementById('currentLevel').textContent = formattedLevel;
        
        // Verificar si hay un valor de servo pendiente y enviar la solicitud
        if (servoValue !== null) {
            await controlDevice('/api/device-control/servo', servoValue);
            servoValue = null; // Restablecer la variable después de enviar la solicitud
        }
        
    } catch (error) {
        console.error('Error fetching water level:', error);
    }
}

function updateUpperTank(value) {
    let waterLevel = document.getElementById('svgContainer').querySelector('#upperTank #waterLevel');
    let maxHeight = 87; // Altura máxima del tanque
    let minHeight = 35.91; // Altura mínima del tanque
    let newY = minHeight + (maxHeight - minHeight) * (1 - value / 100);
    let points = `132.35 ${newY} 14.15 ${newY} 14.15 ${maxHeight} 132.65 ${maxHeight} 132.65 ${newY}`;
    gsap.to(waterLevel, { attr: { points: points }, duration: 1 });
}

function initializeChart() {

    Chart.defaults.font.family = 'Montserrat'; // Establece la fuente global para todos los gráficos
    Chart.defaults.font.size = 16; // Establece el tamaño de la fuente global
    Chart.defaults.font.style = 'normal'; // Establece el estilo de la fuente global
    Chart.defaults.color = '#000000'; // Color global del texto en los gráficos

    // Verificar si el gráfico ya existe y si es así, destruirlo
    if (window.waterLevelChart instanceof Chart) {
        window.waterLevelChart.destroy();
        window.waterLevelChart = null;
    }

    let context = document.getElementById('waterLevelChart').getContext('2d');
    window.waterLevelChart = new Chart(context, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Nivel',
                    data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0, // Eliminar los puntos
                    pointHoverRadius: 0, // Eliminar los puntos al pasar el mouse
                    pointHitRadius: 0 // Eliminar el radio de los puntos al hacer clic
                },
                {
                    label: 'Consigna',
                    data: [],
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0 // Eliminar los puntos
                },
                {
                    label: 'Bomba',
                    data: [],
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0 // Eliminar los puntos
                },
                {
                    label: 'SV2',
                    data: [],
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0 // Eliminar los puntos
                },
                {
                    label: 'Servoválvula',
                    data: [],
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0 // Eliminar los puntos
                }
            ]
        },
        options: {
            scales: {
                x: {
                    type: 'realtime',  // Indica el tipo de eje
                    realtime: {
                        duration: 70000,
                        delay: 2000,
                        onRefresh: function(chart) {},
                        parser: 'timestamp',  // Asegura que los tiempos sean interpretados correctamente
                        time: {
                            tooltipFormat: 'HH:mm:ss',
                            displayFormats: {
                                millisecond: 'HH:mm:ss.SSS',
                                second: 'HH:mm:ss',
                                minute: 'HH:mm',
                                hour: 'HH:mm'
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Fecha y Hora'
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Datos varios (%)'
                    }
                }
            },
            plugins: {
                streaming: {
                    frameRate: 60
                }
            }
        }
    });
}

function updateChart(waterLevel, setpoint, pump, solenoid, servo) {
    if (window.waterLevelChart) {
        window.waterLevelChart.data.datasets[0].data.push({
            x: Date.now(),
            y: waterLevel
        });
        window.waterLevelChart.data.datasets[1].data.push({
            x: Date.now(),
            y: setpoint
        });
        window.waterLevelChart.data.datasets[2].data.push({
            x: Date.now(),
            y: pump * 100  
        });
        window.waterLevelChart.data.datasets[3].data.push({
            x: Date.now(),
            y: solenoid * 100  
        });
        window.waterLevelChart.data.datasets[4].data.push({
            x: Date.now(),
            y: servo * 100  
        });
        window.waterLevelChart.update();
    }
}

// Inicializa el gráfico histórico
function initializeHistoricalChart() {
    let context = document.getElementById('historicalChart').getContext('2d');
    window.historicalChart = new Chart(context, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Nivel',
                    data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Consigna',
                    data: [],
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Bomba',
                    data: [],
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'SV2',
                    data: [],
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Servoválvula',
                    data: [],
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute'
                    },
                    title: {
                        display: true,
                        text: 'Fecha y Hora'
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Datos Varios (%)'
                    }
                }
            }
        }
    });
}

// Función para actualizar el gráfico histórico
async function updateHistoricalChart() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (!startDateInput.value || !endDateInput.value) {
        alert('Por favor, selecciona ambas fechas.');
        return;
    }

    const startDateLocal = new Date(startDateInput.value);
    const endDateLocal = new Date(endDateInput.value);
    
    // Convertir a formato ISO con milisegundos (Zulu time)
    const startDate = startDateLocal.toISOString();
    const endDate = endDateLocal.toISOString();

    try {
        const response = await fetch(`http://192.168.7.2:3001/api/download-data?startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();

        // Imprimir los primeros y últimos 5 valores en la consola
        if (data.length > 0) {
            console.log('Primeros 5 valores:', data.slice(0, 5));
            console.log('Últimos 5 valores:', data.slice(-5));
        } else {
            console.log('No se encontraron datos en el rango de fechas seleccionado.');
        }

        // Asegurarse de que los datos tienen todas las propiedades necesarias
        data.forEach(record => {
            console.log(`Registro: ${JSON.stringify(record)}`);
        });

        // Actualizar el gráfico con los datos
        updateChartWithData(data);
    } catch (error) {
        console.error('Error fetching historical data:', error);
    }
}

// Función para actualizar el gráfico con los datos recibidos
function updateChartWithData(data) {
    const ctx = document.getElementById('historicalChart').getContext('2d');
    if (window.historicalChart) {
        window.historicalChart.destroy();
    }

    const labels = data.map(record => new Date(record.timestamp));
    const levels = data.map(record => record.level);
    const setpoints = data.map(record => record.setpoint);
    const pumps = data.map(record => record.pump * 100); // Convertir a porcentaje
    const solenoids = data.map(record => record.solenoid * 100); // Convertir a porcentaje
    const servos = data.map(record => record.servovalve * 100); // Convertir a porcentaje

    window.historicalChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Nivel del Tanque Histórico',
                    data: levels,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Consigna',
                    data: setpoints,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Bomba',
                    data: pumps,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'SV2',
                    data: solenoids,
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Servoválvula',
                    data: servos,
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute'
                    },
                    title: {
                        display: true,
                        text: 'Fecha y Hora'
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Nivel (%)'
                    }
                }
            }
        }
    });
}


// Función para descargar datos como CSV
async function downloadCSV() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (!startDateInput.value || !endDateInput.value) {
        alert('Por favor, selecciona ambas fechas.');
        return;
    }

    const startDateLocal = new Date(startDateInput.value);
    const endDateLocal = new Date(endDateInput.value);
    
    const startDate = startDateLocal.toISOString();
    const endDate = endDateLocal.toISOString();

    const url = `http://192.168.7.2:3001/api/download-csv?startDate=${startDate}&endDate=${endDate}`;
    window.open(url, '_blank');
}



// al cambiar resolución que se actualice el tamaño
window.addEventListener('resize', function() {
    if (window.waterLevelChart) {
        window.waterLevelChart.resize();
    }
});