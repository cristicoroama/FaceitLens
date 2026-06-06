// CS2 / CS:GO crosshair share code encode & decode.
// Algorithm verified against the reference vector and 8 pro codes (round-trip).
const DICT = "ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789";
const N = BigInt(DICT.length);
const sb = (v) => (v > 127 ? v - 256 : v);
const ub = (v) => ((v < 0 ? v + 256 : v) & 0xff);

export function decodeCrosshair(code) {
  const c = code.replace(/^CSGO/, "").replace(/-/g, "");
  if (c.length !== 25) throw new Error("Invalid share code");
  let big = 0n;
  for (const ch of [...c].reverse()) {
    const idx = DICT.indexOf(ch);
    if (idx < 0) throw new Error("Invalid character in share code");
    big = big * N + BigInt(idx);
  }
  const le = [];
  let n = big;
  while (n > 0n) { le.push(Number(n & 0xffn)); n >>= 8n; }
  while (le.length < 18) le.push(0);
  const a = le.slice(0, 18).reverse();
  return {
    color: a[1],
    gap: sb(a[2]) / 10,
    outline: a[3] / 2,
    red: a[4], green: a[5], blue: a[6], alpha: a[7],
    splitDistance: a[8] & 0x7f,
    followRecoil: (a[8] & 0x80) !== 0,
    fixedCrosshairGap: sb(a[9]) / 10,
    innerSplitAlpha: (a[10] >> 4) / 10,
    outlineEnabled: (a[10] & 0x08) !== 0,
    deployedWeaponGapEnabled: (a[10] & 0x01) !== 0,
    outerSplitAlpha: (a[11] & 0x0f) / 10,
    splitSizeRatio: (a[11] >> 4) / 10,
    thickness: a[12] / 10,
    style: (a[13] & 0x0f) >> 1,
    centerDotEnabled: (a[13] & 0x10) !== 0,
    alphaEnabled: (a[13] & 0x40) !== 0,
    tStyleEnabled: (a[13] & 0x80) !== 0,
    length: a[14] / 10,
    _b10: a[10], _b13: a[13],
  };
}

export function encodeCrosshair(x) {
  const a = new Array(18).fill(0);
  a[1] = (x.color ?? 1) & 0xff;
  a[2] = ub(Math.round(x.gap * 10));
  a[3] = Math.round(x.outline * 2) & 0xff;
  a[4] = x.red & 0xff; a[5] = x.green & 0xff; a[6] = x.blue & 0xff; a[7] = x.alpha & 0xff;
  a[8] = ((x.followRecoil ? 0x80 : 0) | (x.splitDistance & 0x7f)) & 0xff;
  a[9] = ub(Math.round(x.fixedCrosshairGap * 10));
  a[10] = ((Math.round(x.innerSplitAlpha * 10) << 4) |
           (x.outlineEnabled ? 0x08 : 0) |
           (x.deployedWeaponGapEnabled ? 0x01 : 0) |
           (typeof x._b10 === "number" ? (x._b10 & 0x06) : 0)) & 0xff;
  a[11] = (((Math.round(x.splitSizeRatio * 10) & 0x0f) << 4) |
           (Math.round(x.outerSplitAlpha * 10) & 0x0f)) & 0xff;
  a[12] = Math.round(x.thickness * 10) & 0xff;
  let b13 = (((x.style << 1) & 0x0f) |
             (x.centerDotEnabled ? 0x10 : 0) |
             (x.alphaEnabled ? 0x40 : 0) |
             (x.tStyleEnabled ? 0x80 : 0));
  if (typeof x._b13 === "number") b13 |= (x._b13 & 0x20);
  a[13] = b13 & 0xff;
  a[14] = Math.round(x.length * 10) & 0xff;
  let sum = 0;
  for (let i = 1; i < 18; i++) sum += a[i];
  a[0] = sum & 0xff;
  let big = 0n;
  for (const b of a) big = big * 256n + BigInt(b);
  let out = "";
  for (let i = 0; i < 25; i++) { out += DICT[Number(big % N)]; big /= N; }
  return `CSGO-${out.slice(0,5)}-${out.slice(5,10)}-${out.slice(10,15)}-${out.slice(15,20)}-${out.slice(20,25)}`;
}

export function crosshairToConVars(x) {
  const b = (v) => (v ? "1" : "0");
  return [
    `cl_crosshairstyle "${x.style}"`,
    `cl_crosshairsize "${x.length}"`,
    `cl_crosshairthickness "${x.thickness}"`,
    `cl_crosshairgap "${x.gap}"`,
    `cl_crosshair_drawoutline "${b(x.outlineEnabled)}"`,
    `cl_crosshair_outlinethickness "${x.outline}"`,
    `cl_crosshaircolor "${x.color}"`,
    `cl_crosshaircolor_r "${x.red}"`,
    `cl_crosshaircolor_g "${x.green}"`,
    `cl_crosshaircolor_b "${x.blue}"`,
    `cl_crosshairusealpha "${b(x.alphaEnabled)}"`,
    `cl_crosshairalpha "${x.alpha}"`,
    `cl_crosshairdot "${b(x.centerDotEnabled)}"`,
    `cl_crosshair_t "${b(x.tStyleEnabled)}"`,
    `cl_crosshair_recoil "${b(x.followRecoil)}"`,
    `cl_crosshairgap_useweaponvalue "${b(x.deployedWeaponGapEnabled)}"`,
    `cl_fixedcrosshairgap "${x.fixedCrosshairGap}"`,
    `cl_crosshair_dynamic_splitdist "${x.splitDistance}"`,
    `cl_crosshair_dynamic_splitalpha_innermod "${x.innerSplitAlpha}"`,
    `cl_crosshair_dynamic_splitalpha_outermod "${x.outerSplitAlpha}"`,
    `cl_crosshair_dynamic_maxdist_splitratio "${x.splitSizeRatio}"`,
  ].join("\n");
}

export const COLOR_PRESETS = {
  0: [255, 0, 0], 1: [0, 255, 0], 2: [255, 255, 0], 3: [0, 0, 255], 4: [0, 255, 255],
};

export function crosshairRGB(x) {
  if (x.color === 5 || !(x.color in COLOR_PRESETS)) return [x.red, x.green, x.blue];
  return COLOR_PRESETS[x.color];
}

export const DEFAULT_CROSSHAIR = {
  color: 1, gap: -3, outline: 1, red: 0, green: 255, blue: 0, alpha: 255,
  splitDistance: 7, followRecoil: false, fixedCrosshairGap: 0,
  innerSplitAlpha: 0, outlineEnabled: true, deployedWeaponGapEnabled: false,
  outerSplitAlpha: 1, splitSizeRatio: 0.3, thickness: 1,
  style: 4, centerDotEnabled: false, alphaEnabled: true, tStyleEnabled: false,
  length: 5,
};

// Pro player crosshairs (decoded on demand).
export const PRO_PRESETS = [
  { name: "s1mple", code: "CSGO-5JoAp-27by7-EhuBB-nUcq3-3uWPA" },
  { name: "ZywOo", code: "CSGO-ywh69-Ys549-BMc7Y-79HEq-J6sKG" },
  { name: "m0NESY", code: "CSGO-emwq4-BV8Ey-6VdtY-4KEzr-v5BYN" },
  { name: "sh1ro", code: "CSGO-oit62-q2AsV-L2SHE-3hoEJ-cMwLA" },
  { name: "Ax1Le", code: "CSGO-nZtuj-eHzcb-8fyLe-Cxbwc-NHpEM" },
  { name: "broky", code: "CSGO-2uABj-Rr3dC-yhVt3-bXe8v-tDu8O" },
  { name: "NiKo", code: "CSGO-LdXHk-hatWX-JjEa8-tuLDN-5tbJD" },
  { name: "ropz", code: "CSGO-UcXBk-p9Jpo-tJiAr-J6qNc-mRFuA" },
];
