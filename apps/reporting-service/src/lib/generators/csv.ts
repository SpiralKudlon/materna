import { format } from 'fast-csv';
import { Writable } from 'stream';

/**
 * Generates a CSV buffer from an array of record objects.
 */
export async function generateCsv(data: Record<string, any>[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    });

    const csvStream = format({ headers: true });
    csvStream.pipe(stream);

    csvStream.on('error', (error) => reject(error));
    stream.on('finish', () => resolve(Buffer.concat(chunks)));

    data.forEach((row) => {
      csvStream.write(row);
    });

    csvStream.end();
  });
}
