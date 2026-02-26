import Fastify from 'fastify';
import { authRoutes } from './routes/auth.routes.js';

export function buildApp() {
    const app = Fastify({
        logger: true,
    });

    app.register(authRoutes, { prefix: '/api/v1/auth' });

    return app;
}
