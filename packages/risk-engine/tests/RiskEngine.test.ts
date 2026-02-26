import { describe, it, expect } from 'vitest';
import { RiskEngine, type AssessmentData, type ClinicalFactors } from '../src/RiskEngine.js';

describe('RiskEngine', () => {
    const engine = new RiskEngine();

    const baseFactors: ClinicalFactors = {
        age_lt_18: false,
        age_gt_35: false,
        previous_preeclampsia: false,
        multiple_gestation: false,
        bmi_gt_30: false,
        chronic_hypertension: false,
        diabetes: false,
        renal_disease: false,
        autoimmune_disease: false,
        history_of_stillbirth: false,
        previous_c_section: false,
        fundal_height_discrepancy: false,
        reduced_fetal_movement: false,
        fever: false,
        foul_smelling_discharge: false,
        abdominal_pain: false,
        severe_headache: false,
        visual_disturbances: false,
        epigastric_pain: false,
        edema: false,
    };

    const createData = (vitals = {}, factors = {}): AssessmentData => ({
        vitals: { ...vitals },
        factors: { ...baseFactors, ...factors },
    });

    describe('Tier 1: Deterministic Rules', () => {
        it('returns HIGH risk for severe vaginal bleeding', () => {
            const result = engine.evaluate(createData({ vaginal_bleeding: 'SEVERE' }));
            expect(result.tier).toBe('HIGH');
            expect(result.isDeterministicHigh).toBe(true);
            expect(result.score).toBe(100);
        });

        it('returns HIGH risk for loss of consciousness', () => {
            const result = engine.evaluate(createData({ loss_of_consciousness: true }));
            expect(result.tier).toBe('HIGH');
            expect(result.isDeterministicHigh).toBe(true);
            expect(result.score).toBe(100);
        });

        it('returns HIGH risk for systolic BP > 160', () => {
            const result = engine.evaluate(createData({ blood_pressure_systolic: 161 }));
            expect(result.tier).toBe('HIGH');
            expect(result.isDeterministicHigh).toBe(true);
            expect(result.score).toBe(100);
        });

        it('returns HIGH risk for diastolic BP > 110', () => {
            const result = engine.evaluate(createData({ blood_pressure_diastolic: 111 }));
            expect(result.tier).toBe('HIGH');
            expect(result.isDeterministicHigh).toBe(true);
            expect(result.score).toBe(100);
        });

        it('does not trigger HIGH risk for mildly elevated BP', () => {
            const result = engine.evaluate(createData({ blood_pressure_systolic: 140, blood_pressure_diastolic: 90 }));
            expect(result.tier).toBe('LOW');
            expect(result.isDeterministicHigh).toBe(false);
            expect(result.score).toBe(0);
        });

        it('does not trigger HIGH risk for moderate bleeding', () => {
            const result = engine.evaluate(createData({ vaginal_bleeding: 'MODERATE' }));
            expect(result.isDeterministicHigh).toBe(false);
        });
    });

    describe('Tier 2: Weighted Scoring Rules', () => {
        it('returns LOW risk when score is below 20', () => {
            // 3 factors = 15 points
            const result = engine.evaluate(createData({}, {
                age_lt_18: true,
                bmi_gt_30: true,
                edema: true
            }));
            expect(result.tier).toBe('LOW');
            expect(result.score).toBe(15);
            expect(result.isDeterministicHigh).toBe(false);
        });

        it('returns MODERATE risk when score is 20 to 49', () => {
            // 5 factors = 25 points
            const result = engine.evaluate(createData({}, {
                age_gt_35: true,
                previous_preeclampsia: true,
                diabetes: true,
                renal_disease: true,
                fever: true
            }));
            expect(result.tier).toBe('MODERATE');
            expect(result.score).toBe(25);
        });

        it('returns HIGH risk when score is 50 or above', () => {
            // 10 factors = 50 points
            const result = engine.evaluate(createData({}, {
                multiple_gestation: true,
                chronic_hypertension: true,
                autoimmune_disease: true,
                history_of_stillbirth: true,
                previous_c_section: true,
                fundal_height_discrepancy: true,
                reduced_fetal_movement: true,
                foul_smelling_discharge: true,
                abdominal_pain: true,
                severe_headache: true
            }));
            expect(result.tier).toBe('HIGH');
            expect(result.score).toBe(50);
            expect(result.isDeterministicHigh).toBe(false);
        });

        it('returns a max score of 100 even with >20 factors enabled theoretically', () => {
            // 20 factors = 100 points
            const allTrue = Object.keys(baseFactors).reduce((acc, key) => {
                acc[key as keyof ClinicalFactors] = true;
                return acc;
            }, {} as unknown as ClinicalFactors);

            const result = engine.evaluate(createData({}, allTrue));
            expect(result.tier).toBe('HIGH');
            expect(result.score).toBe(100);
            expect(result.isDeterministicHigh).toBe(false);
        });

        it('correctly processes visual disturbances and epigastric pain', () => {
            const result = engine.evaluate(createData({}, {
                visual_disturbances: true,
                epigastric_pain: true
            }));
            expect(result.score).toBe(10);
            expect(result.tier).toBe('LOW');
        });
    });
});
