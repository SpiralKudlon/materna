import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { getKafkaProducer } from '../config/kafka.js';

export interface ReferralRouteOptions {
    pool: Pool;
}

export const referralRoutes: FastifyPluginAsync<ReferralRouteOptions> = async (app, opts) => {
    const { pool } = opts;

    app.patch('/:id/accept', async (request, reply) => {
        const { id: referralId } = request.params as { id: string };

        const client = await pool.connect();
        try {
            // The constraint trigger `enforce_referral_state_machine` will automatically 
            // validate this transition (PENDING -> ACCEPTED). If invalid, it throws an error.
            const result = await client.query(
                `UPDATE referrals SET status = 'ACCEPTED' WHERE id = $1 RETURNING *`,
                [referralId]
            );

            if (result.rowCount === 0) {
                return reply.code(404).send({ error: 'Referral not found' });
            }

            const referral = result.rows[0];

            // Trigger Kafka Event
            const producer = getKafkaProducer();
            if (producer) {
                await producer.send({
                    topic: 'referrals.events',
                    messages: [
                        {
                            key: referral.patient_id, // Partition by patient
                            value: JSON.stringify({
                                eventId: crypto.randomUUID(),
                                type: 'REFERRAL_ACCEPTED',
                                referralId: referral.id,
                                patientId: referral.patient_id,
                                fromFacilityId: referral.from_facility_id,
                                toFacilityId: referral.to_facility_id,
                                timestamp: new Date().toISOString()
                            }),
                        }
                    ]
                });
                app.log.info(`[Kafka] Emitted REFERRAL_ACCEPTED for ${referralId}`);
            }

            return reply.send({ data: referral });
        } catch (err: any) {
            app.log.error(`Referral Accept Failed: ${err.message}`);
            return reply.code(400).send({ error: err.message });
        } finally {
            client.release();
        }
    });

    app.patch('/:id/close', async (request, reply) => {
        const { id: referralId } = request.params as { id: string };

        const client = await pool.connect();
        try {
            const result = await client.query(
                `UPDATE referrals SET status = 'CLOSED' WHERE id = $1 RETURNING *`,
                [referralId]
            );

            if (result.rowCount === 0) {
                return reply.code(404).send({ error: 'Referral not found' });
            }

            const referral = result.rows[0];

            // Trigger Kafka Event
            const producer = getKafkaProducer();
            if (producer) {
                await producer.send({
                    topic: 'referrals.events',
                    messages: [
                        {
                            key: referral.patient_id,
                            value: JSON.stringify({
                                eventId: crypto.randomUUID(),
                                type: 'REFERRAL_CLOSED',
                                referralId: referral.id,
                                patientId: referral.patient_id,
                                timestamp: new Date().toISOString()
                            }),
                        }
                    ]
                });
                app.log.info(`[Kafka] Emitted REFERRAL_CLOSED for ${referralId}`);
            }

            return reply.send({ data: referral });
        } catch (err: any) {
            app.log.error(`Referral Close Failed: ${err.message}`);
            return reply.code(400).send({ error: err.message });
        } finally {
            client.release();
        }
    });
};
