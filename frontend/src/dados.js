// Dados de aparência e de assuntos, reaproveitados do protótipo do site.
export const ST={v:['Verdadeiro','--v'],f:['Falso','--f'],c:['Em contestação','--c'],s:['Sem consenso','--s'],x:['Superado','--x']};
export const SUB={'Educação':['Matrículas','Creches','Merenda','Evasão'],'Economia':['Feira livre','Empregos','Tarifas','Preços'],'Saneamento':['Esgoto','Água tratada','Coleta de lixo','Caixa d’água'],'Saúde':['Vacinas','Posto 24h','Filas','Consultas'],'Segurança':['Iluminação','Ocorrências','Patrulha','Câmeras'],'Meio Ambiente':['Arborização','Rio Claro','Queimadas','Reciclagem']};
const E=(e,r,t,s=54)=>`<span class="em" style="right:${r}px;top:${t}px;font-size:${s}px">${e}</span>`;
export const T={
'Educação':{a:'#f5f0c8',t:'#12301f',e:'🎓',k:'Escolas, matrículas e aprendizado',g:'linear-gradient(120deg,#16402b,#0c1f16)',p:'repeating-linear-gradient(0deg,#ffffff0d 0 1px,#0000 1px 28px)',b:'#6a4a2a',d:E('📚',60,24,64)+E('✏️',170,60)+E('🎓',250,18,60)+'<span class="giz" style="right:40px;top:118px">2 + 2 = 4</span>',n:187,pv:62},
'Economia':{a:'#e3b93f',t:'#17301f',e:'💰',k:'Dinheiro, preços, empregos e tarifas',g:'linear-gradient(120deg,#1c3a26,#0b140e)',p:'repeating-linear-gradient(45deg,#ffffff0d 0 2px,#0000 2px 10px)',b:'#7a5f16',d:'<div class="nota" style="right:210px;top:14px;--r:-9deg">R$ 100<small>nota de exemplo</small></div><div class="nota" style="right:70px;top:44px;--r:7deg">R$ 50<small>nota de exemplo</small></div><div class="ouro" style="right:150px;top:118px">Au 999</div><div class="ouro" style="right:30px;top:134px">Au 999</div>'+E('🪙',330,96,44),n:214,pv:48},
'Saneamento':{a:'#38bdf8',t:'#06222e',e:'🚰',k:'Água, esgoto e coleta de lixo',g:'linear-gradient(120deg,#0b3a52,#051722)',p:'radial-gradient(circle at 20px 20px,#ffffff12 0 8px,#0000 9px) 0 0/40px 40px',b:'#2d4a5c',d:E('💧',60,20,64)+E('🚰',170,60)+E('🌊',270,14,70)+E('💧',340,96,34),n:156,pv:71},
'Saúde':{a:'#5eead4',t:'#07262a',e:'🩺',k:'Vacinas, postos de saúde e atendimento',g:'linear-gradient(120deg,#0b3d42,#061a1d)',p:'linear-gradient(#ffffff0a 1px,#0000 1px) 0 0/32px 32px,linear-gradient(90deg,#ffffff0a 1px,#0000 1px) 0 0/32px 32px',b:'#3a5a5c',d:E('🩺',60,20,64)+E('💊',170,60)+E('🫀',250,14,60)+'<svg class="ecg" viewBox="0 0 200 40"><polyline points="0,20 40,20 50,4 60,36 70,20 120,20 130,10 140,28 150,20 200,20" fill="none" stroke="#5eead4" stroke-width="2"/></svg>',n:203,pv:66},
'Segurança':{a:'#fbbf24',t:'#0e1424',e:'🛡️',k:'Ocorrências, iluminação e policiamento',g:'linear-gradient(120deg,#18223d,#0a0f1d)',p:'repeating-linear-gradient(-45deg,#fbbf2410 0 10px,#0000 10px 24px)',b:'#3a4560',d:E('🛡️',60,20,64)+E('🚨',170,60)+E('🔒',250,18,56),n:142,pv:44},
'Meio Ambiente':{a:'#84cc16',t:'#0b2412',e:'🌳',k:'Árvores, rios, queimadas e reciclagem',g:'linear-gradient(120deg,#164a22,#08160c)',p:'radial-gradient(circle at 10px 10px,#84cc1620 0 3px,#0000 4px) 0 0/26px 26px',b:'#5a3f24',d:E('🌳',60,20,64)+E('🍃',170,60)+E('🌎',250,14,60),n:168,pv:58}};

ST.w=['Em votação','--w'];
ST.i=['Provisório (IA)','--i'];
ST.r=['Aguardando verificação','--r'];
ST.p=['Parcialmente cumprida','--p'];
SUB['Outros']=['Geral'];
T['Outros']={a:'#a1a1aa',t:'#141418',e:'📌',k:'Registros sem assunto definido',g:'linear-gradient(120deg,#26262e,#121216)',p:'none',b:'#4a4a55',d:E('📌',60,24,60),n:0,pv:0};
export const ASSUNTOS = Object.keys(T).filter((k) => k !== 'Outros');
