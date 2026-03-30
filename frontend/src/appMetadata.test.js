import fs from 'fs';
import path from 'path';

describe('app metadata', () => {
  test('uses the clock favicon and branded title', () => {
    const indexHtml = fs.readFileSync(
      path.resolve(__dirname, '../public/index.html'),
      'utf8'
    );

    expect(indexHtml).toContain('favicon.svg');
    expect(indexHtml).toContain('<title>AreYouStillThere</title>');
  });
});