import { useState } from "react";
import { Icon } from "../icons.jsx";

/** The AI scouting report.
 *
 * The backend guarantees the shape this leans on: `guardrails.check_structure`
 * rejects anything over 18 lines or containing markdown, and the prompt asks
 * for one idea per line ending in a one-line verdict. So the lines ARE the
 * structure — rendering them as a single pre-wrap blob threw that away and
 * gave the reader a wall of text.
 *
 * Nothing here re-interprets the model's words; it only lays out lines the
 * model already separated, and lifts the last one out as the verdict.
 */
export default function AiReport({ text, loading }) {
  const [copied, setCopied] = useState(false);

  if (loading && !text) {
    return (
      <div className="ai-panel">
        <div className="ai-panel-head">{Icon.stars} AI Scouting Report</div>
        <div className="ai-skeleton" aria-label="Generating report">
          {[68, 92, 80, 55, 88, 40].map((w, i) => (
            <div className="ai-skel-line" key={i} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!text) return null;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  // The prompt asks the model to close with a verdict. Only treat the last
  // line as one when there is something above it to be a verdict ABOUT —
  // a one-line report is just a report.
  const hasVerdict = lines.length > 1;
  const body = hasVerdict ? lines.slice(0, -1) : lines;
  // The model usually opens that last line with "Verdict:". Left in, it prints
  // directly under a label that already says Verdict — so the prefix is
  // dropped for display. The sentence itself is untouched.
  const verdict = hasVerdict
    ? lines[lines.length - 1].replace(/^verdict\s*[:—-]\s*/i, "")
    : null;

  const copy = () => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <span>{Icon.stars} AI Scouting Report</span>
        <button className="ai-copy" onClick={copy} type="button">
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      <ul className="ai-lines">
        {body.map((line, i) => (
          <li className="ai-line" key={i}>
            {line}
          </li>
        ))}
      </ul>

      {verdict && (
        <div className="ai-verdict">
          <span className="ai-verdict-label">Verdict</span>
          <p className="ai-verdict-text">{verdict}</p>
        </div>
      )}
    </div>
  );
}
