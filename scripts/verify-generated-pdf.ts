/**
 * Verify the contents of a PDF we generated.
 * Usage: npx tsx scripts/verify-generated-pdf.ts [path-to-pdf]
 */
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import * as fs from 'fs';

async function main() {
  const path = process.argv[2] ?? '/tmp/test-resume.pdf';
  const buf = fs.readFileSync(path);
  const result = await pdfParse(buf);
  console.log('Text from generated PDF:');
  console.log('---');
  console.log(result.text);
  console.log('---');
  console.log(`Pages: ${result.numpages}`);
  console.log(`Info: ${JSON.stringify(result.info)}`);
}

main();
