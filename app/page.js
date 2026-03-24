"use client";

import React, { useEffect, useMemo, useState } from "react";

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

const STORAGE_KEY = "depandgevers_saved_deals_v3";
const RULES_STORAGE_KEY = "depandgevers_rules_v1";

const defaultRules = {
  minRate: 5.5,
  maxRate: 10.0,
  benchmarkBaseRate: 6.0,
  ltvThreshold1: 55,
  ltvThreshold2: 70,
  ltvThreshold3: 80,
  ltvScore1: 1,
  ltvScore2: 2,
  ltvScore3: 3,
  ltvScore4: 5,
  dscrThreshold1: 1.5,
  dscrThreshold2: 1.25,
  dscrScore1: 1,
  dscrScore2: 2,
  dscrScore3: 4,
  looptijdThreshold1: 12,
  looptijdThreshold2: 24,
  looptijdScore1: 3,
  looptijdScore2: 2,
  looptijdScore3: 1,
  locatieA: 1,
  locatieB: 2,
  locatieC: 3,
  debiteurSterk: 1,
  debiteurGemiddeld: 2,
  debiteurZwak: 3,
  vastgoedWoning: 1,
  vastgoedZorg: 1,
  vastgoedKantoor: 2,
  vastgoedBedrijfsruimte: 2,
  vastgoedOntwikkeling: 4,
  exitRefinance: 1,
  exitVerkoop: 2,
  exitOnzeker: 3,
  benchmarkLtvMidThreshold: 65,
  benchmarkLtvHighThreshold: 75,
  benchmarkLtvMidAdd: 0.4,
  benchmarkLtvHighAdd: 0.75,
  benchmarkOntwikkelingAdd: 1.0,
  benchmarkKantoorBedrijfsruimteAdd: 0.3,
  benchmarkDebiteurZwakAdd: 0.5,
};

function euro(value, digits = 0) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num(value));
}

function pct(value, digits = 2) {
  return `${num(value).toFixed(digits).replace(".", ",")}%`;
}

function computeLtv(taxatie, lening) {
  const t = num(taxatie);
  const l = num(lening);
  if (t <= 0 || l <= 0) return 0;
  return (l / t) * 100;
}

function normalizeScore(score, rules) {
  const minScore = 7;
  const maxScore =
    num(rules.ltvScore4) +
    num(rules.dscrScore3) +
    num(rules.looptijdScore1) +
    Math.max(num(rules.locatieA), num(rules.locatieB), num(rules.locatieC)) +
    Math.max(num(rules.debiteurSterk), num(rules.debiteurGemiddeld), num(rules.debiteurZwak)) +
    Math.max(
      num(rules.vastgoedWoning),
      num(rules.vastgoedZorg),
      num(rules.vastgoedKantoor),
      num(rules.vastgoedBedrijfsruimte),
      num(rules.vastgoedOntwikkeling)
    ) +
    Math.max(num(rules.exitRefinance), num(rules.exitVerkoop), num(rules.exitOnzeker));

  return Math.min(Math.max((num(score) - minScore) / Math.max(1, maxScore - minScore), 0), 1);
}

function getBenchmarkRate(input, rules) {
  const ltv = computeLtv(input.taxatiewaarde, input.financieringsbedrag);
  let base = num(rules.benchmarkBaseRate);

  if (ltv > num(rules.benchmarkLtvHighThreshold)) base += num(rules.benchmarkLtvHighAdd);
  else if (ltv > num(rules.benchmarkLtvMidThreshold)) base += num(rules.benchmarkLtvMidAdd);

  if (input.vastgoedtype === "Ontwikkeling") base += num(rules.benchmarkOntwikkelingAdd);
  if (input.vastgoedtype === "Kantoor" || input.vastgoedtype === "Bedrijfsruimte") {
    base += num(rules.benchmarkKantoorBedrijfsruimteAdd);
  }
  if (input.debiteur === "Zwak") base += num(rules.benchmarkDebiteurZwakAdd);

  return Math.min(Math.max(base, num(rules.minRate)), num(rules.maxRate));
}

function calculateAdvice(input, rules) {
  const taxatie = num(input.taxatiewaarde);
  const lening = num(input.financieringsbedrag);
  const dscr = num(input.dscr);
  const looptijd = num(input.looptijdMaanden);
  const ltv = computeLtv(taxatie, lening);

  let score = 0;
  const breakdown = [];

  const ltvScore =
    ltv <= num(rules.ltvThreshold1)
      ? num(rules.ltvScore1)
      : ltv <= num(rules.ltvThreshold2)
        ? num(rules.ltvScore2)
        : ltv <= num(rules.ltvThreshold3)
          ? num(rules.ltvScore3)
          : num(rules.ltvScore4);
  score += ltvScore;
  breakdown.push({ label: "LTV", value: ltvScore });

  const dscrScore =
    dscr >= num(rules.dscrThreshold1)
      ? num(rules.dscrScore1)
      : dscr >= num(rules.dscrThreshold2)
        ? num(rules.dscrScore2)
        : num(rules.dscrScore3);
  score += dscrScore;
  breakdown.push({ label: "DSCR", value: dscrScore });

  const looptijdScore =
    looptijd <= num(rules.looptijdThreshold1)
      ? num(rules.looptijdScore1)
      : looptijd <= num(rules.looptijdThreshold2)
        ? num(rules.looptijdScore2)
        : num(rules.looptijdScore3);
  score += looptijdScore;
  breakdown.push({ label: "Looptijd", value: looptijdScore });

  const locatieScore = input.locatie === "A" ? num(rules.locatieA) : input.locatie === "B" ? num(rules.locatieB) : num(rules.locatieC);
  const debiteurScore = input.debiteur === "Sterk" ? num(rules.debiteurSterk) : input.debiteur === "Gemiddeld" ? num(rules.debiteurGemiddeld) : num(rules.debiteurZwak);
  const vastgoedScore =
    input.vastgoedtype === "Woning voor verhuur"
      ? num(rules.vastgoedWoning)
      : input.vastgoedtype === "Zorgvastgoed"
        ? num(rules.vastgoedZorg)
        : input.vastgoedtype === "Kantoor"
          ? num(rules.vastgoedKantoor)
          : input.vastgoedtype === "Bedrijfsruimte"
            ? num(rules.vastgoedBedrijfsruimte)
            : num(rules.vastgoedOntwikkeling);
  const exitScore = input.exitStrategie === "Refinance" ? num(rules.exitRefinance) : input.exitStrategie === "Verkoop" ? num(rules.exitVerkoop) : num(rules.exitOnzeker);

  score += locatieScore + debiteurScore + vastgoedScore + exitScore;
  breakdown.push({ label: "Locatie", value: locatieScore });
  breakdown.push({ label: "Debiteur", value: debiteurScore });
  breakdown.push({ label: "Vastgoed", value: vastgoedScore });
  breakdown.push({ label: "Exit", value: exitScore });

  const normalized = normalizeScore(score, rules);
  const minRate = num(rules.minRate);
  const maxRate = num(rules.maxRate);
  const mid = minRate + (maxRate - minRate) * normalized;
  const spread = 0.2 + (score / 20) * 0.15;

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

  const benchmark = getBenchmarkRate(input, rules);
  let pricingLabel = "Marktconform";
  let pricingTone = "green";

  if (mid < benchmark - 0.3) {
    pricingLabel = "Onder markt (scherp)";
    pricingTone = "orange";
  } else if (mid > benchmark + 0.3) {
    pricingLabel = "Boven markt";
    pricingTone = "red";
  }

  return {
    ltv,
    score,
    breakdown,
    rateMin: Math.max(minRate, mid - spread),
    rateMax: Math.min(maxRate, mid + spread),
    rateMid: mid,
    benchmark,
    pricingLabel,
    pricingTone,
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
  const monthlyRate = num(annualRate) / 100 / 12;
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
    yearly.push({
      year,
      beginBalance: i === 0 ? principal : schedule[i - 1].balance,
      principal: chunk.reduce((sum, row) => sum + row.principal, 0),
      interest: chunk.reduce((sum, row) => sum + row.interest, 0),
      adminFee: chunk.reduce((sum, row) => sum + row.adminFee, 0),
      closingFee: year === 1 ? closingFee : 0,
      endingBalance: chunk.length ? chunk[chunk.length - 1].balance : 0,
    });
  }
  return yearly;
}

function pricingBadgeStyle(pricingTone) {
  if (pricingTone === "orange") {
    return { background: BRAND.orangeBg, color: BRAND.orangeText };
  }
  if (pricingTone === "red") {
    return { background: BRAND.redBg, color: BRAND.redText };
  }
  return { background: BRAND.greenBg, color: BRAND.greenText };
}

function generateRiskText(form, result) {
  if (result.score <= 10) {
    return "Deze financieringsaanvraag wordt gekenmerkt door een laag risicoprofiel. De combinatie van een sterke LTV, solide debiteur en stabiele kasstromen resulteert in een conservatieve risico-inschatting.";
  }
  if (result.score <= 14) {
    return "De aanvraag kent een gemiddeld risicoprofiel. Enkele factoren zoals LTV, looptijd of debiteur zorgen voor een verhoogd risico, maar blijven binnen acceptabele bandbreedtes.";
  }
  return "Deze aanvraag kent een verhoogd risicoprofiel. Factoren zoals hoge leverage, zwakkere debiteur of ontwikkelingscomponent zorgen voor een duidelijke risicopremie.";
}

function downloadPdf(form, result, costs, yearlyOverview) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return;

  const riskPct = Math.min(100, Math.round((result.score / 20) * 100));

  const yearRows = yearlyOverview
    .map(
      (row) => `
      <tr>
        <td>${row.year}</td>
        <td><strong>${euro(row.beginBalance, 2)}</strong></td>
        <td>${euro(row.principal, 2)}</td>
        <td>${euro(row.interest, 2)}</td>
        <td>${euro(row.adminFee, 2)}</td>
        <td><strong>${euro(row.endingBalance, 2)}</strong></td>
      </tr>`
    )
    .join("");

  const riskRows = result.breakdown
    .map((item) => `<tr><td>${item.label}</td><td>${item.value}</td></tr>`)
    .join("");

  const content = `
  <html>
  <head>
    <title>Risico rapport</title>
    <style>
      body { font-family: Arial; padding: 40px; color: #16343B; }
      h1 { color: #00424D; }
      h2 { margin-top: 30px; color: #00424D; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border-bottom: 1px solid #E7DDD1; padding: 10px; font-size: 13px; text-align: left; }

      .card {
        border: 1px solid #E7DDD1;
        border-radius: 16px;
        padding: 16px;
        margin-top: 16px;
      }

      .heatbar {
        height: 16px;
        border-radius: 999px;
        overflow: hidden;
        display: flex;
      }

      .low { background: #DCFCE7; width: 33%; }
      .mid { background: #FFEDD5; width: 33%; }
      .high { background: #FEE2E2; width: 34%; }

      .indicator {
        height: 16px;
        background: #00424D;
      }
    </style>
  </head>

  <body>

    <img src="/logo.png" style="height:60px;" />

    <h1>Financieringsrapport</h1>

    <div class="card">
      <strong>Deal:</strong> ${form.dealNaam}<br/>
      <strong>Lening:</strong> ${euro(form.financieringsbedrag)}<br/>
      <strong>Looptijd:</strong> ${form.looptijdMaanden} maanden<br/>
    </div>

    <h2>Rente advies</h2>
    <div class="card">
      <strong>${pct(result.rateMin)} - ${pct(result.rateMax)}</strong><br/>
      Indicatief: ${pct(result.rateMid)}<br/>
      Benchmark: ${pct(result.benchmark)}
    </div>

    <h2>Risico profiel</h2>
    <div class="card">
      <strong>${result.riskLabel}</strong><br/><br/>

      <div class="heatbar">
        <div class="low"></div>
        <div class="mid"></div>
        <div class="high"></div>
      </div>
      <div class="indicator" style="width:${riskPct}%"></div>

      <p style="margin-top:12px;">
        ${generateRiskText(form, result)}
      </p>
    </div>

    <h2>Risico-opbouw</h2>
    <table>
      <thead>
        <tr><th>Factor</th><th>Score</th></tr>
      </thead>
      <tbody>
        ${riskRows}
      </tbody>
    </table>

    <h2>Kerngegevens</h2>
    <table>
      <tr><td>LTV</td><td>${pct(result.ltv)}</td></tr>
      <tr><td>DSCR</td><td>${form.dscr}</td></tr>
      <tr><td>Vastgoed</td><td>${form.vastgoedtype}</td></tr>
      <tr><td>Exit</td><td>${form.exitStrategie}</td></tr>
    </table>

    <h2>Kosten (leningnemer)</h2>
    <table>
      <tr><td>Admin fee</td><td>${euro(costs.adminTotal)}</td></tr>
      <tr><td>Afsluitprovisie</td><td>${euro(costs.closingFee)}</td></tr>
    </table>

    <h2>Verloop lening</h2>
    <table>
      <thead>
        <tr>
          <th>Jaar</th>
          <th>Beginschuld</th>
          <th>Aflossing</th>
          <th>Rente</th>
          <th>Admin</th>
          <th>Restschuld</th>
        </tr>
      </thead>
      <tbody>
        ${yearRows}
      </tbody>
    </table>

  </body>
  </html>
  `;

  popup.document.open();
  popup.document.write(content);
  popup.document.close();
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [rules, setRules] = useState(defaultRules);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedDeals(JSON.parse(raw));
      const rawRules = window.localStorage.getItem(RULES_STORAGE_KEY);
      if (rawRules) setRules({ ...defaultRules, ...JSON.parse(rawRules) });
    } catch {
      setSavedDeals([]);
      setRules(defaultRules);
    }
  }, []);

  const result = useMemo(() => calculateAdvice(form, rules), [form, rules]);
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
      status: "Ter beoordeling",
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

const updateDealStatus = (id, status) => {
  const next = savedDeals.map((entry) =>
    entry.id === id ? { ...entry, status } : entry
  );
  setSavedDeals(next);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

  if (view === "voorwaarden") {
    const updateRule = (key, value) => {
      const next = { ...rules, [key]: Number(value) };
      setRules(next);
      window.localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(next));
    };

    const resetRules = () => {
      setRules(defaultRules);
      window.localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(defaultRules));
    };

    return (
      <div style={{ minHeight: "100vh", background: BRAND.cream, padding: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Logo />
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={resetRules} style={buttonStyle(false)}>Reset standaard</button>
              <button onClick={() => setView("main")} style={buttonStyle(false)}>Terug</button>
            </div>
          </div>
          <div style={cardStyle(false)}>
            <div style={{ fontSize: 24, fontWeight: 800, color: BRAND.forest, marginBottom: 16 }}>Voorwaarden & scorelogica</div>
            <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Rente & benchmark</div>
                <Field label="Minimum rente"><input style={inputStyle()} type="number" step="0.01" value={rules.minRate} onChange={(e) => updateRule("minRate", e.target.value)} /></Field>
                <Field label="Maximum rente"><input style={inputStyle()} type="number" step="0.01" value={rules.maxRate} onChange={(e) => updateRule("maxRate", e.target.value)} /></Field>
                <Field label="Benchmark basisrente"><input style={inputStyle()} type="number" step="0.01" value={rules.benchmarkBaseRate} onChange={(e) => updateRule("benchmarkBaseRate", e.target.value)} /></Field>
                <Field label="Benchmark LTV drempel midden"><input style={inputStyle()} type="number" step="0.01" value={rules.benchmarkLtvMidThreshold} onChange={(e) => updateRule("benchmarkLtvMidThreshold", e.target.value)} /></Field>
                <Field label="Benchmark LTV opslag midden"><input style={inputStyle()} type="number" step="0.01" value={rules.benchmarkLtvMidAdd} onChange={(e) => updateRule("benchmarkLtvMidAdd", e.target.value)} /></Field>
                <Field label="Benchmark LTV drempel hoog"><input style={inputStyle()} type="number" step="0.01" value={rules.benchmarkLtvHighThreshold} onChange={(e) => updateRule("benchmarkLtvHighThreshold", e.target.value)} /></Field>
                <Field label="Benchmark LTV opslag hoog"><input style={inputStyle()} type="number" step="0.01" value={rules.benchmarkLtvHighAdd} onChange={(e) => updateRule("benchmarkLtvHighAdd", e.target.value)} /></Field>
                <Field label="Benchmark opslag ontwikkeling"><input style={inputStyle()} type="number" step="0.01" value={rules.benchmarkOntwikkelingAdd} onChange={(e) => updateRule("benchmarkOntwikkelingAdd", e.target.value)} /></Field>
                <Field label="Benchmark opslag kantoor/bedrijfsruimte"><input style={inputStyle()} type="number" step="0.01" value={rules.benchmarkKantoorBedrijfsruimteAdd} onChange={(e) => updateRule("benchmarkKantoorBedrijfsruimteAdd", e.target.value)} /></Field>
                <Field label="Benchmark opslag debiteur zwak"><input style={inputStyle()} type="number" step="0.01" value={rules.benchmarkDebiteurZwakAdd} onChange={(e) => updateRule("benchmarkDebiteurZwakAdd", e.target.value)} /></Field>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>LTV scoring</div>
                <Field label="LTV drempel 1"><input style={inputStyle()} type="number" value={rules.ltvThreshold1} onChange={(e) => updateRule("ltvThreshold1", e.target.value)} /></Field>
                <Field label="LTV score 1"><input style={inputStyle()} type="number" value={rules.ltvScore1} onChange={(e) => updateRule("ltvScore1", e.target.value)} /></Field>
                <Field label="LTV drempel 2"><input style={inputStyle()} type="number" value={rules.ltvThreshold2} onChange={(e) => updateRule("ltvThreshold2", e.target.value)} /></Field>
                <Field label="LTV score 2"><input style={inputStyle()} type="number" value={rules.ltvScore2} onChange={(e) => updateRule("ltvScore2", e.target.value)} /></Field>
                <Field label="LTV drempel 3"><input style={inputStyle()} type="number" value={rules.ltvThreshold3} onChange={(e) => updateRule("ltvThreshold3", e.target.value)} /></Field>
                <Field label="LTV score 3"><input style={inputStyle()} type="number" value={rules.ltvScore3} onChange={(e) => updateRule("ltvScore3", e.target.value)} /></Field>
                <Field label="LTV score 4"><input style={inputStyle()} type="number" value={rules.ltvScore4} onChange={(e) => updateRule("ltvScore4", e.target.value)} /></Field>

                <div style={{ fontWeight: 800, margin: "20px 0 10px" }}>DSCR scoring</div>
                <Field label="DSCR drempel 1"><input style={inputStyle()} type="number" step="0.01" value={rules.dscrThreshold1} onChange={(e) => updateRule("dscrThreshold1", e.target.value)} /></Field>
                <Field label="DSCR score 1"><input style={inputStyle()} type="number" value={rules.dscrScore1} onChange={(e) => updateRule("dscrScore1", e.target.value)} /></Field>
                <Field label="DSCR drempel 2"><input style={inputStyle()} type="number" step="0.01" value={rules.dscrThreshold2} onChange={(e) => updateRule("dscrThreshold2", e.target.value)} /></Field>
                <Field label="DSCR score 2"><input style={inputStyle()} type="number" value={rules.dscrScore2} onChange={(e) => updateRule("dscrScore2", e.target.value)} /></Field>
                <Field label="DSCR score 3"><input style={inputStyle()} type="number" value={rules.dscrScore3} onChange={(e) => updateRule("dscrScore3", e.target.value)} /></Field>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Looptijd scoring</div>
                <Field label="Looptijd drempel 1"><input style={inputStyle()} type="number" value={rules.looptijdThreshold1} onChange={(e) => updateRule("looptijdThreshold1", e.target.value)} /></Field>
                <Field label="Looptijd score 1"><input style={inputStyle()} type="number" value={rules.looptijdScore1} onChange={(e) => updateRule("looptijdScore1", e.target.value)} /></Field>
                <Field label="Looptijd drempel 2"><input style={inputStyle()} type="number" value={rules.looptijdThreshold2} onChange={(e) => updateRule("looptijdThreshold2", e.target.value)} /></Field>
                <Field label="Looptijd score 2"><input style={inputStyle()} type="number" value={rules.looptijdScore2} onChange={(e) => updateRule("looptijdScore2", e.target.value)} /></Field>
                <Field label="Looptijd score 3"><input style={inputStyle()} type="number" value={rules.looptijdScore3} onChange={(e) => updateRule("looptijdScore3", e.target.value)} /></Field>

                <div style={{ fontWeight: 800, margin: "20px 0 10px" }}>Locatie / debiteur / exit</div>
                <Field label="Locatie A"><input style={inputStyle()} type="number" value={rules.locatieA} onChange={(e) => updateRule("locatieA", e.target.value)} /></Field>
                <Field label="Locatie B"><input style={inputStyle()} type="number" value={rules.locatieB} onChange={(e) => updateRule("locatieB", e.target.value)} /></Field>
                <Field label="Locatie C"><input style={inputStyle()} type="number" value={rules.locatieC} onChange={(e) => updateRule("locatieC", e.target.value)} /></Field>
                <Field label="Debiteur sterk"><input style={inputStyle()} type="number" value={rules.debiteurSterk} onChange={(e) => updateRule("debiteurSterk", e.target.value)} /></Field>
                <Field label="Debiteur gemiddeld"><input style={inputStyle()} type="number" value={rules.debiteurGemiddeld} onChange={(e) => updateRule("debiteurGemiddeld", e.target.value)} /></Field>
                <Field label="Debiteur zwak"><input style={inputStyle()} type="number" value={rules.debiteurZwak} onChange={(e) => updateRule("debiteurZwak", e.target.value)} /></Field>
                <Field label="Exit refinance"><input style={inputStyle()} type="number" value={rules.exitRefinance} onChange={(e) => updateRule("exitRefinance", e.target.value)} /></Field>
                <Field label="Exit verkoop"><input style={inputStyle()} type="number" value={rules.exitVerkoop} onChange={(e) => updateRule("exitVerkoop", e.target.value)} /></Field>
                <Field label="Exit onzeker"><input style={inputStyle()} type="number" value={rules.exitOnzeker} onChange={(e) => updateRule("exitOnzeker", e.target.value)} /></Field>
              </div>

              <div>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Vastgoed scoring</div>
                <Field label="Woning voor verhuur"><input style={inputStyle()} type="number" value={rules.vastgoedWoning} onChange={(e) => updateRule("vastgoedWoning", e.target.value)} /></Field>
                <Field label="Zorgvastgoed"><input style={inputStyle()} type="number" value={rules.vastgoedZorg} onChange={(e) => updateRule("vastgoedZorg", e.target.value)} /></Field>
                <Field label="Kantoor"><input style={inputStyle()} type="number" value={rules.vastgoedKantoor} onChange={(e) => updateRule("vastgoedKantoor", e.target.value)} /></Field>
                <Field label="Bedrijfsruimte"><input style={inputStyle()} type="number" value={rules.vastgoedBedrijfsruimte} onChange={(e) => updateRule("vastgoedBedrijfsruimte", e.target.value)} /></Field>
                <Field label="Ontwikkeling"><input style={inputStyle()} type="number" value={rules.vastgoedOntwikkeling} onChange={(e) => updateRule("vastgoedOntwikkeling", e.target.value)} /></Field>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "deals") {
  const filteredDeals =
    statusFilter === "all"
      ? savedDeals
      : savedDeals.filter((d) => (d.status || "Ter beoordeling") === statusFilter);
    
  const totalDeals = savedDeals.length;
    
  const doneDeals = savedDeals.filter((d) => d.status === "Gedaan");
  const rejectedDeals = savedDeals.filter((d) => d.status === "Afgekeurd");
  
  const doneCount = doneDeals.length;
  const rejectedCount = rejectedDeals.length;
  const openCount = totalDeals - doneCount - rejectedCount;
  
  const conversion =
    totalDeals > 0 ? ((doneCount / totalDeals) * 100).toFixed(1) : 0;
  
   const totalRevenueDone = doneDeals.reduce(
    (sum, d) =>
      sum +
      (d.costs?.adminTotal || 0) +
      (d.costs?.investorFeeTotal || 0) +
      (d.costs?.closingFee || 0),
    0
  );
  
  const totalLoanDone = doneDeals.reduce(
    (sum, d) => sum + (d.form?.financieringsbedrag || 0),
    0
  );
    
  const donePct = totalDeals ? (doneCount / totalDeals) * 100 : 0;
  const rejectedPct = totalDeals ? (rejectedCount / totalDeals) * 100 : 0;
  const openPct = totalDeals ? (openCount / totalDeals) * 100 : 0;
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div style={{ ...cardStyle(false), padding: 16 }}>
              <div style={{ fontSize: 12, color: "#64748B" }}>Totaal deals</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{totalDeals}</div>
            </div>
          
            <div style={{ ...cardStyle(false), padding: 16 }}>
              <div style={{ fontSize: 12 }}>Gedaan</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.greenText }}>
                {doneCount}
              </div>
            </div>
          
            <div style={{ ...cardStyle(false), padding: 16 }}>
              <div style={{ fontSize: 12 }}>Afgekeurd</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.redText }}>
                {rejectedCount}
              </div>
            </div>
          
            <div style={{ ...cardStyle(false), padding: 16 }}>
              <div style={{ fontSize: 12 }}>Conversie</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {conversion}%
              </div>
            </div>
          
            <div style={{ ...cardStyle(false), padding: 16 }}>
              <div style={{ fontSize: 12 }}>Omzet (gedaan)</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                Leensom: {euro(totalLoanDone, 0)}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {euro(totalRevenueDone, 0)}
              </div>
            </div>
          </div>
          
          <div style={{ ...cardStyle(false), padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 800, marginBottom: 12, color: BRAND.forest }}>
              Deal verdeling
            </div>
          
            <div style={{ display: "flex", height: 20, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${donePct}%`, background: BRAND.greenBg }} />
              <div style={{ width: `${openPct}%`, background: BRAND.orangeBg }} />
              <div style={{ width: `${rejectedPct}%`, background: BRAND.redBg }} />
            </div>
          
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12 }}>
              <div style={{ color: BRAND.greenText }}>🟢 {doneCount}</div>
              <div style={{ color: BRAND.orangeText }}>🟡 {openCount}</div>
              <div style={{ color: BRAND.redText }}>🔴 {rejectedCount}</div>
            </div>
          </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: BRAND.forest, marginBottom: 16 }}>Opgeslagen deals</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              {[
                { label: "Alle", value: "all" },
                { label: "🟡 Ter beoordeling", value: "Ter beoordeling" },
                { label: "🟢 Gedaan", value: "Gedaan" },
                { label: "🔴 Afgekeurd", value: "Afgekeurd" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: `1px solid ${BRAND.border}`,
                    background: statusFilter === f.value ? BRAND.forest : BRAND.white,
                    color: statusFilter === f.value ? BRAND.white : BRAND.forest,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {savedDeals.length === 0 ? <div style={{ color: "#64748B" }}>Nog geen deals opgeslagen.</div> : null}
              {filteredDeals.map((entry) => (
                <div key={entry.id} style={{ border: `1px solid ${BRAND.border}`, borderRadius: 18, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontWeight: 800 }}>{entry.form.dealNaam}</div>

                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "4px 8px",
                            borderRadius: 999,
                            background:
                              entry.status === "Gedaan"
                                ? BRAND.greenBg
                                : entry.status === "Afgekeurd"
                                ? BRAND.redBg
                                : BRAND.orangeBg,
                            color:
                              entry.status === "Gedaan"
                                ? BRAND.greenText
                                : entry.status === "Afgekeurd"
                                ? BRAND.redText
                                : BRAND.orangeText,
                          }}
                        >
                          {entry.status || "Ter beoordeling"}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>{entry.savedAt}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <div style={{ fontWeight: 800 }}>{pct(entry.result.rateMid)}</div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>
                        {euro(entry.form.financieringsbedrag)}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={() => loadDeal(entry)} style={smallButtonStyle(false)}>Open</button>
                    <button onClick={() => deleteDeal(entry.id)} style={smallButtonStyle(true)}>Verwijder</button>

                    <select
                      value={entry.status || "Ter beoordeling"}
                      onChange={(e) => updateDealStatus(entry.id, e.target.value)}
                      style={{
                        borderRadius: 12,
                        padding: "8px 10px",
                        border: `1px solid ${BRAND.border}`,
                        fontSize: 12,
                        fontWeight: 700,
                        color: BRAND.forest,
                     }}
                   >
                    <option value="Ter beoordeling">🟡 Ter beoordeling</option>
                    <option value="Gedaan">🟢 Gedaan</option>
                    <option value="Afgekeurd">🔴 Afgekeurd</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pricingBadge = pricingBadgeStyle(result.pricingTone);

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
                <Field label="Dealnaam"><input style={inputStyle()} value={form.dealNaam} onChange={(e) => update("dealNaam", e.target.value)} /></Field>
                <Field label="Leningstype"><select style={inputStyle()} value={form.loanType} onChange={(e) => update("loanType", e.target.value)}><option value="annuitair">Annuitair</option><option value="lineair">Lineair</option><option value="aflossingsvrij">Aflossingsvrij</option></select></Field>
                <Field label="Taxatiewaarde" note={euro(form.taxatiewaarde)}><input style={inputStyle()} type="number" value={form.taxatiewaarde} onChange={(e) => update("taxatiewaarde", e.target.value)} /></Field>
                <Field label="Financieringsbedrag" note={euro(form.financieringsbedrag)}><input style={inputStyle()} type="number" value={form.financieringsbedrag} onChange={(e) => update("financieringsbedrag", e.target.value)} /></Field>
                <Field label="DSCR"><input style={inputStyle()} type="number" step="0.01" value={form.dscr} onChange={(e) => update("dscr", e.target.value)} /></Field>
                <Field label="Looptijd (maanden)"><input style={inputStyle()} type="number" value={form.looptijdMaanden} onChange={(e) => update("looptijdMaanden", e.target.value)} /></Field>
                <Field label="Locatie"><select style={inputStyle()} value={form.locatie} onChange={(e) => update("locatie", e.target.value)}><option value="A">A-locatie</option><option value="B">B-locatie</option><option value="C">C-locatie</option></select></Field>
                <Field label="Debiteur"><select style={inputStyle()} value={form.debiteur} onChange={(e) => update("debiteur", e.target.value)}><option value="Sterk">Sterk</option><option value="Gemiddeld">Gemiddeld</option><option value="Zwak">Zwak</option></select></Field>
                <Field label="Vastgoedtype"><select style={inputStyle()} value={form.vastgoedtype} onChange={(e) => update("vastgoedtype", e.target.value)}><option value="Woning voor verhuur">Woning voor verhuur</option><option value="Zorgvastgoed">Zorgvastgoed</option><option value="Kantoor">Kantoor</option><option value="Bedrijfsruimte">Bedrijfsruimte</option><option value="Ontwikkeling">Ontwikkeling</option></select></Field>
                <Field label="Exit strategie"><select style={inputStyle()} value={form.exitStrategie} onChange={(e) => update("exitStrategie", e.target.value)}><option value="Refinance">Refinance</option><option value="Verkoop">Verkoop</option><option value="Onzeker">Onzeker</option></select></Field>
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
                    <tr><td style={{ padding: "14px 16px" }}>Admin leningnemer</td><td style={{ padding: "14px 16px" }}>{euro(costs.adminPerYear, 2)}</td><td style={{ padding: "14px 16px" }}>{euro(costs.adminTotal, 2)}</td></tr>
                    <tr><td style={{ padding: "14px 16px" }}>Admin investeerder</td><td style={{ padding: "14px 16px" }}>{euro(costs.investorFeePerYear, 2)}</td><td style={{ padding: "14px 16px" }}>{euro(costs.investorFeeTotal, 2)}</td></tr>
                    <tr><td style={{ padding: "14px 16px" }}>Afsluitprovisie</td><td style={{ padding: "14px 16px" }}>-</td><td style={{ padding: "14px 16px" }}>{euro(costs.closingFee, 2)}</td></tr>
                    <tr><td style={{ padding: "14px 16px", fontWeight: 800 }}>Totale omzet</td><td style={{ padding: "14px 16px", fontWeight: 800 }}>{euro(costs.adminPerYear + costs.investorFeePerYear, 2)}</td><td style={{ padding: "14px 16px", fontWeight: 800 }}>{euro(costs.adminTotal + costs.investorFeeTotal + costs.closingFee, 2)}</td></tr>
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
                <div style={{ display: "inline-flex", padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: BRAND.white, fontSize: 13, fontWeight: 700 }}>Benchmark: {pct(result.benchmark)}</div>
                <div style={{ display: "inline-flex", padding: "8px 12px", borderRadius: 999, fontSize: 13, fontWeight: 800, ...pricingBadge }}>{result.pricingLabel}</div>
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
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", border: `1px solid ${BRAND.border}`, borderRadius: 18 }}><span style={{ color: "#475569" }}>Risico categorie</span><strong>{result.riskLabel}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", border: `1px solid ${BRAND.border}`, borderRadius: 18 }}><span style={{ color: "#475569" }}>LTV beoordeling</span><strong>{result.ltv <= 65 ? "Sterk" : result.ltv <= 80 ? "Acceptabel" : "Risicovol"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", border: `1px solid ${BRAND.border}`, borderRadius: 18 }}><span style={{ color: "#475569" }}>DSCR beoordeling</span><strong>{num(form.dscr) >= 1.4 ? "Sterk" : num(form.dscr) >= 1.25 ? "Gemiddeld" : "Zwak"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", border: `1px solid ${BRAND.border}`, borderRadius: 18 }}><span style={{ color: "#475569" }}>Loan sizing</span><strong>{euro(form.financieringsbedrag)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", border: `1px solid ${BRAND.border}`, borderRadius: 18 }}><span style={{ color: "#475569" }}>Verwachte opbrengst (totaal)</span><strong>{euro(costs.adminTotal + costs.investorFeeTotal + costs.closingFee)}</strong></div>
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
