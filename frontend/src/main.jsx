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
  nodes: [],
  links: [],
}


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
  const [graph, setGraph] = useState(GRAPH)
  const [dashboard, setDashboard] = useState(null)
  const [entities, setEntities] = useState([])

  useEffect(() => {
    apiGet("/api/network/graph", GRAPH).then((r) => {
      setLive(r.live)
      setGraph(r.data)
    })

    apiGet("/api/dashboard", null).then((r) => {
      if (r.live) {
        setDashboard(r.data)
      }
    })
    apiGet("/api/entities", []).then((r) => {
  if (r.live) {
    setEntities(r.data)
  }
})
  }, [])

  const navigate = useNavigate()
  const riskDistribution = dashboard
  ? [
      { name: "LOW", value: dashboard.risk_distribution?.LOW ?? 0, color: "#10B981" },
      { name: "MEDIUM", value: dashboard.risk_distribution?.MEDIUM ?? 0, color: "#F59E0B" },
      { name: "HIGH", value: dashboard.risk_distribution?.HIGH ?? 0, color: "#EF4444" },
      { name: "CRITICAL", value: dashboard.risk_distribution?.CRITICAL ?? 0, color: "#DC2626" },
    ]
  : RISK_DISTRIBUTION

  return (
    <div className="animate-in">
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of the monitored criminal network"
        right={<LiveBadge live={live} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
  icon={Users}
  label="Total Flows"
  value={dashboard?.total_flows ?? "—"}
  accent="#3B82F6"
  delta="Live backend data"
/>

<StatCard
  icon={GitBranch}
  label="Suspicious Flows"
  value={dashboard?.suspicious_flows ?? "—"}
  accent="#8B5CF6"
  delta="Detected by analysis"
/>

<StatCard
  icon={AlertTriangle}
  label="High Risk"
  value={dashboard?.high_risk ?? "—"}
  accent="#EF4444"
  delta="High + critical activity"
/>

<StatCard
  icon={Sparkles}
  label="Protocols"
  value={dashboard?.protocols ?? "—"}
  accent="#F59E0B"
  delta="Observed in traffic"
/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2">
          <SectionTitle icon={Share2} children="Network Overview"
            action={<button className="btn btn-ghost" onClick={() => navigate("/network")}>Open Explorer <ArrowRight size={14} /></button>} />
          <NetworkGraph data={structuredClone(graph)} height={340} onNodeClick={() => navigate("/network")} />
        </Card>

       <Card>
  <SectionTitle icon={ShieldAlert} children="Risk Distribution" />

  <div className="relative" style={{ height: 220 }}>
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={riskDistribution}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
        >
          {riskDistribution.map((e) => (
            <Cell
              key={e.name}
              fill={e.color}
              stroke="transparent"
            />
          ))}
        </Pie>

        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>

    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="text-center">
        <div className="text-3xl font-extrabold text-risk-high">
          {dashboard?.suspicious_flows ?? "—"}
        </div>

        <div className="text-[11px] text-slate-400 uppercase tracking-wider">
          Suspicious
        </div>
      </div>
    </div>
  </div>

  <div className="flex flex-wrap gap-3 justify-center mt-2">
    {riskDistribution.map((e) => (
      <div
        key={e.name}
        className="flex items-center gap-1.5 text-xs text-slate-400"
      >
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: e.color }}
        />

        {e.name}
      </div>
    ))}
  </div>
</Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card>
  <SectionTitle icon={Boxes} children="Protocol Distribution" />

  <div style={{ height: 240 }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={
          dashboard?.protocol_distribution
            ? Object.entries(dashboard.protocol_distribution).map(
                ([name, value]) => ({
                  name,
                  value,
                })
              )
            : []
        }
        margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
      >
        <XAxis
          dataKey="name"
          tick={{ fill: "#7f92b3", fontSize: 10 }}
          axisLine={{ stroke: "#1E3A5F" }}
          tickLine={false}
          angle={-25}
          textAnchor="end"
          height={50}
        />

        <YAxis
          tick={{ fill: "#7f92b3", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />

        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(59,130,246,0.08)" }}
        />

        <Bar
          dataKey="value"
          fill="#3B82F6"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  </div>
</Card>

       <Card className="lg:col-span-2">
  <SectionTitle
    icon={Sparkles}
    children="Top Network Influencers"
    action={
      <button
        className="btn btn-ghost"
        onClick={() => navigate("/entities")}
      >
        View all
      </button>
    }
  />

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
        {entities.slice(0, 6).map((row) => (
          <tr
            key={row.id}
            className="table-row border-t border-edge cursor-pointer"
            onClick={() => navigate("/entities")}
          >
            <td className="py-2.5 font-medium text-white">
              {row.name || row.label || row.id}
            </td>

            <td className="py-2.5 text-slate-300">
              {row.connections ?? 0}
            </td>

            <td className="py-2.5">
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${row.risk ?? 0}%`,
                      background: riskLevel(row.risk ?? 0).color,
                    }}
                  />
                </div>

                <span className="text-slate-300">
                  {row.risk ?? 0}
                </span>
              </div>
            </td>

            <td className="py-2.5">
              <RiskBadge
                level={riskLevel(row.risk ?? 0).label}
              />
            </td>
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
    {(dashboard?.recent_alerts ?? []).slice(0, 6).map((alert, i) => (
      <div
        key={alert.alert_id || alert.id || i}
        className="flex items-start gap-3 p-3 rounded-xl border border-edge bg-[rgba(10,20,40,0.4)]"
      >
        <div className="w-8 h-8 rounded-lg grid place-items-center bg-[rgba(239,68,68,0.14)] text-risk-high shrink-0">
          <AlertTriangle size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-slate-200">
            {alert.title ||
              alert.type ||
              alert.threat_category ||
              "Suspicious activity detected"}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span
              className="chip"
              style={{
                color: "#8B5CF6",
                background: "rgba(139,92,246,0.14)",
                borderColor: "#8B5CF655",
              }}
            >
              {alert.type ||
                alert.threat_category ||
                alert.ml?.threat_category ||
                "Suspicious Activity"}
            </span>

            <span className="text-xs text-slate-500">
              {alert.time ||
                (alert.created_at
                  ? new Date(alert.created_at).toLocaleString()
                  : "—")}
            </span>
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
  const { id } = useParams()
  const [tab, setTab] = useState("Overview")
  const [entity, setEntity] = useState(null)
  const [graph, setGraph] = useState({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const tabs = ["Overview", "Connections", "Transactions", "Locations", "Timeline"]

  useEffect(() => {
    let cancelled = false

    async function loadEntity() {
      setLoading(true)
      setError("")

      try {
        const [entitiesResult, graphResult] = await Promise.all([
          apiGet("/api/entities", []),
          apiGet("/api/network/graph", { nodes: [], links: [] }),
        ])

        if (cancelled) return

        const entities = Array.isArray(entitiesResult.data)
          ? entitiesResult.data
          : []

        const graphData = graphResult.data || { nodes: [], links: [] }

        const found = entities.find(
          (item) =>
            String(item.id) === String(id) ||
            String(item.name) === String(id) ||
            String(item.label) === String(id)
        )

        if (!found) {
          setError(`Entity "${id}" was not found.`)
          setEntity(null)
          setGraph(graphData)
          setLive(entitiesResult.live && graphResult.live)
          setLoading(false)
          return
        }

        setEntity(found)
        setGraph(graphData)
        setLive(entitiesResult.live && graphResult.live)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError("Unable to load entity details.")
          setLoading(false)
          setLive(false)
        }
      }
    }

    loadEntity()

    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="animate-in">
        <PageHeader
          title="Entity Profile"
          subtitle="Loading entity details..."
          right={
            <button
              className="btn btn-ghost"
              onClick={() => navigate("/entities")}
            >
              Back to entities
            </button>
          }
        />

        <Card>
          <div className="py-12 text-center text-slate-400">
            Loading entity information...
          </div>
        </Card>
      </div>
    )
  }

  if (error || !entity) {
    return (
      <div className="animate-in">
        <PageHeader
          title="Entity Profile"
          subtitle="Entity details unavailable"
          right={
            <button
              className="btn btn-ghost"
              onClick={() => navigate("/entities")}
            >
              Back to entities
            </button>
          }
        />

        <Card>
          <div className="py-12 text-center">
            <AlertTriangle
              size={36}
              className="mx-auto mb-3 text-risk-high"
            />
            <div className="text-white font-semibold">
              {error || "Entity not found"}
            </div>
            <p className="text-slate-400 text-sm mt-2">
              The selected entity could not be loaded from the backend.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const entityId = String(entity.id || id)
  const entityName = entity.name || entity.label || entity.id || id
  const entityType = entity.type || entity.kind || "unknown"
  const risk = Number(entity.risk || 0)
  const connectionsCount = Number(
    entity.connections || entity.connection_count || 0
  )

  const meta =
    TYPE_META[entityType] || {
      color: "#64748B",
      icon: Boxes,
      label: entityType,
    }

  const Icon = meta.icon

  // Find all graph links connected to this entity.
  const connectedLinks = (graph.links || []).filter((link) => {
    const sourceId = String(link.source?.id || link.source)
    const targetId = String(link.target?.id || link.target)

    return sourceId === entityId || targetId === entityId
  })

  // Find the other endpoint of every connection.
  const connections = connectedLinks
    .map((link) => {
      const sourceId = String(link.source?.id || link.source)
      const targetId = String(link.target?.id || link.target)

      const otherId =
        sourceId === entityId ? targetId : sourceId

      const node = (graph.nodes || []).find(
        (n) => String(n.id) === otherId
      )

      return {
        node,
        application: link.application || "Unknown",
        suspicious: Boolean(link.suspicious),
        flowId: link.flow_id || "",
      }
    })
    .filter((item) => item.node)

  const riskReasons = Array.isArray(entity.risk_reasons)
    ? entity.risk_reasons
    : []

  return (
    <div className="animate-in">
      <PageHeader
        title="Entity Profile"
        subtitle="Deep-dive entity details"
        right={
          <div className="flex items-center gap-3">
            <LiveBadge live={live} />

            <button
              className="btn btn-ghost"
              onClick={() => navigate("/entities")}
            >
              Back to entities
            </button>
          </div>
        }
      />

      <Card>
        {/* Entity header */}
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl grid place-items-center"
            style={{
              background: meta.color + "22",
              color: meta.color,
            }}
          >
            <Icon size={30} />
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-white">
                {entityName}
              </h2>

              <RiskBadge
                score={risk}
                level={
                  risk >= 80
                    ? "Critical Risk"
                    : risk >= 60
                      ? "High Risk"
                      : risk >= 30
                        ? "Medium Risk"
                        : "Low Risk"
                }
              />
            </div>

            <p className="text-slate-400 text-sm mt-1">
              {meta.label || entityType} · ID {entityId}
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wider">
              Risk Score
            </div>

            <div className="text-3xl font-extrabold text-risk-high">
              {risk}
              <span className="text-lg text-slate-500">
                /100
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5 border-b border-edge overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                tab === t
                  ? "border-brand-blue text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="pt-5">

          {/* OVERVIEW */}
          {tab === "Overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="glass p-4">
                <SectionTitle
                  icon={Icon}
                  children="Entity Information"
                />

                <div className="space-y-3 text-sm">

                  <InfoRow
                    icon={Boxes}
                    label="Type"
                    value={meta.label || entityType}
                  />

                  <InfoRow
                    icon={Activity}
                    label="Risk"
                    value={`${risk}/100`}
                  />

                  <InfoRow
                    icon={Share2}
                    label="Connections"
                    value={
                      connectionsCount ||
                      connections.length ||
                      "0"
                    }
                  />

                  <InfoRow
                    icon={ShieldAlert}
                    label="Status"
                    value={
                      risk >= 80
                        ? "Critical"
                        : risk >= 60
                          ? "High Risk"
                          : risk >= 30
                            ? "Medium Risk"
                            : "Low Risk"
                    }
                  />

                </div>
              </div>

              <div className="glass p-4">
                <SectionTitle
                  icon={Sparkles}
                  children="Risk Factors"
                />

                {riskReasons.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {riskReasons.map((reason, index) => (
                      <span
                        key={index}
                        className="chip"
                        style={{
                          color: "#EF4444",
                          background: "rgba(239,68,68,0.12)",
                          borderColor: "#EF444455",
                        }}
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    No additional risk factors were provided by
                    the backend for this entity.
                  </p>
                )}

                <p className="text-sm text-slate-400 mt-4 leading-relaxed">
                  This profile summarizes network evidence and
                  risk indicators returned by ByteGuard's backend.
                  A risk score is an investigation signal and does
                  not by itself establish wrongdoing.
                </p>
              </div>

              <div className="glass p-4 md:col-span-2">
                <SectionTitle
                  icon={Share2}
                  children="Network Summary"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                  <div className="p-3 rounded-xl bg-white/5">
                    <div className="text-xs text-slate-400">
                      Entity
                    </div>
                    <div className="text-white font-semibold mt-1">
                      {entityName}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5">
                    <div className="text-xs text-slate-400">
                      Connected entities
                    </div>
                    <div className="text-white font-semibold mt-1">
                      {connections.length}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5">
                    <div className="text-xs text-slate-400">
                      Suspicious connections
                    </div>
                    <div className="text-risk-high font-semibold mt-1">
                      {
                        connections.filter(
                          (c) => c.suspicious
                        ).length
                      }
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* CONNECTIONS */}
          {tab === "Connections" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold">
                    Connected Entities
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Connections returned by the live network graph
                  </p>
                </div>

                <span className="text-xs text-slate-400">
                  {connections.length} connections
                </span>
              </div>

              {connections.length === 0 ? (
                <div className="glass p-8 text-center text-slate-400">
                  No connections found for this entity.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">

                  {connections.map((connection, index) => {
                    const c = connection.node

                    const connectionMeta =
                      TYPE_META[c.type] || {
                        color: "#64748B",
                        icon: Boxes,
                        label: c.type || "Unknown",
                      }

                    const ConnectionIcon =
                      connectionMeta.icon

                    return (
                      <div
                        key={`${c.id}-${index}`}
                        className="glass p-3"
                      >
                        <div className="flex items-center gap-3">

                          <div
                            className="w-10 h-10 rounded-lg grid place-items-center"
                            style={{
                              background:
                                connectionMeta.color + "22",
                              color:
                                connectionMeta.color,
                            }}
                          >
                            <ConnectionIcon size={18} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-white truncate">
                              {c.name || c.label || c.id}
                            </div>

                            <div className="text-xs text-slate-400">
                              {connectionMeta.label}
                              {" · "}
                              Risk {Number(c.risk || 0)}
                            </div>
                          </div>

                        </div>

                        <div className="mt-3 pt-3 border-t border-edge flex items-center justify-between">
                          <span className="text-xs text-slate-400">
                            {connection.application}
                          </span>

                          {connection.suspicious ? (
                            <RiskBadge
                              level="Suspicious"
                              score={Number(c.risk || 0)}
                            />
                          ) : (
                            <span className="text-xs text-slate-500">
                              Normal
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                </div>
              )}
            </div>
          )}

          {/* TRANSACTIONS */}
          {tab === "Transactions" && (
            <div className="glass p-6 text-center">
              <Activity
                size={30}
                className="mx-auto mb-3 text-slate-500"
              />

              <h3 className="text-white font-semibold">
                Transaction data
              </h3>

              <p className="text-sm text-slate-400 mt-2">
                No transaction records are currently exposed by
                the network entity API for this entity.
              </p>
            </div>
          )}

          {/* LOCATIONS */}
          {tab === "Locations" && (
            <div className="glass p-6 text-center">
              <MapPin
                size={30}
                className="mx-auto mb-3 text-slate-500"
              />

              <h3 className="text-white font-semibold">
                Location data
              </h3>

              <p className="text-sm text-slate-400 mt-2">
                No location records are currently exposed by the
                backend for this network entity.
              </p>
            </div>
          )}

          {/* TIMELINE */}
          {tab === "Timeline" && (
            <Timeline compact />
          )}

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
  const [alerts, setAlerts] = useState(ALERTS)
  const [status, setStatus] = useState("All")

  useEffect(() => {
    apiGet("/api/alerts", ALERTS).then((r) => {
      setLive(r.live)
      setAlerts(r.data)
    })
  }, [])

  const rows = alerts.filter(
    (a) => status === "All" || a.status === status
  )

  return (
    <div className="animate-in">
      <PageHeader
        title="Alerts & Suspicious Patterns"
        subtitle="Prioritized queue of flagged activity"
        right={<LiveBadge live={live} />}
      />

      <div className="flex gap-2 mb-4">
        {["All", "Open", "Investigating", "Closed"].map((s) => (
          <button
            key={s}
            className={`btn ${status === s ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-left text-xs uppercase tracking-wider bg-[rgba(10,20,40,0.5)]">
              <th className="py-3 px-4">ID</th>
              <th>Alert</th>
              <th>Entity</th>
              <th>Type</th>
              <th>Risk</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((a) => (
              <tr
                key={a.id || a.alert_id || a.flow_id}
                className="border-t border-edge table-row"
              >
                <td className="py-3 px-4 font-mono text-brand-blue">
                  {a.id || a.alert_id || a.flow_id}
                </td>

                <td className="text-white font-medium">
                  {a.title}
                </td>

                <td className="text-slate-300">
                  {a.entity || a.flow_id || "—"}
                </td>

                <td>
                  <span
                    className="chip"
                    style={{
                      color: "#8B5CF6",
                      background: "rgba(139,92,246,0.12)",
                      borderColor: "#8B5CF655",
                    }}
                  >
                    {a.type || a.threat_category || a.ml?.threat_category || "Suspicious Activity"}
                  </span>
                </td>

                <td>
                  <RiskBadge
                    score={a.risk ?? a.risk_score ?? 0}
                    level={a.level || a.severity || "LOW"}
                  />
                </td>

                <td>
                  <span
                    className="chip"
                    style={{
                      color:
                        a.status === "Open"
                          ? "#EF4444"
                          : a.status === "Investigating"
                          ? "#F59E0B"
                          : "#10B981",

                      background:
                        (a.status === "Open"
                          ? "#EF4444"
                          : a.status === "Investigating"
                          ? "#F59E0B"
                          : "#10B981") + "1f",
                    }}
                  >
                    {a.status || "Open"}
                  </span>
                </td>

                <td className="text-slate-500 text-xs">
                  {a.time ||
                    (a.created_at
                      ? new Date(a.created_at).toLocaleString()
                      : "—")}
                </td>
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


function PathFinder() {
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const [entities, setEntities] = useState([])
  const [path, setPath] = useState(null)
  const [live, setLive] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    apiGet("/api/entities", []).then((r) => {
      const rows = r.data || []

      setEntities(rows)

      // Use the connected pair we already verified in Swagger
      const source = rows.find((e) => e.id === "10.0.0.197")
      const target = rows.find((e) => e.id === "104.17.66.140")

      setA(source?.id || rows[0]?.id || "")
      setB(target?.id || rows[1]?.id || "")
    })
  }, [])

  const find = async () => {
    if (!a || !b) return

    setError("")
    setPath(null)

    try {
      const res = await fetch(`${API_BASE}/api/pathfinder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          from: a,
          to: b,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setLive(false)
        setError(data.detail || `HTTP ${res.status}`)
        return
      }

      setLive(true)
      setPath(data)
    } catch (err) {
      setLive(false)
      setError("Unable to connect to the backend API.")
    }
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Connection Path Finder"
        subtitle="Find how any two entities are linked"
        right={<LiveBadge live={live} />}
      />

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs text-slate-400">
              Entity A
            </label>

            <select
              className="input mt-1"
              value={a}
              onChange={(e) => setA(e.target.value)}
            >
              <option value="">Select entity</option>

              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name || entity.label || entity.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400">
              Entity B
            </label>

            <select
              className="input mt-1"
              value={b}
              onChange={(e) => setB(e.target.value)}
            >
              <option value="">Select entity</option>

              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name || entity.label || entity.id}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary"
            onClick={find}
            disabled={!a || !b}
          >
            <RouteIcon size={16} />
            Find Path
          </button>
        </div>
      </Card>

      {error && (
        <Card className="mt-4">
          <div className="flex items-start gap-3 text-sm">
            <AlertTriangle
              size={18}
              className="text-risk-high shrink-0 mt-0.5"
            />

            <div>
              <div className="text-white font-medium">
                No path found
              </div>

              <div className="text-slate-400 mt-1">
                {error}
              </div>
            </div>
          </div>
        </Card>
      )}

      {path && (
        <Card className="mt-4 animate-in">
          <SectionTitle
            icon={RouteIcon}
            children={`Shortest Path · ${path.hops} ${
              path.hops === 1 ? "hop" : "hops"
            } · ${path.suspicious} suspicious link${
              path.suspicious === 1 ? "" : "s"
            }`}
          />

          <div className="flex items-center gap-2 overflow-x-auto py-4">
            {path.path.map((node, i) => {
              const meta =
                TYPE_META[node.type] || TYPE_META.person

              const risk = node.risk ?? 0

              return (
                <React.Fragment key={`${node.name}-${i}`}>
                  <div
                    className="glass px-4 py-3 text-center shrink-0"
                    style={{ minWidth: 150 }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl grid place-items-center mx-auto mb-2"
                      style={{
                        background: meta.color + "22",
                        color: meta.color,
                      }}
                    >
                      <meta.icon size={18} />
                    </div>

                    <div className="text-sm text-white font-medium">
                      {node.name}
                    </div>

                    <div className="text-xs text-slate-400 capitalize">
                      {node.type}
                    </div>

                    <div className="text-xs text-slate-500 mt-1">
                      Risk: {risk}
                    </div>
                  </div>

                  {i < path.path.length - 1 && (
                    <ArrowRight
                      className="text-brand-blue shrink-0"
                      size={22}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </div>

          {path.edges?.length > 0 && (
            <div className="border-t border-edge pt-4 mt-2">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">
                Connection details
              </div>

              <div className="space-y-2">
                {path.edges.map((edge, i) => (
                  <div
                    key={i}
                    className="glass px-4 py-3 flex flex-wrap items-center gap-3 text-sm"
                  >
                    <span className="text-white">
                      {edge.source}
                    </span>

                    <ArrowRight
                      size={16}
                      className="text-slate-500"
                    />

                    <span className="text-white">
                      {edge.target}
                    </span>

                    <span className="chip">
                      {edge.application || "Unknown"}
                    </span>

                    {edge.suspicious && (
                      <span className="chip text-risk-high">
                        Suspicious
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
  const [entities, setEntities] = useState([])
  const [live, setLive] = useState(false)

  useEffect(() => {
    apiGet("/api/entities", []).then((r) => {
      setLive(r.live)
      setEntities(r.data)
    })
  }, [])

  const rows = entities.filter((n) =>
    (n.name || n.label || n.id || "")
      .toLowerCase()
      .includes(q.toLowerCase())
  )

  return (
    <div className="animate-in">
      <PageHeader
        title="Entities"
        subtitle={`${entities.length} tracked entities`}
        right={
          <div className="flex items-center gap-3">
            <LiveBadge live={live} />

            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                className="input pl-9 w-64"
                placeholder="Filter entities..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((n) => {
          const m = TYPE_META[n.type] || TYPE_META.organization

          return (
            <Card
              key={n.id}
              className="cursor-pointer flex items-center gap-3"
              onClick={() => navigate("/entities")}
            >
              <div
                className="w-11 h-11 rounded-xl grid place-items-center"
                style={{
                  background:
                    (n.central ? "#EF4444" : m.color) + "22",
                  color: n.central ? "#EF4444" : m.color,
                }}
              >
                <m.icon size={20} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">
                  {n.name || n.label || n.id}
                </div>

                <div className="text-xs text-slate-400 capitalize">
                  {n.kind || n.type}
                </div>
              </div>

              <RiskBadge
                score={n.risk ?? 0}
                level={riskLevel(n.risk ?? 0).label}
              />
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