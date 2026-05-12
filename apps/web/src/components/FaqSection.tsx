type FaqItem = {
  question: string;
  answer: string;
};

export default function FaqSection({
  title,
  items,
}: {
  title: string;
  items: FaqItem[];
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section className="card">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <h2 style={{ marginBottom: 14 }}>{title}</h2>
      <div style={{ display: "grid", gap: 14 }}>
        {items.map((item) => (
          <div key={item.question}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 6 }}>{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
