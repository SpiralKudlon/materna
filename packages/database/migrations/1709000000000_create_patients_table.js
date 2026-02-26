/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    // 1. Ensure pgcrypto is available for field-level encryption
    pgm.createExtension('pgcrypto', { ifNotExists: true });

    // 2. Create the patients table definition
    // Note: Encrypted fields (full_name, phone, hiv_status) are stored as `bytea` 
    // because `pgp_sym_encrypt` returns bytea. 
    pgm.createTable('patients', {
        patient_id: {
            type: 'uuid',
            primaryKey: true,
            default: pgm.func('gen_random_uuid()'),
            notNull: true,
        },
        // FK to a typical users table
        user_id: {
            type: 'uuid',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE',
        },
        // Encrypted with pgcrypto AES-256-CBC -> bytea
        full_name: {
            type: 'bytea',
            notNull: true,
        },
        // Encrypted with pgcrypto AES-256-CBC -> bytea
        phone: {
            type: 'bytea',
        },
        date_of_birth: {
            type: 'date',
        },
        // Encrypted with pgcrypto AES-256-CBC -> bytea
        hiv_status: {
            type: 'bytea',
        }
    });

    // Create an index for faster lookups by user_id
    pgm.createIndex('patients', 'user_id');

    // 3. Implement Row-Level Security (RLS)
    // Enable RLS on the table
    pgm.alterTable('patients', { levelSecurity: 'ENABLE' });

    // Policy: Patients can only see their own records.
    // Assumes that the current user's UUID is available via a session setting (e.g., `app.current_user_id`).
    // Adjust this setting variable to match your application's authentication configuration (e.g., Supabase uses auth.uid()).
    pgm.createPolicy('patients', 'patients_access_own_records', {
        command: 'ALL',
        // Example: user_id = current_setting('app.current_user_id', true)::uuid
        using: "user_id = current_setting('app.current_user_id', true)::uuid",
    });

    // Policy: CHVs can only see patients assigned to them.
    // Assumes a junction table `chv_patient_assignments (chv_id, patient_id)` exists.
    pgm.createPolicy('patients', 'chvs_access_assigned_patients', {
        command: 'SELECT',
        using: `EXISTS (
      SELECT 1 FROM chv_patient_assignments cpa 
      WHERE cpa.patient_id = patients.patient_id 
      AND cpa.chv_id = current_setting('app.current_user_id', true)::uuid
    )`,
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    // 1. Drop RLS policies
    pgm.dropPolicy('patients', 'chvs_access_assigned_patients');
    pgm.dropPolicy('patients', 'patients_access_own_records');

    // 2. Drop the table
    pgm.dropTable('patients');

    // We explicitly choose not to drop the 'pgcrypto' extension in the down migration 
    // because it might be actively used by other tables/schemas in the database.
};
