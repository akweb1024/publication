import type { Metadata } from "next";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "About | STM Journals",
  description: "Learn more about STM Journals, our mission, editorial principles, and publishing standards.",
  path: "/about",
  keywords: ["STM journals", "about", "publishing mission", "editorial standards"],
});

export default function AboutPage() {
  return (
    <main className="main-stack">
      <section className="hero">
        <span className="eyebrow" style={{ color: "var(--accent-secondary)" }}>About Us</span>
        <h1>STM Journals</h1>
        <p>Leading the way in Scientific, Technical, and Medical publishing.</p>
      </section>
      
      <section className="container" style={{ padding: "40px 0" }}>
        <div className="card" style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{ marginBottom: "20px" }}>Our Mission</h2>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            At STM Journals, our mission is to accelerate scientific discovery and medical advancement by providing a premier, high-quality platform for peer-reviewed academic publishing.
          </p>
          <p style={{ marginBottom: "16px", lineHeight: 1.6 }}>
            We believe that robust, transparent, and rigorous review processes are essential to maintaining the integrity of the scientific record.
          </p>
          
          <h2 style={{ marginTop: "40px", marginBottom: "20px" }}>What We Do</h2>
          <ul style={{ listStyleType: "disc", paddingLeft: "20px", lineHeight: 1.6 }}>
            <li style={{ marginBottom: "8px" }}>Publish high-impact research across diverse scientific domains.</li>
            <li style={{ marginBottom: "8px" }}>Provide an innovative, seamless editorial workspace for authors and reviewers.</li>
            <li style={{ marginBottom: "8px" }}>Maintain strict adherence to global publishing ethics.</li>
            <li style={{ marginBottom: "8px" }}>Ensure open access and broad dissemination of critical findings.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
