import { TOOL_COPY } from "../tool-copy.js";

export default function ToolAbout({ page }) {
  const copy = TOOL_COPY[page];
  if (!copy) return null;
  const ld = copy.faq?.length ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: copy.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  } : null;
  return (
    <section className="tool-about">
      <h2>{copy.heading}</h2>
      {copy.paras.map((p, i) => <p key={i}>{p}</p>)}
      {copy.faq?.length > 0 && (
        <div className="tool-faq">
          {copy.faq.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      )}
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />}
    </section>
  );
}
