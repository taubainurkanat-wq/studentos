/* Shared presentation helpers and academic formatting. */
  const icons = {
    'layout-dashboard':'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    'check-square':'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>',
    'book-open':'<path d="M12 7v14M3 18V4.5A1.5 1.5 0 0 1 4.5 3H7a5 5 0 0 1 5 5 5 5 0 0 1 5-5h2.5A1.5 1.5 0 0 1 21 4.5V18h-4a5 5 0 0 0-5 3 5 5 0 0 0-5-3z"/>',
    'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    'settings':'<path d="M12 15.3a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z"/><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.8l.05.05-1.9 1.9-.05-.05a1.6 1.6 0 0 0-1.8-.32 1.6 1.6 0 0 0-1 1.5V20h-2.7v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.32l-.05.05-1.9-1.9.05-.05a1.6 1.6 0 0 0 .32-1.8 1.6 1.6 0 0 0-1.5-1H6v-2.7h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.32-1.8l-.05-.05 1.9-1.9.05.05a1.6 1.6 0 0 0 1.8.32 1.6 1.6 0 0 0 1-1.5V4h2.7v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.32l.05-.05 1.9 1.9-.05.05a1.6 1.6 0 0 0-.32 1.8 1.6 1.6 0 0 0 1.5 1H20v2.7h-.1a1.6 1.6 0 0 0-1.5 1z" transform="translate(-1 -1)"/>',
    'chevrons-up-down':'<path d="m7 10 5-5 5 5M7 14l5 5 5-5"/>',
    'plus':'<path d="M12 5v14M5 12h14"/>',
    'arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>',
    'arrow-right':'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    'check':'<path d="m5 12 4 4L19 6"/>',
    'x':'<path d="M18 6 6 18M6 6l12 12"/>',
    'edit':'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4z"/>',
    'trash':'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    'search':'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    'graduation':'<path d="m2 10 10-6 10 6-10 6-10-6zM6 13v4c4 4 8 4 12 0v-4M22 10v7"/>',
    'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'target':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    'layers':'<path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
    'sparkles':'<path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3zM19 17v5M16.5 19.5h5"/>',
    'inbox':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l2 3h4l2-3h5"/>',
    'log-out':'<path d="M10 17l5-5-5-5M15 12H3M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
  };
  const icon = (name, size=18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons['sparkles']}</svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  const weekdays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const colors = {violet:'#a99bf9',cyan:'#75d8e0',peach:'#f1bb98',green:'#a7e5ad',pink:'#eea1c3',blue:'#8aa9f1'};
  const labels = {overview:'Overview',tasks:'My tasks',courses:'Courses',schedule:'Schedule',settings:'Settings'};
  const scale = [[95,4],[90,3.67],[85,3.33],[80,3],[75,2.67],[70,2.33],[65,2],[60,1.67],[55,1.33],[50,1],[0,0]];
  const points = grade => scale.find(([threshold]) => Number(grade) >= threshold)[1];
  function todayDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function formatDate(value,opts={month:'short',day:'numeric'}){if(!value)return 'No date';return new Date(`${value}T12:00:00`).toLocaleDateString('en-US',opts);}
  function dayUntil(value){if(!value)return Infinity;const d=new Date(`${value}T00:00:00`);const now=new Date();now.setHours(0,0,0,0);return Math.round((d-now)/86400000);}
  function dateText(value){const days=dayUntil(value);if(days===Infinity)return 'No deadline';if(days===0)return 'Today';if(days===1)return 'Tomorrow';if(days===-1)return 'Yesterday';return formatDate(value);}
  function initials(name){return String(name||'Student').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'S';}
  function dateHeading(){return new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});}
  function welcomeText(){const hour=new Date().getHours();return hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';}
  function sortedTasks(list){return [...list].sort((a,b)=>{const ad=a.due_date||'9999';const bd=b.due_date||'9999';return ad.localeCompare(bd)||b.id-a.id;});}
  const empty = (title,desc,action,label,compact=false) => `<div class="empty-state ${compact?'compact':''}"><div class="empty-icon">${icon('sparkles',26)}</div><h3>${title}</h3><p>${desc}</p>${action?`<button class="btn primary small" data-action="${action}">${icon('plus',14)} ${label}</button>`:''}</div>`;


export { icon, esc, $, weekdays, colors, labels, points, todayDate, formatDate, dayUntil, dateText, initials, dateHeading, welcomeText, sortedTasks, empty };
