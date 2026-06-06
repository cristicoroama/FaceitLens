import { useState, useMemo } from "react";
import {
  decodeCrosshair, encodeCrosshair, crosshairToConVars, crosshairRGB,
  DEFAULT_CROSSHAIR, PRO_PRESETS,
} from "../crosshair.js";

function Preview({ x }) {
  const [r, g, b] = crosshairRGB(x);
  const alpha = x.alphaEnabled ? x.alpha / 255 : 1;
  const color = `rgba(${r},${g},${b},${alpha})`;
  const W = 300, H = 200, cx = W / 2, cy = H / 2;

  const lengthPx = Math.max(0, x.length * 6 + 2);
  const thickPx = Math.max(2, x.thickness * 4);
  const gapPx = Math.max(0, x.gap * 3 + 8);
  const out = x.outlineEnabled ? Math.max(0, x.outline * 2) : 0;

  const arms = [
    { x: cx - gapPx - lengthPx, y: cy - thickPx / 2, w: lengthPx, h: thickPx, k: "l" },
    { x: cx + gapPx, y: cy - thickPx / 2, w: lengthPx, h: thickPx, k: "r" },
    { x: cx - thickPx / 2, y: cy + gapPx, w: thickPx, h: lengthPx, k: "b" },
  ];
  if (!x.tStyleEnabled) {
    arms.push({ x: cx - thickPx / 2, y: cy - gapPx - lengthPx, w: thickPx, h: lengthPx, k: "t" });
  }

  return (
    <div className="xh-preview">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        <defs>
          <linearGradient id="xhbg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a3f47" />
            <stop offset="100%" stopColor="#23272e" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#xhbg)" />
        {out > 0 && arms.map((a) => (
          <rect key={`o${a.k}`} x={a.x - out} y={a.y - out} width={a.w + out * 2} height={a.h + out * 2}
            fill="rgba(0,0,0,0.85)" />
        ))}
        {out > 0 && x.centerDotEnabled && (
          <rect x={cx - thickPx / 2 - out} y={cy - thickPx / 2 - out}
            width={thickPx + out * 2} height={thickPx + out * 2} fill="rgba(0,0,0,0.85)" />
        )}
        {arms.map((a) => (
          <rect key={a.k} x={a.x} y={a.y} width={a.w} height={a.h} fill={color} />
        ))}
        {x.centerDotEnabled && (
          <rect x={cx - thickPx / 2} y={cy - thickPx / 2} width={thickPx} height={thickPx} fill={color} />
        )}
      </svg>
    </div>
  );
}

export default function Crosshair() {
  const [x, setX] = useState(DEFAULT_CROSSHAIR);
  const [importCode, setImportCode] = useState("");
  const [importErr, setImportErr] = useState("");
  const [copied, setCopied] = useState("");

  const set = (field, value) => setX((p) => ({ ...p, [field]: value }));

  const shareCode = useMemo(() => {
    try { return encodeCrosshair(x); } catch { return "—"; }
  }, [x]);
  const conVars = useMemo(() => crosshairToConVars(x), [x]);

  function copy(text, what) {
    navigator.clipboard?.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(""), 1500);
  }

  function doImport() {
    try {
      const c = decodeCrosshair(importCode.trim());
      setX(c);
      setImportErr("");
      setImportCode("");
    } catch (e) {
      setImportErr(e.message || "Invalid code");
    }
  }

  function loadPreset(code) {
    try { setX(decodeCrosshair(code)); } catch { /* ignore */ }
  }

  const Slider = ({ label, field, min, max, step }) => (
    <label className="xh-ctrl">
      <span>{label}</span>
      <span className="xh-row">
        <input type="range" min={min} max={max} step={step} value={x[field]}
          onChange={(e) => set(field, parseFloat(e.target.value))} />
        <span className="xh-val">{x[field]}</span>
      </span>
    </label>
  );
  const Toggle = ({ label, field }) => (
    <label className="xh-toggle">
      <input type="checkbox" checked={!!x[field]} onChange={(e) => set(field, e.target.checked)} />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="xh">
      <div className="xh-left">
        <Preview x={x} />

        <div className="xh-out">
          <div className="xh-out-label">Share code</div>
          <div className="xh-code">
            <input readOnly value={shareCode} />
            <button onClick={() => copy(shareCode, "code")}>{copied === "code" ? "✓" : "Copy"}</button>
          </div>
          <div className="xh-hint">Paste in CS2 → Settings → Crosshair → Share / Import</div>
        </div>

        <div className="xh-out">
          <div className="xh-out-label">Import a code</div>
          <div className="xh-code">
            <input placeholder="CSGO-xxxxx-..." value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doImport()} />
            <button onClick={doImport}>Load</button>
          </div>
          {importErr && <div className="xh-err">{importErr}</div>}
        </div>

        <div className="xh-out">
          <div className="xh-out-label">
            Console commands
            <button className="xh-mini" onClick={() => copy(conVars, "cv")}>{copied === "cv" ? "✓ Copied" : "Copy all"}</button>
          </div>
          <textarea className="xh-console" readOnly value={conVars} rows={8} />
        </div>

        <div className="xh-out">
          <div className="xh-out-label">Pro players</div>
          <div className="xh-presets">
            {PRO_PRESETS.map((p) => (
              <button key={p.name} onClick={() => loadPreset(p.code)}>{p.name}</button>
            ))}
            <button className="xh-reset" onClick={() => setX(DEFAULT_CROSSHAIR)}>Reset</button>
          </div>
        </div>
      </div>

      <div className="xh-right">
        <div className="section-title">Editor</div>
        <Slider label="Length" field="length" min={0} max={30} step={0.5} />
        <Slider label="Thickness" field="thickness" min={0} max={6} step={0.1} />
        <Slider label="Gap" field="gap" min={-5} max={5} step={0.1} />

        <div className="xh-toggles">
          <Toggle label="Outline" field="outlineEnabled" />
          <Toggle label="Center dot" field="centerDotEnabled" />
          <Toggle label="T-style" field="tStyleEnabled" />
        </div>
        {x.outlineEnabled && <Slider label="Outline thickness" field="outline" min={0} max={3} step={0.5} />}

        <label className="xh-ctrl">
          <span>Style</span>
          <select value={x.style} onChange={(e) => set("style", parseInt(e.target.value))}>
            <option value={2}>Classic</option>
            <option value={3}>Classic Dynamic</option>
            <option value={4}>Classic Static</option>
          </select>
        </label>

        <label className="xh-ctrl">
          <span>Color</span>
          <select value={x.color} onChange={(e) => set("color", parseInt(e.target.value))}>
            <option value={0}>Red</option>
            <option value={1}>Green</option>
            <option value={2}>Yellow</option>
            <option value={3}>Blue</option>
            <option value={4}>Cyan</option>
            <option value={5}>Custom (RGB)</option>
          </select>
        </label>
        {x.color === 5 && (
          <>
            <Slider label="Red" field="red" min={0} max={255} step={1} />
            <Slider label="Green" field="green" min={0} max={255} step={1} />
            <Slider label="Blue" field="blue" min={0} max={255} step={1} />
          </>
        )}

        <div className="xh-toggles"><Toggle label="Use alpha (transparency)" field="alphaEnabled" /></div>
        {x.alphaEnabled && <Slider label="Alpha" field="alpha" min={0} max={255} step={1} />}

        <details className="xh-adv">
          <summary>Advanced (dynamic / recoil)</summary>
          <Slider label="Split distance" field="splitDistance" min={0} max={16} step={1} />
          <Slider label="Inner split alpha" field="innerSplitAlpha" min={0} max={1} step={0.1} />
          <Slider label="Outer split alpha" field="outerSplitAlpha" min={0} max={1} step={0.1} />
          <Slider label="Split size ratio" field="splitSizeRatio" min={0} max={1} step={0.1} />
          <Slider label="Fixed gap" field="fixedCrosshairGap" min={-5} max={5} step={0.5} />
          <div className="xh-toggles">
            <Toggle label="Follow recoil" field="followRecoil" />
            <Toggle label="Use weapon gap" field="deployedWeaponGapEnabled" />
          </div>
        </details>
      </div>
    </div>
  );
}
