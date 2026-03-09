import { describe, it, expect } from 'vitest';
import { TemplateService } from '../../src/services/template.service.js';
import type { Pool } from 'pg';

describe('TemplateService - Interpolation Logic', () => {

    it('should correctly interpolate a single variable', () => {
        // Mock pool can just be empty object since we only test the regex interpolation method statically
        const service = new TemplateService({} as Pool);

        const template = 'Hello {{name}}, welcome to maternal health services.';
        const result = service.interpolate(template, { name: 'Aisha' });

        expect(result).toBe('Hello Aisha, welcome to maternal health services.');
    });

    it('should correctly interpolate multiple variables', () => {
        const service = new TemplateService({} as Pool);

        const template = '{{greeting}} {{chvName}}, you have {{highRiskCount}} HIGH risk patients.';
        const result = service.interpolate(template, {
            greeting: 'Good morning',
            chvName: 'Sarah',
            highRiskCount: 3
        });

        expect(result).toBe('Good morning Sarah, you have 3 HIGH risk patients.');
    });

    it('should handle whitespace inside curly brackets safely', () => {
        const service = new TemplateService({} as Pool);

        const template = 'Your appointment is on {{ date }}. Please verify {{  time   }}';
        const result = service.interpolate(template, { date: '2026-04-12', time: '10:00 AM' });

        expect(result).toBe('Your appointment is on 2026-04-12. Please verify 10:00 AM');
    });

    it('should ignore variables missing from the map, leaving them unparsed safely', () => {
        const service = new TemplateService({} as Pool);

        const template = 'Hello {{name}}, you are aged {{age}}.';
        const result = service.interpolate(template, { name: 'Mariam' });

        // age missing, so {{age}} persists exactly as formatted
        expect(result).toBe('Hello Mariam, you are aged {{age}}.');
    });
});
