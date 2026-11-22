const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const m = content.match(/window\.SOLVIX_CONFIG = ({[\s\S]*?});\s*<\/script>/);
const cfg = eval('(' + m[1] + ')');
const DEPTS = cfg.departments, YEARS = cfg.years, PREP = cfg.prepYear;

const NM = {
  'الفرقة الإعدادية': 'Preparatory Year',
  'الفرقة الأولى': 'First Year',
  'الفرقة الثانية': 'Second Year',
  'الفرقة الثالثة': 'Third Year',
  'الفرقة الرابعة': 'Fourth Year',
  'إعدادي': 'Prep Year',
  'أولى': 'First Year',
  'ثانية': 'Second Year',
  'ثالثة': 'Third Year',
  'رابعة': 'Fourth Year'
};
[PREP].concat(YEARS, DEPTS, [].concat(...DEPTS.map((d) => d.programs))).forEach((o) => {
  if (o && o.ar && o.en) {
    NM[o.ar] = o.en;
    NM[o.ar.trim()] = o.en;
    const stripped = o.ar.replace(/^قسم\s+/, '').trim();
    if (stripped && !NM[stripped]) {
      NM[stripped] = o.en.replace(/\s+Department$/i, '').trim();
    }
  }
});

const LANG = 'en';
const nm = (v) => {
  if (!v) return '';
  if (LANG !== 'en') return v;
  const str = String(v).trim();
  if (NM[str]) return NM[str];
  const stripped = str.replace(/^قسم\s+/, '').trim();
  if (NM[stripped]) return NM[stripped];
  return str;
};

const dline = (o) => [nm(o.dept), nm(o.program), nm(o.year)].filter(Boolean).join(' · ');

console.log('Testing Mohamed Ahmed from screenshot:');
console.log(dline({ dept: 'قسم هندسة الاتصالات', year: 'الفرقة الثالثة' }));
console.log('Testing Fahd Ahmed from screenshot:');
console.log(dline({ dept: 'قسم هندسة الاتصالات', year: 'الفرقة الثانية' }));
console.log('Testing Abdallah Abo Elsuod from screenshot:');
console.log(dline({ dept: 'قسم الهندسة الكهربائية', year: 'الفرقة الثانية' }));
console.log('Testing without "قسم":');
console.log(dline({ dept: 'هندسة الاتصالات', year: 'الفرقة الثالثة' }));
console.log('Testing short year:');
console.log(dline({ dept: 'قسم هندسة الاتصالات', year: 'ثالثة' }));
