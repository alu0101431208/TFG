const http = require('http');



let controlInterval = null;

//ON-OFF
let setpoint = 50;
let hysteresis = 5;

// PID
let kp = 25;
let ki = 0.15;
let kd = 0.01;
let integral = 0;
let previousError = 0;
const maxIntegral = 100; // Limites para la integral
const minIntegral = -100;
const maxOutput = 100; // Limites para la salida del PID
const minOutput = -100;

function sendHttpRequest(path, data, callback) {
    const options = {
        hostname: 'localhost',
        port: 3001,
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
            responseBody += chunk;
        });

        res.on('end', () => {
            callback(null, responseBody);
        });
    });

    req.on('error', (error) => {
        callback(error);
    });

    req.write(data);
    req.end();
}

function onOff(waterLevel) {
    if (waterLevel < (setpoint - hysteresis)) {
        const data = JSON.stringify({ status: true });
        sendHttpRequest('/api/device-control/pump', data, (error, response) => {
            if (error) {
                console.error(`Error al encender la bomba: ${error}`);
            } else {
                console.log(response);
            }
        });
    } else if (waterLevel > (setpoint + hysteresis)) {
        const data = JSON.stringify({ status: false });
        sendHttpRequest('/api/device-control/pump', data, (error, response) => {
            if (error) {
                console.error(`Error al apagar la bomba: ${error}`);
            } else {
                console.log(response);
            }
        });
    }
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

    let output = kp * error + ki * integral + kd * derivative;

    // Limitar la salida del PID
    if (output > maxOutput) {
        output = maxOutput;
    } else if (output < minOutput) {
        output = minOutput;
    }

    previousError = error;

    // Mapear la salida del PID a un rango de 0 a 1
    let scaledOutput = (output + 100) / 200;

    console.log(`PID Control: Error=${error}, Integral=${integral}, Derivative=${derivative}, Output=${output}, Servo Output=${scaledOutput}`);
    return scaledOutput;
}

function fetchLatestWaterLevel(callback) {
    const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/water-level/latest',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            const latestWaterLevel = JSON.parse(data).level;
            callback(null, latestWaterLevel);
        });
    });

    req.on('error', (error) => {
        callback(error);
    });

    req.end();
}

function startControl(mode) {
    stopControl(); // Detener cualquier control existente

    if (mode === 'onoff') {
        controlInterval = setInterval(() => {
            fetchLatestWaterLevel((error, currentWaterLevel) => {
                if (error) {
                    console.error(`Error al obtener el nivel de agua: ${error}`);
                } else {
                    onOff(currentWaterLevel);
                }
            });
        }, 2000);
    } else if (mode === 'pid') {
        controlInterval = setInterval(() => {
            fetchLatestWaterLevel((error, currentWaterLevel) => {
                if (error) {
                    console.error(`Error al obtener el nivel de agua: ${error}`);
                } else {
                    // Implementar la lógica de control PID
                    const pidOutput = pidControl(currentWaterLevel);

                    const servoStatus = pidOutput; // Rango de salida del PID es 0 a 1

                    const data = JSON.stringify({ status: servoStatus });
                    sendHttpRequest('/api/device-control/servo', data, (error, response) => {
                        if (error) {
                            console.error(`Error al ajustar la válvula servo: ${error}`);
                        } else {
                            console.log(response);
                        }
                    });
                }
            });
        }, 2000);
    }
}


function stopControl() {
    if (controlInterval) {
        clearInterval(controlInterval);
        controlInterval = null;
    }
}

module.exports = {
    onOff,
    setSetpoint: (newSetpoint) => { 
        console.log(`Setpoint cambiado a: ${newSetpoint}`);
        setpoint = newSetpoint; 
    },
    setHysteresis: (newHysteresis) => { 
        console.log(`Hysteresis cambiado a: ${newHysteresis}`);
        hysteresis = newHysteresis; 
    },
    setKp: (newKp) => { 
        console.log(`Kp cambiado a: ${newKp}`);
        kp = newKp; 
    },
    setKi: (newKi) => { 
        console.log(`Ki cambiado a: ${newKi}`);
        ki = newKi; 
    },
    setKd: (newKd) => { 
        console.log(`Kd cambiado a: ${newKd}`);
        kd = newKd; 
    },
    startControl,
    stopControl
};