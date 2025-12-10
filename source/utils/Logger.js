const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',

    fg: {
        black: '\x1b[30m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        crimson: '\x1b[38m'
    },

    bg: {
        black: '\x1b[40m',
        red: '\x1b[41m',
        green: '\x1b[42m',
        yellow: '\x1b[43m',
        blue: '\x1b[44m',
        magenta: '\x1b[45m',
        cyan: '\x1b[46m',
        white: '\x1b[47m',
        crimson: '\x1b[48m'
    }
};

export class Logger {
    static #getTimestamp() {
        return new Date().toLocaleTimeString();
    }

    static #format(message, type, color) {
        const timestamp = this.#getTimestamp();
        return `${colors.dim}[${timestamp}]${colors.reset} ${colors.bright}${color}[${type}]${colors.reset} ${message}`;
    }

    static log(message) {
        console.log(this.#format(message, 'INFO', colors.fg.cyan));
    }

    static warn(message) {
        console.log(this.#format(message, 'WARN', colors.fg.yellow));
    }

    static error(message) {
        console.log(this.#format(message, 'ERROR', colors.fg.red));
    }

    static success(message) {
        console.log(this.#format(message, 'SUCCESS', colors.fg.green));
    }

    static nya(message) {
        console.log(this.#format(message, 'NYA', colors.fg.magenta));
    }

    static debug(message) {
        console.log(this.#format(message, 'DEBUG', colors.fg.blue));
    }

    static gateway(message) {
        console.log(this.#format(message, 'GATEWAY', colors.fg.white));
    }

    static rest(message) {
        console.log(this.#format(message, 'REST', colors.fg.cyan));
    }
}
