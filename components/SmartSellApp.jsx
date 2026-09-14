"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  LayoutGrid, ScanLine, Search, Store, Bookmark, LineChart, Bot, Settings,
  Camera, Upload, ArrowLeft, ArrowRight, ExternalLink,
  TrendingUp, ShieldCheck, AlertTriangle, CheckCircle2,
  XCircle, Package, Info, Sparkles, Bell, ChevronRight, Home, User, Send
} from "lucide-react";

/* ============================================================================
   DESIGN TOKENS  (unchanged visual identity — dark navy / lime accent)
   ============================================================================ */
const T = {
  bg: "#080B12", panel: "#0F1420", panel2: "#141B2B", panel3: "#1A2236",
  line: "#232C41", ink: "#EAEEF7", sub: "#8B93A8", faint: "#5B6478",
  lime: "#C6FF3D", limeDim: "#8FCC1F", blue: "#6EA8FE", amber: "#FFB84D", coral: "#FF6E6E",
};
const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');`;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round5 = (n) => Math.round(n / 5) * 5;
const fmtR = (n) => `R${Math.round(n).toLocaleString()}`;
const fmtPct = (n) => `${n.toFixed(1)}%`;

// Adaptive layout hook — mobile gets a genuinely different shell/flow, not a
// squeezed desktop view (see Quick Scan / bottom nav below).
function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

/* ============================================================================
   SMARTSELL CALCULATION ENGINE
   ----------------------------------------------------------------------------
   Pure, framework-free functions. In production this module lives in
   apps/api/src/engine/*.ts behind the Analysis Service and is called once
   marketplace connectors + AI identification return real data. Every number
   the engine cannot verify live is explicitly tagged "estimated" — never
   presented as an official fee. Swapping DEMO_CATALOGUE / MARKETPLACE_CONFIG
   for live connector output requires no changes to the functions below.
   ============================================================================ */

// ---- 1. Marketplace fee configuration (per-marketplace, pluggable) --------
const MARKETPLACE_CONFIG = {
  Takealot: { referralFeePct: 0.125, fulfilmentFee: 35, paymentFeePct: 0.015 },
  Amazon: { referralFeePct: 0.15, fulfilmentFee: 42, paymentFeePct: 0.02 },
  "Makro Marketplace": { referralFeePct: 0.10, fulfilmentFee: 28, paymentFeePct: 0.015 },
  "My own store": { referralFeePct: 0.0, fulfilmentFee: 18, paymentFeePct: 0.029 },
};

// ---- 2. Category risk / cost profiles (shipping, duty, return-rate, fragility)
const CATEGORY_PROFILES = {
  "Home & Kitchen": { shippingPct: 0.14, importDutyPct: 0.07, packaging: 9, localDelivery: 12, returnRatePct: 0.03, fragility: "medium" },
  "Electronics": { shippingPct: 0.18, importDutyPct: 0.15, packaging: 14, localDelivery: 14, returnRatePct: 0.06, fragility: "high" },
  "Sports & Outdoor": { shippingPct: 0.12, importDutyPct: 0.05, packaging: 7, localDelivery: 10, returnRatePct: 0.025, fragility: "low" },
  "Fashion & Apparel": { shippingPct: 0.10, importDutyPct: 0.04, packaging: 6, localDelivery: 9, returnRatePct: 0.08, fragility: "low" },
  "Toys & Games": { shippingPct: 0.13, importDutyPct: 0.06, packaging: 8, localDelivery: 11, returnRatePct: 0.04, fragility: "medium" },
  "Other / General": { shippingPct: 0.15, importDutyPct: 0.08, packaging: 8, localDelivery: 12, returnRatePct: 0.04, fragility: "medium" },
};

// ---- 3. Demo marketplace listings (stand-in for a live connector response)
const DEMO_CATALOGUE = [
  { img: "🧴", name: "Insulated Steel Bottle 750ml — Matte", marketplace: "Takealot", seller: "HydroGear SA", price: 479, match: 94, cls: "Exact match", cond: "New" },
  { img: "🧴", name: "750ml Stainless Steel Flask, Matte Finish", marketplace: "Makro Marketplace", seller: "UrbanGoods", price: 449, match: 91, cls: "Same model", cond: "New" },
  { img: "🧴", name: "Steel Vacuum Bottle 750ml (Various Colours)", marketplace: "Amazon", seller: "ThermoLine", price: 512, match: 78, cls: "Very similar", cond: "New" },
  { img: "🧴", name: "Insulated Sports Bottle 700ml", marketplace: "Takealot", seller: "FitFlask", price: 399, match: 61, cls: "Similar", cond: "New" },
  { img: "🧴", name: "Double-Wall Steel Tumbler 800ml", marketplace: "Amazon", seller: "VacuBrand", price: 559, match: 48, cls: "Related product", cond: "New" },
];

// ---- 4. Cost Engine: product-side costs + marketplace fees at a given price
function buildCostBreakdown({ supplierPrice, marketplace, category, referencePrice }) {
  const cat = CATEGORY_PROFILES[category];
  const mp = MARKETPLACE_CONFIG[marketplace];

  const shipping = supplierPrice * cat.shippingPct;
  const importDuty = supplierPrice * cat.importDutyPct;
  const referral = referencePrice * mp.referralFeePct;
  const payment = referencePrice * mp.paymentFeePct;
  const returnAllowance = referencePrice * cat.returnRatePct;

  const lines = [
    { label: "Supplier / product cost", value: supplierPrice, source: "user" },
    { label: `International shipping (${(cat.shippingPct * 100).toFixed(0)}% of cost)`, value: shipping, source: "estimated" },
    { label: `Import duty & handling (${(cat.importDutyPct * 100).toFixed(0)}% of cost)`, value: importDuty, source: "estimated" },
    { label: "Local transport to warehouse", value: cat.localDelivery, source: "estimated" },
    { label: "Packaging & prep", value: cat.packaging, source: "estimated" },
    { label: `${marketplace} referral fee (${(mp.referralFeePct * 100).toFixed(1)}% of price)`, value: referral, source: "estimated" },
    { label: `${marketplace} fulfilment fee (flat)`, value: mp.fulfilmentFee, source: "estimated" },
    { label: "Payment processing fee", value: payment, source: "estimated" },
    { label: `Return / replacement allowance (${(cat.returnRatePct * 100).toFixed(1)}% category avg.)`, value: returnAllowance, source: "estimated" },
  ];
  const total = lines.reduce((a, l) => a + l.value, 0);
  return { lines, total };
}

// ---- 5. Competitor analytics — derived directly from catalogue listings
function computeCompetitorStats(listings) {
  const prices = listings.map((l) => l.price).sort((a, b) => a - b);
  const n = prices.length;
  const lowest = prices[0], highest = prices[n - 1];
  const avg = prices.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 ? prices[(n - 1) / 2] : (prices[n / 2 - 1] + prices[n / 2]) / 2;
  const spread = highest - lowest;
  const spreadRatio = spread / avg;
  // More listings + wider relative spread -> rougher, less predictable competition
  const competitionLevel = clamp(n * 14 + spreadRatio * 40, 0, 100);
  return { lowest, highest, avg, median, count: n, spread, spreadRatio, competitionLevel };
}

// ---- 6. Safe selling price ladder — anchored to real cost + market data
function buildPriceLadder({ totalCostAtAvgPrice, competitorStats }) {
  const minViable = totalCostAtAvgPrice * 1.05;
  const minSafe = totalCostAtAvgPrice * 1.18;
  let recLow = Math.max(minSafe * 1.03, competitorStats.lowest * 0.98);
  let recHigh = Math.min(totalCostAtAvgPrice * 1.35, competitorStats.avg * 1.08);
  if (recHigh < recLow) recHigh = recLow * 1.06;
  const strongProfit = Math.max(totalCostAtAvgPrice * 1.45, competitorStats.highest * 0.92);
  return {
    minViable: round5(minViable),
    minSafe: round5(minSafe),
    recommendedLow: round5(recLow),
    recommendedHigh: round5(recHigh),
    strongProfit: round5(strongProfit),
  };
}

// ---- 7. Profit analysis at the recommended selling price
function buildProfitAnalysis({ supplierPrice, marketplace, category, priceLadder }) {
  const sellingPrice = round5((priceLadder.recommendedLow + priceLadder.recommendedHigh) / 2);
  const costBreakdown = buildCostBreakdown({ supplierPrice, marketplace, category, referencePrice: sellingPrice });
  const profit = sellingPrice - costBreakdown.total;
  const margin = (profit / sellingPrice) * 100;
  return { sellingPrice, costBreakdown, profit, margin };
}

// ---- 8. Safety Factor Engine — SmartSell's own decision-support metric.
//         NOT an official fee, NOT a guarantee against loss.
function computeSafetyFactor({ supplierPrice, totalCost, category, competitorStats, margin }) {
  const cat = CATEGORY_PROFILES[category];

  const knownCostRatio = supplierPrice / totalCost;
  const costConfidenceScore = clamp(55 + knownCostRatio * 45, 0, 100);

  const fragilityPenalty = { low: 0, medium: 8, high: 18 }[cat.fragility];
  const returnRiskScore = clamp(100 - cat.returnRatePct * 100 * 9 - fragilityPenalty, 0, 100);

  const volatilityPenalty = competitorStats.spreadRatio * 55;
  const competitionScore = clamp(100 - competitorStats.competitionLevel * 0.45 - volatilityPenalty, 0, 100);

  const marginCushion = clamp((margin - 15) * 0.3, -10, 10);

  const confidence = Math.round(
    clamp(costConfidenceScore * 0.35 + returnRiskScore * 0.35 + competitionScore * 0.30 + marginCushion, 0, 100)
  );
  const factor = +(1 + (confidence / 100) * 1.3).toFixed(2);
  const riskLevel = confidence >= 75 ? "Low" : confidence >= 50 ? "Medium" : "High";

  return {
    confidence, factor, riskLevel,
    subScores: {
      costConfidenceScore: Math.round(costConfidenceScore),
      returnRiskScore: Math.round(returnRiskScore),
      competitionScore: Math.round(competitionScore),
    },
  };
}

// ---- 9. Product Opportunity Score — transparent weighted composite
function computeOpportunityScore({ margin, competitorStats, safetyFactor, sellingPrice }) {
  const profitability = clamp((margin / 45) * 100, 0, 100);
  const competition = clamp(100 - competitorStats.competitionLevel, 0, 100);
  const demand = clamp(competitorStats.count * 16, 0, 100);
  const risk = safetyFactor.confidence;
  const priceGapPct = ((sellingPrice - competitorStats.avg) / competitorStats.avg) * 100;
  const priceAdvantage = clamp(100 - Math.max(priceGapPct, 0) * 6 - Math.max(-priceGapPct, 0) * 1.5, 0, 100);

  const weighted =
    profitability * 0.30 + competition * 0.15 + demand * 0.20 + risk * 0.20 + priceAdvantage * 0.15;
  const score = Math.round(weighted);
  const decision = score >= 75 ? "good" : score >= 50 ? "caution" : "avoid";

  return {
    score, decision,
    breakdown: [
      { label: "Profitability", value: Math.round(profitability) },
      { label: "Competition", value: Math.round(competition) },
      { label: "Demand confidence", value: Math.round(demand) },
      { label: "Risk", value: Math.round(risk) },
      { label: "Price advantage", value: Math.round(priceAdvantage) },
    ],
  };
}

// ---- 10. Recommended test quantity — encourages small, controlled testing
function recommendTestQuantity({ supplierPrice, safetyFactor, opportunity }) {
  let qty, reason;
  if (opportunity.score >= 75 && safetyFactor.confidence >= 70) {
    qty = 10; reason = "High opportunity score and strong Safety Factor confidence support a larger initial batch.";
  } else if (opportunity.score >= 50) {
    qty = 5; reason = "Moderate competition and unvalidated demand — test a small batch before committing more capital.";
  } else {
    qty = 2; reason = "Low confidence in this product — validate with a minimal batch before any further investment.";
  }
  return { qty, reason, capitalExposure: qty * supplierPrice };
}

// ---- 11. Orchestrator — runs the full pipeline in the documented order
function runSmartSellAnalysis({ productName, supplierPrice, marketplace, category }) {
  const competitorStats = computeCompetitorStats(DEMO_CATALOGUE);
  const refCost = buildCostBreakdown({ supplierPrice, marketplace, category, referencePrice: competitorStats.avg });
  const priceLadder = buildPriceLadder({ totalCostAtAvgPrice: refCost.total, competitorStats });
  const profitAnalysis = buildProfitAnalysis({ supplierPrice, marketplace, category, priceLadder });
  const safetyFactor = computeSafetyFactor({
    supplierPrice, totalCost: profitAnalysis.costBreakdown.total, category, competitorStats, margin: profitAnalysis.margin,
  });
  const opportunity = computeOpportunityScore({
    margin: profitAnalysis.margin, competitorStats, safetyFactor, sellingPrice: profitAnalysis.sellingPrice,
  });
  const testQuantity = recommendTestQuantity({ supplierPrice, safetyFactor, opportunity });

  return { productName, supplierPrice, marketplace, category, competitorStats, priceLadder, profitAnalysis, safetyFactor, opportunity, testQuantity };
}

// ---- 12. Scenario Simulator — same engine functions, called on every input
//          change instead of once on submit. No new formulas, no duplication.
function simulateScenario({ supplierPrice, sellingPrice, marketplace, category, quantity }) {
  const competitorStats = computeCompetitorStats(DEMO_CATALOGUE);
  const costBreakdown = buildCostBreakdown({ supplierPrice, marketplace, category, referencePrice: sellingPrice });
  const profit = sellingPrice - costBreakdown.total;
  const margin = (profit / sellingPrice) * 100;
  const safetyFactor = computeSafetyFactor({ supplierPrice, totalCost: costBreakdown.total, category, competitorStats, margin });
  const opportunity = computeOpportunityScore({ margin, competitorStats, safetyFactor, sellingPrice });
  return {
    competitorStats, costBreakdown, profit, margin, safetyFactor, opportunity,
    totalProfit: profit * quantity,
    capitalExposure: supplierPrice * quantity,
  };
}

/* ============================================================================
   STATIC / UI-ONLY MOCK DATA  (screens not yet wired to the engine)
   ============================================================================ */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "scan", label: "Scan Product", icon: ScanLine },
  { id: "research", label: "Product Research", icon: Search },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "watchlist", label: "Watchlist", icon: Bookmark },
  { id: "simulator", label: "Profit Simulator", icon: LineChart },
  { id: "assistant", label: "AI Assistant", icon: Bot },
  { id: "settings", label: "Settings", icon: Settings },
];
const STATS = [
  { label: "Products analysed", value: "128", delta: "+12 this week" },
  { label: "Good opportunities", value: "34", tone: T.lime },
  { label: "Caution", value: "19", tone: T.amber },
  { label: "Avoid", value: "11", tone: T.coral },
  { label: "Avg. opportunity score", value: "71/100" },
  { label: "Potential profit tracked", value: "R48,230" },
];
const RECENT = [
  { name: "Insulated Steel Water Bottle 750ml", score: 87, decision: "good", price: "R479" },
  { name: "Bluetooth Neck Fan", score: 54, decision: "caution", price: "R329" },
  { name: "Ceramic Knife Set (5pc)", score: 29, decision: "avoid", price: "R249" },
  { name: "Foldable Laptop Stand — Aluminium", score: 79, decision: "good", price: "R389" },
];
const SOURCE_META = {
  verified: { label: "Verified", color: T.lime },
  user: { label: "User entered", color: T.blue },
  estimated: { label: "Estimated", color: T.amber },
};
const WATCHLIST = [
  { name: "Insulated Steel Water Bottle 750ml", score: 87, alert: "Competitor dropped price to R459", time: "3h ago" },
  { name: "Foldable Laptop Stand — Aluminium", score: 79, alert: "2 new competing listings found", time: "1d ago" },
  { name: "Bluetooth Neck Fan", score: 54, alert: null, time: null },
];

/* ============================================================================
   UI PRIMITIVES (unchanged)
   ============================================================================ */
function Card({ children, style, className }) {
  return (
    <div className={className} style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 18, padding: 20, ...style }}>
      {children}
    </div>
  );
}
function Pill({ children, color = T.sub, bg = "transparent", border }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, color, background: bg, border: border || `1px solid ${T.line}`, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
function DecisionBadge({ decision, size = "md" }) {
  const map = {
    good: { label: "Good opportunity", color: T.lime, Icon: CheckCircle2, bg: "rgba(198,255,61,0.1)" },
    caution: { label: "Caution", color: T.amber, Icon: AlertTriangle, bg: "rgba(255,184,77,0.1)" },
    avoid: { label: "Avoid", color: T.coral, Icon: XCircle, bg: "rgba(255,110,110,0.1)" },
  };
  const d = map[decision];
  const big = size === "lg";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: big ? "10px 16px" : "5px 12px", borderRadius: 999, background: d.bg, border: `1px solid ${d.color}55`, color: d.color, fontWeight: 700, fontSize: big ? 15 : 12.5 }}>
      <d.Icon size={big ? 18 : 14} />{d.label}
    </div>
  );
}
function Bar({ pct, color = T.lime, track = T.panel3, h = 8 }) {
  return <div style={{ height: h, borderRadius: 99, background: track, overflow: "hidden" }}><div style={{ width: `${clamp(pct,0,100)}%`, height: "100%", background: color, borderRadius: 99 }} /></div>;
}
function SectionTitle({ icon: Icon, title, tag }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {Icon && <Icon size={17} color={T.lime} />}
        <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: T.ink }}>{title}</h3>
      </div>
      {tag}
    </div>
  );
}

/* ============================================================================
   SIDEBAR / TOPBAR (unchanged)
   ============================================================================ */
function Sidebar({ view, setView }) {
  return (
    <div style={{ width: 232, flexShrink: 0, background: T.panel, borderRight: `1px solid ${T.line}`, display: "flex", flexDirection: "column", padding: "22px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 30 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: T.lime, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={16} color="#0A0E17" />
        </div>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: T.ink }}>SmartSell</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) => {
          const active = view === n.id;
          return (
            <button key={n.id} onClick={() => setView(n.id)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 11, border: "none", background: active ? T.panel3 : "transparent", color: active ? T.ink : T.sub, fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", textAlign: "left", borderLeft: active ? `2px solid ${T.lime}` : "2px solid transparent" }}>
              <n.icon size={16} color={active ? T.lime : T.faint} />{n.label}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: "auto" }}>
        <Card style={{ padding: 14, background: T.panel3 }}>
          <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>Free plan</div>
          <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 10 }}>7 of 10 scans used this month</div>
          <Bar pct={70} />
        </Card>
      </div>
    </div>
  );
}
function Topbar({ title, onScan }) {
  return (
    <div style={{ height: 66, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", borderBottom: `1px solid ${T.line}`, background: T.bg }}>
      <h1 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 21, fontWeight: 600, color: T.ink }}>{title}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onScan} style={{ display: "flex", alignItems: "center", gap: 7, background: T.lime, color: "#0A0E17", border: "none", borderRadius: 11, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
          <ScanLine size={15} /> Scan a product
        </button>
        <div style={{ position: "relative" }}>
          <Bell size={18} color={T.sub} />
          <div style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: 99, background: T.coral }} />
        </div>
        <div style={{ width: 32, height: 32, borderRadius: 99, background: T.panel3, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: T.ink }}>TM</div>
      </div>
    </div>
  );
}

/* ============================================================================
   MOBILE SHELL — bottom tab bar with an elevated Scan button, per spec
   (Home, Scan, Research, Watchlist, Profile — not a shrunk desktop sidebar)
   ============================================================================ */
function MobileTopBar({ title }) {
  return (
    <div style={{ height: 56, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", borderBottom: `1px solid ${T.line}`, background: T.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: T.lime, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={14} color="#0A0E17" />
        </div>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: T.ink }}>{title}</span>
      </div>
      <div style={{ position: "relative" }}>
        <Bell size={17} color={T.sub} />
        <div style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: 99, background: T.coral }} />
      </div>
    </div>
  );
}

function MobileBottomNav({ view, setView }) {
  const items = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "research", label: "Research", icon: Search },
    { id: "scan", label: "Scan", icon: ScanLine, elevated: true },
    { id: "watchlist", label: "Watchlist", icon: Bookmark },
    { id: "settings", label: "Profile", icon: User },
  ];
  return (
    <div style={{ height: 74, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-around", borderTop: `1px solid ${T.line}`, background: T.panel }}>
      {items.map((it) => {
        const active = view === it.id || (it.id === "scan" && (view === "analysis" || view === "simulator"));
        if (it.elevated) {
          return (
            <button key={it.id} onClick={() => setView(it.id)} style={{ position: "relative", top: -20, width: 56, height: 56, borderRadius: 99, background: T.lime, border: `4px solid ${T.bg}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 14px rgba(198,255,61,0.25)" }}>
              <it.icon size={22} color="#0A0E17" />
            </button>
          );
        }
        return (
          <button key={it.id} onClick={() => setView(it.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: active ? T.lime : T.faint }}>
            <it.icon size={18} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
   DASHBOARD
   ============================================================================ */
function Dashboard({ setView, isMobile }) {
  return (
    <div style={{ padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap: isMobile ? 16 : 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: isMobile ? 10 : 16 }}>
        {STATS.map((s) => (
          <Card key={s.label}>
            <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: s.tone || T.ink }}>{s.value}</div>
            {s.delta && <div style={{ fontSize: 11.5, color: T.faint, marginTop: 6 }}>{s.delta}</div>}
          </Card>
        ))}
      </div>
      <Card>
        <SectionTitle icon={LayoutGrid} title="Recent analyses" tag={<button onClick={() => setView("research")} style={{ background: "none", border: "none", color: T.blue, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>View all <ChevronRight size={13} /></button>} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {RECENT.map((r) => (
            <div key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: T.panel3, borderRadius: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: T.panel, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>📦</div>
                <div>
                  <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: T.faint, marginTop: 2 }}>Recommended: {r.price}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 13, color: T.sub, fontWeight: 600 }}>{r.score}/100</div>
                <DecisionBadge decision={r.decision} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================================
   QUICK SCAN — mobile-only minimal flow: photo/name, price, Analyse.
   Deliberately not the full desktop form; advanced fields are tucked away.
   ============================================================================ */
function QuickScanView({ onAnalyse }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [marketplace, setMarketplace] = useState("Takealot");
  const [category, setCategory] = useState("Home & Kitchen");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = () => {
    const supplierPrice = parseFloat(price);
    if (!supplierPrice || supplierPrice <= 0) { setError("Enter what you'd pay your supplier."); return; }
    setError("");
    setBusy(true);
    setTimeout(() => {
      const result = runSmartSellAnalysis({ productName: name.trim() || "Scanned product", supplierPrice, marketplace, category });
      setBusy(false);
      onAnalyse(result);
    }, 1100);
  };

  return (
    <div style={{ padding: "18px 18px 28px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 480, margin: "0 auto" }}>
      <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700, color: T.ink }}>Quick Scan</div>
        <div style={{ fontSize: 12, color: T.faint, marginTop: 4 }}>Photo, price, go.</div>
      </div>

      <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "30px 20px" }}>
        <div style={{ width: 78, height: 78, borderRadius: 22, background: T.panel3, display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px dashed ${T.line}` }}>
          <Camera size={28} color={T.lime} />
        </div>
        <button style={{ background: T.lime, color: "#0A0E17", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>Take photo</button>
        <div style={{ fontSize: 11, color: T.faint }}>or type the product name below</div>
      </Card>

      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name (optional if photo taken)" style={{ width: "100%", background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 12, padding: "13px 14px", color: T.ink, fontSize: 14, boxSizing: "border-box" }} />

      <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Supplier price (ZAR)" style={{ width: "100%", background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 12, padding: "13px 14px", color: T.ink, fontSize: 14, boxSizing: "border-box" }} />

      <button onClick={() => setShowAdvanced((s) => !s)} style={{ background: "none", border: "none", color: T.blue, fontSize: 12, textAlign: "left", cursor: "pointer", padding: 0 }}>
        {showAdvanced ? "Hide" : "Marketplace & category"} options
      </button>
      {showAdvanced && (
        <div style={{ display: "flex", gap: 10 }}>
          <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)} style={{ flex: 1, background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 12px", color: T.ink, fontSize: 12.5 }}>
            {Object.keys(MARKETPLACE_CONFIG).map((m) => <option key={m}>{m}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: 1, background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 12px", color: T.ink, fontSize: 12.5 }}>
            {Object.keys(CATEGORY_PROFILES).map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 12px", background: "rgba(255,110,110,0.08)", border: `1px solid ${T.coral}44`, borderRadius: 10, color: T.coral, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <button onClick={run} disabled={busy} style={{ width: "100%", background: T.lime, color: "#0A0E17", border: "none", borderRadius: 13, padding: "15px", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
        {busy ? "Analysing…" : "Analyse"}
      </button>
    </div>
  );
}

/* ============================================================================
   SCAN VIEW — now a real form feeding the engine
   ============================================================================ */
function ScanView({ onAnalyse }) {
  const [name, setName] = useState("Insulated Steel Water Bottle 750ml");
  const [price, setPrice] = useState("200");
  const [marketplace, setMarketplace] = useState("Takealot");
  const [category, setCategory] = useState("Home & Kitchen");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = () => {
    const supplierPrice = parseFloat(price);
    if (!name.trim()) { setError("Enter a product name so SmartSell knows what it's analysing."); return; }
    if (!supplierPrice || supplierPrice <= 0) { setError("Enter a valid supplier price greater than 0."); return; }
    setError("");
    setBusy(true);
    setTimeout(() => {
      const result = runSmartSellAnalysis({ productName: name.trim(), supplierPrice, marketplace, category });
      setBusy(false);
      onAnalyse(result);
    }, 1100);
  };

  return (
    <div style={{ padding: 28, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, maxWidth: 1100 }}>
      <Card>
        <SectionTitle icon={Camera} title="Identify your product" />
        <div style={{ border: `1.5px dashed ${T.line}`, borderRadius: 16, padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: T.panel3, marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: T.panel, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Upload size={22} color={T.lime} />
          </div>
          <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 500 }}>Drop a product photo, or take one</div>
          <div style={{ fontSize: 11.5, color: T.faint }}>JPG, PNG — image identification is not wired up in this preview</div>
          <button style={{ marginTop: 4, background: T.panel, border: `1px solid ${T.line}`, color: T.ink, borderRadius: 10, padding: "8px 14px", fontSize: 12.5, cursor: "pointer" }}>Choose photo</button>
        </div>

        <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 18 }}>— or skip the photo and type it in —</div>

        <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Product name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 11, padding: "11px 14px", color: T.ink, fontSize: 13.5, marginBottom: 16, boxSizing: "border-box" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Supplier / purchase price (ZAR)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" style={{ width: "100%", background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 11, padding: "11px 14px", color: T.ink, fontSize: 13.5, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Target marketplace</label>
            <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)} style={{ width: "100%", background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 11, padding: "11px 14px", color: T.ink, fontSize: 13.5, boxSizing: "border-box" }}>
              {Object.keys(MARKETPLACE_CONFIG).map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Product category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%", background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 11, padding: "11px 14px", color: T.ink, fontSize: 13.5, boxSizing: "border-box" }}>
          {Object.keys(CATEGORY_PROFILES).map((c) => <option key={c}>{c}</option>)}
        </select>

        {error && (
          <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(255,110,110,0.08)", border: `1px solid ${T.coral}44`, borderRadius: 10, color: T.coral, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <button onClick={run} disabled={busy} style={{ marginTop: 22, width: "100%", background: T.lime, color: "#0A0E17", border: "none", borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Running cost, safety & opportunity engine…" : (<>Analyse product <ArrowRight size={16} /></>)}
        </button>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Info size={15} color={T.blue} /><div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>What SmartSell will calculate</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {["Landed cost from your supplier price + category assumptions", "Competitor price spread from matching listings", "A dynamic Safety Factor from cost, return & competition risk", "A safe price ladder anchored to your real cost", "Profit, margin & an overall Opportunity Score"].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: T.sub }}>
                <div style={{ width: 5, height: 5, borderRadius: 99, background: T.lime, flexShrink: 0 }} />{t}
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ background: "rgba(255,184,77,0.06)", border: `1px solid ${T.amber}33` }}>
          <div style={{ display: "flex", gap: 9 }}>
            <AlertTriangle size={16} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.6 }}>
              The math below runs for real on whatever price and category you enter. The competing listings themselves are still <strong style={{ color: T.ink }}>demo catalogue data</strong> — a live marketplace connector plugs into the same engine functions.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
   ANALYSIS VIEW — fully driven by the engine output
   ============================================================================ */
function AnalysisView({ data, onBack, onOpenSimulator, onSaveToComparison, isMobile }) {
  const [sort, setSort] = useState("Best Match");
  const [saved, setSaved] = useState(false);
  const { productName, marketplace, competitorStats, priceLadder, profitAnalysis, safetyFactor, opportunity, testQuantity } = data;
  const competitionLabel = competitorStats.competitionLevel >= 66 ? "High" : competitorStats.competitionLevel >= 33 ? "Moderate" : "Low";
  const competitionColor = competitorStats.competitionLevel >= 66 ? T.coral : competitorStats.competitionLevel >= 33 ? T.amber : T.lime;

  return (
    <div style={{ padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap: isMobile ? 14 : 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.sub, fontSize: 12.5, cursor: "pointer", width: "fit-content" }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { onSaveToComparison(data); setSaved(true); }}
            disabled={saved}
            style={{ display: "flex", alignItems: "center", gap: 6, background: saved ? "rgba(198,255,61,0.1)" : T.panel3, border: `1px solid ${saved ? T.lime + "55" : T.line}`, color: saved ? T.lime : T.ink, fontSize: 12.5, fontWeight: 600, cursor: saved ? "default" : "pointer", padding: "8px 14px", borderRadius: 10 }}
          >
            <Bookmark size={14} color={saved ? T.lime : T.faint} /> {saved ? "Saved" : "Save to Compare"}
          </button>
          <button onClick={onOpenSimulator} style={{ display: "flex", alignItems: "center", gap: 6, background: T.panel3, border: `1px solid ${T.line}`, color: T.ink, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "8px 14px", borderRadius: 10 }}>
            <LineChart size={14} color={T.lime} /> {isMobile ? "Simulator" : "Open in Simulator"}
          </button>
        </div>
      </div>

      <Card style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 14 : 0, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: T.panel3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🧴</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: T.ink, fontFamily: "'Space Grotesk', sans-serif" }}>{productName}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <Pill color={T.lime} border={`1px solid ${T.lime}55`} bg="rgba(198,255,61,0.08)">94% match · Exact / near-exact (demo AI)</Pill>
              <Pill color={T.blue}>{marketplace}</Pill>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 6 }}>Final decision</div>
          <DecisionBadge decision={opportunity.decision} size="lg" />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? 10 : 16 }}>
        <Card>
          <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>Product opportunity</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, color: opportunity.score >= 75 ? T.lime : opportunity.score >= 50 ? T.amber : T.coral }}>
            {opportunity.score}<span style={{ fontSize: 15, color: T.faint }}>/100</span>
          </div>
          <div style={{ fontSize: 11.5, color: T.faint, marginTop: 4 }}>
            {opportunity.score >= 75 ? "Strong opportunity" : opportunity.score >= 50 ? "Worth a cautious test" : "High risk of loss"}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>Safety Factor</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, color: T.ink }}>{safetyFactor.factor}×</div>
          <div style={{ fontSize: 11.5, color: safetyFactor.riskLevel === "Low" ? T.lime : safetyFactor.riskLevel === "Medium" ? T.amber : T.coral, marginTop: 4 }}>
            Risk: {safetyFactor.riskLevel} · Confidence {safetyFactor.confidence}%
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>Recommended test quantity</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, color: T.ink }}>{testQuantity.qty} <span style={{ fontSize: 14, color: T.faint }}>units</span></div>
          <div style={{ fontSize: 11.5, color: T.faint, marginTop: 4 }}>Capital exposure: {fmtR(testQuantity.capitalExposure)}</div>
        </Card>
      </div>

      <Card>
        <SectionTitle icon={Package} title="Matching product catalogue" tag={
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ background: T.panel3, border: `1px solid ${T.line}`, color: T.sub, fontSize: 12, borderRadius: 9, padding: "6px 10px" }}>
            <option>Best Match</option><option>Lowest Price</option><option>Highest Price</option><option>Marketplace</option>
          </select>
        } />
        <div style={{ fontSize: 11, color: T.faint, marginBottom: 10 }}>Demo catalogue — the competitor statistics below are calculated live from these listings.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...DEMO_CATALOGUE]
            .sort((a, b) => sort === "Lowest Price" ? a.price - b.price : sort === "Highest Price" ? b.price - a.price : sort === "Marketplace" ? a.marketplace.localeCompare(b.marketplace) : b.match - a.match)
            .map((c) => (
              isMobile ? (
                <div key={c.name} style={{ padding: "12px 12px", background: T.panel3, borderRadius: 12, fontSize: 12.5 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 18 }}>{c.img}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: T.ink, fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>{c.seller} · {c.marketplace}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: T.ink, fontWeight: 700 }}>{fmtR(c.price)}</span>
                    <Pill color={c.match >= 85 ? T.lime : c.match >= 65 ? T.blue : T.amber}>{c.match}% · {c.cls}</Pill>
                  </div>
                </div>
              ) : (
              <div key={c.name} style={{ display: "grid", gridTemplateColumns: "40px 2fr 1fr 1fr 0.8fr 0.9fr 24px", alignItems: "center", gap: 12, padding: "11px 12px", background: T.panel3, borderRadius: 12, fontSize: 12.5 }}>
                <div style={{ fontSize: 18 }}>{c.img}</div>
                <div style={{ color: T.ink }}>{c.name}<div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>{c.seller} · {c.cond}</div></div>
                <div style={{ color: T.sub }}>{c.marketplace}</div>
                <div style={{ color: T.ink, fontWeight: 700 }}>{fmtR(c.price)}</div>
                <Pill color={c.match >= 85 ? T.lime : c.match >= 65 ? T.blue : T.amber}>{c.match}%</Pill>
                <div style={{ color: T.faint }}>{c.cls}</div>
                <ExternalLink size={13} color={T.faint} />
              </div>
              )
            ))}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 14 : 16 }}>
        <Card>
          <SectionTitle icon={TrendingUp} title="Competitor price analysis" />
          <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 14 }}>{competitorStats.count} competing listings found across {new Set(DEMO_CATALOGUE.map(c => c.marketplace)).size} marketplaces</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
            <span style={{ color: T.sub }}>Competition level</span><span style={{ color: T.ink, fontWeight: 600 }}>{competitionLabel}</span>
          </div>
          <Bar pct={competitorStats.competitionLevel} color={competitionColor} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 18 }}>
            {[["Lowest", competitorStats.lowest], ["Average", competitorStats.avg], ["Median", competitorStats.median], ["Highest", competitorStats.highest]].map(([l, v]) => (
              <div key={l}><div style={{ fontSize: 11, color: T.faint }}>{l}</div><div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginTop: 3 }}>{fmtR(v)}</div></div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "10px 12px", background: "rgba(198,255,61,0.06)", borderRadius: 10, border: `1px solid ${T.lime}33`, fontSize: 12, color: T.sub }}>
            Recommended pricing position: <strong style={{ color: T.lime }}>{fmtR(priceLadder.recommendedLow)} – {fmtR(priceLadder.recommendedHigh)}</strong>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={ShieldCheck} title="Opportunity score breakdown" />
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {opportunity.breakdown.map((o) => (
              <div key={o.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                  <span style={{ color: T.sub }}>{o.label}</span><span style={{ color: T.ink, fontWeight: 600 }}>{o.value}</span>
                </div>
                <Bar pct={o.value} color={o.value >= 80 ? T.lime : o.value >= 60 ? T.blue : T.amber} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle icon={Package} title="True cost / landed cost breakdown" tag={<Pill color={T.amber}>Selling price used: {fmtR(profitAnalysis.sellingPrice)}</Pill>} />
        <div style={{ fontSize: 11, color: T.faint, marginBottom: 10 }}>No live marketplace fee connector is active — every line below is a calculated estimate from a configurable rate table, not a live-verified fee.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {profitAnalysis.costBreakdown.lines.map((c) => (
            <div key={c.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 4px", borderBottom: `1px solid ${T.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: T.ink }}>{c.label}</span>
                <Pill color={SOURCE_META[c.source].color}>{SOURCE_META[c.source].label}</Pill>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{fmtR(c.value)}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 4px 4px" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Total estimated cost</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: T.lime }}>{fmtR(profitAnalysis.costBreakdown.total)}</span>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 14 : 16 }}>
        <Card>
          <SectionTitle icon={LineChart} title="Safe selling price" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[["Minimum viable", priceLadder.minViable, T.coral], ["Minimum safe", priceLadder.minSafe, T.amber], ["Recommended", `${fmtR(priceLadder.recommendedLow)} – ${fmtR(priceLadder.recommendedHigh)}`, T.lime], ["Strong profit", priceLadder.strongProfit, T.blue]].map(([l, v, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: T.panel3, borderRadius: 10 }}>
                <span style={{ fontSize: 12.5, color: T.sub }}>{l}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{typeof v === "number" ? fmtR(v) : v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={TrendingUp} title="Profit analysis" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Selling price", fmtR(profitAnalysis.sellingPrice)], ["Total estimated cost", fmtR(profitAnalysis.costBreakdown.total)], ["Estimated profit", fmtR(profitAnalysis.profit)], ["Profit margin", fmtPct(profitAnalysis.margin)]].map(([l, v]) => (
              <div key={l}><div style={{ fontSize: 11.5, color: T.faint }}>{l}</div><div style={{ fontSize: 17, fontWeight: 700, color: profitAnalysis.profit < 0 && l === "Estimated profit" ? T.coral : T.ink, marginTop: 3 }}>{v}</div></div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle icon={ShieldCheck} title="What affects your Safety Factor?" />
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.6 }}>
          The Safety Factor is SmartSell's internal risk/profitability metric — not an official marketplace fee, and not a guarantee against loss. It weighs cost certainty, return risk and competition/price volatility from this analysis.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10 }}>
          {[["Cost estimate confidence", safetyFactor.subScores.costConfidenceScore], ["Return / replacement risk", safetyFactor.subScores.returnRiskScore], ["Competition & price volatility", safetyFactor.subScores.competitionScore]].map(([l, v]) => (
            <div key={l} style={{ padding: 12, background: T.panel3, borderRadius: 11 }}>
              <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 8 }}>{l}</div>
              <Bar pct={v} color={v >= 70 ? T.lime : v >= 45 ? T.amber : T.coral} />
              <div style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>{v}/100</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ background: "rgba(110,168,254,0.06)", border: `1px solid ${T.blue}33` }}>
        <div style={{ display: "flex", gap: 9 }}>
          <Info size={16} color={T.blue} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.6 }}>
            <strong style={{ color: T.ink }}>Why {testQuantity.qty} units?</strong> {testQuantity.reason}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================================
   PROFIT SIMULATOR — live sliders over the same engine, no new formulas
   ============================================================================ */
function SliderRow({ label, value, onChange, min, max, step, format }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, color: T.sub }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: T.lime, cursor: "pointer" }}
      />
    </div>
  );
}

function SimulatorView({ seed, isMobile }) {
  const [supplierPrice, setSupplierPrice] = useState(seed?.supplierPrice ?? 200);
  const [sellingPrice, setSellingPrice] = useState(seed?.sellingPrice ?? 480);
  const [marketplace, setMarketplace] = useState(seed?.marketplace ?? "Takealot");
  const [category, setCategory] = useState(seed?.category ?? "Home & Kitchen");
  const [quantity, setQuantity] = useState(5);

  const result = simulateScenario({ supplierPrice, sellingPrice, marketplace, category, quantity });
  const { profit, margin, safetyFactor, opportunity, competitorStats, costBreakdown, totalProfit, capitalExposure } = result;

  return (
    <div style={{ padding: isMobile ? 16 : 28, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.1fr", gap: isMobile ? 16 : 20 }}>
      <Card>
        <SectionTitle icon={LineChart} title="Adjust the scenario" tag={<Pill color={T.blue}>Live</Pill>} />

        <SliderRow label="Selling price" value={sellingPrice} onChange={setSellingPrice} min={Math.max(20, supplierPrice)} max={supplierPrice * 6} step={5} format={fmtR} />
        <SliderRow label="Supplier / purchase cost" value={supplierPrice} onChange={setSupplierPrice} min={10} max={2000} step={5} format={fmtR} />
        <SliderRow label="Test quantity" value={quantity} onChange={setQuantity} min={1} max={50} step={1} format={(n) => `${n} units`} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 6 }}>
          <div>
            <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Marketplace</label>
            <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)} style={{ width: "100%", background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 11, padding: "11px 14px", color: T.ink, fontSize: 13.5, boxSizing: "border-box" }}>
              {Object.keys(MARKETPLACE_CONFIG).map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.sub, display: "block", marginBottom: 6 }}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%", background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 11, padding: "11px 14px", color: T.ink, fontSize: 13.5, boxSizing: "border-box" }}>
              {Object.keys(CATEGORY_PROFILES).map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 18, padding: "10px 12px", background: T.panel3, borderRadius: 10, fontSize: 11.5, color: T.faint, lineHeight: 1.6 }}>
          Every change re-runs the same Cost, Safety Factor and Opportunity Score engine used on the Analysis page — nothing here is a separate calculation.
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>Profit per unit</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: profit >= 0 ? T.lime : T.coral }}>{fmtR(profit)}</div>
            <div style={{ fontSize: 11.5, color: T.faint, marginTop: 4 }}>Margin {fmtPct(margin)}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>Total profit ({quantity} units)</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: totalProfit >= 0 ? T.lime : T.coral }}>{fmtR(totalProfit)}</div>
            <div style={{ fontSize: 11.5, color: T.faint, marginTop: 4 }}>Capital exposure {fmtR(capitalExposure)}</div>
          </Card>
        </div>

        <Card>
          <SectionTitle icon={ShieldCheck} title="Safety Factor & opportunity" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 4 }}>Safety Factor</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>{safetyFactor.factor}×</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 4 }}>Risk level</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: safetyFactor.riskLevel === "Low" ? T.lime : safetyFactor.riskLevel === "Medium" ? T.amber : T.coral }}>{safetyFactor.riskLevel}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 4 }}>Opportunity score</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.ink }}>{opportunity.score}/100</div>
            </div>
          </div>
          <DecisionBadge decision={opportunity.decision} size="lg" />
        </Card>

        <Card>
          <SectionTitle icon={TrendingUp} title="Where this price sits vs. the market" />
          <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 10 }}>
            Competitor range: {fmtR(competitorStats.lowest)} – {fmtR(competitorStats.highest)} · average {fmtR(competitorStats.avg)}
          </div>
          <Bar
            pct={clamp(((sellingPrice - competitorStats.lowest) / (competitorStats.highest - competitorStats.lowest)) * 100, 0, 100)}
            color={sellingPrice > competitorStats.avg ? T.amber : T.lime}
          />
          <div style={{ fontSize: 11, color: T.faint, marginTop: 8 }}>
            Total estimated cost at this price: <strong style={{ color: T.ink }}>{fmtR(costBreakdown.total)}</strong>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
   PRODUCT COMPARISON — Research screen. Compares saved analyses side by side
   using the exact same engine output shape produced on the Analysis page.
   ============================================================================ */
const COMPARISON_ROWS = [
  { key: "supplierPrice", label: "Supplier cost", fmt: fmtR, get: (a) => a.supplierPrice },
  { key: "marketAvg", label: "Market avg. price", fmt: fmtR, get: (a) => a.competitorStats.avg },
  { key: "totalCost", label: "Total estimated cost", fmt: fmtR, get: (a) => a.profitAnalysis.costBreakdown.total },
  { key: "sellingPrice", label: "Recommended price", fmt: fmtR, get: (a) => a.profitAnalysis.sellingPrice },
  { key: "profit", label: "Estimated profit", fmt: fmtR, get: (a) => a.profitAnalysis.profit },
  { key: "margin", label: "Profit margin", fmt: fmtPct, get: (a) => a.profitAnalysis.margin },
  { key: "safety", label: "Safety Factor", fmt: (v) => `${v}×`, get: (a) => a.safetyFactor.factor },
  { key: "risk", label: "Risk level", fmt: (v) => v, get: (a) => a.safetyFactor.riskLevel },
  { key: "competition", label: "Competition level", fmt: (v) => `${Math.round(v)}/100`, get: (a) => a.competitorStats.competitionLevel },
  { key: "score", label: "Opportunity score", fmt: (v) => `${v}/100`, get: (a) => a.opportunity.score },
  { key: "testQty", label: "Recommended test qty", fmt: (v) => `${v} units`, get: (a) => a.testQuantity.qty },
];

function ComparisonView({ savedAnalyses, isMobile }) {
  const [selectedIds, setSelectedIds] = useState(() => savedAnalyses.slice(0, 3).map((a) => a.id));

  const toggle = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev; // Product A / B / C — max three
      return [...prev, id];
    });
  };

  const selected = savedAnalyses.filter((a) => selectedIds.includes(a.id));
  const best = selected.length > 1 ? selected.reduce((a, b) => (b.opportunity.score > a.opportunity.score ? b : a)) : null;

  if (savedAnalyses.length === 0) {
    return (
      <div style={{ padding: isMobile ? 16 : 28 }}>
        <Card style={{ textAlign: "center", padding: 50 }}>
          <Search size={22} color={T.lime} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: T.ink, fontWeight: 600, marginBottom: 6 }}>No saved products yet</div>
          <div style={{ fontSize: 12.5, color: T.faint, maxWidth: 360, margin: "0 auto" }}>
            Run a scan, then hit "Save to Compare" on the analysis page. Saved products will show up here so you can weigh them side by side.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <SectionTitle icon={Search} title="Saved products" tag={<Pill color={T.sub}>Pick up to 3</Pill>} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {savedAnalyses.map((a) => {
            const active = selectedIds.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                style={{
                  textAlign: "left", cursor: "pointer", padding: "12px 14px", borderRadius: 13,
                  background: active ? "rgba(198,255,61,0.08)" : T.panel3,
                  border: `1px solid ${active ? T.lime + "66" : T.line}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{a.productName}</span>
                  {active && <CheckCircle2 size={15} color={T.lime} />}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: T.sub }}>{a.opportunity.score}/100</span>
                  <DecisionBadge decision={a.opportunity.decision} />
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {selected.length < 2 ? (
        <Card style={{ textAlign: "center", padding: 34 }}>
          <div style={{ fontSize: 12.5, color: T.faint }}>Select at least two saved products above to compare them.</div>
        </Card>
      ) : isMobile ? (
        // Mobile: stacked per-product cards instead of a side-scrolling table
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {selected.map((a) => (
            <Card key={a.id} style={{ border: a.id === best.id ? `1px solid ${T.lime}66` : `1px solid ${T.line}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{a.productName}</span>
                {a.id === best.id && <Pill color={T.lime} border={`1px solid ${T.lime}55`} bg="rgba(198,255,61,0.08)">Best opportunity</Pill>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {COMPARISON_ROWS.map((row) => (
                  <div key={row.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0", borderBottom: `1px solid ${T.line}` }}>
                    <span style={{ color: T.sub }}>{row.label}</span>
                    <span style={{ color: T.ink, fontWeight: 600 }}>{row.fmt(row.get(a))}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <SectionTitle icon={ShieldCheck} title="Side-by-side comparison" />
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: `180px repeat(${selected.length}, 1fr)`, minWidth: 180 + selected.length * 160 }}>
              <div />
              {selected.map((a) => (
                <div key={a.id} style={{ padding: "0 10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{a.productName}</div>
                  {a.id === best.id && <Pill color={T.lime} border={`1px solid ${T.lime}55`} bg="rgba(198,255,61,0.08)">Best opportunity</Pill>}
                </div>
              ))}

              {COMPARISON_ROWS.map((row) => (
                <React.Fragment key={row.key}>
                  <div style={{ fontSize: 12.5, color: T.sub, padding: "10px 10px 10px 0", borderTop: `1px solid ${T.line}` }}>{row.label}</div>
                  {selected.map((a) => (
                    <div key={a.id} style={{ fontSize: 13, fontWeight: 600, color: a.id === best.id ? T.lime : T.ink, padding: "10px", textAlign: "center", borderTop: `1px solid ${T.line}` }}>
                      {row.fmt(row.get(a))}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================================================================
   AI BUSINESS ASSISTANT — reasons over the user's real SmartSell data
   (saved analyses + the last product analysed), not generic advice.
   ============================================================================ */
function buildAssistantContext({ savedAnalyses, currentAnalysis }) {
  const describe = (a) => ({
    productName: a.productName,
    marketplace: a.marketplace,
    category: a.category,
    supplierCost: Math.round(a.supplierPrice),
    recommendedSellingPrice: Math.round(a.profitAnalysis.sellingPrice),
    totalEstimatedCost: Math.round(a.profitAnalysis.costBreakdown.total),
    estimatedProfit: Math.round(a.profitAnalysis.profit),
    profitMarginPct: +a.profitAnalysis.margin.toFixed(1),
    safetyFactor: a.safetyFactor.factor,
    safetyRiskLevel: a.safetyFactor.riskLevel,
    safetyConfidencePct: a.safetyFactor.confidence,
    competitionLevel0to100: Math.round(a.competitorStats.competitionLevel),
    marketAvgPrice: Math.round(a.competitorStats.avg),
    marketPriceRange: [Math.round(a.competitorStats.lowest), Math.round(a.competitorStats.highest)],
    opportunityScore0to100: a.opportunity.score,
    opportunityBreakdown: a.opportunity.breakdown,
    finalDecision: a.opportunity.decision,
    recommendedTestQuantity: a.testQuantity.qty,
    testQuantityReason: a.testQuantity.reason,
  });
  return {
    currentlyOpenAnalysis: currentAnalysis ? describe(currentAnalysis) : null,
    savedProducts: savedAnalyses.map(describe),
  };
}

const ASSISTANT_SUGGESTIONS = [
  "Which of my saved products should I test first?",
  "Why is this product's Safety Factor low?",
  "How could I improve the margin on this product?",
  "Compare my saved products and pick the best one.",
];

function AssistantView({ savedAnalyses, currentAnalysis, isMobile }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "I'm your SmartSell assistant. Ask me about a product you've scanned or saved — I'll answer from your actual analysis data, not generic advice." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const hasData = savedAnalyses.length > 0 || currentAnalysis;

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setInput("");
    setError("");
    const nextMessages = [...messages, { role: "user", text: question }];
    setMessages(nextMessages);
    setBusy(true);

    const context = buildAssistantContext({ savedAnalyses, currentAnalysis });
    const systemPrompt = `You are the SmartSell AI Business Assistant, built into an e-commerce product-research tool. You help a seller decide whether to sell a product, using ONLY the structured analysis data provided below — never invent prices, fees, or demand figures.

Rules:
- Base every answer on the JSON data given. Reference specific numbers from it (margin %, Safety Factor, opportunity score, etc).
- If the data needed to answer isn't present (e.g. no products saved yet), say so plainly and suggest the person scan/save a product first — do not make up numbers.
- The Safety Factor is a decision-support metric, never a guarantee against loss — don't imply otherwise.
- Be direct and concise (short paragraphs or a short list), like a sharp analyst, not a generic chatbot.
- Currency is South African Rand (R).

User's SmartSell data:
${JSON.stringify(context, null, 2)}`;

    try {
      const apiMessages = nextMessages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });
      const data = await response.json();
      const textOut = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n") || "I couldn't generate a response — please try again.";
      setMessages((prev) => [...prev, { role: "assistant", text: textOut }]);
    } catch (e) {
      setError("Couldn't reach the assistant right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap: 14, height: "100%", boxSizing: "border-box" }}>
      {!hasData && (
        <Card style={{ background: "rgba(255,184,77,0.06)", border: `1px solid ${T.amber}33` }}>
          <div style={{ display: "flex", gap: 9 }}>
            <AlertTriangle size={16} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.6 }}>
              No scanned or saved products yet — the assistant will tell you that instead of guessing. Run a Scan first for a real conversation.
            </div>
          </div>
        </Card>
      )}

      <Card style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, padding: 0, overflow: "hidden" }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "82%", padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap",
                background: m.role === "user" ? T.lime : T.panel3,
                color: m.role === "user" ? "#0A0E17" : T.ink,
                fontWeight: m.role === "user" ? 600 : 400,
                border: m.role === "user" ? "none" : `1px solid ${T.line}`,
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ padding: "10px 14px", borderRadius: 14, background: T.panel3, border: `1px solid ${T.line}`, color: T.faint, fontSize: 13 }}>Thinking…</div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div style={{ padding: "0 18px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ASSISTANT_SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} style={{ fontSize: 11.5, color: T.sub, background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 999, padding: "6px 12px", cursor: "pointer" }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {error && <div style={{ padding: "0 18px 8px", fontSize: 11.5, color: T.coral }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, padding: 14, borderTop: `1px solid ${T.line}` }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Ask about your products…"
            style={{ flex: 1, background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 11, padding: "11px 14px", color: T.ink, fontSize: 13.5, boxSizing: "border-box" }}
          />
          <button onClick={() => send()} disabled={busy || !input.trim()} style={{ background: T.lime, color: "#0A0E17", border: "none", borderRadius: 11, width: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: busy || !input.trim() ? 0.6 : 1 }}>
            <Send size={16} />
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================================
   WATCHLIST / PLACEHOLDER (unchanged)
   ============================================================================ */
function WatchlistView() {
  return (
    <div style={{ padding: 28 }}>
      <Card>
        <SectionTitle icon={Bookmark} title="Watchlist" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {WATCHLIST.map((w) => (
            <div key={w.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 14px", background: T.panel3, borderRadius: 13 }}>
              <div>
                <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 500 }}>{w.name}</div>
                {w.alert ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                    <Bell size={12} color={T.amber} /><span style={{ fontSize: 11.5, color: T.amber }}>{w.alert}</span><span style={{ fontSize: 11, color: T.faint }}>· {w.time}</span>
                  </div>
                ) : <div style={{ fontSize: 11.5, color: T.faint, marginTop: 5 }}>No changes detected</div>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{w.score}/100</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
function Placeholder({ label }) {
  return (
    <div style={{ padding: 28 }}>
      <Card style={{ textAlign: "center", padding: 50 }}>
        <Sparkles size={22} color={T.lime} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 14, color: T.ink, fontWeight: 600, marginBottom: 6 }}>{label} is coming in a later phase</div>
        <div style={{ fontSize: 12.5, color: T.faint }}>This screen is planned in the SmartSell roadmap and will use the same live data pipeline once connected.</div>
      </Card>
    </div>
  );
}

/* ============================================================================
   APP
   ============================================================================ */
const TITLES = { dashboard: "Overview", scan: "Scan Product", analysis: "Product Analysis", research: "Product Research", marketplace: "Marketplace Analysis", watchlist: "Watchlist", simulator: "Profit Simulator", assistant: "AI Assistant", settings: "Settings" };

export default function SmartSellApp() {
  const isMobile = useIsMobile();
  const [view, setView] = useState("dashboard");
  const [analysis, setAnalysis] = useState(null);
  const [simSeed, setSimSeed] = useState(null);
  const [savedAnalyses, setSavedAnalyses] = useState([]);

  const handleAnalyse = (result) => { setAnalysis(result); setView("analysis"); };
  const saveToComparison = (result) => {
    setSavedAnalyses((prev) => [...prev, { ...result, id: `${result.productName}-${Date.now()}` }]);
  };
  const openSimulatorFromAnalysis = () => {
    setSimSeed({
      supplierPrice: analysis.supplierPrice,
      sellingPrice: analysis.profitAnalysis.sellingPrice,
      marketplace: analysis.marketplace,
      category: analysis.category,
    });
    setView("simulator");
  };

  let content;
  if (view === "dashboard") content = <Dashboard setView={setView} isMobile={isMobile} />;
  else if (view === "scan") content = isMobile ? <QuickScanView onAnalyse={handleAnalyse} /> : <ScanView onAnalyse={handleAnalyse} />;
  else if (view === "analysis" && analysis) content = <AnalysisView data={analysis} onBack={() => setView("scan")} onOpenSimulator={openSimulatorFromAnalysis} onSaveToComparison={saveToComparison} isMobile={isMobile} />;
  else if (view === "simulator") content = <SimulatorView seed={simSeed} isMobile={isMobile} />;
  else if (view === "research") content = <ComparisonView savedAnalyses={savedAnalyses} isMobile={isMobile} />;
  else if (view === "assistant") content = <AssistantView savedAnalyses={savedAnalyses} currentAnalysis={analysis} isMobile={isMobile} />;
  else if (view === "watchlist") content = <WatchlistView />;
  else content = <Placeholder label={TITLES[view]} />;

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, fontFamily: "'Inter', sans-serif", color: T.ink }}>
        <style>{fontImport}</style>
        <MobileTopBar title={TITLES[view]} />
        <div style={{ flex: 1, overflowY: "auto" }}>{content}</div>
        <MobileBottomNav view={view} setView={setView} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, fontFamily: "'Inter', sans-serif", color: T.ink }}>
      <style>{fontImport}</style>
      <Sidebar view={view} setView={setView} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar title={TITLES[view]} onScan={() => setView("scan")} />
        <div style={{ flex: 1, overflowY: "auto" }}>{content}</div>
      </div>
    </div>
  );
}
