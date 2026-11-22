const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const m = content.match(/window\.SOLVIX_CONFIG = ({[\s\S]*?});\s*<\/script>/);
const cfg = eval('(' + m[1] + ')');
const DEPTS = cfg.departments, YEARS = cfg.years, PREP = cfg.prepYear;
const NM = {};
[PREP].concat(YEARS, DEPTS, [].concat(...DEPTS.map((d) => d.programs))).forEach((o) => { NM[o.ar] = o.en; });

console.log('NM keys:', Object.keys(NM));
console.log('Test 1:', NM['قسم هندسة الاتصالات']);
console.log('Test 2:', NM['الفرقة الثالثة']);
console.log('Test 3:', NM['قسم الهندسة الكهربائية']);
console.log('Test 4 with trimming:');
const d1 = "قسم هندسة الاتصالات";
const y1 = "الفرقة الثالثة";
console.log('dline simulation:');
const LANG = 'en';
const nm = (v) => (LANG === 'en' && NM[v ? v.trim() : '']) || v || '';
const dline = (o) => [nm(o.dept), nm(o.program), nm(o.year)].filter(Boolean).join(' · ');
console.log('Output without trim:', [NM[d1], NM[y1]]);
