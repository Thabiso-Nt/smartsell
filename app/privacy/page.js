export const metadata = { title: "Privacy Policy — SmartSell" };

const S = {
  bg: "#080B12", ink: "#EAEEF7", sub: "#8B93A8", lime: "#C6FF3D", line: "#232C41",
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: S.bg, color: S.ink, fontFamily: "'Inter', system-ui, sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ color: S.sub, fontSize: 13, marginBottom: 30 }}>Last updated: 2026</p>

        <p style={{ lineHeight: 1.7, color: S.sub, marginBottom: 20 }}>
          SmartSell ("we", "the app") is a product research tool. This page explains what
          information we collect and how it's used, in plain terms.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>What we collect</h2>
        <ul style={{ lineHeight: 1.8, color: S.sub, paddingLeft: 20 }}>
          <li>Your email address, provided by you (or by Google, if you sign in with Google).</li>
          <li>Products you scan, save, or add to your trending list, along with the figures you enter (supplier price, marketplace, category).</li>
          <li>Basic account preferences you set, such as your country and default marketplace.</li>
        </ul>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>What we don't do</h2>
        <ul style={{ lineHeight: 1.8, color: S.sub, paddingLeft: 20 }}>
          <li>We don't sell your data to third parties.</li>
          <li>We don't share your saved products or analyses with other users — each account's data is private to that account.</li>
          <li>We don't use your data to train AI models.</li>
        </ul>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>How your data is stored</h2>
        <p style={{ lineHeight: 1.7, color: S.sub, marginBottom: 20 }}>
          Your account and saved data are stored securely with Supabase, our database provider.
          Access is restricted so that only you can see your own saved products and analyses.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>Signing in with Google</h2>
        <p style={{ lineHeight: 1.7, color: S.sub, marginBottom: 20 }}>
          If you sign in with Google, we only receive your name, email address, and profile
          picture, as permitted by Google's sign-in flow. We do not access your Gmail, Google
          Drive, or any other Google service.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>Deleting your data</h2>
        <p style={{ lineHeight: 1.7, color: S.sub, marginBottom: 20 }}>
          You can delete your saved products at any time from the Settings page inside the app.
          To delete your account entirely, contact us using the details below.
        </p>

        <h2 style={{ fontSize: 17, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>Contact</h2>
        <p style={{ lineHeight: 1.7, color: S.sub }}>
          Questions about this policy can be directed to the app owner via the contact details
          provided at sign-up.
        </p>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${S.line}` }}>
          <a href="/" style={{ color: S.lime, fontSize: 13, textDecoration: "none" }}>← Back to SmartSell</a>
        </div>
      </div>
    </div>
  );
}
