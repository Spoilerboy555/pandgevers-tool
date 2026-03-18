"use client";

import React, { useEffect, useMemo, useState } from "react";

const BRAND = {
  forest: "#00424D",
  peach: "#FF7E50",
  cream: "#FEF1E2",
  ink: "#16343B",
  white: "#FFFFFF",
  border: "#E7DDD1",
  soft: "#FFFDF9",
  greenBg: "#DCFCE7",
  greenText: "#166534",
  orangeBg: "#FFEDD5",
  orangeText: "#C2410C",
  redBg: "#FEE2E2",
  redText: "#B91C1C",
};

const MIN_RATE = 5.5;
const MAX_RATE = 10.0;
const STORAGE_KEY = "depandgevers_saved_deals_v3";

const scoreMaps = {
  locatie: { A: 1, B: 2, C: 3 },
  debiteur: { Sterk: 1, Gemiddeld: 2, Zwak: 3 },
  vastgoedtype: {
    "Woning voor verhuur": 1,
    Zorgvastgoed: 1,
    Kantoor: 2,
    Bedrijfsruimte: 2,
    Ontwikkeling: 4,
  },
  exit: { Refinance: 1, Verkoop: 2, Onzeker: 3 },
};

function euro(value, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "€ 0";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

function pct(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0,00%";
  return `${n.toFixed(digits).replace(".", ",")}%`;
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeLtv(taxatie, lening) {
  const t = num(taxatie);
  const l = num(lening);
  if (t <= 0 || l <= 0) return 0;
  return (l / t) * 100;
}

function normalizeScore(score) {
  return Math.min(Math.max((score - 7) / 15, 0), 1);
}

function calculateAdvice(input) {
  const taxatie = num(input.taxatiewaarde);
  const lening = num(input.financieringsbedrag);
  const dscr = num(input.dscr);
  const looptijd = num(input.looptijdMaanden);
  const ltv = computeLtv(taxatie, lening);

  let score = 0;
  const breakdown = [];

  let ltvScore = 0;
  if (ltv <= 55) ltvScore = 1;
  else if (ltv <= 70) ltvScore = 2;
  else if (ltv <= 80) ltvScore = 3;
  else ltvScore = 5;
  score += ltvScore;
  breakdown.push({ label: "LTV", value: ltvScore });

  let dscrScore = 0;
  if (dscr >= 1.5) dscrScore = 1;
  else if (dscr >= 1.25) dscrScore = 2;
  else dscrScore = 4;
  score += dscrScore;
  breakdown.push({ label: "DSCR", value: dscrScore });

  let looptijdScore = 0;
  if (looptijd <= 12) looptijdScore = 3;
  else if (looptijd <= 24) looptijdScore = 2;
  else looptijdScore = 1;
  score += looptijdScore;
  breakdown.push({ label: "Looptijd", value: looptijdScore });

  const locatieScore = scoreMaps.locatie[input.locatie] ?? 0;
  const debiteurScore = scoreMaps.debiteur[input.debiteur] ?? 0;
  const vastgoedScore = scoreMaps.vastgoedtype[input.vastgoedtype] ?? 0;
  const exitScore = scoreMaps.exit[input.exitStrategie] ?? 0;

  score += locatieScore + debiteurScore + vastgoedScore + exitScore;
  breakdown.push({ label: "Locatie", value: locatieScore });
  breakdown.push({ label: "Debiteur", value: debiteurScore });
  breakdown.push({ label: "Vastgoed", value: vastgoedScore });
  breakdown.push({ label: "Exit", value: exitScore });

  const normalized = normalizeScore(score);
  const mid = MIN_RATE + (MAX_RATE - MIN_RATE) * normalized;
  const spread = score <= 10 ? 0.2 : score <= 14 ? 0.25 : 0.3;

  let riskLabel = "Laag risico";
  let riskBg = BRAND.greenBg;
  let riskColor = BRAND.greenText;
  if (score > 14) {
    riskLabel = "Hoog risico";
    riskBg = BRAND.redBg;
    riskColor = BRAND.redText;
  } else if (score > 10) {
    riskLabel = "Gemiddeld risico";
    riskBg = BRAND.orangeBg;
    riskColor = BRAND.orangeText;
  }

  return {
    ltv,
    score,
    breakdown,
    rateMin: Math.max(MIN_RATE, mid - spread),
    rateMax: Math.min(MAX_RATE, mid + spread),
    rateMid: mid,
    riskLabel,
    riskBg,
    riskColor,
  };
}

function calculateCosts(input) {
  const lening = num(input.financieringsbedrag);
  const looptijdMaanden = num(input.looptijdMaanden);
  const adminPerYear = lening * 0.005;
  const adminTotal = adminPerYear * (looptijdMaanden / 12);
  const investorFeePerYear = lening * 0.005;
  const investorFeeTotal = investorFeePerYear * (looptijdMaanden / 12);
  const closingFee = lening * 0.02;
  return { adminPerYear, adminTotal, investorFeePerYear, investorFeeTotal, closingFee };
}

function calculateSchedule(input, annualRate) {
  const principal = num(input.financieringsbedrag);
  const months = Math.max(1, num(input.looptijdMaanden));
  const monthlyRate = annualRate / 100 / 12;
  const loanType = input.loanType;
  const monthlyAdminFee = principal * 0.005 / 12;

  let balance = principal;
  let annuityPayment = 0;
  if (loanType === "annuitair" && monthlyRate > 0) {
    annuityPayment = principal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
  } else if (loanType === "annuitair") {
    annuityPayment = principal / months;
  }

  const rows = [];
  for (let month = 1; month <= months; month += 1) {
    const interest = balance * monthlyRate;
    let principalPart = 0;
    let payment = 0;

    if (loanType === "annuitair") {
      payment = annuityPayment;
      principalPart = payment - interest;
    } else if (loanType === "lineair") {
      principalPart = principal / months;
      payment = principalPart + interest;
    } else {
      principalPart = month === months ? principal : 0;
      payment = interest + principalPart;
    }

    if (principalPart > balance) {
      principalPart = balance;
      payment = interest + principalPart;
    }

    balance = Math.max(0, balance - principalPart);

    rows.push({
      month,
      payment,
      interest,
      principal: principalPart,
      balance,
      adminFee: monthlyAdminFee,
    });
  }

  return rows;
}

function calculateYearlyOverview(schedule, closingFee, principal) {
  const yearly = [];
  for (let i = 0; i < schedule.length; i += 12) {
    const chunk = schedule.slice(i, i + 12);
    const year = Math.floor(i / 12) + 1;
    const principalPaid = chunk.reduce((sum, row) => sum + row.principal, 0);
    const interest = chunk.reduce((sum, row) => sum + row.interest, 0);
    const adminFee = chunk.reduce((sum, row) => sum + row.adminFee, 0);
    const beginBalance = i === 0 ? principal : schedule[i - 1].balance;
    const endingBalance = chunk.length ? chunk[chunk.length - 1].balance : 0;

    yearly.push({
      year,
      beginBalance,
      principal: principalPaid,
      interest,
      adminFee,
      closingFee: year === 1 ? closingFee : 0,
      endingBalance,
    });
  }
  return yearly;
}

function downloadPdf(form, result, _costs, yearlyOverview) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return;

  const yearRows = yearlyOverview
    .map(
      (row) => `
        <tr>
          <td>${row.year}</td>
          <td><strong>${euro(row.beginBalance, 2)}</strong></td>
          <td>${euro(row.principal, 2)}</td>
          <td>${euro(row.interest, 2)}</td>
          <td>${euro(row.adminFee, 2)}</td>
          <td>${euro(row.closingFee, 2)}</td>
          <td><strong>${euro(row.endingBalance, 2)}</strong></td>
        </tr>`
    )
    .join("");

  const ltvBlock = `
    <table>
      <thead>
        <tr>
          <th>LTV</th>
          <th>Taxatie</th>
          <th>Lening</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${pct(result.ltv, 1)}</td>
          <td>${euro(num(form.taxatiewaarde))}</td>
          <td>${euro(num(form.financieringsbedrag))}</td>
        </tr>
      </tbody>
    </table>
  `;

  const riskRows = result.breakdown
    .map((item) => `<tr><td>${item.label}</td><td>${item.value}</td></tr>`)
    .join("");

  const content = `
    <html>
      <head>
        <title>De Pandgevers - Rente Advies</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #16343B; }
          h2 { color: #00424D; margin-top: 28px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border-bottom: 1px solid #E7DDD1; padding: 10px; text-align: left; font-size: 13px; }
        </style>
      </head>
      <body>
        <img src="/logo.png" style="height:60px; margin-bottom:16px;" />

        <h2>Rente advies</h2>
        <div><strong>${pct(result.rateMin)} - ${pct(result.rateMax)}</strong></div>
        <div>Indicatief: ${pct(result.rateMid)}</div>
        <div>Risico: ${result.riskLabel}</div>

        <h2>Risico-opbouw</h2>
        <table>
          <thead><tr><th>Factor</th><th>Score</th></tr></thead>
          <tbody>${riskRows}</tbody>
        </table>

        <h2>Kerngegevens</h2>
        ${ltvBlock}

        <h2>Verloopoverzicht leningnemer</h2>
        <table>
          <thead>
            <tr>
              <th>Jaar</th>
              <th>Beginschuld</th>
              <th>Aflossing</th>
              <th>Rente</th>
              <th>Admin</th>
              <th>Afsluit</th>
              <th>Restschuld</th>
            </tr>
          </thead>
          <tbody>${yearRows}</tbody>
        </table>
      </body>
    </html>`;

  popup.document.open();
  popup.document.write(content);
  popup.document.close();
  popup.focus();
  popup.print();
}

function cardStyle(dark = false) {
  return {
    background: dark ? BRAND.forest : BRAND.white,
    color: dark ? BRAND.white : BRAND.ink,
    borderRadius: 28,
    boxShadow: "0 16px 40px rgba(22, 52, 59, 0.08)",
    padding: 24,
  };
}

function inputStyle() {
  return {
    width: "100%",
    height: 48,
    borderRadius: 16,
    border: `1px solid ${BRAND.border}`,
    padding: "0 14px",
    fontSize: 15,
    boxSizing: "border-box",
    background: BRAND.white,
  };
}

function buttonStyle(primary = false) {
  return {
    border: primary ? "none" : `1px solid ${BRAND.border}`,
    background: primary ? BRAND.peach : BRAND.white,
    color: primary ? BRAND.white : BRAND.forest,
    borderRadius: 16,
    padding: "12px 18px",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  };
}

function smallButtonStyle(danger = false) {
  return {
    border: danger ? "1px solid #FECACA" : `1px solid ${BRAND.border}`,
    background: danger ? "#FFF1F2" : BRAND.white,
    color: danger ? "#B91C1C" : BRAND.forest,
    borderRadius: 12,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
      <img src="/logo.png" alt="De Pandgevers vastgoedfinanciering" style={{ height: 70, maxWidth: "100%", objectFit: "contain" }} />
    </div>
  );
}

function Field({ label, children, note }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.forest, marginBottom: 8 }}>{label}</div>
      {children}
      {note ? <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>{note}</div> : null}
    </div>
  );
}

function LogicBlock({ title, lines }) {
  return (
    <div>
      <strong>{title}</strong>
      {lines.map((line, index) => (
        <div key={`${title}-${index}`}>{line}</div>
      ))}
    </div>
  );
}

export default function Page() {
  const [form, setForm] = useState({
    dealNaam: "Nieuwe deal",
    taxatiewaarde: 1250000,
    financieringsbedrag: 775000,
    dscr: 1.3,
    looptijdMaanden: 24,
    locatie: "A",
    debiteur: "Sterk",
    vastgoedtype: "Woning voor verhuur",
    exitStrategie: "Refinance",
    loanType: "annuitair",
  });
  const [savedDeals, setSavedDeals] = useState([]);
  const [view, setView] = useState("main");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedDeals(JSON.parse(raw));
    } catch {
      setSavedDeals([]);
    }
  }, []);

  const result = useMemo(() => calculateAdvice(form), [form]);
  const costs = useMemo(() => calculateCosts(form), [form]);
  const schedule = useMemo(() => calculateSchedule(form, result.rateMid), [form, result.rateMid]);
  const yearlyOverview = useMemo(
    () => calculateYearlyOverview(schedule, costs.closingFee, num(form.financieringsbedrag)),
    [schedule, costs.closingFee, form.financieringsbedrag]
  );

  const pricingMode = useMemo(() => {
    if (result.score <= 10) return "Scherp";
    if (result.score <= 14) return "Normaal";
    return "Premium";
  }, [result.score]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const saveDeal = () => {
    const entry = {
      id: Date.now(),
      savedAt: new Date().toLocaleString("nl-NL"),
      form,
      result,
      costs,
    };
    const next = [entry, ...savedDeals];
    setSavedDeals(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const loadDeal = (entry) => {
    setForm(entry.form);
    setView("main");
  };

  const deleteDeal = (id) => {
    const next = savedDeals.filter((entry) => entry.id !== id);
    setSavedDeals(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  if (view === "voorwaarden") {
    return (
      <div style={{ minHeight: "100vh", background: BRAND.cream, padding: 24 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Logo />
            <button onClick={() => setView("main")} style={buttonStyle(false)}>Terug</button>
          </div>
          <div style={cardStyle(false)}>
            <div style={{ fontSize: 24, fontWeight: 800, color: BRAND.forest, marginBottom: 16 }}>Voorwaarden & scorelogica</div>
            <div style={{ display: "grid", gap: 16, fontSize: 14 }}>
              <LogicBlock
                title="LTV scoring"
                lines={[
                  "≤ 55% → 1 punt",
                  "55% - 70% → 2 punten",
                  "70% - 80% → 3 punten",
                  "> 80% → 5 punten",
                ]}
              />
              <LogicBlock
                title="DSCR scoring"
                lines={[
                  "≥ 1,50 → 1 punt",
                  "1,25 - 1,50 → 2 punten",
                  "< 1,25 → 4 punten",
                ]}
              />
              <LogicBlock
                title="Looptijd"
                lines={[
                  "≤ 12 maanden → 3 punten",
                  "13 - 24 maanden → 2 punten",
                  "> 24 maanden → 1 punt",
                ]}
              />
              <LogicBlock
                title="Overige factoren"
                lines={[
                  "Locatie, debiteur, vastgoedtype en exitstrategie bepalen aanvullende score.",
                ]}
              />
              <LogicBlock
                title="Rente bepaling"
                lines={[
                  `Genormaliseerde score naar bandbreedte ${MIN_RATE}% - ${MAX_RATE}%.
`,
                  "Lage score = scherper tarief, hoge score = hoger tarief.",
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "deals") {
    return (
      <div style={{ minHeight: "100vh", background: BRAND.cream, padding: 24 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Logo />
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setView("voorwaarden")} style={buttonStyle(false)}>Voorwaarden</button>
              <button onClick={() => setView("main")} style={buttonStyle(false)}>Terug</button>
            </div>
          </div>
          <div style={cardStyle(false)}>
            <div style={{ fontSize: 24, fontWeight: 800, color: BRAND.forest, marginBottom: 16 }}>Opgeslagen deals</div>
            <div style={{ display: "grid", gap: 12 }}>
              {savedDeals.length === 0 ? <div style={{ color: "#64748B" }}>Nog geen deals opgeslagen.</div> : null}
              {savedDeals.map((entry) => (
                <div key={entry.id} style={{ border: `1px solid ${BRAND.border}`, borderRadius: 18, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{entry.form.dealNaam}</div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>{entry.savedAt}</div>
                    </div>
                    <div style={{ fontWeight: 800 }}>{pct(entry.result.rateMid)}</div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                    <button onClick={() => loadDeal(entry)} style={smallButtonStyle(false)}>Open</button>
                    <button onClick={() => deleteDeal(entry.id)} style={smallButtonStyle(true)}>Verwijder</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BRAND.cream, padding: 24, fontFamily: "Arial, sans-serif", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1380, margin: "0 auto", display: "grid", gap: 24 }}>
        <div style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: 28, padding: 24, display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Logo />
            <button onClick={() => setView("voorwaarden")} style={buttonStyle(false)}>Voorwaarden</button>
          </div>
          <div style={{ color: BRAND.ink, lineHeight: 1.6, maxWidth: 760 }}>
            Interne webtool voor rente-advies op vastgoedfinancieringen. De tool berekent automatisch de LTV, vertaalt de dealkenmerken naar een risicoscore, toont omzet voor De Pandgevers B.V. en geeft een jaaroverzicht voor de leningnemer.
          </div>
        </div>

        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 0.85fr)" }}>
          <div style={{ display: "grid", gap: 24 }}>
            <div style={cardStyle(false)}>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 16, color: BRAND.forest }}>Deal invoer</div>
              <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <Field label="Dealnaam">
                  <input style={inputStyle()} value={form.dealNaam} onChange={(e) => update("dealNaam", e.target.value)} />
                </Field>
                <Field label="Leningstype">
                  <select style={inputStyle()} value={form.loanType} onChange={(e) => update("loanType", e.target.value)}>
                    <option value="annuitair">Annuitair</option>
                    <option value="lineair">Lineair</option>
                    <option value="aflossingsvrij">Aflossingsvrij</option>
                  </select>
                </Field>
                <Field label="Taxatiewaarde" note={euro(form.taxatiewaarde)}>
                  <input style={inputStyle()} type="number" value={form.taxatiewaarde} onChange={(e) => update("taxatiewaarde", e.target.value)} />
                </Field>
                <Field label="Financieringsbedrag" note={euro(form.financieringsbedrag)}>
                  <input style={inputStyle()} type="number" value={form.financieringsbedrag} onChange={(e) => update("financieringsbedrag", e.target.value)} />
                </Field>
                <Field label="DSCR">
                  <input style={inputStyle()} type="number" step="0.01" value={form.dscr} onChange={(e) => update("dscr", e.target.value)} />
                </Field>
                <Field label="Looptijd (maanden)">
                  <input style={inputStyle()} type="number" value={form.looptijdMaanden} onChange={(e) => update("looptijdMaanden", e.target.value)} />
                </Field>
                <Field label="Locatie">
                  <select style={inputStyle()} value={form.locatie} onChange={(e) => update("locatie", e.target.value)}>
                    <option value="A">A-locatie</option>
                    <option value="B">B-locatie</option>
                    <option value="C">C-locatie</option>
                  </select>
                </Field>
                <Field label="Debiteur">
                  <select style={inputStyle()} value={form.debiteur} onChange={(e) => update("debiteur", e.target.value)}>
                    <option value="Sterk">Sterk</option>
                    <option value="Gemiddeld">Gemiddeld</option>
                    <option value="Zwak">Zwak</option>
                  </select>
                </Field>
                <Field label="Vastgoedtype">
                  <select style={inputStyle()} value={form.vastgoedtype} onChange={(e) => update("vastgoedtype", e.target.value)}>
                    <option value="Woning voor verhuur">Woning voor verhuur</option>
                    <option value="Zorgvastgoed">Zorgvastgoed</option>
                    <option value="Kantoor">Kantoor</option>
                    <option value="Bedrijfsruimte">Bedrijfsruimte</option>
                    <option value="Ontwikkeling">Ontwikkeling</option>
                  </select>
                </Field>
                <Field label="Exit strategie">
                  <select style={inputStyle()} value={form.exitStrategie} onChange={(e) => update("exitStrategie", e.target.value)}>
                    <option value="Refinance">Refinance</option>
                    <option value="Verkoop">Verkoop</option>
                    <option value="Onzeker">Onzeker</option>
                  </select>
                </Field>
              </div>

              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 22, background: BRAND.soft, border: `1px solid ${BRAND.border}`, borderRadius: 24, padding: 18 }}>
                <div>
                  <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#64748B" }}>LTV</div>
                  <div style={{ marginTop: 6, fontSize: 30, fontWeight: 800, color: BRAND.forest }}>{pct(result.ltv, 1)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#64748B" }}>Taxatie</div>
                  <div style={{ marginTop: 6, fontSize: 30, fontWeight: 800, color: BRAND.forest }}>{euro(form.taxatiewaarde)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#64748B" }}>Lening</div>
                  <div style={{ marginTop: 6, fontSize: 30, fontWeight: 800, color: BRAND.forest }}>{euro(form.financieringsbedrag)}</div>
                </div>
              </div>
            </div>

            <div style={cardStyle(false)}>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 16, color: BRAND.forest }}>Omzet De Pandgevers B.V.</div>
              <div style={{ overflowX: "auto", border: `1px solid ${BRAND.border}`, borderRadius: 20, marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: BRAND.soft, color: BRAND.forest }}>
                      <th style={{ padding: "14px 16px", textAlign: "left" }}>Component</th>
                      <th style={{ padding: "14px 16px", textAlign: "left" }}>Per jaar</th>
                      <th style={{ padding: "14px 16px", textAlign: "left" }}>Totaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "14px 16px" }}>Admin leningnemer</td>
                      <td style={{ padding: "14px 16px" }}>{euro(costs.adminPerYear, 2)}</td>
                      <td style={{ padding: "14px 16px" }}>{euro(costs.adminTotal, 2)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "14px 16px" }}>Admin investeerder</td>
                      <td style={{ padding: "14px 16px" }}>{euro(costs.investorFeePerYear, 2)}</td>
                      <td style={{ padding: "14px 16px" }}>{euro(costs.investorFeeTotal, 2)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "14px 16px" }}>Afsluitprovisie</td>
                      <td style={{ padding: "14px 16px" }}>-</td>
                      <td style={{ padding: "14px 16px" }}>{euro(costs.closingFee, 2)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "14px 16px", fontWeight: 800 }}>Totale omzet</td>
                      <td style={{ padding: "14px 16px", fontWeight: 800 }}>{euro(costs.adminPerYear + costs.investorFeePerYear, 2)}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 800 }}>{euro(costs.adminTotal + costs.investorFeeTotal + costs.closingFee, 2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 16, color: BRAND.forest }}>Verloopoverzicht leningnemer (per jaar)</div>
              <div style={{ overflowX: "auto", border: `1px solid ${BRAND.border}`, borderRadius: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: BRAND.soft, color: BRAND.forest }}>
                      <th style={{ textAlign: "left", padding: "14px 16px" }}>Jaar</th>
                      <th style={{ textAlign: "left", padding: "14px 16px" }}>Beginschuld</th>
                      <th style={{ textAlign: "left", padding: "14px 16px" }}>Aflossing</th>
                      <th style={{ textAlign: "left", padding: "14px 16px" }}>Rente</th>
                      <th style={{ textAlign: "left", padding: "14px 16px" }}>Admin</th>
                      <th style={{ textAlign: "left", padding: "14px 16px" }}>Afsluit</th>
                      <th style={{ textAlign: "left", padding: "14px 16px" }}>Restschuld</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyOverview.map((row) => (
                      <tr key={row.year}>
                        <td style={{ padding: "14px 16px" }}>{row.year}</td>
                        <td style={{ padding: "14px 16px", fontWeight: 800 }}>{euro(row.beginBalance, 2)}</td>
                        <td style={{ padding: "14px 16px" }}>{euro(row.principal, 2)}</td>
                        <td style={{ padding: "14px 16px" }}>{euro(row.interest, 2)}</td>
                        <td style={{ padding: "14px 16px" }}>{euro(row.adminFee, 2)}</td>
                        <td style={{ padding: "14px 16px" }}>{euro(row.closingFee, 2)}</td>
                        <td style={{ padding: "14px 16px", fontWeight: 800 }}>{euro(row.endingBalance, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 24 }}>
            <div style={cardStyle(true)}>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 16, color: BRAND.white }}>Rente advies</div>
              <div style={{ fontSize: 14, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Geadviseerde range</div>
              <div style={{ marginTop: 14, fontSize: 46, fontWeight: 900, lineHeight: 1.05 }}>
                {pct(result.rateMin)} <span style={{ opacity: 0.55 }}>–</span> {pct(result.rateMax)}
              </div>
              <div style={{ marginTop: 14, fontSize: 18, color: "rgba(255,255,255,0.82)" }}>Indicatief midden: {pct(result.rateMid)}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
                <div style={{ display: "inline-flex", padding: "8px 12px", borderRadius: 999, background: result.riskBg, color: result.riskColor, fontSize: 13, fontWeight: 700 }}>{result.riskLabel}</div>
                <div style={{ display: "inline-flex", padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: BRAND.white, fontSize: 13, fontWeight: 700 }}>Score {result.score}</div>
                <div style={{ display: "inline-flex", padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: BRAND.white, fontSize: 13, fontWeight: 700 }}>{pricingMode} pricing</div>
              </div>
            </div>

            <div style={cardStyle(false)}>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 16, color: BRAND.forest }}>Risico-opbouw</div>
              <div style={{ display: "grid", gap: 12 }}>
                {result.breakdown.map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${BRAND.border}`, borderRadius: 18, padding: "14px 16px" }}>
                    <div style={{ fontSize: 14, color: "#475569", fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 14, color: BRAND.forest, fontWeight: 800 }}>+{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle(false)}>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 16, color: BRAND.forest }}>Snelle deal beoordeling</div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", border: `1px solid ${BRAND.border}`, borderRadius: 18 }}>
                  <span style={{ color: "#475569" }}>Risico categorie</span>
                  <strong>{result.riskLabel}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", border: `1px solid ${BRAND.border}`, borderRadius: 18 }}>
                  <span style={{ color: "#475569" }}>LTV beoordeling</span>
                  <strong>{result.ltv <= 65 ? "Sterk" : result.ltv <= 80 ? "Acceptabel" : "Risicovol"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", border: `1px solid ${BRAND.border}`, borderRadius: 18 }}>
                  <span style={{ color: "#475569" }}>DSCR beoordeling</span>
                  <strong>{form.dscr >= 1.4 ? "Sterk" : form.dscr >= 1.25 ? "Gemiddeld" : "Zwak"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", border: `1px solid ${BRAND.border}`, borderRadius: 18 }}>
                  <span style={{ color: "#475569" }}>Loan sizing</span>
                  <strong>{euro(form.financieringsbedrag)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", border: `1px solid ${BRAND.border}`, borderRadius: 18 }}>
                  <span style={{ color: "#475569" }}>Verwachte opbrengst (totaal)</span>
                  <strong>{euro(costs.adminTotal + costs.investorFeeTotal + costs.closingFee)}</strong>
                </div>
              </div>

              <div style={{ marginTop: 20, fontSize: 24, fontWeight: 800, color: BRAND.forest }}>Advies & beslissing</div>
              <div style={{ marginTop: 12, background: BRAND.cream, borderRadius: 20, padding: 16, lineHeight: 1.7, fontSize: 14 }}>
                Deze deal valt in de categorie <strong>{result.riskLabel.toLowerCase()}</strong>. Geadviseerde rente: <strong>{pct(result.rateMin)} - {pct(result.rateMax)}</strong>.
              </div>
              <div style={{ marginTop: 14, padding: 16, borderRadius: 20, background: result.score <= 14 ? BRAND.greenBg : BRAND.redBg }}>
                <strong style={{ color: result.score <= 14 ? BRAND.greenText : BRAND.redText }}>
                  {result.score <= 14 ? "✅ Deal doen" : "❌ Deal niet doen / herstructureren"}
                </strong>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
                <button onClick={() => downloadPdf(form, result, costs, yearlyOverview)} style={buttonStyle(true)}>Download / print PDF</button>
                <button onClick={saveDeal} style={buttonStyle(false)}>Opslaan deal</button>
                <button onClick={() => setView("deals")} style={buttonStyle(false)}>Bekijk opgeslagen deals</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
