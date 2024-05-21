console.log('Comienza script página');
setTargetAddress(location.host,  {
  initialized: run
});

let b = undefined;
const pumpOutput = "P9_12";
const solenoidValveOutput = "P9_15";
const servoValveOutput = "P9_14";
const waterLevelInput = "P9_36";

function run() {
    // Obtiene el elemento HTML con el id 'mensaje'.
    let label = document.getElementById('mensaje');
  
    // Comprueba si 'require' está definido.
    if (!require) {
      // Si 'require' no está definido, actualiza el texto del elemento 'mensaje' y usa 'myrequire' para cargar 'bonescript'.
      label.textContent = "NO hay require :-("
      b = myrequire('bonescript');
    } else {
      // Si 'require' está definido, actualiza el texto del elemento 'mensaje' y carga 'bonescript' con 'require'.
      label.textContent = "SI hay require :-)"
      b = require('bonescript');
    }
  
    // Configura el pin del LED como salida.
    b.pinMode(pumpOutput, b.OUTPUT);
    b.pinMode(solenoidValveOutput, b.OUTPUT);
    b.pinMode(servoValveOutput, b.ANALOG_OUTPUT);
    //Pin 9.36 no hace falta porque es sólo de uso ANALOG_INPUT

  
    // Imprime un mensaje en la consola indicando que la función 'run' ha terminado.
    console.log("Terminado el run");
};

document.addEventListener('DOMContentLoaded', function() {
    initializeChart();  // Inicializa el gráfico al cargar la página
    document.getElementById('pumpToggle').addEventListener('change', togglePump);
    document.getElementById('drainToggle').addEventListener('change', toggleDrain);
});


function togglePump() {
    const isPumpOn = document.getElementById('pumpToggle').checked;
    b.digitalWrite(pumpOutput, isPumpOn ? b.HIGH : b.LOW);
}

function toggleDrain() {
    const isDrainOn = document.getElementById('drainToggle').checked;
    b.digitalWrite(solenoidValveOutput, isDrainOn ? b.HIGH : b.LOW);
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
}

function initializeChart() {
    Chart.defaults.font.family = 'Montserrat'; // Establece la fuente global para todos los gráficos
    Chart.defaults.font.size = 16; // Establece el tamaño de la fuente global
    Chart.defaults.font.style = 'normal'; // Establece el estilo de la fuente global
    Chart.defaults.color = '#000000'; // Color global del texto en los gráficos

    // Verificar si el gráfico ya existe y si es así, destruirlo
    if (window.waterLevelChart instanceof Chart) {
        window.waterLevelChart.destroy();
    }

    let context = document.getElementById('waterLevelChart').getContext('2d');
    window.waterLevelChart = new Chart(context, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Nivel del Tanque',
                data: [],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                fill: false
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'realtime',  // Indica el tipo de eje
                    realtime: {
                        duration: 30000,
                        delay: 2000,
                        onRefresh: function(chart) {
                            chart.data.datasets.forEach(function(dataset) {
                                b.analogRead(waterLevelInput, function(err, resp) {
                                    if (!err) {
                                        const waterLevel = resp * 100; // Suponiendo que el valor es de 0 a 1
                                        dataset.data.push({
                                            x: Date.now(),
                                            y: waterLevel
                                        });
                                        document.getElementById('currentLevel').textContent = waterLevel.toFixed(2) + '%';
                                    } else {
                                        console.error('Error leyendo el valor analógico:', err);
                                    }
                                });
                            });
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

window.addEventListener('resize', function() {
    if (window.waterLevelChart) {
        window.waterLevelChart.resize();
    }
});