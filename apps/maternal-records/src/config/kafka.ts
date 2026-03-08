import { Kafka, Producer } from 'kafkajs';
import { env } from './env.js';

let producer: Producer | null = null;

if (env.KAFKA_BROKERS) {
    const kafka = new Kafka({
        clientId: 'maternal-records',
        brokers: env.KAFKA_BROKERS.split(','),
    });

    producer = kafka.producer();
}

export const getKafkaProducer = () => producer;

export const connectKafka = async () => {
    if (producer) {
        try {
            await producer.connect();
            console.log('✅ Connected to Kafka Brokers');
        } catch (err: any) {
            console.error('❌ Failed to connect to Kafka:', err.message);
        }
    } else {
        console.warn('⚠️ KAFKA_BROKERS not provided. Event publishing is disabled.');
    }
};

export const disconnectKafka = async () => {
    if (producer) {
        await producer.disconnect();
        console.log('🛑 Disconnected from Kafka Brokers');
    }
};
