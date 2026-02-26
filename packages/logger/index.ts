import pino from 'pino';

export const createLogger = (name: string) => {
    const isProduction = process.env.NODE_ENV === 'production';

    return pino({
        name,
        level: process.env.LOG_LEVEL || 'info',
        formatters: {
            level: (label) => {
                return { level: label };
            },
        },
        ...(isProduction
            ? {}
            : {
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                        translateTime: 'SYS:standard',
                        ignore: 'pid,hostname',
                    },
                },
            }),
    });
};

export const logger = createLogger('maternal-system');

// Example middleware or utility to attach request-id
export const logWithRequestId = (reqId: string, msg: string, data?: any) => {
    logger.info({ reqId, ...data }, msg);
};
