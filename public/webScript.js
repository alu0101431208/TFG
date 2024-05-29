console.log('Comienza script página');

//Variables globales
let setpoint = 50;

document.addEventListener('DOMContentLoaded', function() {
    
    initializeChart();  // Inicializa el gráfico al cargar la página
    initializeHistoricalChart();  // Inicializa el gráfico histórico al cargar la página
    
    const pumpToggle = document.getElementById('pumpToggle');
    if (pumpToggle) {
        pumpToggle.addEventListener('change', function() {
            controlDevice('/api/device-control/pump', this.checked);
        });
    }

    const drainToggle = document.getElementById('drainToggle');
    if (drainToggle) {
        drainToggle.addEventListener('change', function() {
            controlDevice('/api/device-control/solenoid', this.checked);
        });
    }
    
    const standbyLevel = document.getElementById('standbyLevel');
    if (standbyLevel) {
        standbyLevel.addEventListener('input', function() {
            let input = this;
            let value = parseInt(input.value, 10);
            if (value < 0 || value > 100) {
                input.value = value < 0 ? 0 : 100;
                alert('El valor debe estar entre 0 y 100.');
            }
        });
    }

    updateSetpoint(); // Inicializa el setpoint al cargar la página
    
    setInterval(fetchLatestWaterLevel, 2000); // Actualiza cada 2 segundos
});

function updateSetpoint() {
    setpoint = parseFloat(document.getElementById('activeLevel').textContent);
    console.log('Setpoint actualizado: ', setpoint);
    // Enviar el nuevo setpoint al backend
    sendSetpointToServer(setpoint);
}

function sendSetpointToServer(setpoint) {
    fetch('http://localhost:3001/api/control/setpoint', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ setpoint: setpoint })
    })
    .then(response => response.json())
    .then(data => console.log('Setpoint updated on server:', data))
    .catch(error => console.error('Error:', error));
}

function togglePump() {
    const isPumpOn = document.getElementById('pumpToggle').checked;
    controlDevice('/api/device-control/pump', isPumpOn);
}

function toggleDrain() {
    const isDrainOn = document.getElementById('drainToggle').checked;
    controlDevice('/api/device-control/solenoid', isDrainOn);
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
            initializeChart();
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


function swapLevels(){
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
            datasets:
            [                
                {
                    label: 'Nivel del Tanque',
                    data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    fill: false
                },
                {
                    label: 'Consigna',
                    data: [],
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    fill: false,
                    borderDash: [10, 5]  // Línea punteada
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
                        onRefresh: function(chart) {
                        },
                        parser: 'timestamp',  // Asegura que los tiempos sean interpretados correctamente
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                streaming: {
                    frameRate: 60
                }
            },
        }
    });
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
        // Aquí actualiza tu UI con los datos recibidos
        const level = data.level
        updateChart(level);
    } catch (error) {
        console.error('Error fetching water level:', error);
    }
}

function updateChart(waterLevel) {
    if (window.waterLevelChart) {
        window.waterLevelChart.data.datasets[0].data.push({
            x: Date.now(),
            y: waterLevel
        });
        window.waterLevelChart.data.datasets[1].data.push({
            x: Date.now(),
            y: setpoint
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
            datasets: [{
                label: 'Nivel del Tanque Histórico',
                data: [],
                backgroundColor: 'rgba(92, 6, 140, 0.2)',
                borderColor: 'rgba(92, 6, 140, 1)',
                borderWidth: 1,
                fill: false
            }]
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

        updateChartWithData(data);
    } catch (error) {
        console.error('Error fetching historical data:', error);
    }
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

// Función para actualizar el gráfico con los datos recibidos
function updateChartWithData(data) {
    const ctx = document.getElementById('historicalChart').getContext('2d');
    if (window.historicalChart) {
        window.historicalChart.destroy();
    }

    const labels = data.map(record => new Date(record.timestamp));
    const levels = data.map(record => record.level);

    window.historicalChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Water Level',
                data: levels,
                borderColor: 'rgba(92, 6, 140, 1)',
                borderWidth: 1,
                fill: false
            }]
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
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Level'
                    }
                }
            }
        }
    });
}

window.addEventListener('resize', function() {
    if (window.waterLevelChart) {
        window.waterLevelChart.resize();
    }
});