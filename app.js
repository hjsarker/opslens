/* OpsLens, a static and reproducible incident analytics demonstration. */
(() => {
  'use strict';
  const iconPaths={
    overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    tickets:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h10M7 14h7"/>',
    shield:'<path d="m12 22 7-4V6l-7-4-7 4v12l7 4Z"/><path d="m9 12 2 2 4-4"/>',
    chart:'<path d="M3 3v18h18M7 17l5-6 3 2 5-8"/>',
    database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    alert:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 18h.01"/>',
    trend:'<path d="m2 17 6-6 5 4 9-10M16 5h6v6"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M5 17v3h14v-3"/>',
    arrow:'<path d="m5 12 14 0m-6-6 6 6-6 6"/>',
    chevron:'<path d="m15 18-6-6 6-6"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    close:'<path d="M5 5 19 19M19 5 5 19"/>',
    file:'<path d="M14 2H6v20h12V8l-4-6Z"/><path d="M14 2v6h4M9 13h6M9 17h6"/>',
    check:'<path d="M4 12l5 5L20 6"/>',
    building:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h2M14 8h2M8 12h2M14 12h2M10 21v-5h4v5"/>',
    layers:'<path d="m12 2 10 6-10 6L2 8l10-6ZM2 12l10 6 10-6M2 16l10 6 10-6"/>',
    external:'<path d="M13 5h6v6M19 5l-9 9M19 14v5H5V5h5"/>',
    activity:'<path d="M2 12h4l3-8 5 16 3-8h5"/>',
  };
  const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.info}</svg>`;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=new Intl.NumberFormat('en-US');
  const localTime=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'});
  const localDate=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Europe/Berlin'});
  const shortMonth=new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'Europe/Berlin'});
  const pct=n=>`${Number.isFinite(n)?n.toFixed(1):'0.0'}%`;
  const msHour=60*60*1000,dayMs=24*msHour;
  let dataset=null,REPORTS=null,INCIDENTS=[],BY_ID=new Map(),ASOF=0;
  const state={page:'overview',range:90,search:'',priority:'all',status:'all',category:'all',sla:'all',sort:'openedAt',sortDesc:true,index:0,perPage:12,lastPage:'incidents',mobileOpen:false,team:'all',issue:'',service:'',openOnly:false,riskOnly:false,resolvedOnly:false,policyPriority:'P3',policyHours:16};
  const nav=[['overview','Overview','overview'],['incidents','Incident explorer','tickets'],['sla','SLA monitor','shield'],['insights','Service insights','chart'],['quality','Data quality','database'],['methodology','Methodology','info']];
  const titleFor={overview:'Operations overview',incidents:'Incident explorer',sla:'SLA monitor',insights:'Service insights',quality:'Data quality',methodology:'Methodology',detail:'Incident detail'};
  const labelFor={overview:'SERVICE INTELLIGENCE',incidents:'INCIDENT MANAGEMENT',sla:'SERVICE PERFORMANCE',insights:'OPERATIONAL PATTERNS',quality:'DATA ASSURANCE',methodology:'DOCUMENTATION',detail:'INCIDENT LIFECYCLE'};
  const scopes={30:'Last 30 days',90:'Last 90 days',365:'Last 12 months',0:'All history'};
  const fromDate=()=>state.range?ASOF-state.range*dayMs:0;
  const report=()=>REPORTS.ranges[String(state.range)];
  const openExplorer=(options={})=>{
    Object.assign(state,{team:'all',issue:'',service:'',priority:'all',status:'all',category:'all',sla:'all',search:'',openOnly:false,riskOnly:false,resolvedOnly:false,index:0},options);
    go('incidents');window.scrollTo(0,0);
  };
  const detailsLink=(label,incidentId)=>`<button class="text-action" data-incident="${esc(incidentId)}">${esc(label)} ${icon('arrow',12)}</button>`;
  const isWithin=(iso)=>!!iso&&Date.parse(iso)>=fromDate()&&Date.parse(iso)<=ASOF;
  const metricResolved=()=>INCIDENTS.filter(i=>i.resolvedAt&&isWithin(i.resolvedAt));
  const scopeOpened=()=>INCIDENTS.filter(i=>isWithin(i.openedAt));
  const openIncidents=()=>INCIDENTS.filter(i=>!i.resolvedAt);
  const getMetric=(id)=>BY_ID.get(id);
  const statusTone=status=>['Breached'].includes(status)?'bad':['Critical','On Hold'].includes(status)?'warn':['At risk'].includes(status)?'warn':['Met','Closed','Resolved'].includes(status)?'good':['On track','In Progress'].includes(status)?'blue':'neutral';
  const priorityTone=p=>p==='P1'?'bad':p==='P2'?'warn':'neutral';
  const statusTag=(label,tone=statusTone(label))=>`<span class="pill ${tone}"><i></i>${esc(label)}</span>`;
  const sum=(arr,fn)=>arr.reduce((a,x)=>a+fn(x),0);
  const average=(arr,fn)=>arr.length?sum(arr,fn)/arr.length:0;
  const countBy=(arr,key)=>arr.reduce((a,x)=>(a[key(x)]=(a[key(x)]||0)+1,a),{});
  const ranked=(obj)=>Object.entries(obj).sort((a,b)=>b[1]-a[1]);
  const dateStr=(s,full=false)=>!s?'Not resolved':(full?localTime:localDate).format(new Date(s));
  const hrs=m=>m==null?'—':m>=60?`${(m/60).toFixed(1)}h`:`${Math.round(m)}m`;
  const overdueLabel=i=>{const mins=Math.max(0,(ASOF-Date.parse(i.slaDueAt))/60000);return mins>=2880?`${(mins/1440).toFixed(0)}d overdue`:`${Math.max(1,Math.round(mins/60))}h overdue`;};
  const isOpen=i=>!i.resolvedAt;
  const route=()=>{
    const hash=decodeURIComponent(location.hash.slice(1));
    const page=hash.split('/').filter(Boolean)[0]||'overview';
    state.page=page==='incident'?'detail':nav.some(n=>n[0]===page)?page:'overview';
    state.detailId=state.page==='detail'?(hash.split('/')[2]||null):null;
    state.mobileOpen=false;
    render();
  };
  const go=(page)=>{location.hash=page.startsWith('incident/')?`#/${page}`:`#/${page}`;if(location.hash===`#/${page}`)route();};
  const header=()=>`<div class="mobile-overlay ${state.mobileOpen?'open':''}" data-action="menu-close"></div>
    <div class="shell">
      <aside class="sidebar ${state.mobileOpen?'open':''}" aria-label="Main navigation">
        <div class="brand"><div class="brand-mark">${icon('activity',26)}</div><div><div class="brand-name">OpsLens<span style="color:#77a7f6">.</span></div><div class="brand-sub">SERVICE INTELLIGENCE</div></div><button class="sidebar-close" data-action="menu-close" aria-label="Close menu">${icon('close')}</button></div>
        <div class="side-label">WORKSPACE</div>
        <nav class="nav-list">${nav.map(([id,label,ico])=>`<button class="nav-link ${(state.page===id||state.page==='detail'&&id==='incidents')?'active':''}" data-page="${id}" aria-current="${state.page===id?'page':'false'}">${icon(ico)}${esc(label)}${id==='incidents'?'<span class="nav-dot">3.2k</span>':''}</button>`).join('')}</nav>
        <div class="sidebar-bottom"><div class="data-pill"><i class="pulse"></i>SYNTHETIC DEMONSTRATION</div><p>Designed for IT operations and analytics. No real employee, customer or employer ticket data.</p><a class="side-source" href="./README.md" target="_blank" rel="noopener">${icon('file',15)} Project documentation ${icon('external',12)}</a></div>
      </aside>
      <div class="workspace"><header class="topbar"><button class="menu-button" data-action="menu-open" aria-label="Open navigation">${icon('menu')}</button><div class="crumb"><span>Workspace</span><span>/</span><strong>${esc(titleFor[state.page])}</strong></div><div class="top-actions"><div class="snapshot">${icon('clock',14)} Snapshot: ${dateStr(dataset.meta.asOf)}</div><div class="demo-tag"><i></i>DEMO DATA</div></div></header><main class="main" id="main-content" tabindex="-1">${pageContent()}<footer class="footer"><span>© 2026 OpsLens · Independent ITSM analytics portfolio project</span><span>All incidents are synthetic · <a href="#/methodology">Data & methodology</a></span></footer></main></div>
    </div>`;
  const pageHead=(title,subtitle,controls='')=>`<div class="page-head"><div><div class="eyebrow">${labelFor[state.page]}</div><h1 class="page-title">${title}</h1><p class="page-lead">${subtitle}</p></div>${controls?`<div class="head-controls">${controls}</div>`:''}</div>`;
  const rangeSelect=()=>`<div class="segmented" role="group" aria-label="Reporting date range">${[30,90,365,0].map(v=>`<button type="button" data-range="${v}" class="segment ${state.range===v?'active':''}" aria-pressed="${state.range===v}">${v===0?'All':v===365?'12M':`${v}D`}</button>`).join('')}</div>`;
  const kpi=(name,value,description,ico,tone='',action='')=>{
    const tag=action?'button':'div';const attribute=action?` type="button" data-action="${action}" aria-label="${esc(name)}. ${esc(description)}. Open supporting incidents"`:'';
    return `<${tag} class="surface kpi ${action?'kpi-button':''}"${attribute}><div class="kpi-top"><span class="kpi-title">${name}</span><span class="kpi-icon ${tone}">${icon(ico)}</span></div><div class="kpi-value">${value}</div><div class="kpi-foot">${description}</div></${tag}>`;
  };
  const sectionHeader=(title,desc,tool)=>`<div class="section-top"><div><h2>${title}</h2>${desc?`<p>${desc}</p>`:''}</div>${tool||''}</div>`;
  function chartModel(records){
    const end=new Date(ASOF);const bucketCount=state.range===30?10:state.range===90?12:state.range===365?12:13;
    const step=state.range===30?3:state.range===90?8:30;
    const list=[];
    for(let n=bucketCount-1;n>=0;n--){
      const start=ASOF-(n+1)*step*dayMs,end=ASOF-n*step*dayMs;
      const created=INCIDENTS.filter(i=>Date.parse(i.openedAt)>=start&&Date.parse(i.openedAt)<end).length;
      const resolved=INCIDENTS.filter(i=>i.resolvedAt&&Date.parse(i.resolvedAt)>=start&&Date.parse(i.resolvedAt)<end).length;
      const label=state.range===30||state.range===90?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',timeZone:'Europe/Berlin'}).format(new Date(end)):shortMonth.format(new Date(end));
      list.push({label,created,resolved});
    }
    return list;
  }
  const lineChart=()=>{
    const values=chartModel();const w=680,h=240,pad={l:39,r:12,t:21,b:32},plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b;
    const yMax=Math.max(20,Math.ceil(Math.max(...values.map(x=>Math.max(x.created,x.resolved)))/20)*20);
    const xy=(i,v)=>[pad.l+i*(plotW/(values.length-1)),pad.t+plotH-v/yMax*plotH];
    const path=key=>values.map((d,i)=>{const [x,y]=xy(i,d[key]);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`}).join(' ');
    const fillPath=path('created')+` L${pad.l+plotW},${pad.t+plotH} L${pad.l},${pad.t+plotH} Z`;
    const ticks=[0,.25,.5,.75,1].map(t=>`<line class="chart-line" x1="${pad.l}" x2="${w-pad.r}" y1="${pad.t+plotH*(1-t)}" y2="${pad.t+plotH*(1-t)}"/><text class="chart-label" x="${pad.l-10}" y="${pad.t+plotH*(1-t)+3}" text-anchor="end">${Math.round(yMax*t)}</text>`).join('');
    const labels=values.map((d,i)=>i%Math.max(1,Math.ceil(values.length/6))===0||i===values.length-1?`<text class="chart-label" text-anchor="middle" x="${xy(i,0)[0]}" y="${h-6}">${esc(d.label)}</text>`:'').join('');
    return `<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Incident creation and resolution trends; see the incident table for exact records"><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f88f1" stop-opacity=".26"/><stop offset="1" stop-color="#4f88f1" stop-opacity="0"/></linearGradient></defs>${ticks}<path class="chart-area" d="${fillPath}"/><path class="chart-stroke" d="${path('created')}"/><path class="chart-stroke secondary" d="${path('resolved')}"/>${labels}</svg></div><div class="legend"><span><i></i>Created</span><span><i class="teal"></i>Resolved</span></div>`;
  };
  const barList=(entries,limit=7)=>{
    const records=entries.slice(0,limit),max=Math.max(1,...records.map(x=>x[1]));
    return `<div class="vertical-bars">${records.map(([label,val])=>`<div class="bar-row"><span class="bar-name" title="${esc(label)}">${esc(label)}</span><div class="bar-track" aria-label="${esc(label)}: ${val}"><span class="bar-fill" style="width:${(val/max*100).toFixed(1)}%"></span></div><span class="bar-number">${fmt.format(val)}</span></div>`).join('')}</div>`;
  };
  const donut=items=>{
    const pri=['P1','P2','P3','P4'],colors=['#e37a80','#e8bb6d','#4681eb','#94a9c6'];
    let begin=0;
    const total=sum(pri,p=>items[p]||0)||1;
    const stops=pri.map((p,i)=>{const degree=(items[p]||0)/total*360;const ret=`${colors[i]} ${begin}deg ${begin+degree}deg`;begin+=degree;return ret;}).join(',');
    return `<div class="priority-ring"><div class="donut" style="background:conic-gradient(${stops})"><div class="donut-inner"><b>${fmt.format(total)}</b><small>incidents</small></div></div><div class="priority-legend">${pri.map((p,i)=>`<div class="priority-row"><span><i style="background:${colors[i]}"></i>${p} ${['Critical','High','Medium','Low'][i]}</span><b>${Math.round((items[p]||0)/total*100)}%</b></div>`).join('')}</div></div>`;
  };
  const activeRisk=()=>openIncidents().filter(i=>['Critical','At risk','Breached'].includes(i.slaStatus)).sort((a,b)=>b.slaPercent-a.slaPercent);

  const backlogChart=()=>{
    const history=REPORTS.backlogDaily;
    const n=state.range||365;
    const values=history.slice(-Math.min(n+1,history.length));
    const sampled=values.filter((_,i)=>i%Math.max(1,Math.ceil(values.length/52))===0||i===values.length-1);
    const width=740,height=170,pad=22;
    const max=Math.max(10,...sampled.map(x=>x.count));
    const path=sampled.map((x,i)=>`${i?'L':'M'}${(pad+i*(width-2*pad)/Math.max(1,sampled.length-1)).toFixed(1)},${(height-pad-x.count/max*(height-2*pad)).toFixed(1)}`).join(' ');
    const first=sampled[0],last=sampled.at(-1);
    return `<div class="history-wrap"><svg class="history-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Historical backlog from ${esc(first.date)} to ${esc(last.date)}. Ending backlog ${last.count} incidents.">
      <path d="M${pad} ${height-pad} H${width-pad}" stroke="#dbe5f2" stroke-width="1.4"/>
      <path d="${path}" fill="none" stroke="#376ce5" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="${pad}" y="16" fill="#7286a4" font-size="11">${fmt.format(max)} tickets maximum</text>
      <circle cx="${width-pad}" cy="${height-pad-last.count/max*(height-2*pad)}" r="5" fill="#376ce5"/>
      <text x="${pad}" y="${height-3}" fill="#8492aa" font-size="10">${esc(first.date)}</text>
      <text x="${width-pad}" y="${height-3}" text-anchor="end" fill="#8492aa" font-size="10">${esc(last.date)} · ${last.count} open</text>
      </svg><div class="history-summary"><span>Based on each day's ticket creation and final resolution timestamps, not today's status copied backward.</span><button class="text-action" data-action="drill-open">Inspect open tickets ${icon('arrow',13)}</button></div></div>`;
  };
  const teamTable=()=>{
    const rows=report().teams;
    return `<div class="table-wrap"><table class="table analytical-table"><thead><tr><th scope="col">Resolver team</th><th scope="col">Opened</th><th scope="col">Resolved</th><th scope="col">SLA met</th><th scope="col">MTTR</th><th scope="col">Mean transfers</th></tr></thead><tbody>${rows.map(r=>`<tr><td><button class="incident-link" data-team="${esc(r.name)}" title="Show incidents assigned to ${esc(r.name)}">${esc(r.name)} ${icon('arrow',12)}</button></td><td>${r.opened}</td><td>${r.resolved}</td><td>${r.compliance===null?'—':pct(r.compliance)}</td><td>${r.resolved?hrs(r.mttrMinutes):'—'}</td><td>${r.avgTransfers.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`;
  };
  const serviceTable=()=>{
    const rows=report().services;
    return `<div class="table-wrap"><table class="table analytical-table"><thead><tr><th>Service</th><th>Opened</th><th>Resolved</th><th>SLA compliance</th><th>Mean resolution</th></tr></thead><tbody>${rows.map(r=>`<tr><td><button class="incident-link" data-service="${esc(r.name)}">${esc(r.name)} ${icon('arrow',12)}</button><small class="table-context">${esc(r.category)}</small></td><td>${r.opened}</td><td>${r.resolved}</td><td>${r.compliance===null?'—':pct(r.compliance)}</td><td>${r.resolved?hrs(r.mttrMinutes):'—'}</td></tr>`).join('')}</tbody></table></div>`;
  };

  function overview(){
    const stats=report(),risks=activeRisk(),categories=stats.categories.map(x=>[x.name,x.count]);
    const priorities=Object.fromEntries(stats.priorities.map(x=>[x.name,x.count]));
    const scopedSummary=`${scopes[state.range]} · ${fmt.format(stats.resolved)} eligible resolutions · calculated with SQL`;
    return `${pageHead('Operations overview','Incident performance, historical workload and resolution efficiency, backed by reproducible SQL.',rangeSelect())}
      <div class="kpis">${kpi('Open incidents',fmt.format(REPORTS.current.open),'Current backlog at snapshot','tickets','','drill-open')}${kpi('SLA compliance',stats.compliance==null?'—':pct(stats.compliance),'Resolutions in selected period','shield','green','drill-compliant')}${kpi('Mean resolution time',hrs(stats.mttrMinutes),'Calendar time · resolved in period','clock','','drill-resolved')}${kpi('Incidents needing attention',fmt.format(REPORTS.current.attention),'Open at risk, critical or breached','alert','amber','drill-risk')}</div>
      <div class="grid-main"><section class="surface">${sectionHeader('Incident activity','Created and resolved over the selected reporting window',`<span class="section-tool">${icon('chart',14)} Ticket volume</span>`)}${lineChart()}</section><section class="surface">${sectionHeader('Service categories','Incidents opened in selected reporting period')}${barList(categories)}</section></div>
      <section class="surface analytics-block">${sectionHeader('Historical backlog','SQL reconstruction of unresolved tickets for each reporting day')}${backlogChart()}</section>
      <div class="grid-bottom"><section class="surface">${sectionHeader('Priority distribution','Incidents opened in the selected period')}${donut(priorities)}</section><section class="surface">${sectionHeader('At-risk workload','Open incidents with the highest SLA consumption',`<button class="section-tool" data-page="sla">View all ${icon('arrow',14)}</button>`)}<div class="risk-list">${risks.length?risks.slice(0,4).map(i=>`<div class="risk-row" role="button" tabindex="0" data-incident="${i.id}"><div><strong>${i.id} · ${esc(i.summary)}</strong><small>${esc(i.team)} · ${esc(i.priority)}</small></div><span>${i.slaStatus==='Breached'?overdueLabel(i):`${Math.round(i.slaPercent)}% used`}</span></div>`).join(''):'<div class="empty">No incidents are currently at risk.</div>'}</div></section></div>
      <section class="surface analytics-block">${sectionHeader('Resolver team SLA performance','Team-level volume, completed resolutions and response outcomes')}${teamTable()}</section>
      <div class="notice">${icon('info')}<span><strong>How to read this dashboard:</strong> Open backlog and at-risk tickets are measured at the fixed snapshot date. Resolution-time and compliance KPIs use incidents resolved during the selected range. ${esc(scopedSummary)}. All data is synthetic.</span></div>`;
  }
  const filterRows=(mode)=>{
    let rows=mode==='sla'?INCIDENTS.slice():scopeOpened();
    const query=state.search.trim().toLowerCase();
    if(query)rows=rows.filter(i=>[i.id,i.summary,i.category,i.service,i.team].some(v=>String(v).toLowerCase().includes(query)));
    if(state.priority!=='all')rows=rows.filter(i=>i.priority===state.priority);
    if(state.status!=='all')rows=rows.filter(i=>i.status===state.status);
    if(state.category!=='all')rows=rows.filter(i=>i.category===state.category);
    if(state.sla!=='all')rows=rows.filter(i=>i.slaStatus===state.sla);
    if(state.team!=='all')rows=rows.filter(i=>i.team===state.team);
    if(state.service)rows=rows.filter(i=>i.service===state.service);
    if(state.issue)rows=rows.filter(i=>i.summary===state.issue);
    if(state.openOnly)rows=rows.filter(i=>!i.resolvedAt);
    if(state.resolvedOnly)rows=rows.filter(i=>i.resolvedAt&&isWithin(i.resolvedAt));
    if(state.riskOnly)rows=rows.filter(i=>!i.resolvedAt&&['At risk','Critical','Breached'].includes(i.slaStatus));
    rows.sort((a,b)=>{
      const v1=a[state.sort]??'',v2=b[state.sort]??'';
      const val=typeof v1==='number'&&typeof v2==='number'?v1-v2:String(v1).localeCompare(String(v2));
      return state.sortDesc?-val:val;
    });
    return rows;
  };
  const selectField=(id,options,val)=>`<select class="field" id="${id}" aria-label="${id.replace('-',' ')} filter"><option value="all">${id==='category'?'All services':id==='priority'?'All priorities':id==='status'?'All statuses':'All SLA states'}</option>${options.map(o=>`<option value="${esc(o)}" ${val===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  const toolbar=(mode)=>`<div class="toolbar"><label class="search-field">${icon('search',16)}<input id="search-incidents" type="search" value="${esc(state.search)}" placeholder="Search incident ID, issue, team…" aria-label="Search incidents"></label>${selectField('priority',['P1','P2','P3','P4'],state.priority)}${mode==='sla'?selectField('sla',['Breached','Critical','At risk','On track','Met'],state.sla):selectField('status',['New','In Progress','On Hold','Resolved','Closed'],state.status)}${selectField('category',Object.keys(countBy(INCIDENTS,i=>i.category)).sort(),state.category)}<button class="outline-btn" data-action="export">${icon('download',14)} Export filtered CSV</button><button class="outline-btn" data-action="reset">Reset</button></div>`;
  const sortedCol=(key,label)=>`<th class="sortable" data-sort="${key}" aria-sort="${state.sort===key?(state.sortDesc?'descending':'ascending'):'none'}">${label}${state.sort===key?state.sortDesc?' ↓':' ↑':''}</th>`;
  const renderTable=(rows,mode)=>{
    const total=rows.length, pages=Math.max(1,Math.ceil(total/state.perPage));
    state.index=Math.min(state.index,pages-1);
    const displayed=rows.slice(state.index*state.perPage,(state.index+1)*state.perPage);
    const headers=`<tr>${sortedCol('id','Incident ID')}<th>Summary</th>${sortedCol('priority','Priority')}<th>Category / Service</th>${sortedCol('team','Resolver team')}${sortedCol('openedAt','Opened')}${mode==='sla'?sortedCol('slaPercent','SLA used'):sortedCol('status','Status')}<th>SLA</th></tr>`;
    const body=displayed.map(i=>`<tr><td><button class="incident-link" data-incident="${i.id}">${i.id}</button></td><td class="summary-cell" title="${esc(i.summary)}">${esc(i.summary)}</td><td>${statusTag(i.priority,priorityTone(i.priority))}</td><td>${esc(i.category)}</td><td>${esc(i.team)}</td><td>${dateStr(i.openedAt)}</td><td>${mode==='sla'?i.slaStatus==='Breached'?'Over target':`${i.slaPercent}%`:statusTag(i.status)}</td><td>${statusTag(i.slaStatus)}</td></tr>`).join('');
    return `<div class="table-wrap"><table class="table"><thead>${headers}</thead><tbody>${body||`<tr><td colspan="9"><div class="empty"><strong>No incidents found</strong><p>Try a broader search or reset the filters.</p></div></td></tr>`}</tbody></table></div><div class="pagination"><span>Showing ${total?fmt.format(state.index*state.perPage+1):0}–${fmt.format(Math.min(total,(state.index+1)*state.perPage))} of ${fmt.format(total)} incidents</span><div class="pager-actions"><button data-action="prev" ${state.index===0?'disabled':''}>Previous</button><button data-action="next" ${state.index>=pages-1?'disabled':''}>Next</button></div></div>`;
  };
  const investigationFilters=()=>state.team!=='all'||state.service||state.issue||state.openOnly||state.resolvedOnly||state.riskOnly?`<div class="investigation-chip"><strong>Investigation filter:</strong> ${esc([state.team!=='all'&&state.team,state.service,state.issue,state.openOnly&&'Unresolved only',state.resolvedOnly&&'Resolved in period',state.riskOnly&&'At-risk workload'].filter(Boolean).join(' · '))}<button data-action="reset">Clear investigation filter ×</button></div>`:'';
  const incidentsPage=()=>`${pageHead('Incident explorer','Search, filter and investigate the records behind the reporting metrics.',rangeSelect())}<section class="surface">${sectionHeader('Incident records','Select any incident number to see its lifecycle and SLA details')}${investigationFilters()}${toolbar('incidents')}<div id="table-zone">${renderTable(filterRows('incidents'),'incidents')}</div></section><p class="meta-note">Date range filters incidents by opening date, except drill-downs from a resolution KPI. All records, events and assignments are simulated.</p>`;
  const slaPage=()=>{
    const opened=openIncidents(),resolved=report(),breach=REPORTS.current.breached;
    const p=state.policyPriority,base=dataset.meta.slaRules[p];
    const original=base.minutes/60,example=opened.find(i=>i.priority===p)||INCIDENTS.find(i=>i.priority===p);
    const whatifUsed=example?example.slaUsedMin:0;
    const whatifPercent=100*whatifUsed/(Math.max(.5,state.policyHours)*60);
    const whatifStatus=whatifPercent>100?'Breached':whatifPercent>=90?'Critical':whatifPercent>=75?'At risk':'On track';
    return `${pageHead('SLA monitor','Monitor deadlines and experiment with transparent demonstration policies.',rangeSelect())}<div class="kpis">${kpi('Open SLA breaches',fmt.format(breach),'Unresolved beyond target','alert','red')}${kpi('Approaching deadline',fmt.format(opened.filter(i=>['At risk','Critical'].includes(i.slaStatus)).length),'75% or more consumed','clock','amber')}${kpi('Resolved within SLA',resolved.compliance===null?'—':pct(resolved.compliance),'SQL: resolved during selected period','shield','green')}${kpi('Resolved in scope',fmt.format(resolved.resolved),'Eligible resolution denominator','tickets')}</div>
      <div class="rules-grid">${Object.entries(dataset.meta.slaRules).map(([priority,v])=>`<div class="surface rule-card"><h3>${priority} · ${({P1:'Critical',P2:'High',P3:'Medium',P4:'Low'})[priority]}</h3><strong>${v.schedule==='24/7'?`${v.minutes/60} hours`:`${v.minutes/60} business hours`}</strong><small>${v.schedule==='business'?'Weekdays 09:00–17:00, NRW holidays excluded':'Calendar hours, 24/7'}</small></div>`).join('')}</div>
      <section class="surface analytics-block">${sectionHeader('Policy lab','What-if example. Changes here do not alter historical incident records or KPI denominators.')}<div class="policy-lab"><label>Priority<select class="field" id="policy-priority">${Object.keys(dataset.meta.slaRules).map(i=>`<option value="${i}" ${p===i?'selected':''}>${i}</option>`).join('')}</select></label><label>Example resolution target (hours)<input class="field" type="number" id="policy-hours" min="0.5" max="200" step="0.5" value="${state.policyHours}"></label><div class="policy-result"><strong>${example?example.id:'No example'}</strong><span>Current configured target: ${original}h. Example consumption at ${state.policyHours}h: ${whatifPercent.toFixed(1)}%</span>${statusTag(whatifStatus)}</div></div><p class="policy-disclaimer">This is a consumption sensitivity test using the selected example's existing eligible elapsed minutes. Holiday or work-schedule changes require regenerating the dataset, and changing the target here does not recompute an incident's deadline.</p></section>
      <section class="surface">${sectionHeader('SLA incident register','Inspect open breaches and resolution outcomes against the published policy')}${toolbar('sla')}<div id="table-zone">${renderTable(filterRows('sla'),'sla')}</div></section><p class="meta-note">Time is measured in Europe/Berlin. P3/P4 exclude configured NRW statutory holidays; on-hold intervals pause consumption. SLA targets are illustrative and do not represent any employer contract.</p>`;
  };
  const insightsPage=()=>{
    const opened=scopeOpened(),stats=report();
    const categories=stats.categories.map(x=>[x.name,x.count]);
    const issueCounts=stats.issues.map(x=>[x.name,x.count]);
    const teamCounts=stats.teams.map(x=>[x.name,x.opened]);
    const reassigned=opened.filter(i=>i.reassignments>=1).length;
    const multiple=opened.filter(i=>i.reassignments>=2).length;
    const topTeam=stats.teams[0]?.name||'—';
    return `${pageHead('Service insights','Explore repeated issues, resolver workloads and service performance using SQL aggregates.',rangeSelect())}
      <div class="kpis">${kpi('Recurring issue types',fmt.format(stats.issues.length),'Most frequent normalized service + summary pairs','layers')}${kpi('Incidents reassigned',pct(opened.length?reassigned/opened.length*100:0),'Tickets opened within selected period','arrow')}${kpi('Multiple team transfers',fmt.format(multiple),'Two or more recorded transfers','alert','amber')}${kpi('Highest volume team',esc(topTeam.split(' ')[0]),esc(topTeam),'building')}</div>
      <div class="insights-layout"><section class="surface">${sectionHeader('Recurring incident descriptions','Frequency of repeated synthetic issue summaries')}${barList(issueCounts,10)}</section><section class="surface">${sectionHeader('Resolver team workload','Assigned team of tickets opened in period')}${barList(teamCounts,7)}</section></div>
      <section class="surface analytics-block">${sectionHeader('Service performance','Select a service name to investigate its underlying incidents')}${serviceTable()}</section>
      <section class="surface analytics-block">${sectionHeader('Recurring issue investigations','Select an issue to inspect related ticket records. These are possible patterns, not proven causes.')}
        <div class="issue-list investigation-list">${stats.issues.slice(0,12).map(row=>`<div class="issue-item"><div><button class="issue-link" data-issue="${esc(row.name)}" data-service="${esc(row.service)}">${esc(row.name)} ${icon('arrow',13)}</button><p>${esc(row.service)} · ${row.avgTransfers.toFixed(1)} mean resolver-group transfers</p></div><b>${fmt.format(row.count)} tickets</b></div>`).join('')}</div></section>
      <div class="notice">${icon('info')}<span><strong>Interpretation:</strong> These patterns come from SQL aggregations on a fixed synthetic dataset. Similar text does not establish a common root cause.</span></div>`;
  };
  function checks(){
    const ids=new Set(),duplicate=[],badDates=[],missing=[],badEvent=[],invalid=[],future=[];
    const states=new Set(['New','In Progress','On Hold','Resolved','Closed']);
    for(const i of INCIDENTS){
      if(ids.has(i.id))duplicate.push(i.id);ids.add(i.id);
      if(!i.id||!i.priority||!i.category||!i.team||!i.service)missing.push(i.id);
      if(!states.has(i.status)||!dataset.meta.slaRules[i.priority])invalid.push(i.id);
      if(i.resolvedAt&&(Date.parse(i.resolvedAt)<Date.parse(i.openedAt)))badDates.push(i.id);
      if(Date.parse(i.openedAt)>ASOF||(i.resolvedAt&&Date.parse(i.resolvedAt)>ASOF))future.push(i.id);
      if(!i.events||!i.events.length||i.events[0].type!=='created'||i.events.some((e,j)=>Date.parse(e.at)<Date.parse(i.openedAt)||j&&Date.parse(e.at)<Date.parse(i.events[j-1].at)))badEvent.push(i.id);
    }
    return [
      ['Unique incident IDs','No duplicate incident identifiers',duplicate],
      ['Required fields','All incidents have service, team, priority and identifiers',missing],
      ['Lifecycle states','All statuses and SLA policies are recognized',invalid],
      ['Chronological resolution','Resolution must follow incident opening',badDates],
      ['Snapshot integrity','No created or resolved timestamps after the snapshot',future],
      ['Event ordering','Incident events exist and appear in chronological order',badEvent],
    ];
  }
  const qualityPage=()=>{
    const r=REPORTS.quality;
    const labels={duplicate_id:'Unique incident IDs',required_field:'Mandatory fields',timestamp:'Lifecycle timestamps',state:'Status consistency',event_history:'Event sequencing',assignment:'Resolver transfers',sla:'SLA policy values'};
    return `${pageHead('Data quality','Independent Python validation and deliberate error scenarios, separate from reporting data.')}
      <div class="kpis">${kpi('Checked incidents',fmt.format(r.checked),'Validated before SQL aggregation','database')}${kpi('Validation rules',fmt.format(r.rules.length),'Independent Python checks','shield','green')}${kpi('Records flagged',fmt.format(r.failed),'Unique source records failing checks','alert',r.failed?'red':'green')}${kpi('Injected test scenarios',fmt.format(REPORTS.qualityScenarios.length),'Not included in published incident facts','check','green')}</div>
      <section class="surface">${sectionHeader('Published dataset verification','Results generated during the data pipeline build')}
        <div class="check-list">${r.rules.map(x=>`<div class="check-row"><div><strong>${esc(labels[x.id]||x.id)}</strong><p>Rule ${esc(x.id)} · ${fmt.format(r.checked)} tickets checked</p></div><span class="pass" style="${x.count?'background:#fff0f2;color:#bb4351':''}">${x.count?`${x.count} flagged`:`${icon('check',13)} Passed`}</span></div>`).join('')}</div></section>
      <section class="surface analytics-block">${sectionHeader('Deliberately flawed example records','Seven isolated examples demonstrate what the validator detects. They never enter the published KPIs.')}
        <div class="table-wrap"><table class="table analytical-table"><thead><tr><th>Example record</th><th>Problem introduced</th><th>Rule</th><th>Result</th></tr></thead><tbody>${REPORTS.qualityScenarios.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.scenario)}</td><td>${esc(x.expectedRule)}</td><td>${statusTag(x.detected?'Detected':'Not detected',x.detected?'good':'bad')}</td></tr>`).join('')}</tbody></table></div></section>
      <div class="notice">${icon('info')}<span><strong>Source separation:</strong> The main report is produced by SQL from validated synthetic incident records. The intentionally invalid samples are generated separately and excluded from every incident KPI and chart.</span></div>`;
  };
  const methodologyPage=()=>`${pageHead('Data and methodology','Definitions, assumptions and technical boundaries behind every metric.')}
   <div class="method-grid">
    <section class="surface method-block"><h3>Project purpose</h3><p>OpsLens is an independent technical portfolio demo focused on incident analytics, IT operations and business intelligence. It is <strong>not</strong> connected to a real ServiceNow, Jira or enterprise IT system.</p><p>Every incident, event, assignment and summary is synthetically generated. Data is frozen at <strong>${dateStr(dataset.meta.asOf,true)} Europe/Berlin</strong> for reproducible reporting.</p><p>The generator, SQL aggregation code, tests and source are included in the downloadable project package.</p></section>
    <section class="surface method-block"><h3>SLA assumptions</h3><p>P1 and P2 use calendar time. P3 and P4 use <strong>Monday–Friday 09:00–17:00</strong> in Europe/Berlin. NRW statutory holidays and configured closures are excluded from P3/P4 business time. On-hold intervals subtract from eligible SLA time.</p><p>At risk starts at 75% consumption; critical starts at 90%; a breach occurs above 100%. These are <strong>example policies</strong>, not contractual SLAs or ServiceNow defaults.</p></section>
    <section class="surface method-block"><h3>KPI dictionary</h3><table class="method-table"><tbody>
      <tr><th>Open incidents</th><td>Unresolved as of snapshot, all opening dates</td></tr>
      <tr><th>SLA compliance</th><td>Resolved within SLA / eligible incidents resolved during selected period</td></tr>
      <tr><th>Mean resolution time</th><td>Calendar minutes from opening to final resolution, period based on resolution date</td></tr>
      <tr><th>At risk workload</th><td>Open incidents at 75%+ SLA consumed, including breaches</td></tr>
      <tr><th>Incident explorer range</th><td>Filter by incident opening date</td></tr>
      <tr><th>Reassignments</th><td>Recorded transfers between resolver groups, not individual owners</td></tr>
      <tr><th>Historical backlog</th><td>Unresolved at the end of each reporting date: opened on/before that date and not resolved until later</td></tr>
    </tbody></table></section>
    <section class="surface method-block"><h3>Implementation</h3><ul><li><strong>Data:</strong> ${fmt.format(INCIDENTS.length)} generated incidents, deterministic seed <code>${dataset.meta.seed}</code></li><li><strong>Pipeline:</strong> Reproducible Python generator, SQL-backed reporting aggregates (SQLite by default, optional DuckDB engine) and unit tests.</li><li><strong>Frontend:</strong> Dependency-free HTML, CSS and JavaScript, custom SVG visualizations.</li><li><strong>Deployment:</strong> Static hosting; no backend, authentication or paid APIs.</li><li><strong>Accessibility:</strong> Focus states, semantic tables, responsive layout and reduced-motion support.</li></ul><p><strong>Limitations:</strong> Static snapshot; NRW demo business calendar; synthetic patterns; no machine learning or live integration. Actual enterprise SLAs can have different clocks, holidays, stop conditions and exclusions.</p></section>
   </div>`;
  function detailPage(){
    const i=getMetric(state.detailId);
    if(!i)return `${pageHead('Incident not found','This identifier is not present in the synthetic dataset.')}<button class="outline-btn" data-page="incidents">Return to incident explorer</button>`;
    const actions=i.events.map(e=>`<div class="timeline-item ${e.type}"><div class="timeline-dot"></div><div><h4>${esc(e.text)}</h4><p>${esc(e.team)} · ${esc(e.type.replace('_',' '))}</p><time datetime="${e.at}">${dateStr(e.at,true)}</time></div></div>`).join('');
    const progressClass=i.slaStatus==='Breached'?'bad':['Critical','At risk'].includes(i.slaStatus)?'warn':'';
    const kv=[['Incident ID',i.id],['Category',i.category],['Affected service',i.service],['Current / last team',i.team],['Priority',i.priority],['Current status',i.status],['Opened',dateStr(i.openedAt,true)],['Resolved',i.resolvedAt?dateStr(i.resolvedAt,true):'Not resolved'],['Reassignments',String(i.reassignments)],['Hold periods',String(i.holds)]];
    return `<div class="detail-top"><button class="back-link" data-page="${esc(state.lastPage)}">${icon('chevron',16)} Back to ${state.lastPage==='sla'?'SLA monitor':'incident explorer'}</button><div class="demo-tag"><i></i>SYNTHETIC INCIDENT</div></div><div class="eyebrow">INCIDENT LIFECYCLE</div><h1 class="detail-title">${i.id}</h1><p class="detail-summary">${esc(i.summary)}</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 26px">${statusTag(i.priority,priorityTone(i.priority))}${statusTag(i.status)}${statusTag(i.slaStatus)}</div><div class="detail-grid"><section class="surface">${sectionHeader('Incident activity','Events recorded in chronological order')}<div class="timeline">${actions}</div></section><div style="display:flex;flex-direction:column;gap:18px"><section class="surface">${sectionHeader('Incident properties','Metadata from the synthetic record')}<div class="kv-list">${kv.map(([name,value])=>`<div class="kv"><span>${esc(name)}</span><b>${esc(value)}</b></div>`).join('')}</div></section><section class="surface sla-meter"><div class="sla-label"><h3>SLA consumption</h3>${statusTag(i.slaStatus)}</div><h2>${i.slaStatus==='Breached'?`Overdue · ${overdueLabel(i)}`:`${i.slaPercent}%`}</h2><div class="progress"><span class="${progressClass}" style="width:${Math.min(100,i.slaPercent)}%"></span></div><p>${hrs(i.slaUsedMin)} eligible elapsed / ${hrs(i.slaTargetMin)} target</p><div class="kv"><span>Policy</span><b>${esc(i.slaPolicy)}</b></div><div class="kv"><span>Estimated SLA deadline</span><b>${dateStr(i.slaDueAt,true)}</b></div><p style="margin-top:13px">Pauses and business-hour schedules are applied. The target is a demonstration policy.</p></section></div></div>`;
  }
  const pageContent=()=>{switch(state.page){case'overview':return overview();case'incidents':return incidentsPage();case'sla':return slaPage();case'insights':return insightsPage();case'quality':return qualityPage();case'methodology':return methodologyPage();case'detail':return detailPage();default:return overview();}};
  const render=()=>{if(!dataset)return;document.getElementById('app').innerHTML=header();document.title=`${titleFor[state.page]} | OpsLens`;};
  const exportCsv=()=>{
    const mode=state.page==='sla'?'sla':'incidents',rows=filterRows(mode);
    const names=['id','openedAt','resolvedAt','status','priority','category','service','team','summary','slaPolicy','slaUsedMin','slaPercent','slaStatus','reassignments','holds'];
    const csv=[names.join(','),...rows.map(i=>names.map(k=>`"${String(i[k]??'').replaceAll('"','""')}"`).join(','))].join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`opslens-${mode}-synthetic-${new Date(ASOF).toISOString().slice(0,10)}.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  };
  const rerenderTable=()=>{const el=document.getElementById('table-zone');if(!el)return;const mode=state.page==='sla'?'sla':'incidents';el.innerHTML=renderTable(filterRows(mode),mode);};
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-page],[data-action],[data-range],[data-incident],[data-sort],[data-team],[data-service],[data-issue]');if(!target)return;
    if(target.dataset.page){go(target.dataset.page);window.scrollTo(0,0);return;}
    if(target.dataset.incident){state.lastPage=state.page==='sla'?'sla':'incidents';go(`incident/${target.dataset.incident}`);window.scrollTo(0,0);return;}
    if(target.dataset.issue){openExplorer({issue:target.dataset.issue,service:target.dataset.service||''});return;}
    if(target.dataset.service){openExplorer({service:target.dataset.service});return;}
    if(target.dataset.team){openExplorer({team:target.dataset.team});return;}
    if(target.dataset.range!==undefined){state.range=Number(target.dataset.range);state.index=0;render();return;}
    if(target.dataset.sort){if(state.sort===target.dataset.sort)state.sortDesc=!state.sortDesc;else{state.sort=target.dataset.sort;state.sortDesc=true}rerenderTable();return;}
    const action=target.dataset.action;
    if(action==='menu-open'){state.mobileOpen=true;render()}else if(action==='menu-close'){state.mobileOpen=false;render()}else if(action==='export'){exportCsv()}else if(action==='reset'){Object.assign(state,{search:'',priority:'all',status:'all',category:'all',sla:'all',team:'all',service:'',issue:'',openOnly:false,riskOnly:false,resolvedOnly:false,index:0});render()}
    else if(action==='drill-open'){openExplorer({openOnly:true})}
    else if(action==='drill-risk'){openExplorer({openOnly:true,riskOnly:true})}
    else if(action==='drill-compliant'){openExplorer({resolvedOnly:true,sla:'Met'})}
    else if(action==='drill-resolved'){openExplorer({resolvedOnly:true})}else if(action==='prev'){state.index=Math.max(0,state.index-1);rerenderTable()}else if(action==='next'){state.index++;rerenderTable()}
  });
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('.risk-row')){e.preventDefault();const row=e.target.closest('.risk-row');state.lastPage='sla';go(`incident/${row.dataset.incident}`);}});
  document.addEventListener('input',e=>{if(e.target.id==='search-incidents'){state.search=e.target.value;state.index=0;rerenderTable();}});
  document.addEventListener('change',e=>{
    if(['priority','status','category','sla'].includes(e.target.id)){state[e.target.id]=e.target.value;state.index=0;rerenderTable();}
    else if(e.target.id==='policy-priority'){state.policyPriority=e.target.value;state.policyHours=dataset.meta.slaRules[state.policyPriority].minutes/60;render();}
    else if(e.target.id==='policy-hours'){const n=Number(e.target.value);state.policyHours=Math.min(200,Math.max(.5,Number.isFinite(n)?n:16));render();}
  });
  window.addEventListener('hashchange',route);
  async function loadData(){
    const r=await fetch('./data/incidents.json.gz');
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    if(typeof DecompressionStream==='undefined'){
      const backup=await fetch('./data/incidents.json');
      if(!backup.ok)throw Error('Your browser cannot decode the data archive');
      return backup.json();
    }
    return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
  }
  const loadReports=async()=>{
    const response=await fetch('./data/analytics.json');
    if(!response.ok)throw Error(`SQL analytics unavailable: HTTP ${response.status}`);
    return response.json();
  };
  Promise.all([loadData(),loadReports()]).then(([data,reports])=>{
    if(!data?.meta?.synthetic||!Array.isArray(data.incidents))throw Error('Invalid incident dataset');
    if(reports?.meta?.asOf!==data.meta.asOf||reports.meta.sourceIncidents!==data.incidents.length||!reports.ranges?.['90'])throw Error('Analytics and incident datasets are out of sync');
    dataset=data;REPORTS=reports;INCIDENTS=data.incidents;BY_ID=new Map(INCIDENTS.map(i=>[i.id,i]));ASOF=Date.parse(data.meta.asOf);route();
  }).catch(error=>{document.getElementById('app').innerHTML=`<div class="loading-screen"><div class="loading-mark">!</div><h1>Unable to load the dataset</h1><p>${esc(error.message)}</p><p>Run a static file server from the project root. See README.md.</p></div>`;console.error('OpsLens load failure',error);});
})();
