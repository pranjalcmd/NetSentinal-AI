import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = 'http://localhost:8000';

function App(){
  const [tab,setTab]=React.useState('Dashboard');
  const [data,setData]=React.useState(null);
  const [alerts,setAlerts]=React.useState([]);
  const [selected,setSelected]=React.useState(null);
  const [ai,setAi]=React.useState(null);
  const [busy,setBusy]=React.useState(false);

  async function loadDemo(){
    setBusy(true); setAi(null); setSelected(null);
    const r=await fetch(`${API}/api/demo/load`,{method:'POST'}); const j=await r.json();
    setData(j.summary); const a=await fetch(`${API}/api/alerts`); setAlerts(await a.json()); setBusy(false); setTab('Threats');
  }
  async function explain(alert){
    const r=await fetch(`${API}/api/alerts/${alert.alert_id}/explain`,{method:'POST'}); setAi(await r.json()); setSelected(alert); setTab('AI Investigation');
  }
  return <div className="app">
    <aside><div className="brand"><div className="shield">◈</div><div><b>NetSentinel</b><small>AI Security</small></div></div>
      {['Dashboard','Traffic Analysis','Threats','Network Flows','AI Investigation','Reports'].map(x=><button className={tab===x?'nav active':'nav'} onClick={()=>setTab(x)} key={x}>{x}</button>)}
      <div className="spacer"/><button className="nav">⚙ Settings</button>
    </aside>
    <main><header><div><h1>{tab}</h1><p>Network traffic intelligence · DPI-assisted analysis · AI investigation</p></div><div className="header-actions"><span className="online">● System Online</span><button onClick={loadDemo} disabled={busy}>{busy?'Analysing…':'Run Demo Analysis'}</button></div></header>
      {tab==='Dashboard' && <Dashboard data={data} alerts={alerts} onAlert={setSelected}/>} 
      {tab==='Traffic Analysis' && <Traffic loadDemo={loadDemo} busy={busy}/>} 
      {tab==='Threats' && <Threats alerts={alerts} onExplain={explain}/>} 
      {tab==='Network Flows' && <Flows/>}
      {tab==='AI Investigation' && <Investigation selected={selected} ai={ai} onExplain={explain}/>} 
      {tab==='Reports' && <Reports data={data} alerts={alerts}/>} 
    </main>
  </div>
}

function Dashboard({data,alerts,onAlert}){return <><section className="cards">{[['TOTAL FLOWS',data?.total_flows??0],['SUSPICIOUS',data?.suspicious_flows??0],['HIGH RISK',data?.high_risk??0],['PROTOCOLS',data?.protocols??0]].map(([a,b])=><div className="card" key={a}><span>{a}</span><strong>{b}</strong></div>)}</section><section className="grid"><Panel title="Protocol Distribution"><Bars obj={data?.protocol_distribution||{}}/></Panel><Panel title="Risk Distribution"><Bars obj={data?.risk_distribution||{}}/></Panel></section><Panel title="Recent Threats"><ThreatList alerts={alerts} onExplain={onAlert}/></Panel></>}
function Traffic({loadDemo,busy}){return <div className="empty"><div className="upload">⬆</div><h2>Analyse network traffic</h2><p>Start with the controlled demo capture, then replace it with the team's authorized PCAP integration.</p><button onClick={loadDemo} disabled={busy}>{busy?'Running DPI pipeline…':'Analyse Demo PCAP'}</button><div className="steps"><span>1. Packet capture</span><span>2. nDPI</span><span>3. Detection rules</span><span>4. AI explanation</span></div></div>}
function Threats({alerts,onExplain}){return <Panel title={`Threats (${alerts.length})`}><table><thead><tr><th>Severity</th><th>Threat</th><th>Source</th><th>Score</th><th>Action</th></tr></thead><tbody>{alerts.map(a=><tr key={a.alert_id}><td><Severity s={a.severity}/></td><td>{a.title}</td><td>{a.flow_id}</td><td>{a.risk_score}</td><td><button className="ghost" onClick={()=>onExplain(a)}>Investigate</button></td></tr>)}</tbody></table></Panel>}
function Flows(){return <Panel title="Network Flows"><p className="muted">Load the demo from Dashboard or Traffic Analysis to populate flow data.</p></Panel>}
function Investigation({selected,ai,onExplain}){return <div>{!selected?<div className="empty small"><h2>No alert selected</h2><p>Open Threats and click Investigate.</p></div>:<><Panel title={selected.title}><div className="alert-head"><Severity s={selected.severity}/><b>Risk {selected.risk_score}/100</b></div><h3>Evidence</h3><ul>{selected.evidence.map(e=><li key={e}>{e}</li>)}</ul></Panel>{ai?<Panel title="AI Security Analysis"><p><b>{ai.threat_category}</b> · {ai.severity} · {(ai.confidence*100).toFixed(0)}% confidence</p><p>{ai.summary}</p><h3>Observed evidence</h3><ul>{ai.observed_evidence.map(e=><li key={e}>{e}</li>)}</ul><h3>Recommended investigation</h3><ol>{ai.recommendations.map(e=><li key={e}>{e}</li>)}</ol><p className="muted">AI is an analyst-assistance layer; validate findings against your telemetry.</p></Panel>:<button onClick={()=>onExplain(selected)}>Analyse with AI</button>}</div>}
function Reports({data,alerts}){return <Panel title="Reports"><div className="report"><b>NetSentinel AI Analysis Report</b><span>Flows: {data?.total_flows??0}</span><span>Alerts: {alerts.length}</span><span>High risk: {data?.high_risk??0}</span><button className="ghost">Export JSON</button></div></Panel>}
function ThreatList({alerts,onExplain}){return <div>{alerts.slice(0,5).map(a=><div className="threat" key={a.alert_id}><Severity s={a.severity}/><div><b>{a.title}</b><small>{a.flow_id}</small></div><strong>{a.risk_score}</strong><button className="ghost" onClick={()=>onExplain(a)}>View</button></div>)}</div>}
function Bars({obj}){return <div>{Object.entries(obj).map(([k,v])=><div className="bar-row" key={k}><span>{k}</span><div><i style={{width:`${Math.min(100,v*12)}%`}}/></div><b>{v}</b></div>)}</div>}
function Severity({s}){return <span className={`sev ${String(s).toLowerCase()}`}>{s}</span>}
function Panel({title,children}){return <section className="panel"><div className="panel-title"><h2>{title}</h2></div>{children}</section>}

createRoot(document.getElementById('root')).render(<App/>);
