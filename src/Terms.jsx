import { useEffect, useState } from "react";
import Starfield from "./Starfield.jsx";
import { sbFetch } from "./hubUtils.jsx";

const FALLBACK = `...
        <h1>Terms &amp; Conditions</h1>
        <p class="updated">Last Updated: May 26, 2026</p>

        <p>Welcome to FRC Team 4550 "Something's Bruin." By accessing or using our website at <a href="https://4550robotics.com">4550robotics.com</a> (the "Site"), you agree to be bound by these Terms &amp; Conditions ("Terms"). If you do not agree with any part of these Terms, you must not use the Site.</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By using the Site, you affirm that you are at least 13 years of age, or if you are under 13, that you have obtained parental consent to use the Site. The Member Hub is restricted to current team members, alumni, mentors, and authorized school personnel.</p>

        <h2>2. Description of Services</h2>
        <p>FRC Team 4550 provides the following services through the Site:</p>
        <ul>
          <li><strong>Public Website:</strong> Information about the team, its history, sponsors, media gallery, and contact information.</li>
          <li><strong>Member Hub:</strong> A password-protected portal for team members to manage tasks, calendar events, announcements, media, resources, inventory, and scouting data.</li>
          <li><strong>Sponsor Tracker:</strong> A password-protected tool for managing sponsor relationships and outreach.</li>
          <li><strong>Public Media Gallery:</strong> A publicly accessible gallery of team photos and videos.</li>
        </ul>

        <h2>3. User Accounts &amp; Responsibilities</h2>
        <p>Access to the Member Hub and Sponsor Tracker requires authorization. By using these services:</p>
        <ul>
          <li>You are responsible for maintaining the confidentiality of any login credentials.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
          <li>You agree to notify us immediately of any unauthorized use of your account.</li>
          <li>You agree not to share access credentials with unauthorized individuals.</li>
          <li>We reserve the right to revoke access at any time for any reason, including violation of these Terms or team policies.</li>
        </ul>

        <h2>4. Acceptable Use</h2>
        <p>You agree not to use the Site for any unlawful purpose or in violation of these Terms. Prohibited activities include:</p>
        <ul>
          <li>Attempting to access restricted areas without authorization</li>
          <li>Uploading malicious code, viruses, or harmful content</li>
          <li>Interfering with the operation of the Site or servers</li>
          <li>Harassing, threatening, or abusing other users</li>
          <li>Posting inappropriate, offensive, or discriminatory content</li>
          <li>Using the Site to violate any applicable laws or regulations</li>
          <li>Scraping, crawling, or mining the Site without permission</li>
        </ul>

        <h2>5. User-Generated Content</h2>
        <p>Users of the Member Hub may post content such as task descriptions, announcements, comments, and uploaded media. By posting content:</p>
        <ul>
          <li>You retain ownership of your content but grant us a non-exclusive, royalty-free license to store, display, and use it for team purposes.</li>
          <li>You represent that your content does not violate any third-party rights or applicable laws.</li>
          <li>We reserve the right to moderate, edit, or remove any content at our discretion.</li>
        </ul>

        <h2>6. Intellectual Property</h2>
        <p>The Team 4550 name, logos, branding, and website design are the intellectual property of FRC Team 4550 and Cherry Creek School District. Unauthorized use is prohibited. The content on this Site, including text, graphics, photos, and videos, is protected by copyright and other intellectual property laws unless otherwise noted.</p>

        <h2>7. Donations &amp; Payments</h2>
        <p>Donations made through our Site are processed by third-party payment processors (Vanco Events). We do not store or process credit card information directly. All donations are subject to the terms and privacy policies of the payment processor. Donations are generally non-refundable, except as required by law.</p>

        <h2>8. Third-Party Services</h2>
        <p>Our Site integrates with third-party services including:</p>
        <ul>
          <li>Supabase (database, authentication, file storage)</li>
          <li>Vercel (hosting)</li>
          <li>YouTube (video embedding)</li>
          <li>Instagram (social media linking)</li>
          <li>Google Calendar / iCal (calendar subscriptions)</li>
          <li>Discord (announcement notifications)</li>
          <li>Groq AI (CSV data parsing)</li>
        </ul>
        <p>We are not responsible for the content, privacy practices, or terms of these third-party services. Your use of these services is subject to their respective terms and policies.</p>

        <h2>9. Limitation of Liability</h2>
        <p>To the fullest extent permitted by applicable law, FRC Team 4550, its members, mentors, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the Site. This includes, but is not limited to, damages for loss of data, loss of profits, or service interruption.</p>

        <h2>10. Disclaimer of Warranties</h2>
        <p>The Site is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. We do not warrant that the Site will be uninterrupted, error-free, secure, or free from viruses or other harmful components. We reserve the right to modify, suspend, or discontinue any part of the Site at any time without notice.</p>

        <h2>11. Indemnification</h2>
        <p>You agree to indemnify, defend, and hold harmless FRC Team 4550, its members, mentors, and affiliates from any claims, liabilities, damages, losses, or expenses arising out of your use of the Site, your violation of these Terms, or your violation of any rights of a third party.</p>

        <h2>12. Termination</h2>
        <p>We reserve the right to terminate or suspend your access to the Site, including Member Hub access, at any time without prior notice for violation of these Terms, team policies, or for any other reason. Upon termination, your right to use the Site immediately ceases.</p>

        <h2>13. Governing Law</h2>
        <p>These Terms shall be governed by and construed in accordance with the laws of the State of Colorado, without regard to its conflict of law provisions. Any legal action arising out of these Terms shall be brought in the courts of Arapahoe County, Colorado.</p>

        <h2>14. Changes to Terms</h2>
        <p>We reserve the right to update or modify these Terms at any time. Changes will be effective immediately upon posting. Your continued use of the Site after any changes constitutes acceptance of the new Terms. We encourage you to review these Terms periodically.</p>

        <h2>15. Contact Information</h2>
        <p>For questions or concerns regarding these Terms, please contact us at:</p>
        <p>
          FRC Team 4550 "Something's Bruin"<br />
          Cherry Creek High School<br />
          9300 E Union Ave<br />
          Greenwood Village, CO 80111<br />
          Email: <a href="mailto:team4550frc@gmail.com">team4550frc@gmail.com</a>
        </p>`;

export default function Terms() {
  const [html, setHtml] = useState("");

  useEffect(() => {
    document.title = "Terms & Conditions · Team 4550";
    sbFetch("site_config?key=eq.terms_conditions&select=value").then(r => {
      if (r?.[0]?.value) setHtml(r[0].value);
    });
  }, []);

  const content = html || FALLBACK;

  return (
    <div style={{ minHeight: "100vh", background: "#080a0f", color: "#f1f5f9", fontFamily: "'Exo 2', sans-serif", position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <Starfield density={9000} opacity={0.38} />
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Exo 2:wght@300;400;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#080a0f;}
        .legal-content{max-width:800px;margin:0 auto;padding:100px 24px 60px;position:relative;z-index:1;}
        .legal-content h1{font-family:'Orbitron',sans-serif;font-size:28px;font-weight:700;color:#ef4444;margin-bottom:8px;letter-spacing:2px;}
        .legal-content .updated{font-family:'Share Tech Mono',monospace;font-size:11px;color:#64748b;margin-bottom:32px;}
        .legal-content h2{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:700;color:#f1f5f9;margin-top:32px;margin-bottom:12px;letter-spacing:1px;}
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
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px 32px", textAlign: "center" }}>
        <div style={{ color: "#334155", fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>
          &copy; {new Date().getFullYear()} FRC Team 4550 Something's Bruin &middot; <a href="/" style={{ color: "#64748b", textDecoration: "none" }}>Home</a>
        </div>
      </footer>
    </div>
  );
}
