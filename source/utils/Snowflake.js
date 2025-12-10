export class Snowflake {
    static EPOCH = 1420070400000n;

    static generate(timestamp = Date.now()) {
        const time = BigInt(timestamp) - Snowflake.EPOCH;
        const workerId = 0n;
        const processId = 0n;
        const increment = BigInt(Math.floor(Math.random() * 4096));

        return ((time << 22n) | (workerId << 17n) | (processId << 12n) | increment).toString();
    }

    static deconstruct(snowflake) {
        const bigIntSnowflake = BigInt(snowflake);

        return {
            timestamp: Number((bigIntSnowflake >> 22n) + Snowflake.EPOCH),
            workerId: Number((bigIntSnowflake >> 17n) & 0b11111n),
            processId: Number((bigIntSnowflake >> 12n) & 0b11111n),
            increment: Number(bigIntSnowflake & 0b111111111111n),
            date: new Date(Number((bigIntSnowflake >> 22n) + Snowflake.EPOCH))
        };
    }

    static getTimestamp(snowflake) {
        return Number((BigInt(snowflake) >> 22n) + Snowflake.EPOCH);
    }

    static getDate(snowflake) {
        return new Date(Snowflake.getTimestamp(snowflake));
    }
}
