/* StudentOS — accessible, dependency-free frontend. All data is saved by the API. */
(() => {
  'use strict';
  const TOKEN_KEY = 'studentos_session';
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
  const appState = {token:sessionStorage.getItem(TOKEN_KEY),data:null,page:'overview',filter:'all',search:'',authMode:'login'};
  let toastTimer;

  function todayDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function formatDate(value,opts={month:'short',day:'numeric'}){if(!value)return 'No date';return new Date(`${value}T12:00:00`).toLocaleDateString('en-US',opts);}
  function dayUntil(value){if(!value)return Infinity;const d=new Date(`${value}T00:00:00`);const now=new Date();now.setHours(0,0,0,0);return Math.round((d-now)/86400000);}
  function dateText(value){const days=dayUntil(value);if(days===Infinity)return 'No deadline';if(days===0)return 'Today';if(days===1)return 'Tomorrow';if(days===-1)return 'Yesterday';return formatDate(value);}
  function initials(name){return String(name||'Student').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'S';}
  function nameFirst(){return (appState.data?.user?.name||'Student').split(' ')[0];}
  function course(id){return appState.data?.courses.find(c=>c.id===id)||null;}
  function courseDot(id){const c=course(id);return `<span class="course-dot ${c?.color||'violet'}"></span>`;}
  function taskCourse(task){return course(task.course_id)?.name || 'Personal task';}
  function gpaData(){const graded=appState.data.courses.filter(c=>c.grade!==null&&c.grade!==undefined);const credits=graded.reduce((s,c)=>s+c.credits,0);return {value:credits?graded.reduce((s,c)=>s+points(c.grade)*c.credits,0)/credits:null,credits,graded:graded.length};}
  function taskStats(){const tasks=appState.data.tasks;const completed=tasks.filter(t=>t.status==='done').length;const outstanding=tasks.filter(t=>t.status!=='done');return {completed,total:tasks.length,active:outstanding.length,dueSoon:outstanding.filter(t=>dayUntil(t.due_date)>=0&&dayUntil(t.due_date)<=7).length,overdue:outstanding.filter(t=>dayUntil(t.due_date)<0).length,percent:tasks.length?Math.round(completed/tasks.length*100):0};}
  function dateHeading(){return new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});}
  function welcomeText(){const hour=new Date().getHours();return hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';}
  function sortedTasks(list){return [...list].sort((a,b)=>{const ad=a.due_date||'9999';const bd=b.due_date||'9999';return ad.localeCompare(bd)||b.id-a.id;});}
  const empty = (title,desc,action,label,compact=false) => `<div class="empty-state ${compact?'compact':''}"><div class="empty-icon">${icon('sparkles',26)}</div><h3>${title}</h3><p>${desc}</p>${action?`<button class="btn primary small" data-action="${action}">${icon('plus',14)} ${label}</button>`:''}</div>`;

  async function api(path,{method='GET',body,authorized=true}={}){
    const headers={}; if(body!==undefined) headers['Content-Type']='application/json';
    if(authorized&&appState.token) headers.Authorization=`Bearer ${appState.token}`;
    let response;
    try{response=await fetch(path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});}
    catch{throw Error('Cannot connect to the server. Is StudentOS running?');}
    let data;try{data=await response.json();}catch{data={};}
    if(!response.ok){if(response.status===401&&authorized){signOut(false);}const detail=data.detail;throw Error(typeof detail==='string'?detail:Array.isArray(detail)?detail.map(e=>e.msg).join(', '):`Request failed (${response.status})`);}
    return data;
  }
  function toast(message,error=false){const el=$('toast');el.textContent=message;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3300);}
  function setBusy(button,busy){if(!button)return;button.disabled=busy;button.dataset.original ||= button.innerHTML;if(busy)button.innerHTML='Working…';else button.innerHTML=button.dataset.original;}

  function showAuth(){ $('auth').hidden=false;$('app').hidden=true;$('modalHost').innerHTML='';renderAuth(); }
  function renderAuth(){const register=appState.authMode==='register';$('authTitle').innerHTML=register?'Create your space<span class="dot">.</span>':'Welcome back<span class="dot">.</span>';
    $('authSubtitle').textContent=register?'A smarter semester starts right here.':'Your workspace is right where you left it.';
    $('nameField').hidden=!register;$('authName').required=register;$('authPassword').autocomplete=register?'new-password':'current-password';
    $('authSubmit').innerHTML=register?'Create account <span>→</span>':'Sign in <span>→</span>';
    $('authSwitch').firstChild.textContent=register?'Already have an account? ':'New here? ';
    $('authToggle').textContent=register?'Sign in':'Create an account';
  }
  function signOut(refresh=true){appState.token=null;appState.data=null;sessionStorage.removeItem(TOKEN_KEY);if(refresh)showAuth();else showAuth();}
  async function enter(token){appState.token=token;sessionStorage.setItem(TOKEN_KEY,token);appState.page='overview';await reload();$('auth').hidden=true;$('app').hidden=false;renderAll();}
  async function reload(){appState.data=await api('/api/state');}
  function renderAll(){if(!appState.data)return;renderChrome();renderPage();}
  function renderChrome(){const u=appState.data.user;const i=initials(u.name);$('sidebarAvatar').textContent=i;$('topAvatar').textContent=i;$('sidebarUsername').textContent=u.name;$('topDate').textContent=dateHeading();$('breadcrumb').textContent=labels[appState.page];$('navTaskCount').textContent=String(taskStats().active);document.querySelectorAll('[data-nav]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.nav===appState.page);});}
  function setPage(page){appState.page=page;appState.search='';renderAll();window.scrollTo(0,0);}
  function heading(label,title,subtitle,button){return `<div class="page-heading"><div><div class="eyebrow muted-eyebrow">${esc(label)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${button?`<div class="page-actions">${button}</div>`:''}</div>`;}
  function btn(action,label,small=false,ghost=false){return `<button class="btn ${ghost?'outline':'primary'} ${small?'small':''}" data-action="${action}">${icon('plus',15)} ${esc(label)}</button>`;}
  function statCard(label,value,description,iconName,tag){return `<article class="stat-card"><div class="stat-top"><div class="stat-icon">${icon(iconName)}</div>${tag?`<span class="stat-tag neutral">${esc(tag)}</span>`:''}</div><div class="stat-value">${value}</div><div class="stat-label">${esc(label)} <span style="color:#667086">·</span> ${esc(description)}</div></article>`;}

  function taskRow(t,withActions=false){const isDone=t.status==='done';const overdue=!isDone&&dayUntil(t.due_date)<0;return `<div class="task-row">
    <button aria-label="${isDone?'Mark incomplete':'Mark completed'}" class="task-checkbox ${isDone?'done':''}" data-action="toggle-task" data-id="${t.id}">${isDone?icon('check',14):''}</button>
    <div class="task-body"><div class="task-title ${isDone?'done':''}">${esc(t.title)}</div><div class="task-meta">${courseDot(t.course_id)} <span>${esc(taskCourse(t))}</span> <span>·</span> <span>${t.status==='in_progress'?'In progress':isDone?'Completed':'To do'}</span></div></div>
    ${withActions&&t.priority==='high'&&!isDone?`<span class="priority-dot">High</span>`:''}
    <span class="task-date ${overdue?'overdue':''}">${esc(dateText(t.due_date))}</span>
    ${withActions?`<div class="task-actions"><button class="icon-button" data-action="edit-task" data-id="${t.id}" aria-label="Edit task">${icon('edit')}</button><button class="icon-button" data-action="delete-task" data-id="${t.id}" aria-label="Delete task">${icon('trash')}</button></div>`:''}
    </div>`;}

  function overview(){const s=taskStats(),g=gpaData();const tasks=sortedTasks(appState.data.tasks.filter(t=>t.status!=='done')).slice(0,5);const courses=appState.data.courses.slice(0,4);let sched=appState.data.schedule.slice();const today=(new Date().getDay()+6)%7;sched.sort((a,b)=>((a.day-today+7)%7)-((b.day-today+7)%7)||a.start_time.localeCompare(b.start_time));
    return `${heading('YOUR DASHBOARD',welcomeText()+', '+nameFirst()+' ✳','Here’s what’s happening in your academic world.')}
    <section class="hero"><div class="hero-text"><div class="eyebrow"><span class="live-dot"></span> YOUR ACADEMIC COMMAND CENTER</div><h2>Every big goal starts<br/>with <span>one small step.</span></h2><p>Keep your courses organized, stay ahead of deadlines, and enjoy the progress you’re making.</p></div><div class="hero-mark">FOCUS. LEARN. GROW.</div></section>
    <section class="stats-grid" aria-label="Study statistics">
      ${statCard('Courses',''+appState.data.courses.length,'this semester','book-open')}
      ${statCard('Tasks completed',`${s.completed}<small> / ${s.total}</small>`,'finished so far','check-square')}
      ${statCard('Due in 7 days',''+s.dueSoon,'upcoming deadlines','clock',s.overdue?`${s.overdue} overdue`:null)}
      ${statCard('Estimated GPA',g.value===null?'—':g.value.toFixed(2),g.value===null?'add grades to see':'on a 4.0 scale','graduation')}
    </section>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-head"><h3>Upcoming tasks</h3><button class="panel-link" data-nav="tasks">View all ${icon('arrow-up-right',14)}</button></div>${tasks.length?`<div class="task-list">${tasks.map(t=>taskRow(t)).join('')}</div>`:empty('All caught up!','You have no unfinished tasks. Ready to plan something new?','add-task','Create task',true)}</section>
      <section class="panel pulse-panel"><div class="panel-head"><div><h3>Study pulse</h3><p class="panel-subtitle">Your completion rate</p></div>${icon('target',19)}</div><div class="pulse-content"><div class="donut" style="--degree:${s.percent*3.6}deg"><div class="donut-inner"><strong>${s.percent}%</strong><small>completed</small></div></div><div class="pulse-desc"><strong>${s.total===0?'Fresh start!':s.percent===100?'Amazing work!':'Keep that momentum.'}</strong><p>${s.total===0?'Create a task to start tracking your progress.':`${s.completed} of ${s.total} tasks completed. Every small win counts.`}</p></div></div><div class="pulse-foot"><span>${s.active} tasks remaining</span><strong>${s.percent===100?'All done ✓':'Stay focused ↗'}</strong></div></section>
    </div>
    <div class="bottom-grid">
      <section class="panel"><div class="panel-head"><h3>Your courses</h3><button class="panel-link" data-nav="courses">View all ${icon('arrow-up-right',14)}</button></div>${courses.length?`<div class="mini-courses">${courses.map(c=>`<div class="mini-course"><div class="mini-course-top">${courseDot(c.id)}<span class="course-code">${esc(c.code)}</span></div><strong title="${esc(c.name)}">${esc(c.name)}</strong><div class="mini-course-foot"><span>${c.credits} credits</span><span>${c.grade===null?'No grade':`${Number(c.grade).toFixed(0)}%`}</span></div></div>`).join('')}</div>`:empty('No courses yet','Add a course to organize your academic life.','add-course','Add course',true)}</section>
      <section class="panel"><div class="panel-head"><h3>Next classes</h3><button class="panel-link" data-nav="schedule">Weekly view ${icon('arrow-up-right',14)}</button></div>${sched.length?`<div>${sched.slice(0,3).map(c=>`<div class="upcoming-class"><div class="upcoming-time">${esc(c.start_time)}</div><div><strong>${esc(c.title)}</strong><small>${esc(weekdays[c.day])} · ${esc(c.location||c.type)}</small></div></div>`).join('')}</div>`:empty('An open calendar','Add class sessions to see your week.','add-class','Add class',true)}</section>
    </div>`;}

  function tasksPage(){const tasks=appState.data.tasks;const filtered=sortedTasks(tasks.filter(t=>{if(appState.filter==='upcoming'&&t.status==='done')return false;if(appState.filter==='completed'&&t.status!=='done')return false;const text=`${t.title} ${taskCourse(t)} ${t.notes}`.toLowerCase();return text.includes(appState.search.toLowerCase());}));const filters=[['all','All tasks'],['upcoming','Upcoming'],['completed','Completed']];return `${heading('STAY ON TOP OF IT','My tasks','Turn your big plans into little checkmarks.',btn('add-task','Add task'))}
    <div class="task-controls"><div class="filter-tabs">${filters.map(([val,label])=>`<button class="filter-btn ${appState.filter===val?'active':''}" data-action="filter" data-filter="${val}">${label}</button>`).join('')}</div><div class="search-box">${icon('search')}<input id="taskSearch" aria-label="Search tasks" placeholder="Search your tasks..." value="${esc(appState.search)}"/></div></div>
    <section class="panel task-table-panel">${filtered.length?`<div class="task-list">${filtered.map(t=>taskRow(t,true)).join('')}</div>`:empty(appState.search?'Nothing found':appState.filter==='completed'?'No completed tasks yet':'Your task list is clear',appState.search?'Try a different search.':'Add an assignment, deadline or personal goal.','add-task','Create a task')}</section>`;}

  function coursesPage(){const courses=appState.data.courses,g=gpaData();return `${heading('YOUR LEARNING SPACE','My courses',`${courses.length} course${courses.length===1?'':'s'} · ${g.credits} graded credits`,btn('add-course','Add course'))}
    ${courses.length?`<div class="course-grid">${courses.map(c=>`<article class="course-card" style="--course-accent:${colors[c.color]||colors.violet}"><div class="course-card-top"><div class="color-square">${esc((c.code||'CS').split(' ')[0].slice(0,2).toUpperCase())}</div><div class="course-actions"><button class="icon-button" data-action="edit-course" data-id="${c.id}" title="Edit course" aria-label="Edit ${esc(c.name)}">${icon('edit')}</button><button class="icon-button" data-action="delete-course" data-id="${c.id}" title="Delete course" aria-label="Delete ${esc(c.name)}">${icon('trash')}</button></div></div><h3>${esc(c.name)}</h3><p>${esc(c.code)} ${c.instructor?'· '+esc(c.instructor):''}</p><div class="course-bottom"><span>${c.credits} credits</span>${c.grade===null?`<strong>Not graded</strong>`:`<span class="course-grade-pill">${Number(c.grade).toFixed(0)}% · ${points(c.grade).toFixed(2)} pts</span>`}</div></article>`).join('')}</div>`:empty('Your courses live here','Create your first course and attach tasks, classes and grades to it.','add-course','Add your first course')}
    <div class="info-note">${icon('target',14)} &nbsp; Estimated GPA: <strong>${g.value===null?'Not available yet':g.value.toFixed(2)+'/4.00'}</strong> · Weighted by course credits, using the built-in sample grading scale. This estimate is not an official university GPA. Add current overall percentages when available.</div>`;}

  function schedulePage(){const s=appState.data.schedule;const today=(new Date().getDay()+6)%7;return `${heading('PLAN YOUR WEEK','Weekly schedule',`${s.length} scheduled class${s.length===1?'':'es'} · Find your rhythm.`,btn('add-class','Add class'))}
    <div class="schedule-layout">${weekdays.map((day,n)=>{const entries=s.filter(x=>x.day===n).sort((a,b)=>a.start_time.localeCompare(b.start_time));return `<div class="day-column ${today===n?'today':''}"><div class="day-name">${day.slice(0,3).toUpperCase()} ${today===n?'<span class="today-tag">TODAY</span>':''}</div>${entries.length?entries.map(c=>`<div class="class-card" style="--course-accent:${colors[course(c.course_id)?.color]||colors.violet}"><small>${esc(c.start_time)}–${esc(c.end_time)}</small><strong>${esc(c.title)}</strong><p>${esc(c.location||c.type)}</p><div class="class-buttons"><button data-action="edit-class" data-id="${c.id}">Edit</button><button data-action="delete-class" data-id="${c.id}">Delete</button></div></div>`).join(''):`<div class="day-empty">Free day</div>`}</div>`;}).join('')}</div><div class="info-note">${icon('calendar',14)} &nbsp; Your schedule repeats every week. Add lectures, labs or seminars and keep your timetable in one place.</div>`;}

  function settingsPage(){const u=appState.data.user,s=taskStats();return `${heading('YOUR WORKSPACE','Account settings','Keep your student profile up to date.')}
    <div class="settings-grid"><section class="panel settings-panel"><h3>Personal information</h3><p>Your name is used in your private StudentOS dashboard.</p><form id="profileForm" class="form-stack"><div><label for="profileName">Full name</label><input id="profileName" name="name" value="${esc(u.name)}" required minlength="2" maxlength="70"/></div><div><label for="profileEmail">Email address</label><input id="profileEmail" type="email" value="${esc(u.email)}" disabled/></div><div><button class="btn primary" type="submit">Save changes ${icon('arrow-right',16)}</button></div></form></section>
    <section class="panel settings-panel"><div class="settings-avatar">${esc(initials(u.name))}</div><h3>${esc(u.name)}</h3><p>${esc(u.email)}</p><div class="settings-list"><div><span>My courses</span><strong>${appState.data.courses.length}</strong></div><div><span>Completed tasks</span><strong>${s.completed}</strong></div><div><span>Account type</span><strong>Student</strong></div></div><div style="margin-top:26px"><button class="btn outline full" data-action="logout">${icon('log-out')} Sign out</button></div></section></div>`;}

  function renderPage(){const pages={overview,tasks:tasksPage,courses:coursesPage,schedule:schedulePage,settings:settingsPage};$('content').innerHTML=pages[appState.page]();}

  function courseOptions(selected=null){return `<option value="">Personal / None</option>`+appState.data.courses.map(c=>`<option value="${c.id}" ${selected===c.id?'selected':''}>${esc(c.name)}</option>`).join('');}
  function option(values,selected){return values.map(([val,label])=>`<option value="${esc(val)}" ${String(val)===String(selected)?'selected':''}>${esc(label)}</option>`).join('');}
  function field(label,name,type='text',value='',extra=''){return `<div class="field"><label for="field-${name}">${esc(label)}</label><input id="field-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}/></div>`;}
  function selectField(label,name,options){return `<div class="field"><label for="field-${name}">${esc(label)}</label><select name="${name}" id="field-${name}">${options}</select></div>`;}
  function modal(title,body,kind){$('modalHost').innerHTML=`<div class="modal-backdrop" id="backdrop"><section role="dialog" aria-modal="true" aria-labelledby="modalTitle" class="modal"><div class="modal-header"><h2 id="modalTitle">${esc(title)}</h2><button data-action="close-modal" class="icon-button" aria-label="Close dialog">${icon('x')}</button></div><form id="modalForm" data-kind="${kind}">${body}<div class="modal-footer"><button class="btn outline" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save ${icon('check',15)}</button></div></form></section></div>`;const el=$('modalForm').querySelector('input,select,textarea');if(el)el.focus();}
  function openTask(t=null){const content=`${field('Task title *','title','text',t?.title||'','required minlength="2" maxlength="160" placeholder="e.g. Complete calculus assignment"')}
    ${selectField('Course','course_id',courseOptions(t?.course_id||null))}
    <div class="field-row">${field('Due date','due_date','date',t?.due_date||'')}${selectField('Priority','priority',option([['low','Low'],['medium','Medium'],['high','High']],t?.priority||'medium'))}</div>
    ${selectField('Status','status',option([['todo','To do'],['in_progress','In progress'],['done','Completed']],t?.status||'todo'))}
    <div class="field"><label for="field-notes">Notes</label><textarea id="field-notes" name="notes" maxlength="1000" placeholder="Anything else to remember...">${esc(t?.notes||'')}</textarea></div>`;
    modal(t?'Edit task':'Create a task',content,t?`task:${t.id}`:'task:new');}
  function openCourse(c=null){const content=`${field('Course name *','name','text',c?.name||'','required minlength="2" maxlength="100" placeholder="e.g. Data Structures"')}
    <div class="field-row">${field('Course code *','code','text',c?.code||'','required minlength="2" maxlength="20" placeholder="CS 201"')}${field('Credits','credits','number',c?.credits??3,'required min="1" max="20" step="1"')}</div>
    ${field('Instructor (optional)','instructor','text',c?.instructor||'','maxlength="100" placeholder="Prof. Smith"')}
    <div class="field-row">${field('Overall grade % (optional)','grade','number',c?.grade??'','min="0" max="100" step="0.01" placeholder="e.g. 85"')}${selectField('Color','color',option(Object.keys(colors).map(x=>[x,x[0].toUpperCase()+x.slice(1)]),c?.color||'violet'))}</div>
    <p class="form-help">Enter your current overall course percentage, not a single assignment score.</p>`;
    modal(c?'Edit course':'Add a course',content,c?`course:${c.id}`:'course:new');}
  function openClass(c=null){const content=`${field('Class / event title *','title','text',c?.title||'','required minlength="2" maxlength="100" placeholder="e.g. Web Development Lab"')}
    ${selectField('Course','course_id',courseOptions(c?.course_id||null))}
    <div class="field-row">${selectField('Day','day',option(weekdays.map((x,i)=>[i,x]),c?.day??0))}${selectField('Type','type',option([['Lecture','Lecture'],['Lab','Lab'],['Seminar','Seminar'],['Other','Other']],c?.type||'Lecture'))}</div>
    <div class="field-row">${field('Starts at','start_time','time',c?.start_time||'09:00','required')}${field('Ends at','end_time','time',c?.end_time||'10:30','required')}</div>
    ${field('Room / location','location','text',c?.location||'','maxlength="80" placeholder="e.g. Building A, 305"')}`;
    modal(c?'Edit class':'Add a class',content,c?`schedule:${c.id}`:'schedule:new');}
  function closeModal(){$('modalHost').innerHTML='';}
  async function perform(action,id){const objects=appState.data;
    if(action==='add-task')return openTask();if(action==='add-course')return openCourse();if(action==='add-class')return openClass();
    if(action==='edit-task')return openTask(objects.tasks.find(x=>x.id===id));
    if(action==='edit-course')return openCourse(objects.courses.find(x=>x.id===id));
    if(action==='edit-class')return openClass(objects.schedule.find(x=>x.id===id));
    if(action==='close-modal')return closeModal();
    if(action==='logout'){try{await api('/api/auth/logout',{method:'POST'});}catch{}signOut();return;}
    if(action==='toggle-task'){
      const t=objects.tasks.find(x=>x.id===id);if(!t)return;
      await api(`/api/tasks/${id}`,{method:'PATCH',body:{status:t.status==='done'?'todo':'done'}});await reload();renderAll();return;
    }
    const match=/^delete-(task|course|class)$/.exec(action);
    if(match){const type=match[1],which={task:'tasks',course:'courses',class:'schedule'}[type],val=objects[which].find(x=>x.id===id);if(!val)return;
      const warning=type==='course'?'Deleting this course will unlink its tasks and schedule entries (they will remain saved).':'This cannot be undone.';
      if(!window.confirm(`Delete "${val.title||val.name}"?\n\n${warning}`))return;
      await api(`/api/${which}/${id}`,{method:'DELETE'});await reload();renderAll();toast('Deleted successfully');return;
    }
  }
  async function saveModal(form){const [kind,id]=form.dataset.kind.split(':');const raw=Object.fromEntries(new FormData(form));let payload,resource;
    if(kind==='task'){resource='tasks';payload={title:raw.title.trim(),notes:raw.notes.trim(),due_date:raw.due_date||null,course_id:raw.course_id?Number(raw.course_id):null,priority:raw.priority,status:raw.status};}
    else if(kind==='course'){resource='courses';payload={name:raw.name.trim(),code:raw.code.trim(),instructor:raw.instructor.trim(),credits:Number(raw.credits),grade:raw.grade===''?null:Number(raw.grade),color:raw.color};}
    else {resource='schedule';payload={title:raw.title.trim(),course_id:raw.course_id?Number(raw.course_id):null,day:Number(raw.day),start_time:raw.start_time,end_time:raw.end_time,location:raw.location.trim(),type:raw.type};}
    const button=form.querySelector('button[type=submit]');setBusy(button,true);
    try{await api(`/api/${resource}${id==='new'?'':`/${id}`}`,{method:id==='new'?'POST':'PATCH',body:payload});closeModal();await reload();renderAll();toast(id==='new'?'Created successfully':'Saved changes');}
    catch(e){toast(e.message,true);setBusy(button,false);}
  }
  async function handleAuth(form){const btn=$('authSubmit'),body=Object.fromEntries(new FormData(form));setBusy(btn,true);
    try{const target=appState.authMode==='register'?'register':'login';const result=await api(`/api/auth/${target}`,{method:'POST',body,authorized:false});await enter(result.token);toast(target==='register'?'Welcome to your new workspace!':'Welcome back!');}
    catch(e){toast(e.message,true);}finally{setBusy(btn,false);}
  }
  function bindEvents(){
    document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
    $('authForm').addEventListener('submit',e=>{e.preventDefault();handleAuth(e.currentTarget);});
    $('authToggle').addEventListener('click',()=>{appState.authMode=appState.authMode==='login'?'register':'login';$('authForm').reset();renderAuth();});
    $('demoButton').addEventListener('click',async e=>{setBusy(e.currentTarget,true);try{const result=await api('/api/auth/demo',{method:'POST',authorized:false});await enter(result.token);toast('Demo workspace is ready — try anything!');}catch(err){toast(err.message,true);}finally{setBusy(e.currentTarget,false);}});
    document.addEventListener('click',async e=>{
      if(e.target.id==='backdrop'){closeModal();return;}
      const control=e.target.closest('[data-nav],[data-action]');if(!control)return;
      if(control.dataset.nav){setPage(control.dataset.nav);return;}
      if(control.dataset.action==='filter'){appState.filter=control.dataset.filter;renderPage();return;}
      try{await perform(control.dataset.action,Number(control.dataset.id));}catch(err){toast(err.message,true);}
    });
    document.addEventListener('input',e=>{if(e.target.id==='taskSearch'){const pos=e.target.selectionStart;appState.search=e.target.value;renderPage();const input=$('taskSearch');input?.focus();input?.setSelectionRange(pos,pos);}});
    document.addEventListener('submit',async e=>{if(e.target.id==='modalForm'){e.preventDefault();await saveModal(e.target);}if(e.target.id==='profileForm'){e.preventDefault();const btn=e.target.querySelector('button[type=submit]');setBusy(btn,true);try{await api('/api/me',{method:'PATCH',body:{name:new FormData(e.target).get('name').trim()}});await reload();renderAll();toast('Profile updated');}catch(err){toast(err.message,true);setBusy(btn,false);}}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('backdrop'))closeModal();});
  }
  async function main(){bindEvents();if(!appState.token){showAuth();return;}try{await reload();$('auth').hidden=true;$('app').hidden=false;renderAll();}catch{signOut();}}
  main();
})();
