class PIDController {
    constructor(Kp, Ki, Kd, consigna) {
        this.Kp = Kp;
        this.Ki = Ki;
        this.Kd = Kd;
        this.consigna = consigna;
        this.cumulativeError = 0;
        this.lastError = 0;
        this.lastTime = Date.now();
    }

    update(sensorValue) {
        const now = Date.now();
        const deltaTime = (now - this.lastTime) / 1000; // segundos
        this.lastTime = now;

        const error = this.consigna - sensorValue;
        this.cumulativeError += error * deltaTime;
        const rateError = (error - this.lastError) / deltaTime;

        const output = (this.Kp * error) + (this.Ki * this.cumulativeError) + (this.Kd * rateError);
        this.lastError = error;

        return output;
    }
}