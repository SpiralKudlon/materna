import { Pool } from 'pg';

export interface NotificationTemplate {
    id: string;
    name: string;
    language: string;
    content: string;
    created_at: Date;
    updated_at: Date;
}

export class TemplateService {
    constructor(private readonly dbPool: Pool) { }

    /**
     * Fetch a template from the database based on its unique name and target language
     */
    async getTemplate(name: string, language: string = 'en'): Promise<string> {
        // Try fetching the requested language
        let result = await this.dbPool.query<NotificationTemplate>(
            'SELECT content FROM notification_templates WHERE name = $1 AND language = $2 LIMIT 1',
            [name, language]
        );

        // Fallback to English if exact language lacks a translation row
        if (result.rows.length === 0 && language !== 'en') {
            result = await this.dbPool.query<NotificationTemplate>(
                'SELECT content FROM notification_templates WHERE name = $1 AND language = $2 LIMIT 1',
                [name, 'en']
            );
        }

        if (result.rows.length === 0) {
            throw new Error(`Template not found for name: ${name}`);
        }

        return result.rows[0].content;
    }

    /**
     * Basic string interpolation mirroring i18next behavior
     * e.g. "Hello {{name}}" mapped with { name: 'Alice' } -> "Hello Alice"
     */
    interpolate(templateStr: string, variables: Record<string, string | number>): string {
        return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
            return variables[key] !== undefined ? String(variables[key]) : match;
        });
    }

    /**
     * Combined helper retrieving the fully rendered localized string 
     */
    async render(name: string, language: string, variables: Record<string, string | number>): Promise<string> {
        const rawTemplate = await this.getTemplate(name, language);
        return this.interpolate(rawTemplate, variables);
    }
}
