import { buildApp } from './app.js';

const start = async () => {
    const app = buildApp();
    try {
        const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
        await app.listen({ port, host: '0.0.0.0' });
        app.log.info(`Server listening on port ${port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
