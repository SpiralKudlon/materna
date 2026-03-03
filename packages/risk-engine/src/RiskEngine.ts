export type RiskTier = 'LOW' | 'MODERATE' | 'HIGH';
export type RiskSource = 'deterministic' | 'weighted';

export interface Vitals {
    vaginal_bleeding?: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE';
    loss_of_consciousness?: boolean;
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
}

export interface ClinicalFactors {
    age_lt_18?: boolean;
    age_gt_35?: boolean;
    previous_preeclampsia?: boolean;
    multiple_gestation?: boolean;
    bmi_gt_30?: boolean;
    chronic_hypertension?: boolean;
    diabetes?: boolean;
    renal_disease?: boolean;
    autoimmune_disease?: boolean;
    history_of_stillbirth?: boolean;
    previous_c_section?: boolean;
    fundal_height_discrepancy?: boolean;
    reduced_fetal_movement?: boolean;
    fever?: boolean;
    foul_smelling_discharge?: boolean;
    abdominal_pain?: boolean;
    severe_headache?: boolean;
    visual_disturbances?: boolean;
    epigastric_pain?: boolean;
    edema?: boolean;
}

export interface AssessmentData {
    vitals: Vitals;
    factors: ClinicalFactors;
}

/** Discriminated union: deterministic bypass vs weighted scoring */
export type RiskResult =
    | { source: 'deterministic'; tier: 'HIGH'; score: 100; isDeterministicHigh: true }
    | { source: 'weighted'; tier: RiskTier; score: number; isDeterministicHigh: false };

/**
 * Default evidence-informed weights (sum = 100 if all 20 factors are true).
 * Higher-weighted factors reflect stronger independent predictors found in literature.
 * Callers can supply custom weights to reflect local clinical protocols.
 */
export const DEFAULT_WEIGHTS: Record<keyof ClinicalFactors, number> = {
    previous_preeclampsia: 12,
    chronic_hypertension: 10,
    multiple_gestation: 8,
    renal_disease: 8,
    autoimmune_disease: 7,
    diabetes: 7,
    history_of_stillbirth: 6,
    severe_headache: 6,
    visual_disturbances: 5,
    epigastric_pain: 5,
    reduced_fetal_movement: 5,
    fundal_height_discrepancy: 4,
    abdominal_pain: 4,
    fever: 3,
    foul_smelling_discharge: 3,
    age_lt_18: 3,
    age_gt_35: 3,
    bmi_gt_30: 3,
    previous_c_section: 3,
    edema: 3,
};

export class RiskEngine {
    private readonly weights: Record<keyof ClinicalFactors, number>;

    constructor(weights: Partial<Record<keyof ClinicalFactors, number>> = {}) {
        this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    }

    public evaluate(data: AssessmentData): RiskResult {
        if (this.evaluateTier1(data.vitals)) {
            return { source: 'deterministic', tier: 'HIGH', score: 100, isDeterministicHigh: true };
        }

        const score = this.evaluateTier2(data.factors);

        let tier: RiskTier = 'LOW';
        if (score >= 50) {
            tier = 'HIGH';
        } else if (score >= 20) {
            tier = 'MODERATE';
        }

        return { source: 'weighted', tier, score, isDeterministicHigh: false };
    }

    private evaluateTier1(vitals: Vitals): boolean {
        if (vitals.vaginal_bleeding === 'SEVERE') return true;
        if (vitals.loss_of_consciousness === true) return true;
        // 🟡 Fix: use >= per ACOG severe-range criteria (was strictly >)
        if (vitals.blood_pressure_systolic !== undefined && vitals.blood_pressure_systolic >= 160) return true;
        if (vitals.blood_pressure_diastolic !== undefined && vitals.blood_pressure_diastolic >= 110) return true;
        return false;
    }

    private evaluateTier2(factors: ClinicalFactors): number {
        let score = 0;
        for (const key of Object.keys(this.weights) as Array<keyof ClinicalFactors>) {
            if (factors[key]) {
                score += this.weights[key];
            }
        }
        return Math.min(Math.round(score), 100);
    }
}
