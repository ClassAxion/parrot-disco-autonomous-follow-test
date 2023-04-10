import Telemetry from './interface/Telemetry.interface';
import { io, Socket } from 'socket.io-client';
import logger from './utils/logger';
import Algorithm from './module/Algorithm.module';
import readline from 'readline';

const target: string = process.argv[2] || 'ws://localhost:9999';

let socket: Socket = null;
let telemetry: Telemetry = {};

const dummy: Telemetry = {
    altitude: {
        value: 100,
        lastReceivedAt: Date.now(),
    },
    speed: {
        value: 40,
        lastReceivedAt: Date.now(),
    },
    heading: {
        value: 0,
        lastReceivedAt: Date.now(),
    },
    location: {
        latitude: 53.3393,
        longitude: 17.6381,
        lastReceivedAt: Date.now(),
    },
};

function attachEvents() {
    socket.on('altitude', ({ altitude }) => {
        telemetry.altitude = {
            value: altitude,
            lastReceivedAt: Date.now(),
        };
    });

    socket.on('location', ({ latitude, longitude }) => {
        telemetry.location = {
            latitude,
            longitude,
            lastReceivedAt: Date.now(),
        };
    });

    socket.on('heading', ({ heading }) => {
        telemetry.heading = {
            value: heading,
            lastReceivedAt: Date.now(),
        };
    });

    socket.on('speed ', ({ speed }) => {
        telemetry.speed = {
            value: speed,
            lastReceivedAt: Date.now(),
        };
    });
}

let roll, throttle, distance;

async function readDummy() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    while (true) {
        const answer = await new Promise<string>((r) => rl.question('Type: ', r));

        const parts = answer.split('|');

        if (parts[0] === 'h') {
            dummy.heading = {
                value: Number(parts[1]),
                lastReceivedAt: Date.now(),
            };

            console.log(`Got heading ${dummy.heading.value} from user`);
        }

        if (parts[0] === 'a') {
            dummy.altitude = {
                value: Number(parts[1]),
                lastReceivedAt: Date.now(),
            };

            console.log(`Got altitude ${dummy.altitude.value} from user`);
        }

        if (parts[0] === 's') {
            dummy.speed = {
                value: Number(parts[1]),
                lastReceivedAt: Date.now(),
            };

            console.log(`Got speed ${dummy.speed.value} from user`);
        }

        if (parts[0] === 'l') {
            dummy.location = {
                latitude: Number(parts[1]),
                longitude: Number(parts[2]),
                lastReceivedAt: Date.now(),
            };

            console.log(`Got location ${dummy.location.latitude} ${dummy.location.longitude} from user`);
        }

        console.log(`Roll: ${roll}`);
        console.log(`Last distance: ${distance}m`);
        console.log(`Throttle: ${throttle}`);
    }

    rl.close();
}

(async () => {
    logger.info(`Connecting to ${target}`);

    const url = target;

    socket = io(url);

    await new Promise<void>((r) => socket.once('connect', () => r()));

    telemetry = {};

    socket.on('disconnect', () => {
        logger.error(`Connection lost, aborting`);
        process.exit(1);
    });

    logger.info(`Disco connected`);

    attachEvents();

    logger.info(`Events attached`);

    readDummy();

    const algorithm = new Algorithm();

    let lastRoll: number;
    let lastThrottle: number;

    await new Promise((r) => setTimeout(r, 5 * 1000));

    logger.info(`Starting following algorithm..`);

    while (true) {
        algorithm.setTelemetry('A', telemetry);
        algorithm.setTelemetry('B', dummy);

        roll = algorithm.getRollAxis();

        throttle = algorithm.getThrottle();
        throttle = 0;

        distance = algorithm.getDistance();

        if (!lastRoll || lastRoll !== roll || lastRoll === -25 || lastRoll === 25) {
            socket.emit('move', { roll });
        }

        if (!lastThrottle || lastThrottle !== throttle) {
            // socket.emit('move', { throttle });
        }

        lastRoll = roll;
        lastThrottle = throttle;

        await new Promise<void>((r) => setTimeout(r, 100));
    }
})();
