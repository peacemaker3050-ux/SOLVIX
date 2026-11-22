const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const lines = html.split('\n');
const suspicious = [];
lines.forEach((line, idx) => {
  if (/[\u0600-\u06FF]/.test(line)) {
    const trimmed = line.trim();
    // Exclude dictionary definitions and translation mappings
    if (
      !trimmed.includes("LANG === 'ar'") &&
      !trimmed.includes("LANG==='ar'") &&
      !trimmed.includes("LANG === 'en'") &&
      !trimmed.includes("ar:") &&
      !trimmed.includes('ar:') &&
      !trimmed.includes('"ar":') &&
      !trimmed.includes('TR[') &&
      !trimmed.includes('NM[') &&
      !trimmed.includes('const TR =') &&
      !trimmed.includes('const DEPT =') &&
      !trimmed.includes('const YEARS =') &&
      !trimmed.includes('const PROGRAMS =') &&
      !trimmed.includes('const LEVELS =') &&
      !trimmed.includes('LEVELS = [') &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('*')
    ) {
      suspicious.push({ lineNum: idx + 1, content: trimmed });
    }
  }
});
console.log('Total suspicious lines with Arabic:', suspicious.length);
suspicious.forEach(s => console.log(s.lineNum + ': ' + s.content));
