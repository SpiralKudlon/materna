import PDFDocument from 'pdfkit';

/**
 * Generates a basic PDF buffer from an array of record objects.
 */
export async function generatePdf(data: Record<string, any>[], title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Title
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated at: ${new Date().toISOString()}`, { align: 'center' });
      doc.moveDown(2);

      if (data.length === 0) {
        doc.fontSize(12).text('No data available for this period.', { align: 'center' });
      } else {
        // Simple key-value listing for the first few rows (simplistic table simulation)
        const headers = Object.keys(data[0]);

        data.forEach((row, index) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`Record #${index + 1}`);
          headers.forEach(header => {
            doc.fontSize(10).font('Helvetica').text(`${header}: ${row[header]}`);
          });
          doc.moveDown();
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
