import { describe, it, expect } from 'vitest';
import { RiskEngine, DEFAULT_WEIGHTS, type ClinicalFactors } from '../src/RiskEngine.js';

describe('RiskEngine', () => {
    const engine = new RiskEngine();

    const baseFactors: ClinicalFactors = {
        age_lt_18: false, age_gt_35: false, previous_preeclampsia: false, multiple_gestation: false,
        bmi_gt_30: false, chronic_hypertension: false, diabetes: false, renal_disease: false,
        autoimmune_disease: false, history_of_stillbirth: false, previous_c_section: false,
        fundal_height_discrepancy: false, reduced_fetal_movement: false, fever: false,
        foul_smelling_discharge: false, abdominal_pain: false, severe_headache: false,
        visual_disturbances: false, epigastric_pain: false, edema: false,
    };

    const make = (vitals = {}, factors = {}) => ({
        vitals: { ...vitals },
        factors: { ...baseFactors, ...factors },
    });

    // ─── Default weights ─────────────────────────────────────────────────────
    it('DEFAULT_WEIGHTS export contains all 20 factors', () => {
        expect(Object.keys(DEFAULT_WEIGHTS).length).toBe(20);
    });

    // ─── Tier 1: Deterministic Rules ─────────────────────────────────────────
    describe('Tier 1: Deterministic Rules', () => {
        it('returns HIGH + source=deterministic for severe vaginal bleeding', () => {
            const r = engine.evaluate(make({ vaginal_bleeding: 'SEVERE' }));
            expect(r.tier).toBe('HIGH');
            expect(r.source).toBe('deterministic');
            expect(r.isDeterministicHigh).toBe(true);
            expect(r.score).toBe(100);
        });

        it('returns HIGH for loss of consciousness', () => {
            const r = engine.evaluate(make({ loss_of_consciousness: true }));
            expect(r.tier).toBe('HIGH');
            expect(r.isDeterministicHigh).toBe(true);
        });

        it('returns HIGH for systolic BP exactly 160 (>= threshold)', () => {
            const r = engine.evaluate(make({ blood_pressure_systolic: 160 }));
            expect(r.tier).toBe('HIGH');
            expect(r.isDeterministicHigh).toBe(true);
        });

        it('returns HIGH for systolic BP above 160', () => {
            const r = engine.evaluate(make({ blood_pressure_systolic: 180 }));
            expect(r.tier).toBe('HIGH');
        });

        it('returns HIGH for diastolic BP exactly 110 (>= threshold)', () => {
            const r = engine.evaluate(make({ blood_pressure_diastolic: 110 }));
            expect(r.tier).toBe('HIGH');
            expect(r.isDeterministicHigh).toBe(true);
        });

        it('does NOT trigger HIGH for systolic BP 159', () => {
            const r = engine.evaluate(make({ blood_pressure_systolic: 159 }));
            expect(r.tier).toBe('LOW');
            expect(r.isDeterministicHigh).toBe(false);
        });

        it('does NOT trigger HIGH for moderate bleeding', () => {
            const r = engine.evaluate(make({ vaginal_bleeding: 'MODERATE' }));
            expect(r.isDeterministicHigh).toBe(false);
        });
    });

    // ─── Tier 2: Weighted Scoring ─────────────────────────────────────────────
    describe('Tier 2: Weighted Scoring', () => {
        it('source is weighted for non-deterministic paths', () => {
            const r = engine.evaluate(make({}, { edema: true }));
            expect(r.source).toBe('weighted');
            expect(r.isDeterministicHigh).toBe(false);
        });

        it('returns LOW when score is 0 with no factors', () => {
            const r = engine.evaluate(make());
            expect(r.tier).toBe('LOW');
            expect(r.score).toBe(0);
        });

        it('returns MODERATE for a mid-range set of factors', () => {
            // previous_preeclampsia (12) + diabetes (7) = 19 -> last factor edema (3) = 22 -> MODERATE
            const r = engine.evaluate(make({}, {
                previous_preeclampsia: true,
                diabetes: true,
                edema: true,
            }));
            expect(r.tier).toBe('MODERATE');
            expect(r.score).toBeGreaterThanOrEqual(20);
            expect(r.score).toBeLessThan(50);
        });

        it('returns HIGH when score >= 50', () => {
            // chronic_hypertension (10) + previous_preeclampsia (12) + multiple_gestation (8)
            // + renal_disease (8) + autoimmune_disease (7) + diabetes (7) = 52
            const r = engine.evaluate(make({}, {
                chronic_hypertension: true, previous_preeclampsia: true, multiple_gestation: true,
                renal_disease: true, autoimmune_disease: true, diabetes: true,
            }));
            expect(r.tier).toBe('HIGH');
            expect(r.score).toBeGreaterThanOrEqual(50);
        });

        it('caps score at 100 when all factors are true', () => {
            const allTrue = Object.keys(baseFactors).reduce((acc, k) => {
                acc[k as keyof ClinicalFactors] = true; return acc;
            }, {} as ClinicalFactors);
            const r = engine.evaluate(make({}, allTrue));
            expect(r.score).toBe(100);
            expect(r.tier).toBe('HIGH');
        });

        it('accepts custom weights via constructor', () => {
            // Give edema an extremely high weight so it alone triggers HIGH
            const customEngine = new RiskEngine({ edema: 100 });
            const r = customEngine.evaluate(make({}, { edema: true }));
            expect(r.tier).toBe('HIGH');
        });
    });
});
