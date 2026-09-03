const fs=require('fs');
const html=fs.readFileSync(require('path').resolve(__dirname,'..','index.html'),'utf8');
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.substr(i,2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
const r=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
const vars={}; (html.match(/--c-[a-z]+:\s*#[0-9A-Fa-f]{6}/g)||[]).forEach(m=>{const[k,v]=m.split(/:\s*/);vars[k.replace('--c-','')]=v.toUpperCase();});
const js={}; (html.match(/(\w+):\s*\{\s*\n\s*label:'[^']*',\s*short:'[^']*',\s*hex:'(#[0-9A-Fa-f]{6})'/g)||[])
  .forEach(b=>{js[b.match(/^(\w+)/)[1]]=b.match(/hex:'(#[0-9A-Fa-f]{6})'/)[1].toUpperCase();});
let fail=0;
console.log('TOKEN SYNC (CSS var vs CATEGORIES.hex):');
Object.keys(js).forEach(k=>{const ok=vars[k]===js[k];if(!ok)fail++;console.log('  '+(ok?'match ':'DIVERGED')+' '+k.padEnd(10)+' css='+vars[k]+' js='+js[k]);});
console.log('\nCATEGORY INDICATOR CONTRAST (>= 3.0 vs card #1C2A46):');
Object.keys(js).forEach(k=>{const v=r(js[k],'#1C2A46');if(v<3)fail++;console.log('  '+(v>=3?'PASS':'FAIL')+'  '+v.toFixed(2).padStart(5)+'  '+k);});
console.log('\nTEXT CONTRAST (>= 4.5):');
[['body #EAF0FB on card','#EAF0FB','#1C2A46'],['muted #8FA0C0 on card','#8FA0C0','#1C2A46'],
 ['muted #8FA0C0 on panel','#8FA0C0','#152238'],['cyan #4FA8C9 on panel','#4FA8C9','#152238'],
 ['amber #E39A3E on panel','#E39A3E','#152238'],['danger btn #EAF0FB on #B23A3A','#EAF0FB','#B23A3A'],
 ['primary btn #06131F on #4FA8C9','#06131F','#4FA8C9'],['done-tag #2FB574 on card','#2FB574','#1C2A46']]
.forEach(([n,a,b])=>{const v=r(a,b);if(v<4.5)fail++;console.log('  '+(v>=4.5?'PASS':'FAIL')+'  '+v.toFixed(2).padStart(5)+'  '+n);});
console.log('\n'+(fail?fail+' PROBLEM(S)':'all contrast + sync checks pass'));
process.exit(fail?1:0);
