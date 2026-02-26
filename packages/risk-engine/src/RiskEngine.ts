export type RiskTier = 'LOW' | 'MODERATE' | 'HIGH';

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

export interface RiskResult {
    tier: RiskTier;
    score: number;
    isDeterministicHigh: boolean;
}

export class RiskEngine {
    public evaluate(data: AssessmentData): RiskResult {
        const isDeterministicHigh = this.evaluateTier1(data.vitals);

        if (isDeterministicHigh) {
            return {
                tier: 'HIGH',
                score: 100,
                isDeterministicHigh: true
            };
        }

        const score = this.evaluateTier2(data.factors);

        let tier: RiskTier = 'LOW';
        if (score >= 50) {
            tier = 'HIGH';
        } else if (score >= 20) {
            tier = 'MODERATE';
        }

        return {
            tier,
            score,
            isDeterministicHigh: false
        };
    }

    private evaluateTier1(vitals: Vitals): boolean {
        if (vitals.vaginal_bleeding === 'SEVERE') return true;
        if (vitals.loss_of_consciousness === true) return true;
        if (vitals.blood_pressure_systolic !== undefined && vitals.blood_pressure_systolic > 160) return true;
        if (vitals.blood_pressure_diastolic !== undefined && vitals.blood_pressure_diastolic > 110) return true;
        return false;
    }

    private evaluateTier2(factors: ClinicalFactors): number {
        let score = 0;

        // 20 factors mapped to points (5 points each to cleanly sum to 100)
        if (factors.age_lt_18) score += 5;
        if (factors.age_gt_35) score += 5;
        if (factors.previous_preeclampsia) score += 5;
        if (factors.multiple_gestation) score += 5;
        if (factors.bmi_gt_30) score += 5;
        if (factors.chronic_hypertension) score += 5;
        if (factors.diabetes) score += 5;
        if (factors.renal_disease) score += 5;
        if (factors.autoimmune_disease) score += 5;
        if (factors.history_of_stillbirth) score += 5;
        if (factors.previous_c_section) score += 5;
        if (factors.fundal_height_discrepancy) score += 5;
        if (factors.reduced_fetal_movement) score += 5;
        if (factors.fever) score += 5;
        if (factors.foul_smelling_discharge) score += 5;
        if (factors.abdominal_pain) score += 5;
        if (factors.severe_headache) score += 5;
        if (factors.visual_disturbances) score += 5;
        if (factors.epigastric_pain) score += 5;
        if (factors.edema) score += 5;

        return Math.min(score, 100);
    }
}
