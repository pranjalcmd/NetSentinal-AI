// frontend/src/main.jsx
// ByteGuard - AI-Powered Criminal Network Analysis
// Single-file React SPA (all views live here per project constraints).

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import ReactDOM from "react-dom/client"
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  useNavigate,
  useParams,
} from "react-router-dom"
import ForceGraph2D from "react-force-graph-2d"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  LayoutDashboard,
  Share2,
  Users,
  GitBranch,
  Bell,
  Bot,
  Boxes,
  Clock,
  FileText,
  Settings as SettingsIcon,
  Search,
  ChevronDown,
  ShieldAlert,
  Phone,
  Mail,
  MapPin,
  Car,
  Building2,
  CreditCard,
  User,
  Activity,
  TrendingUp,
  Zap,
  Upload,
  Download,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Route as RouteIcon,
  Send,
  CheckCircle2,
} from "lucide-react"

import "./styles.css"

/* --------------------------------------------------------------------------
 * API layer — tries the FastAPI backend, falls back to bundled demo data.
 * Endpoints: /api/network/graph, /api/entities, /api/alerts,
 *            /api/pathfinder, /api/ai/ask
 * ------------------------------------------------------------------------ */
const API_BASE = import.meta.env.VITE_API_URL || ""

async function apiGet(path, fallback) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { data: await res.json(), live: true }
  } catch (err) {
    console.log("[v0] API fallback for", path, "-", err.message)
    return { data: fallback, live: false }
  }
}

async function apiPost(path, body, fallback) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { data: await res.json(), live: true }
  } catch (err) {
    console.log("[v0] API fallback for", path, "-", err.message)
    return { data: fallback, live: false }
  }
}

/* --------------------------------------------------------------------------
 * Demo data (mirrors samples/demo_flows.json shape).
 * ------------------------------------------------------------------------ */
const TYPE_META = {
  person: { color: "#3B82F6", icon: User, label: "People" },
  phone: { color: "#8B5CF6", icon: Phone, label: "Phones" },
  vehicle: { color: "#F59E0B", icon: Car, label: "Vehicles" },
  location: { color: "#10B981", icon: MapPin, label: "Locations" },
  organization: { color: "#EF4444", icon: Building2, label: "Organizations" },
  account: { color: "#06B6D4", icon: CreditCard, label: "Accounts" },
}

const GRAPH = {
  nodes: [
    { id: "amit", name: "Amit Das", type: "person", risk: 82, central: true },
    { id: "ravi", name: "Ravi Singh", type: "person", risk: 74 },
    { id: "sunil", name: "Sunil Verma", type: "person", risk: 61 },
    { id: "meena", name: "Meena Roy", type: "person", risk: 45 },
    { id: "karan", name: "Karan Malhotra", type: "person", risk: 88 },
    { id: "p1", name: "+91 98765 43210", type: "phone", risk: 70 },
    { id: "p2", name: "+91 90123 55678", type: "phone", risk: 55 },
    { id: "p3", name: "+91 88990 12345", type: "phone", risk: 40 },
    { id: "v1", name: "WB-02-AC-1099", type: "vehicle", risk: 66 },
    { id: "v2", name: "DL-08-ZZ-4521", type: "vehicle", risk: 30 },
    { id: "l1", name: "Kolkata Warehouse", type: "location", risk: 78 },
    { id: "l2", name: "Salt Lake Sector V", type: "location", risk: 35 },
    { id: "o1", name: "Nexus Traders LLP", type: "organization", risk: 90 },
    { id: "o2", name: "BlueWave Imports", type: "organization", risk: 58 },
    { id: "a1", name: "A/C ****4471", type: "account", risk: 84 },
    { id: "a2", name: "A/C ****2290", type: "account", risk: 49 },
  ],
  links: [
    { source: "amit", target: "ravi", suspicious: true },
    { source: "amit", target: "sunil" },
    { source: "amit", target: "meena" },
    { source: "amit", target: "karan", suspicious: true },
    { source: "amit", target: "p1" },
    { source: "amit", target: "p2" },
    { source: "amit", target: "v1", suspicious: true },
    { source: "amit", target: "l1", suspicious: true },
    { source: "amit", target: "o1", suspicious: true },
    { source: "amit", target: "a1", suspicious: true },
    { source: "ravi", target: "p3" },
    { source: "ravi", target: "a2" },
    { source: "karan", target: "o1" },
    { source: "sunil", target: "v2" },
    { source: "meena", target: "l2" },
    { source: "o1", target: "o2" },
    { source: "karan", target: "l1" },
  ],
}

const INFLUENCERS = [
  { name: "Amit Das", connections: 18, risk: 92, level: "Critical" },
  { name: "Karan Malhotra", connections: 15, risk: 88, level: "Critical" },
  { name: "Ravi Singh", connections: 12, risk: 74, level: "High" },
  { name: "Nexus Traders LLP", connections: 11, risk: 90, level: "Critical" },
  { name: "Sunil Verma", connections: 9, risk: 61, level: "Medium" },
  { name: "Meena Roy", connections: 7, risk: 45, level: "Low" },
]

const RISK_DISTRIBUTION = [
  { name: "High Risk", value: 37, color: "#EF4444" },
  { name: "Medium Risk", value: 94, color: "#F59E0B" },
  { name: "Low Risk", value: 1153, color: "#10B981" },
]

const ENTITY_DISTRIBUTION = [
  { name: "People", value: 512, color: "#3B82F6" },
  { name: "Phones", value: 341, color: "#8B5CF6" },
  { name: "Accounts", value: 188, color: "#06B6D4" },
  { name: "Vehicles", value: 121, color: "#F59E0B" },
  { name: "Locations", value: 87, color: "#10B981" },
  { name: "Orgs", value: 35, color: "#EF4444" },
]

const SUSPICIOUS_PATTERNS = [
  { text: "Circular fund transfer between 4 accounts linked to Amit Das", tag: "Money Laundering", time: "12m ago" },
  { text: "Burner phone swapped 3x within 48h near Kolkata Warehouse", tag: "Evasion", time: "1h ago" },
  { text: "Nexus Traders LLP shares directors with 2 flagged shell orgs", tag: "Shell Network", time: "3h ago" },
  { text: "Vehicle WB-02-AC-1099 pinged 5 flagged locations overnight", tag: "Movement", time: "6h ago" },
]

const ALERTS = [
  { id: "AL-001", title: "Circular transaction ring", entity: "Amit Das", type: "Money Laundering", risk: 92, level: "Critical", status: "Open", time: "12m ago" },
  { id: "AL-002", title: "Rapid SIM rotation", entity: "Karan Malhotra", type: "Evasion", risk: 81, level: "High", status: "Open", time: "1h ago" },
  { id: "AL-003", title: "Shell org director overlap", entity: "Nexus Traders LLP", type: "Shell Network", risk: 88, level: "Critical", status: "Investigating", time: "3h ago" },
  { id: "AL-004", title: "Unusual vehicle movement", entity: "WB-02-AC-1099", type: "Movement", risk: 66, level: "Medium", status: "Open", time: "6h ago" },
  { id: "AL-005", title: "Cross-border small transfers", entity: "A/C ****4471", type: "Structuring", risk: 84, level: "Critical", status: "Investigating", time: "8h ago" },
  { id: "AL-006", title: "New contact w/ flagged node", entity: "Meena Roy", type: "Association", risk: 42, level: "Low", status: "Closed", time: "1d ago" },
]

const COMMUNITIES = [
  { id: "C1", name: "Kolkata Logistics Ring", members: 42, risk: 88, density: 0.72, type: "organization" },
  { id: "C2", name: "Burner Phone Cluster", members: 27, risk: 74, density: 0.61, type: "phone" },
  { id: "C3", name: "Shell Account Web", members: 19, risk: 91, density: 0.83, type: "account" },
  { id: "C4", name: "Northern Transit Group", members: 33, risk: 55, density: 0.48, type: "vehicle" },
  { id: "C5", name: "Peripheral Associates", members: 61, risk: 38, density: 0.29, type: "person" },
  { id: "C6", name: "Import Front Network", members: 24, risk: 79, density: 0.66, type: "organization" },
]

const REPORTS = [
  { id: "RP-2041", name: "Amit Das — Full Network Dossier", type: "PDF", size: "4.2 MB", date: "2026-09-08" },
  { id: "RP-2038", name: "Weekly Suspicious Activity Summary", type: "PDF", size: "1.1 MB", date: "2026-09-06" },
  { id: "RP-2035", name: "Nexus Traders LLP — Entity Graph Export", type: "CSV", size: "820 KB", date: "2026-09-05" },
  { id: "RP-2030", name: "Community Cluster Analysis Q3", type: "XLSX", size: "2.7 MB", date: "2026-09-01" },
  { id: "RP-2027", name: "Path Findings: Amit Das → Ravi Singh", type: "PDF", size: "640 KB", date: "2026-08-29" },
]

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/network", label: "Network Explorer", icon: Share2 },
  { to: "/entities", label: "Entities", icon: Users },
  { to: "/relationships", label: "Relationships", icon: GitBranch },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/ai", label: "AI Investigation", icon: Bot },
  { to: "/communities", label: "Communities", icon: Boxes },
  { to: "/timeline", label: "Timeline", icon: Clock },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
]

/* --------------------------------------------------------------------------
 * Shared UI helpers
 * ------------------------------------------------------------------------ */
function riskLevel(score) {
  if (score >= 80) return { label: score >= 90 ? "Critical" : "High", color: "#EF4444", bg: "rgba(239,68,68,0.14)" }
  if (score >= 50) return { label: "Medium", color: "#F59E0B", bg: "rgba(245,158,11,0.14)" }
  return { label: "Low", color: "#10B981", bg: "rgba(16,185,129,0.14)" }
}

function RiskBadge({ score, level }) {
  const r = riskLevel(score)
  const label = level || r.label
  return (
    <span className="chip" style={{ color: r.color, background: r.bg, borderColor: r.color + "55" }}>
      <ShieldAlert size={12} /> {label}
      {score != null && <span style={{ opacity: 0.85 }}>· {score}</span>}
    </span>
  )
}

function Card({ children, className = "", ...rest }) {
  return (
    <div className={`glass glass-hover p-4 ${className}`} {...rest}>
      {children}
    </div>
  )
}

function SectionTitle({ icon: Icon, children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        {Icon && <Icon size={16} className="text-brand-blue" />}
        {children}
      </h3>
      {action}
    </div>
  )
}

function LiveBadge({ live }) {
  return (
    <span
      className="chip"
      title={live ? "Connected to backend API" : "Using bundled demo data"}
      style={{
        color: live ? "#10B981" : "#F59E0B",
        background: live ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
        borderColor: (live ? "#10B981" : "#F59E0B") + "55",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: live ? "#10B981" : "#F59E0B",
          display: "inline-block",
        }}
      />
      {live ? "Live API" : "Demo data"}
    </span>
  )
}

function useMeasure() {
  const ref = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect
      setSize({ width: cr.width, height: cr.height })
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}

/* --------------------------------------------------------------------------
 * Reusable force graph
 * ------------------------------------------------------------------------ */
function NetworkGraph({ data, onNodeClick, selectedId, height = 480 }) {
  const [wrapRef, size] = useMeasure()
  const fgRef = useRef()

  const paint = useCallback(
    (node, ctx, globalScale) => {
      const meta = TYPE_META[node.type] || TYPE_META.person
      const color = node.central ? "#EF4444" : meta.color
      const radius = node.central ? 12 : 6 + (node.risk || 0) / 25
      const selected = node.id === selectedId

      if (node.central || selected) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI)
        ctx.fillStyle = color + "22"
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = node.central ? 18 : 8
      ctx.fill()
      ctx.shadowBlur = 0
      if (selected) {
        ctx.lineWidth = 2 / globalScale
        ctx.strokeStyle = "#ffffff"
        ctx.stroke()
      }

      const fontSize = Math.max(10 / globalScale, node.central ? 4 : 3)
      ctx.font = `${node.central ? 700 : 500} ${fontSize}px Inter, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      ctx.fillStyle = "#cdd9ee"
      ctx.fillText(node.name, node.x, node.y + radius + 2)
    },
    [selectedId]
  )

  return (
    <div ref={wrapRef} style={{ width: "100%", height }} className="rounded-xl overflow-hidden">
      {size.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.width}
          height={size.height || height}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={6}
          nodeCanvasObject={paint}
          nodePointerAreaPaint={(node, color, ctx) => {
            const radius = node.central ? 14 : 9
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
            ctx.fill()
          }}
          linkColor={(l) => (l.suspicious ? "rgba(239,68,68,0.55)" : "rgba(59,130,246,0.28)")}
          linkWidth={(l) => (l.suspicious ? 2 : 1)}
          linkDirectionalParticles={(l) => (l.suspicious ? 3 : 0)}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => "#EF4444"}
          onNodeClick={(node) => {
            onNodeClick && onNodeClick(node)
            if (fgRef.current) fgRef.current.centerAt(node.x, node.y, 600)
          }}
          cooldownTicks={120}
        />
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------
 * Layout: Sidebar + TopBar
 * ------------------------------------------------------------------------ */
function Sidebar() {
  return (
    <aside className="w-64 shrink-0 h-full border-r border-edge bg-[rgba(10,20,40,0.55)] backdrop-blur flex flex-col">
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl grid place-items-center bg-gradient-to-br from-brand-blue to-brand-purple shadow-glow">
          <ShieldAlert size={20} className="text-white" />
        </div>
        <div>
          <div className="font-extrabold tracking-tight text-white leading-none">ByteGuard</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Network Intel</div>
        </div>
      </div>
      <nav className="px-3 flex-1 overflow-y-auto space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3">
        <div className="glass p-3 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Zap size={14} className="text-brand-purple" /> AI Engine
          </div>
          <p className="mt-1 text-slate-400 leading-relaxed">Graph models active. Last sync 2m ago.</p>
        </div>
      </div>
    </aside>
  )
}

function TopBar() {
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [openMenu, setOpenMenu] = useState(false)
  return (
    <header className="h-16 shrink-0 border-b border-edge bg-[rgba(10,20,40,0.55)] backdrop-blur flex items-center gap-4 px-5">
      <form
        className="relative flex-1 max-w-lg"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) navigate("/entities")
        }}
      >
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-9"
          placeholder="Search entities, phones, accounts..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      <button className="relative w-10 h-10 grid place-items-center rounded-xl border border-edge bg-[rgba(16,30,56,0.6)] text-slate-300 hover:text-white">
        <Bell size={18} />
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-risk-high" />
      </button>
      <div className="relative">
        <button
          onClick={() => setOpenMenu((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-edge bg-[rgba(16,30,56,0.6)] pl-1 pr-2 py-1 text-sm text-slate-200"
        >
          <span className="w-8 h-8 rounded-lg grid place-items-center bg-gradient-to-br from-brand-blue to-brand-purple text-white font-bold">
            A
          </span>
          <span className="hidden sm:block">Admin</span>
          <ChevronDown size={16} className="text-slate-400" />
        </button>
        {openMenu && (
          <div className="absolute right-0 mt-2 w-44 glass p-1 z-50 animate-in">
            {["Profile", "Preferences", "Audit Log", "Sign out"].map((i) => (
              <button
                key={i}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-[rgba(59,130,246,0.1)] hover:text-white"
                onClick={() => setOpenMenu(false)}
              >
                {i}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}

function Layout({ children }) {
  return (
    <div className="h-screen w-screen flex overflow-hidden text-slate-200">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

function PageHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

/* --------------------------------------------------------------------------
 * 1. Dashboard
 * ------------------------------------------------------------------------ */
function StatCard({ icon: Icon, label, value, accent, delta }) {
  return (
    <Card className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</div>
          <div className="text-3xl font-extrabold text-white mt-2">{value}</div>
          {delta && (
            <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: accent }}>
              <TrendingUp size={12} /> {delta}
            </div>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl grid place-items-center" style={{ background: accent + "22", color: accent }}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  )
}

function Dashboard() {
  const [live, setLive] = useState(false)
  useEffect(() => {
    apiGet("/api/network/graph", GRAPH).then((r) => setLive(r.live))
  }, [])
  const navigate = useNavigate()

  return (
    <div className="animate-in">
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of the monitored criminal network"
        right={<LiveBadge live={live} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Entities" value="1,284" accent="#3B82F6" delta="+3.2% this week" />
        <StatCard icon={GitBranch} label="Relationships" value="2,817" accent="#8B5CF6" delta="+5.1% this week" />
        <StatCard icon={AlertTriangle} label="Suspicious Links" value="37" accent="#EF4444" delta="+8 new" />
        <StatCard icon={Sparkles} label="Key Influencers" value="8" accent="#F59E0B" delta="2 critical" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2">
          <SectionTitle icon={Share2} children="Network Overview"
            action={<button className="btn btn-ghost" onClick={() => navigate("/network")}>Open Explorer <ArrowRight size={14} /></button>} />
          <NetworkGraph data={structuredClone(GRAPH)} height={340} onNodeClick={() => navigate("/network")} />
        </Card>

        <Card>
          <SectionTitle icon={ShieldAlert} children="Risk Distribution" />
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={RISK_DISTRIBUTION} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                  {RISK_DISTRIBUTION.map((e) => (
                    <Cell key={e.name} fill={e.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center">
                <div className="text-3xl font-extrabold text-risk-high">37</div>
                <div className="text-[11px] text-slate-400 uppercase tracking-wider">Suspicious</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {RISK_DISTRIBUTION.map((e) => (
              <div key={e.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} /> {e.name}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card>
          <SectionTitle icon={Boxes} children="Entity Distribution" />
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ENTITY_DISTRIBUTION} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: "#7f92b3", fontSize: 11 }} axisLine={{ stroke: "#1E3A5F" }} tickLine={false} />
                <YAxis tick={{ fill: "#7f92b3", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(59,130,246,0.08)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {ENTITY_DISTRIBUTION.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle icon={Sparkles} children="Top Network Influencers"
            action={<button className="btn btn-ghost" onClick={() => navigate("/entities")}>View all</button>} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left text-xs uppercase tracking-wider">
                  <th className="py-2 font-medium">Entity</th>
                  <th className="py-2 font-medium">Connections</th>
                  <th className="py-2 font-medium">Risk</th>
                  <th className="py-2 font-medium">Level</th>
                </tr>
              </thead>
              <tbody>
                {INFLUENCERS.map((row) => (
                  <tr key={row.name} className="table-row border-t border-edge cursor-pointer" onClick={() => navigate("/entities/amit")}>
                    <td className="py-2.5 font-medium text-white">{row.name}</td>
                    <td className="py-2.5 text-slate-300">{row.connections}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${row.risk}%`, background: riskLevel(row.risk).color }} />
                        </div>
                        <span className="text-slate-300">{row.risk}</span>
                      </div>
                    </td>
                    <td className="py-2.5"><RiskBadge level={row.level} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle icon={Activity} children="Recent Suspicious Patterns" />
        <div className="space-y-2">
          {SUSPICIOUS_PATTERNS.map((p, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-edge bg-[rgba(10,20,40,0.4)]">
              <div className="w-8 h-8 rounded-lg grid place-items-center bg-[rgba(239,68,68,0.14)] text-risk-high shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200">{p.text}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="chip" style={{ color: "#8B5CF6", background: "rgba(139,92,246,0.14)", borderColor: "#8B5CF655" }}>{p.tag}</span>
                  <span className="text-xs text-slate-500">{p.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

const tooltipStyle = {
  background: "rgba(16,30,56,0.95)",
  border: "1px solid #1E3A5F",
  borderRadius: 10,
  color: "#e6edf7",
  fontSize: 12,
}

/* --------------------------------------------------------------------------
 * 2. Network Explorer
 * ------------------------------------------------------------------------ */
const FILTERS = ["All", "People", "Phones", "Vehicles", "Locations", "Organizations", "Accounts"]
const FILTER_TYPE = {
  People: "person", Phones: "phone", Vehicles: "vehicle",
  Locations: "location", Organizations: "organization", Accounts: "account",
}

function NetworkExplorer() {
  const [filter, setFilter] = useState("All")
  const [riskFilter, setRiskFilter] = useState("All")
  const [selected, setSelected] = useState(GRAPH.nodes[0])
  const [live, setLive] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    apiGet("/api/network/graph", GRAPH).then((r) => setLive(r.live))
  }, [])

  const graphData = useMemo(() => {
    const type = FILTER_TYPE[filter]
    let nodes = GRAPH.nodes.filter((n) => {
      const typeOk = !type || n.type === type || n.central
      const riskOk =
        riskFilter === "All" ||
        (riskFilter === "High" && n.risk >= 80) ||
        (riskFilter === "Medium" && n.risk >= 50 && n.risk < 80) ||
        (riskFilter === "Low" && n.risk < 50)
      return typeOk && riskOk
    })
    const ids = new Set(nodes.map((n) => n.id))
    const links = GRAPH.links.filter((l) => ids.has(l.source.id || l.source) && ids.has(l.target.id || l.target))
    return structuredClone({ nodes, links })
  }, [filter, riskFilter])

  const meta = TYPE_META[selected?.type] || TYPE_META.person
  const r = riskLevel(selected?.risk || 0)

  return (
    <div className="animate-in">
      <PageHeader title="Network Explorer" subtitle="Interactive relationship graph — click a node to inspect" right={<LiveBadge live={live} />} />

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`btn ${filter === f ? "btn-primary" : "btn-ghost"}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3 p-2">
          <NetworkGraph data={graphData} selectedId={selected?.id} onNodeClick={setSelected} height={520} />
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle icon={SettingsIcon} children="Filters" />
            <label className="text-xs text-slate-400">Risk Level</label>
            <select className="input mt-1 mb-3" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
              {["All", "High", "Medium", "Low"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <label className="text-xs text-slate-400">Date Range</label>
            <select className="input mt-1">
              <option>Last 30 days</option>
              <option>Last 7 days</option>
              <option>Last 24 hours</option>
              <option>All time</option>
            </select>
          </Card>

          {selected && (
            <Card>
              <SectionTitle icon={meta.icon} children="Selected Entity" />
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl grid place-items-center" style={{ background: (selected.central ? "#EF4444" : meta.color) + "22", color: selected.central ? "#EF4444" : meta.color }}>
                  <meta.icon size={22} />
                </div>
                <div>
                  <div className="font-semibold text-white">{selected.name}</div>
                  <div className="text-xs text-slate-400 capitalize">{selected.type}</div>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <Row label="Risk Level" value={<RiskBadge score={selected.risk} />} />
                <Row label="Risk Score" value={<span style={{ color: r.color }}>{selected.risk}/100</span>} />
                <Row label="Connections" value={GRAPH.links.filter((l) => (l.source.id || l.source) === selected.id || (l.target.id || l.target) === selected.id).length} />
                <Row label="Type" value={<span className="capitalize">{selected.type}</span>} />
              </div>
              <button className="btn btn-primary w-full mt-4" onClick={() => navigate("/entities/amit")}>
                View Details <ArrowRight size={14} />
              </button>
            </Card>
          )}

          <Card>
            <SectionTitle children="Legend" />
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPE_META).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} /> {v.label}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * 3. Entity Profile
 * ------------------------------------------------------------------------ */
function EntityProfile() {
  const [tab, setTab] = useState("Overview")
  const tabs = ["Overview", "Connections", "Transactions", "Locations", "Timeline"]
  const navigate = useNavigate()

  const connections = GRAPH.links
    .filter((l) => (l.source.id || l.source) === "amit")
    .map((l) => GRAPH.nodes.find((n) => n.id === (l.target.id || l.target)))
    .filter(Boolean)

  return (
    <div className="animate-in">
      <PageHeader title="Entity Profile" subtitle="Deep-dive dossier" right={
        <button className="btn btn-ghost" onClick={() => navigate("/network")}>Back to graph</button>
      } />

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-16 h-16 rounded-2xl grid place-items-center bg-gradient-to-br from-risk-high/30 to-brand-purple/20 text-risk-high">
            <User size={30} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-white">Amit Das</h2>
              <RiskBadge score={82} level="High Risk" />
            </div>
            <p className="text-slate-400 text-sm mt-1">Person · ID ENT-0001 · Flagged influencer</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Risk Score</div>
            <div className="text-3xl font-extrabold text-risk-high">82<span className="text-lg text-slate-500">/100</span></div>
          </div>
        </div>

        <div className="flex gap-1 mt-5 border-b border-edge overflow-x-auto">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === t ? "border-brand-blue text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="pt-5">
          {tab === "Overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass p-4">
                <SectionTitle icon={User} children="Basic Info" />
                <div className="space-y-2 text-sm">
                  <InfoRow icon={Phone} label="Phone" value="+91 98765 43210" />
                  <InfoRow icon={Mail} label="Email" value="amit.das@protonmail.com" />
                  <InfoRow icon={MapPin} label="Address" value="Kolkata, West Bengal" />
                  <InfoRow icon={User} label="Aliases" value="A. Das, Amitabh D." />
                </div>
              </div>
              <div className="glass p-4">
                <SectionTitle icon={Sparkles} children="Key Insights & Risk Factors" />
                <div className="flex flex-wrap gap-2">
                  {["Central hub node", "18 direct connections", "Circular transactions", "Links to shell org", "Burner phone usage", "High-risk locations"].map((t) => (
                    <span key={t} className="chip" style={{ color: "#EF4444", background: "rgba(239,68,68,0.12)", borderColor: "#EF444455" }}>{t}</span>
                  ))}
                </div>
                <p className="text-sm text-slate-400 mt-3 leading-relaxed">
                  Amit Das sits at the center of the monitored cluster, bridging financial accounts, communication devices, and a flagged organization. Removal would fragment the network into 4 sub-clusters.
                </p>
              </div>
            </div>
          )}

          {tab === "Connections" && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {connections.map((c) => {
                const m = TYPE_META[c.type]
                return (
                  <div key={c.id} className="glass p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg grid place-items-center" style={{ background: m.color + "22", color: m.color }}>
                      <m.icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{c.name}</div>
                      <div className="text-xs text-slate-400">Risk {c.risk}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === "Transactions" && (
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 text-left text-xs uppercase"><th className="py-2">Date</th><th>Counterparty</th><th>Amount</th><th>Flag</th></tr></thead>
              <tbody>
                {[["2026-09-07", "A/C ****4471", "₹4,80,000", true], ["2026-09-05", "Nexus Traders LLP", "₹2,15,000", true], ["2026-09-02", "Ravi Singh", "₹95,000", false], ["2026-08-30", "BlueWave Imports", "₹1,20,000", true]].map((t, i) => (
                  <tr key={i} className="border-t border-edge table-row">
                    <td className="py-2.5 text-slate-300">{t[0]}</td>
                    <td className="text-white">{t[1]}</td>
                    <td className="text-slate-200">{t[2]}</td>
                    <td>{t[3] ? <RiskBadge level="Suspicious" score={85} /> : <span className="text-slate-500 text-xs">Normal</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "Locations" && (
            <div className="grid sm:grid-cols-2 gap-3">
              {[["Kolkata Warehouse", "Visited 14×", 78], ["Salt Lake Sector V", "Visited 6×", 35], ["Howrah Station", "Visited 4×", 52], ["Airport Zone", "Visited 2×", 44]].map((l, i) => (
                <div key={i} className="glass p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin size={18} className="text-risk-low" />
                    <div><div className="text-sm text-white">{l[0]}</div><div className="text-xs text-slate-400">{l[1]}</div></div>
                  </div>
                  <RiskBadge score={l[2]} />
                </div>
              ))}
            </div>
          )}

          {tab === "Timeline" && <Timeline compact />}
        </div>
      </Card>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={15} className="text-slate-500" />
      <span className="text-slate-400 w-20">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * 4. Alerts
 * ------------------------------------------------------------------------ */
function Alerts() {
  const [live, setLive] = useState(false)
  const [status, setStatus] = useState("All")
  useEffect(() => { apiGet("/api/alerts", ALERTS).then((r) => setLive(r.live)) }, [])
  const rows = ALERTS.filter((a) => status === "All" || a.status === status)

  return (
    <div className="animate-in">
      <PageHeader title="Alerts & Suspicious Patterns" subtitle="Prioritized queue of flagged activity" right={<LiveBadge live={live} />} />
      <div className="flex gap-2 mb-4">
        {["All", "Open", "Investigating", "Closed"].map((s) => (
          <button key={s} className={`btn ${status === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-left text-xs uppercase tracking-wider bg-[rgba(10,20,40,0.5)]">
              <th className="py-3 px-4">ID</th><th>Alert</th><th>Entity</th><th>Type</th><th>Risk</th><th>Status</th><th>Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-edge table-row">
                <td className="py-3 px-4 font-mono text-brand-blue">{a.id}</td>
                <td className="text-white font-medium">{a.title}</td>
                <td className="text-slate-300">{a.entity}</td>
                <td><span className="chip" style={{ color: "#8B5CF6", background: "rgba(139,92,246,0.12)", borderColor: "#8B5CF655" }}>{a.type}</span></td>
                <td><RiskBadge score={a.risk} level={a.level} /></td>
                <td>
                  <span className="chip" style={{
                    color: a.status === "Open" ? "#EF4444" : a.status === "Investigating" ? "#F59E0B" : "#10B981",
                    background: (a.status === "Open" ? "#EF4444" : a.status === "Investigating" ? "#F59E0B" : "#10B981") + "1f",
                  }}>{a.status}</span>
                </td>
                <td className="text-slate-500 text-xs">{a.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * 5. AI Investigation Assistant
 * ------------------------------------------------------------------------ */
const AI_SUGGESTIONS = [
  "Why is Amit Das important?",
  "Who connects Amit Das and Ravi Singh?",
  "Which accounts show circular transfers?",
  "Summarize the highest risk community",
]

function aiAnswer(question) {
  const q = question.toLowerCase()
  if (q.includes("amit") && q.includes("important")) {
    return {
      answer:
        "Amit Das is the most central node in the network with 18 direct connections and a risk score of 82/100. He bridges financial accounts (A/C ****4471), a flagged organization (Nexus Traders LLP), and communication devices. His removal would fragment the network into 4 disconnected sub-clusters, making him the single most impactful target.",
      evidence: [
        "Highest betweenness centrality (0.41) in the graph",
        "5 of his 10 primary links are marked suspicious",
        "Directly tied to a circular fund-transfer ring (AL-001)",
      ],
    }
  }
  if (q.includes("ravi") || q.includes("connect")) {
    return {
      answer:
        "The shortest path from Amit Das to Ravi Singh runs through a shared phone number and an intermediary account: Amit Das → +91 98765 43210 → A/C ****2290 → Ravi Singh. This 3-hop path includes one suspicious financial link.",
      evidence: ["Path length: 3 hops", "1 suspicious edge on the path", "Shared device indicates direct coordination"],
    }
  }
  if (q.includes("circular") || q.includes("account")) {
    return {
      answer:
        "Accounts A/C ****4471, A/C ****2290, and two linked to Nexus Traders LLP form a circular transfer ring. Funds move in a loop within 48-hour windows, a classic layering pattern consistent with money laundering.",
      evidence: ["4 accounts in the cycle", "Avg loop completion: 41 hours", "Total cycled: ₹18.6L over 3 weeks"],
    }
  }
  return {
    answer:
      "The Kolkata Logistics Ring (C1) is the highest-risk community with 42 members and a density of 0.72. It concentrates organizations and vehicles around the flagged Kolkata Warehouse and overlaps heavily with Amit Das's ego network.",
    evidence: ["Community risk: 88/100", "Density 0.72 (highly interconnected)", "Contains 3 of the top 8 influencers"],
  }
}

function AiInvestigation() {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi, I'm ByteGuard AI. Ask me anything about the network — entities, connections, or suspicious patterns." },
  ])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, thinking])

  const ask = async (question) => {
    const q = question.trim()
    if (!q || thinking) return
    setMessages((m) => [...m, { role: "user", text: q }])
    setInput("")
    setThinking(true)
    const fallback = aiAnswer(q)
    const { data } = await apiPost("/api/ai/ask", { question: q }, fallback)
    setTimeout(() => {
      setMessages((m) => [...m, { role: "ai", ...data }])
      setThinking(false)
    }, 500)
  }

  return (
    <div className="animate-in h-full flex flex-col">
      <PageHeader title="AI Investigation Assistant" subtitle="Ask ByteGuard — grounded answers with evidence" />
      <Card className="flex-1 flex flex-col p-0 overflow-hidden" style={{ minHeight: 460 }}>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "ai" && (
                <div className="w-9 h-9 rounded-xl grid place-items-center bg-gradient-to-br from-brand-blue to-brand-purple text-white shrink-0"><Bot size={18} /></div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-brand-blue text-white" : "glass"}`}>
                <p className="leading-relaxed">{m.text || m.answer}</p>
                {m.evidence && (
                  <div className="mt-3 pt-3 border-t border-edge">
                    <div className="text-xs uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1"><CheckCircle2 size={12} className="text-risk-low" /> Evidence</div>
                    <ul className="space-y-1">
                      {m.evidence.map((e, j) => (
                        <li key={j} className="text-xs text-slate-300 flex gap-2"><span className="text-brand-blue">•</span>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="w-9 h-9 rounded-xl grid place-items-center bg-[rgba(16,30,56,0.8)] border border-edge text-slate-300 shrink-0"><User size={18} /></div>
              )}
            </div>
          ))}
          {thinking && (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl grid place-items-center bg-gradient-to-br from-brand-blue to-brand-purple text-white"><Bot size={18} /></div>
              <div className="glass rounded-2xl px-4 py-3 text-sm text-slate-400">Analyzing network…</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-edge p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {AI_SUGGESTIONS.map((s) => (
              <button key={s} className="chip" style={{ color: "#93a4c3", background: "rgba(59,130,246,0.08)", borderColor: "#1E3A5F" }} onClick={() => ask(s)}>{s}</button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
            <input className="input" placeholder="Ask ByteGuard about the network..." value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn btn-primary" type="submit"><Send size={16} /></button>
          </form>
        </div>
      </Card>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * 6. Connection Path Finder (Relationships)
 * ------------------------------------------------------------------------ */
const PEOPLE = GRAPH.nodes.filter((n) => n.type === "person")

function PathFinder() {
  const [a, setA] = useState("Amit Das")
  const [b, setB] = useState("Ravi Singh")
  const [path, setPath] = useState(null)
  const [live, setLive] = useState(false)

  const find = async () => {
    const fallback = {
      path: [
        { name: a, type: "person" },
        { name: "+91 98765 43210", type: "phone" },
        { name: "A/C ****2290 (Intermediary)", type: "account" },
        { name: b, type: "person" },
      ],
      hops: 3,
      suspicious: 1,
    }
    const { data, live } = await apiPost("/api/pathfinder", { from: a, to: b }, fallback)
    setLive(live)
    setPath(data)
  }

  return (
    <div className="animate-in">
      <PageHeader title="Connection Path Finder" subtitle="Find how any two entities are linked" right={path ? <LiveBadge live={live} /> : null} />
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs text-slate-400">Person A</label>
            <select className="input mt-1" value={a} onChange={(e) => setA(e.target.value)}>
              {PEOPLE.map((p) => <option key={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Person B</label>
            <select className="input mt-1" value={b} onChange={(e) => setB(e.target.value)}>
              {PEOPLE.map((p) => <option key={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={find}><RouteIcon size={16} /> Find Path</button>
        </div>
      </Card>

      {path && (
        <Card className="mt-4 animate-in">
          <SectionTitle icon={RouteIcon} children={`Shortest Path · ${path.hops} hops · ${path.suspicious} suspicious link`} />
          <div className="flex items-center gap-2 overflow-x-auto py-4">
            {path.path.map((node, i) => {
              const m = TYPE_META[node.type] || TYPE_META.person
              return (
                <React.Fragment key={i}>
                  <div className="glass px-4 py-3 text-center shrink-0" style={{ minWidth: 130 }}>
                    <div className="w-10 h-10 rounded-xl grid place-items-center mx-auto mb-2" style={{ background: m.color + "22", color: m.color }}>
                      <m.icon size={18} />
                    </div>
                    <div className="text-sm text-white font-medium">{node.name}</div>
                    <div className="text-xs text-slate-400 capitalize">{node.type}</div>
                  </div>
                  {i < path.path.length - 1 && <ArrowRight className="text-brand-blue shrink-0" size={22} />}
                </React.Fragment>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------
 * 7. Communities / Network Clusters
 * ------------------------------------------------------------------------ */
function MiniGraph({ color }) {
  // tiny decorative cluster preview drawn with positioned dots
  const dots = useMemo(() => Array.from({ length: 9 }, () => ({
    x: 15 + Math.random() * 70, y: 15 + Math.random() * 70,
  })), [])
  return (
    <svg viewBox="0 0 100 100" className="w-full h-24">
      {dots.map((d, i) => dots.slice(i + 1).map((e, j) => (
        Math.hypot(d.x - e.x, d.y - e.y) < 40 ? (
          <line key={`${i}-${j}`} x1={d.x} y1={d.y} x2={e.x} y2={e.y} stroke={color} strokeOpacity="0.25" strokeWidth="0.8" />
        ) : null
      )))}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={i === 0 ? 4 : 2.5} fill={color} />
      ))}
    </svg>
  )
}

function Communities() {
  const navigate = useNavigate()
  return (
    <div className="animate-in">
      <PageHeader title="Communities & Network Clusters" subtitle="Auto-detected sub-networks ranked by risk" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMMUNITIES.map((c) => {
          const m = TYPE_META[c.type]
          return (
            <Card key={c.id} className="cursor-pointer" onClick={() => navigate("/network")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: m.color + "22", color: m.color }}><m.icon size={16} /></span>
                  <span className="font-mono text-xs text-slate-500">{c.id}</span>
                </div>
                <RiskBadge score={c.risk} />
              </div>
              <h3 className="font-semibold text-white mt-3">{c.name}</h3>
              <MiniGraph color={m.color} />
              <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                <span>{c.members} members</span>
                <span>Density {c.density}</span>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * 8. Data Upload
 * ------------------------------------------------------------------------ */
const SAMPLE_DATASETS = [
  { name: "demo_flows.json", desc: "Sample financial flow graph", size: "142 KB" },
  { name: "call_records.csv", desc: "Anonymized call detail records", size: "2.1 MB" },
  { name: "entities_seed.csv", desc: "Seed entity list with attributes", size: "88 KB" },
]

function DataUpload() {
  const [drag, setDrag] = useState(false)
  const [files, setFiles] = useState([])
  const inputRef = useRef(null)

  const addFiles = (list) => {
    const arr = Array.from(list).map((f) => ({ name: f.name, size: `${(f.size / 1024).toFixed(0)} KB` }))
    setFiles((prev) => [...arr, ...prev])
  }

  return (
    <div className="animate-in">
      <PageHeader title="Data Upload" subtitle="Import datasets to expand the network graph" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
            onClick={() => inputRef.current?.click()}
            className="rounded-xl border-2 border-dashed grid place-items-center text-center py-16 cursor-pointer transition-colors"
            style={{ borderColor: drag ? "#3B82F6" : "#1E3A5F", background: drag ? "rgba(59,130,246,0.06)" : "transparent" }}
          >
            <input ref={inputRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            <div className="w-14 h-14 rounded-2xl grid place-items-center bg-gradient-to-br from-brand-blue to-brand-purple text-white mb-4"><Upload size={26} /></div>
            <div className="font-semibold text-white">Drag & drop files here</div>
            <div className="text-sm text-slate-400 mt-1">or click to browse · CSV, JSON, XLSX up to 50MB</div>
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between glass p-3">
                  <div className="flex items-center gap-3"><FileText size={16} className="text-brand-blue" /><span className="text-sm text-white">{f.name}</span></div>
                  <div className="flex items-center gap-3"><span className="text-xs text-slate-400">{f.size}</span><CheckCircle2 size={16} className="text-risk-low" /></div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle icon={Boxes} children="Sample Datasets" />
          <div className="space-y-2">
            {SAMPLE_DATASETS.map((d) => (
              <div key={d.name} className="glass p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">{d.name}</span>
                  <button className="btn btn-ghost !py-1 !px-2"><Download size={14} /></button>
                </div>
                <div className="text-xs text-slate-400 mt-1">{d.desc} · {d.size}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * 9. Reports
 * ------------------------------------------------------------------------ */
function Reports() {
  return (
    <div className="animate-in">
      <PageHeader title="Reports & Exports" subtitle="Generated dossiers and data exports" right={<button className="btn btn-primary"><FileText size={16} /> New Report</button>} />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-left text-xs uppercase tracking-wider bg-[rgba(10,20,40,0.5)]">
              <th className="py-3 px-4">ID</th><th>Report</th><th>Type</th><th>Size</th><th>Date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {REPORTS.map((r) => (
              <tr key={r.id} className="border-t border-edge table-row">
                <td className="py-3 px-4 font-mono text-brand-blue">{r.id}</td>
                <td className="text-white font-medium">{r.name}</td>
                <td><span className="chip" style={{ color: "#06B6D4", background: "rgba(6,182,212,0.12)", borderColor: "#06B6D455" }}>{r.type}</span></td>
                <td className="text-slate-300">{r.size}</td>
                <td className="text-slate-400">{r.date}</td>
                <td className="pr-4 text-right"><button className="btn btn-ghost !py-1"><Download size={14} /> Download</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * Timeline + Settings (supporting views)
 * ------------------------------------------------------------------------ */
const TIMELINE = [
  { time: "2026-09-08 14:22", title: "Circular transfer detected", desc: "₹4.8L looped through 4 accounts", risk: 92 },
  { time: "2026-09-07 09:10", title: "New burner phone linked", desc: "+91 88990 12345 added to Amit Das", risk: 70 },
  { time: "2026-09-05 18:44", title: "Warehouse meeting", desc: "3 flagged entities co-located at Kolkata Warehouse", risk: 78 },
  { time: "2026-09-02 11:05", title: "Vehicle movement", desc: "WB-02-AC-1099 crossed 5 flagged zones", risk: 66 },
  { time: "2026-08-29 20:30", title: "Shell org registered", desc: "Nexus Traders LLP shares directors with flagged orgs", risk: 90 },
]

function Timeline({ compact }) {
  return (
    <div className={compact ? "" : "animate-in"}>
      {!compact && <PageHeader title="Timeline" subtitle="Chronological activity across the network" />}
      <div className="relative pl-6">
        <div className="absolute left-2 top-1 bottom-1 w-px bg-edge" />
        <div className="space-y-4">
          {TIMELINE.map((t, i) => (
            <div key={i} className="relative">
              <span className="absolute -left-[18px] top-1 w-3 h-3 rounded-full border-2 border-bg" style={{ background: riskLevel(t.risk).color }} />
              <div className="glass p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">{t.title}</span>
                  <RiskBadge score={t.risk} />
                </div>
                <p className="text-sm text-slate-400 mt-1">{t.desc}</p>
                <span className="text-xs text-slate-500">{t.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Entities() {
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const rows = GRAPH.nodes.filter((n) => n.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="animate-in">
      <PageHeader title="Entities" subtitle={`${GRAPH.nodes.length} tracked entities`} right={
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9 w-64" placeholder="Filter entities..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      } />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((n) => {
          const m = TYPE_META[n.type]
          return (
            <Card key={n.id} className="cursor-pointer flex items-center gap-3" onClick={() => navigate("/entities/amit")}>
              <div className="w-11 h-11 rounded-xl grid place-items-center" style={{ background: (n.central ? "#EF4444" : m.color) + "22", color: n.central ? "#EF4444" : m.color }}>
                <m.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">{n.name}</div>
                <div className="text-xs text-slate-400 capitalize">{n.type}</div>
              </div>
              <RiskBadge score={n.risk} />
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Settings() {
  return (
    <div className="animate-in">
      <PageHeader title="Settings" subtitle="Platform configuration" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={SettingsIcon} children="General" />
          <div className="space-y-3 text-sm">
            <Row label="Organization" value="ByteGuard HQ" />
            <Row label="Data region" value="ap-south-1" />
            <Row label="API base URL" value={<span className="font-mono text-xs">{API_BASE || "/api (proxy)"}</span>} />
          </div>
        </Card>
        <Card>
          <SectionTitle icon={ShieldAlert} children="Risk Thresholds" />
          {[["High", 80, "#EF4444"], ["Medium", 50, "#F59E0B"], ["Low", 0, "#10B981"]].map((t) => (
            <div key={t[0]} className="flex items-center justify-between py-2 border-b border-edge last:border-0">
              <span className="text-slate-300 text-sm">{t[0]}</span>
              <span className="chip" style={{ color: t[2], background: t[2] + "1f", borderColor: t[2] + "55" }}>≥ {t[1]}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * App shell + router
 * ------------------------------------------------------------------------ */
function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/network" element={<NetworkExplorer />} />
          <Route path="/entities" element={<Entities />} />
          <Route path="/entities/:id" element={<EntityProfile />} />
          <Route path="/relationships" element={<PathFinder />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/ai" element={<AiInvestigation />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)