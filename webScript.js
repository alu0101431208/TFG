console.log('Comienza script página');
setTargetAddress(location.host,  {
  initialized: run
});

let b = undefined;
const pumpOutput = "P9_12";
const solenoidValveOutput = "P9_15";
const servoValveOutput = "P9_16";
const waterLevelInput = "P9_36";


let setpoint = 50
let Kp = 25;  // Ganancia proporcional
let Ki = 0.15;  // Ganancia integral
let Kd = 0.01; // Ganancia derivativa
let previousError = 0;
let integral = 0;
let maxIntegral = 100;  // Límite máximo para la integral
let minIntegral = -100; // Límite mínimo para la integral
let maxOutput = 100; // Máximo output del PID
let minOutput = -100; // Mínimo output del PID

function run() {
        
    let label = document.getElementById('mensaje');
    if (! require) {
        label.textContent = "NO hay require :-("
        b = myrequire('bonescript');
    } else {
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
    document.getElementById('standbyLevel').addEventListener('input', function() {
        let input = this;
        let value = parseInt(input.value, 10);
        if (value < 0 || value > 100) {
            input.value = value < 0 ? 0 : 100;
            alert('El valor debe estar entre 0 y 100.');
        }
    });
    // Aquí es donde debe ir el listener para el activeLevel
    updateSetpoint(); // Inicializa el setpoint al cargar la página
    
setInterval(function() {
        b.analogRead(waterLevelInput, function(err, resp) {
            if (!err) {
                const waterLevel = resp * 100; // Suponiendo que el valor es de 0 a 1
                
                if (isNaN(waterLevel) || waterLevel < 0 || waterLevel > 100) {
                    console.error('Valor analógico inválido:', waterLevel);
                    alert('Error en la lectura del nivel de agua. Valor inválido.');
                    return;
                }
                
                let output = pidControl(waterLevel);
                applyControl(output);
                console.log(`Interval: Water Level=${waterLevel}, Output=${output}`); // Añadir log para depuración
                
                // Actualizar el gráfico aquí
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
                } else {
                    console.warn("El gráfico no está inicializado")
                }

                document.getElementById('currentLevel').textContent = waterLevel.toFixed(2) + '%';
            } else {
                console.error('Error leyendo el valor analógico:', err);
                alert('Error leyendo el valor analógico.');
            }
        });
    }, 2000); // Ejecutar cada 2 segundos (2000 ms)
});

function updateSetpoint() {
    setpoint = parseFloat(document.getElementById('activeLevel').textContent);
    console.log('Setpoint actualizado: ', setpoint);
    // Reinicializar las variables del PID
    previousError = 0;
    integral = 0;
}

function togglePump() {
    const isPumpOn = document.getElementById('pumpToggle').checked;
    b.digitalWrite(pumpOutput, isPumpOn ? b.HIGH : b.LOW);
}

function toggleDrain() {
    const isDrainOn = document.getElementById('drainToggle').checked;
    b.digitalWrite(solenoidValveOutput, isDrainOn ? b.HIGH : b.LOW);
}

function pidControl(currentLevel) {
    let error = setpoint - currentLevel;
    integral += error;
    
    if (integral > maxIntegral) {
        integral = maxIntegral;
    } else if (integral < minIntegral) {
        integral = minIntegral;
    }
    
    let derivative = error - previousError;

    let output = Kp * error + Ki * integral + Kd * derivative;
    
        // Limitar la salida del PID
    if (output > maxOutput) {
        output = maxOutput;
    } else if (output < minOutput) {
        output = minOutput;
    }

    
    previousError = error;
    console.log(`PID Control: Error=${error}, Integral=${integral}, Derivative=${derivative}, Output=${output}`);
    return output;
}

function applyControl(output) {
    // Escalar el output de un rango de -100 a 100 a un rango de 0 a 1
    let scaledOutput = (output + 100) / 200;  // Mapea -100 a 0 y 100 a 1
    if (scaledOutput < 0 || scaledOutput > 1) {
        console.warn(`applyControl: Scaled Output fuera de rango: ${scaledOutput}`);
    }
    b.analogWrite(servoValveOutput, scaledOutput);
    console.log(`applyControl: Output=${output}, Scaled Output=${scaledOutput}`); // Añadir log para depuración
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
                            // Vaciar el onRefresh, ya que se actualizará en el setInterval
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