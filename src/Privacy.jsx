import { useEffect } from "react";
import Starfield from "./Starfield.jsx";

export default function Privacy() {
  useEffect(() => {
    document.title = "Privacy Policy · Team 4550";
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#080a0f", color: "#f1f5f9", fontFamily: "'Exo 2', sans-serif", position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <Starfield density={9000} opacity={0.38} />
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#080a0f;}
        .legal-content{max-width:800px;margin:0 auto;padding:100px 24px 60px;position:relative;z-index:1;}
        .legal-content h1{font-family:'Orbitron',sans-serif;font-size:28px;font-weight:700;color:#ef4444;margin-bottom:8px;letter-spacing:2px;}
        .legal-content .updated{font-family:'Share Tech Mono',monospace;font-size:11px;color:#64748b;margin-bottom:32px;}
        .legal-content h2{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:700;color:#f1f5f9;margin-top:32px;margin-bottom:12px;letter-spacing:1px;}
        .legal-content h3{font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:#e2e8f0;margin-top:24px;margin-bottom:8px;letter-spacing:0.5px;}
        .legal-content p,.legal-content li{color:#94a3b8;line-height:1.8;font-size:14px;margin-bottom:10px;}
        .legal-content ul{padding-left:20px;margin-bottom:12px;}
        .legal-content li{margin-bottom:6px;}
        .legal-content a{color:#fca5a5;text-decoration:none;}
        .legal-content a:hover{text-decoration:underline;}
        .legal-content .back-link{display:inline-block;margin-bottom:28px;color:#64748b;text-decoration:none;font-family:'Share Tech Mono',monospace;font-size:12px;}
        .legal-content .back-link:hover{color:#ef4444;}
      `}</style>
      <div className="legal-content">
        <a href="/" className="back-link">← Back to Home</a>
        <h1>Privacy Policy</h1>
        <p className="updated">Last Updated: May 26, 2026</p>

        <p>FRC Team 4550 "Something's Bruin" ("we," "our," or "us") operates the website at <a href="https://4550robotics.com">4550robotics.com</a> (the "Site"). This Privacy Policy explains how we collect, use, disclose, and protect your information when you visit our Site or use our services.</p>

        <h2>1. Information We Collect</h2>

        <h3>Information You Provide to Us</h3>
        <ul>
          <li><strong>Member Hub Accounts:</strong> When team members register for the Member Hub, we collect your name, username, and any information you provide in your profile.</li>
          <li><strong>Suggestions & Feedback:</strong> If you submit a suggestion or feedback through our Site, we collect the content of your submission.</li>
          <li><strong>Contact Forms:</strong> If you email us or use a contact form, we collect your email address and the contents of your message.</li>
          <li><strong>Sponsor Information:</strong> Sponsor contact information (company name, email, phone) is stored in our secure database for outreach purposes.</li>
        </ul>

        <h3>Information Collected Automatically</h3>
        <ul>
          <li><strong>Log Data:</strong> Our servers automatically record certain information when you visit the Site, including your IP address, browser type, operating system, referring URLs, and pages visited.</li>
          <li><strong>Cookies:</strong> We use essential cookies for authentication (login sessions). We do not use tracking cookies or third-party advertising cookies.</li>
          <li><strong>Service Providers:</strong> We use Vercel (hosting) and Supabase (database/authentication), which may process data as described in their respective privacy policies.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect for the following purposes:</p>
        <ul>
          <li>To operate and maintain the Member Hub and team management tools</li>
          <li>To manage sponsor relationships and outreach</li>
          <li>To communicate with team members, parents, and sponsors</li>
          <li>To improve our website and team operations</li>
          <li>To comply with legal obligations</li>
        </ul>

        <h2>3. Data Inventory</h2>
        <p>The following table details every data point collected by our Site and services:</p>
        <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: "#cbd5e1", fontFamily: "'Share Tech Mono', monospace" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#f1f5f9" }}>Data Point</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#f1f5f9" }}>Purpose</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#f1f5f9" }}>Storage</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#f1f5f9" }}>Retention</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: "#f1f5f9" }}>Shared With</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Name / Username", "Member Hub identification", "Supabase", "Until deactivation", "Never sold"],
                ["Email address", "Communication, login", "Supabase", "Until deactivation", "Never sold"],
                ["Phone number", "Sponsor outreach", "Supabase", "Until requested deletion", "Never sold"],
                ["Task assignments", "Team coordination", "Supabase", "Until deleted by user", "Never sold"],
                ["Calendar events", "Team scheduling", "Supabase", "Until deleted by user", "Never sold"],
                ["Media uploads", "Team gallery", "Supabase Storage", "Until deleted by user", "Never sold"],
                ["Suggestions / Feedback", "Team improvement", "Supabase", "Indefinite (anonymized)", "Never sold"],
                ["IP address", "Analytics, security", "Vercel logs", "30 days", "Vercel (processor)"],
                ["Login sessions", "Authentication", "LocalStorage", "Until logout", "Never"],
                ["Camera / Photos", "Inventory AI identification", "Supabase Storage", "Until deleted by user", "None (AI in-memory only)"],
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                  {row.map((cell, j) => <td key={j} style={{ padding: "8px 12px" }}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>4. Legal Basis for Processing (GDPR)</h2>
        <p>While we are based in the United States, if you are accessing our Site from the European Economic Area (EEA), our legal basis for collecting and using your information depends on the specific data concerned and the context in which we collect it. We typically process your information on the following grounds:</p>
        <ul>
          <li><strong>Consent:</strong> Where you have given us explicit permission.</li>
          <li><strong>Legitimate Interests:</strong> For operating our robotics team and website.</li>
          <li><strong>Legal Obligation:</strong> Where required by applicable law.</li>
        </ul>

        <h2>5. Data Sharing and Disclosure</h2>
        <p>We do not sell your personal information to third parties. We may share your information in the following circumstances:</p>
        <ul>
          <li><strong>Service Providers:</strong> With Vercel (hosting), Supabase (database & authentication), and other service providers who help us operate the Site.</li>
          <li><strong>Legal Requirements:</strong> If required by law, court order, or governmental regulation.</li>
          <li><strong>Protection of Rights:</strong> To protect the rights, property, or safety of our team, our members, or others.</li>
          <li><strong>School District:</strong> Cherry Creek School District may have access to certain information as part of oversight of the team as a school-affiliated organization.</li>
        </ul>

        <h2>6. Data Security</h2>
        <p>We implement appropriate technical and organizational security measures to protect your information, including encryption in transit (HTTPS), secure authentication for the Member Hub, and restricted database access. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>

        <h2>7. Data Retention</h2>
        <p>We retain your information for as long as necessary to fulfill the purposes described in this Privacy Policy, or as required by applicable law. Member Hub accounts may be deactivated upon request. Completed tasks older than 24 hours are automatically deleted.</p>

        <h2>8. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the following rights regarding your personal information:</p>
        <ul>
          <li><strong>Access:</strong> Request a copy of the information we hold about you.</li>
          <li><strong>Correction:</strong> Request that we correct inaccurate or incomplete information.</li>
          <li><strong>Deletion:</strong> Request that we delete your information, subject to certain exceptions.</li>
          <li><strong>Portability:</strong> Request a copy of your information in a machine-readable format.</li>
          <li><strong>Opt-Out:</strong> Opt out of future communications at any time.</li>
        </ul>
        <p>To exercise any of these rights, please contact us at <a href="mailto:team4550frc@gmail.com">team4550frc@gmail.com</a>.</p>

        <h2>9. California Privacy Rights (CCPA)</h2>
        <p>If you are a California resident, the California Consumer Privacy Act (CCPA) provides you with additional rights regarding your personal information:</p>
        <ul>
          <li>You have the right to know what personal information we collect, use, disclose, and sell.</li>
          <li>We do not sell your personal information.</li>
          <li>You have the right to request deletion of your personal information.</li>
          <li>You have the right to non-discrimination for exercising your CCPA rights.</li>
        </ul>
        <p>To make a CCPA request, please contact us at <a href="mailto:team4550frc@gmail.com">team4550frc@gmail.com</a>.</p>

        <h2>10. Children's Privacy (COPPA)</h2>
        <p>Our Site is intended for general audiences. The Member Hub is restricted to team members and authorized personnel. We do not knowingly collect personal information from children under 13 without parental consent. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete such information. If you believe a child under 13 has provided us with personal information, please contact us immediately.</p>

        <h2>11. Third-Party Links</h2>
        <p>Our Site may contain links to third-party websites, including YouTube, Instagram, and donation platforms. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any information.</p>

        <h2>12. Changes to This Privacy Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify users of material changes by posting the updated policy on this page with a new "Last Updated" date. Continued use of the Site after changes constitutes acceptance of the updated policy.</p>

        <h2>13. Contact Us</h2>
        <p>If you have questions, concerns, or requests regarding this Privacy Policy, please contact us at:</p>
        <p>
          FRC Team 4550 "Something's Bruin"<br />
          Cherry Creek High School<br />
          9300 E Union Ave<br />
          Greenwood Village, CO 80111<br />
          Email: <a href="mailto:team4550frc@gmail.com">team4550frc@gmail.com</a>
        </p>
      </div>
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px 32px", textAlign: "center" }}>
        <div style={{ color: "#334155", fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>
          &copy; {new Date().getFullYear()} FRC Team 4550 Something's Bruin &middot; <a href="/" style={{ color: "#64748b", textDecoration: "none" }}>Home</a>
        </div>
      </footer>
    </div>
  );
}
