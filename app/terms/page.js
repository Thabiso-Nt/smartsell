export const metadata = { title: "Terms of Service — SmartSell" };

const S = {
  bg: "#080B12", ink: "#EAEEF7", sub: "#8B93A8", lime: "#C6FF3D", line: "#232C41",
};

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: S.bg, color: S.ink, fontFamily: "'Inter', system-ui, sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Terms of Service</h1>
        <p style={{ color: S.sub, fontSize: 13, marginBottom: 30 }}>Last updated: 2026</p>

        <p style={{ lineHeight: 1.7, color: S.sub, marginBottom: 20 }}>
          By using SmartSell, you agree to the following terms.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>What SmartSell is</h2>
        <p style={{ lineHeight: 1.7, color: S.sub, marginBottom: 20 }}>
          SmartSell is a research and decision-support tool for people considering selling a
          product online. It estimates costs, fees, risk, and potential profit based on the
          information you provide and configured assumptions.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>Not financial or business advice</h2>
        <p style={{ lineHeight: 1.7, color: S.sub, marginBottom: 20 }}>
          Figures shown in SmartSell — including the Safety Factor, Opportunity Score, cost
          estimates, and price recommendations — are decision-support tools, not guarantees.
          They do not guarantee profit or protect against loss. You are responsible for your own
          purchasing and selling decisions.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>Estimated vs. verified data</h2>
        <p style={{ lineHeight: 1.7, color: S.sub, marginBottom: 20 }}>
          Marketplace fees, shipping costs, and competitor listings shown in the app may be
          estimated, configured defaults, or demo data where noted, rather than live-verified
          figures from the named marketplaces. Always confirm real fees and policies directly
          with a marketplace before relying on them.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>Your account</h2>
        <p style={{ lineHeight: 1.7, color: S.sub, marginBottom: 20 }}>
          You're responsible for keeping your account secure. Don't share your login with others.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>Changes</h2>
        <p style={{ lineHeight: 1.7, color: S.sub, marginBottom: 20 }}>
          SmartSell is an evolving tool. Features may change, be added, or be removed over time.
        </p>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${S.line}` }}>
          <a href="/" style={{ color: S.lime, fontSize: 13, textDecoration: "none" }}>← Back to SmartSell</a>
        </div>
      </div>
    </div>
  );
}
