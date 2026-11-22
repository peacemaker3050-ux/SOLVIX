const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

const arabicRegex = /[\u0600-\u06FF]/;
const findings = [];

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  // skip comments, CONFIG, AR dictionary, NM setup
  if (lineNum >= 650 && lineNum <= 910) return; // SOLVIX_CONFIG
  if (lineNum >= 1060 && lineNum <= 1195) return; // AR & translation tables
  if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
  
  if (arabicRegex.test(line)) {
    // Check if line contains LANG === 'ar' or tr( or conditional
    const hasLangCheck = line.includes("LANG === 'ar'") || line.includes("LANG==='ar'") || line.includes("LANG !== 'en'") || line.includes("isAr") || line.includes("LEVELS");
    findings.push({ lineNum, hasLangCheck, text: line.trim().slice(0, 100) });
  }
});

console.log('Total non-dictionary lines with Arabic:', findings.length);
const withoutLangCheck = findings.filter(f => !f.hasLangCheck);
console.log('Lines WITHOUT explicit LANG check:', withoutLangCheck.length);
withoutLangCheck.forEach(f => console.log(f.lineNum + ': ' + f.text));
