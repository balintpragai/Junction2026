"use client";

import { useEffect, useMemo, useState } from "react";
import type { components } from "@/lib/api-types";

type Region = components["schemas"]["Region"];
type Indicator = components["schemas"]["Indicator"];
type GapSummary = components["schemas"]["GapSummary"];
type OutreachList = components["schemas"]["OutreachList"];
type Section = "overview" | "outreach" | "trends" | "strategy";

const fallbackIndicators: Indicator[] = [
  { code: "3621", name: "Breast screening participation", unit: "%", higher_is_better: true, target: 80, years: [2020, 2021, 2022, 2023, 2024] },
  { code: "3620", name: "Cervical screening participation", unit: "%", higher_is_better: true, target: 80, years: [2020, 2021, 2022, 2023, 2024] },
  { code: "6103", name: "Colorectal screening participation", unit: "%", higher_is_better: true, target: 80, years: [2020, 2021, 2022, 2023, 2024] },
];

const tilePositions = [
  [2, 0], [1, 1], [2, 1], [3, 1], [4, 0], [1, 2], [3, 2], [0, 3], [5, 0],
  [2, 3], [0, 2], [3, 3], [5, 2], [4, 3], [1, 3], [0, 4], [2, 4], [1, 4],
  [3, 4], [2, 5], [4, 4], [2, 6], [5, 4],
];

function fmt(value: number | null | undefined, digits = 1) {
  return value == null ? "—" : new Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(value);
}

function severityText(severity: string) {
  return severity === "act" ? "Needs attention" : severity === "watch" ? "Keep an eye on" : "On track";
}

function Sparkline({ points, target }: { points: GapSummary["trend"]; target: number | null }) {
  const values = [...points.map((point) => point.value), ...(target == null ? [] : [target])];
  if (points.length < 2 || values.length < 2) return <div className="chart-empty">Not enough years to show a trend yet.</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xAt = (index: number) => 18 + (index * 324) / Math.max(points.length - 1, 1);
  const yAt = (value: number) => 126 - ((value - min) / range) * 98;
  const segments: string[] = [];
  let active: string[] = [];
  points.forEach((point, index) => {
    const prior = index > 0 ? points[index - 1] : null;
    if (prior && point.year - prior.year > 1) {
      if (active.length > 1) segments.push(active.join(" "));
      active = [];
    }
    active.push(`${xAt(index)},${yAt(point.value)}`);
  });
  if (active.length > 1) segments.push(active.join(" "));
  return (
    <svg className="sparkline" viewBox="0 0 360 150" role="img" aria-label="Regional screening trend over time">
      {[0, 1, 2].map((line) => <line key={line} x1="18" x2="342" y1={28 + line * 49} y2={28 + line * 49} className="chart-grid" />)}
      {target != null && <><line x1="18" x2="342" y1={yAt(target)} y2={yAt(target)} className="target-line" /><text x="342" y={yAt(target) - 5} textAnchor="end" className="chart-label">target {fmt(target)}%</text></>}
      {segments.map((segment, index) => <polyline key={index} points={segment} className="trend-line" />)}
      {points.map((point, index) => <circle key={point.year} cx={xAt(index)} cy={yAt(point.value)} r="3.5" className="trend-dot"><title>{point.year}: {fmt(point.value)}%</title></circle>)}
      {points.length > 0 && <><text x="18" y="146" className="chart-label">{points[0].year}</text><text x="342" y="146" textAnchor="end" className="chart-label">{points[points.length - 1].year}</text></>}
    </svg>
  );
}

export default function Home() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>(fallbackIndicators);
  const [indicatorCode, setIndicatorCode] = useState(fallbackIndicators[0].code);
  const [year, setYear] = useState(2024);
  const [selectedCode, setSelectedCode] = useState("90");
  const [section, setSection] = useState<Section>("overview");
  const [summary, setSummary] = useState<GapSummary | null>(null);
  const [outreach, setOutreach] = useState<OutreachList | null>(null);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");

  const indicator = indicators.find((item) => item.code === indicatorCode) ?? indicators[0];
  const availableYears = indicator?.years ?? [year];

  useEffect(() => {
    let alive = true;
    fetch("/api/data/regions").then((res) => res.ok ? res.json() : Promise.reject()).then((data: components["schemas"]["RegionList"]) => {
      if (alive && data.regions.length) setRegions(data.regions);
    }).catch(() => undefined);
    fetch("/api/data/indicators").then((res) => res.ok ? res.json() : Promise.reject()).then((data: components["schemas"]["IndicatorList"]) => {
      if (!alive || !data.indicators.length) return;
      setIndicators(data.indicators);
      const firstTarget = data.indicators.find((item) => item.target != null) ?? data.indicators[0];
      setIndicatorCode(firstTarget.code);
      setYear(firstTarget.years.at(-1) ?? 2024);
      setApiAvailable(true);
    }).catch(() => { if (alive) setApiAvailable(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!indicator) return;
    if (!indicator.years.includes(year)) setYear(indicator.years.at(-1) ?? year);
  }, [indicatorCode, indicator, year]);

  useEffect(() => {
    let alive = true;
    const query = new URLSearchParams({ indicator: indicatorCode, year: String(year) });
    fetch(`/api/data/regions/${selectedCode}/gap-summary?${query}`).then((res) => res.ok ? res.json() : Promise.reject()).then((data: GapSummary) => { if (alive) setSummary(data); }).catch(() => { if (alive) setSummary(null); });
    fetch(`/api/data/outreach-list?${query}`).then((res) => res.ok ? res.json() : Promise.reject()).then((data: OutreachList) => { if (alive) setOutreach(data); }).catch(() => { if (alive) setOutreach(null); });
    return () => { alive = false; };
  }, [selectedCode, indicatorCode, year]);

  const outreachCodes = useMemo(() => new Set(outreach?.rows.map((row) => row.region.code) ?? []), [outreach]);
  const selectedRegion = regions.find((region) => region.code === selectedCode);
  const gap = summary?.gap;
  const deviation = gap?.deviation ?? null;
  const distanceText = gap ? `${fmt(Math.abs(gap.deviation))} ${indicator?.unit === "%" ? "pp" : indicator?.unit ?? ""} ${gap.direction === "below" ? "below" : gap.direction === "above" ? "above" : "at"} ${gap.reference_kind === "target" ? "target" : "peer median"}` : "Select an area to explore its gap";

  function selectIndicator(code: string) {
    const next = indicators.find((item) => item.code === code);
    setIndicatorCode(code);
    if (next?.years.length) setYear(next.years.at(-1)!);
  }

  function submitChat(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatText.trim()) return;
    setSubmittedQuestion(chatText.trim());
    setChatText("");
  }

  function answerQuestion(question: string) {
    if (/why|cause/i.test(question)) return "Regional data shows where a gap exists, but cannot establish why. Check local and individual-level evidence before choosing an intervention.";
    if (/trend|change|progress/i.test(question)) return gap?.trend_5y == null ? "There is not enough history to describe a five-year change for this region." : `Over five years, participation changed by ${fmt(gap.trend_5y)} ${indicator?.unit ?? ""}. Use the trend view to see the annual values.`;
    if (/which|priority|attention|outreach/i.test(question)) return `The current priority list includes ${outreach?.rows.length ?? 0} regions below target for this indicator and year.`;
    if (/gap|target|region|screening/i.test(question)) return summary?.narrative.text ?? "Select a region to see its verified gap summary.";
    return "I can summarize the selected region’s verified gap, target and trend. This preview does not generate open-ended AI answers yet.";
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Reach Loop home"><span className="brand-mark">R</span><span>reach<span className="brand-light">loop</span></span></a>
        <div className="workspace-label">POLICY INTELLIGENCE</div>
        <nav className="primary-nav" aria-label="Dashboard sections">
          {([["overview", "Overview", "◫"], ["outreach", "Outreach priorities", "◎"], ["trends", "Progress over time", "↗"], ["strategy", "Strategy actions", "✳"]] as [Section, string, string][]).map(([key, label, icon]) => (
            <button key={key} className={`nav-item ${section === key ? "active" : ""}`} onClick={() => setSection(key)}><span className="nav-icon">{icon}</span>{label}{key === "outreach" && outreach?.rows.length ? <span className="nav-count">{outreach.rows.length}</span> : null}</button>
          ))}
        </nav>
        <div className="sidebar-bottom"><span className="live-indicator" />{apiAvailable ? "Connected to live data" : "Preview data"}<button className="help-button" aria-label="About the data" title="Regional data from THL and Statistics Finland. Patterns guide where to look, not who is affected.">i</button></div>
      </aside>

      <section className="main-column" id="top">
        <header className="topbar"><div className="breadcrumb">Finland <span>/</span> Cancer care equity</div><div className="top-actions"><span className="updated-label"><span className="tiny-dot" /> {apiAvailable ? "Live data" : "Demo preview"}</span><button className="avatar" aria-label="Policy workspace">P</button></div></header>
        <div className="content-wrap">
          <div className="page-heading"><div><div className="eyebrow">NATIONAL OVERVIEW <span className="heading-line" /></div><h1>Find the gaps.<br /><em>Focus effort where it matters.</em></h1><p className="lede">A clear view of cancer screening differences across Finland’s regions—so policy teams can direct support where it may have the greatest impact.</p></div><div className="heading-note"><span className="note-icon">✦</span><span>23 reporting<br />regions</span></div></div>

          <div className="toolbar"><label className="select-wrap"><span>INDICATOR</span><select value={indicatorCode} onChange={(event) => selectIndicator(event.target.value)}>{indicators.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label className="select-wrap year-select"><span>YEAR</span><select value={year} onChange={(event) => setYear(Number(event.target.value))}>{availableYears.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><span className="toolbar-spacer" /><span className="unit-pill">{indicator?.unit ?? "%"}</span><button className="filter-button" onClick={() => setSection("outreach")}><span>☷</span> View priority areas</button></div>

          <div className="overview-grid">
            <section className="map-panel panel">
              <div className="panel-header"><div><div className="panel-kicker">REGIONAL PICTURE</div><h2>Where are the gaps?</h2></div><span className="map-caption">Select a region</span></div>
              <div className="map-content"><div className="tile-map" role="group" aria-label="Finland regional tile map">
                {regions.map((region, index) => {
                  const [col, row] = tilePositions[index] ?? [index % 6, Math.floor(index / 6)];
                  const isSelected = region.code === selectedCode;
                  const needsAttention = outreachCodes.has(region.code);
                  return <button key={region.code} className={`region-tile ${isSelected ? "selected" : ""} ${needsAttention ? "attention" : "unknown"}`} style={{ gridColumn: col + 1, gridRow: row + 1 }} onClick={() => setSelectedCode(region.code)} aria-pressed={isSelected} aria-label={`${region.name}${needsAttention ? ", below target" : ", no priority gap returned"}`} title={region.name}><span>{region.code === "90" ? "HEL" : region.code === "91" ? "ÅL" : region.code}</span><span className="tile-dot" /></button>;
                })}
                {!regions.length && <div className="map-loading">{apiAvailable ? "Loading regions…" : "Connect the API to load regional data"}</div>}
              </div><div className="map-legend"><span><i className="legend-square act" />Below target</span><span><i className="legend-square neutral" />No priority gap returned</span><span className="legend-caveat">Not a complete performance ranking</span></div></div>
              <div className="map-footer"><span className="footer-pin">↳</span><span>The map shows <strong>wellbeing service regions</strong>, not municipalities.</span></div>
            </section>

            <section className="insight-panel panel" aria-live="polite">
              <div className="insight-top"><div className="panel-kicker">REGION INSIGHT</div><span className={`severity-chip ${gap?.severity ?? "watch"}`}><i />{gap ? severityText(gap.severity) : "Loading insight"}</span></div>
              <div className="region-title-row"><h2>{summary?.region.name ?? selectedRegion?.name ?? "Selected region"}</h2><span className="region-code">{selectedCode}</span></div>
              <p className="narrative">{summary?.narrative.text ?? "Choose a region to explore its screening gap, trend and related strategy action."}</p>
              {summary?.narrative && <details className="source-disclosure"><summary>How this insight was written</summary><span>{summary.narrative.source === "llm" ? "AI-assisted, with every figure checked against the data." : "A verified template sentence built from the reported figures."}</span></details>}
              <div className="insight-rule" />
              <div className="metric-row"><div><span className="metric-label">CURRENT PARTICIPATION</span><div className="big-number">{summary ? <>{fmt(gap?.value)}<small>{indicator?.unit}</small></> : "—"}</div></div><div className="metric-context"><span className="gap-direction">{distanceText}</span><span className="rank">Rank <strong>{gap?.rank ?? "—"}</strong> of {gap?.n_regions ?? 23}</span></div></div>
              {summary?.data_quality_notes?.[0] && <div className="quality-note"><span>!</span>{summary.data_quality_notes[0].message}</div>}
              <div className="insight-bottom"><span className="source-label">REFERENCE <strong>{gap?.reference_kind === "target" ? "National target" : "Regional peers"}</strong></span><span className="trend-label">5-year change <strong>{gap?.trend_5y == null ? "Not enough data" : `${gap.trend_5y > 0 ? "+" : ""}${fmt(gap.trend_5y)} ${indicator?.unit}`}</strong></span></div>
            </section>
          </div>

          <div className="lower-grid">
            <section className="trend-panel panel"><div className="panel-header"><div><div className="panel-kicker">CHANGE OVER TIME</div><h2>{selectedRegion?.name ?? "Selected region"} trend</h2></div><span className="chart-unit">{indicator?.unit}</span></div><Sparkline points={summary?.trend ?? []} target={indicator?.target ?? null} /><div className="chart-caption"><span>Annual participation</span><span className="target-key"><i />National target {indicator?.target != null ? `${fmt(indicator.target)}%` : "not set"}</span></div></section>
            <section className="action-panel panel"><div className="panel-kicker">POTENTIAL NEXT STEP</div><div className="action-icon">✳</div>{summary?.action ? <><h2>{summary.action.title}</h2><p>{summary.action.text}</p><a className="action-link" href="#strategy" onClick={(event) => { event.preventDefault(); setSection("strategy"); }}>Explore strategy action <span>↗</span></a><div className="action-source">Source: {summary.action.source}</div></> : <><h2>Connect a gap to action</h2><p>{summary ? "No strategy action is linked to this indicator yet. Use the regional gap and trend to guide the discussion." : "Select a region to see a relevant action from the National Cancer Strategy."}</p><button className="action-link button-link" onClick={() => setSection("strategy")}>Explore strategy actions <span>↗</span></button></>}</section>
          </div>

          {section === "outreach" && <section className="below-fold panel" id="outreach"><div className="panel-header"><div><div className="panel-kicker">RESOURCE FOCUS</div><h2>Areas furthest from target</h2></div><span className="table-count">{outreach?.rows.length ?? 0} regions</span></div><p className="section-description">A starting point for deciding where additional outreach or capacity may be useful.</p>{outreach?.ecological_fallacy_note && <p className="caveat"><span>ⓘ</span>{outreach.ecological_fallacy_note}</p>}<div className="priority-list">{outreach?.rows.map((row) => <button className="priority-row" key={row.region.code} onClick={() => { setSelectedCode(row.region.code); setSection("overview"); }}><span className="priority-rank">{String(row.rank).padStart(2, "0")}</span><span className="priority-name">{row.region.name}<small>{row.covariates.immigrant_background_share_pct == null ? "No same-year background data" : `${fmt(row.covariates.immigrant_background_share_pct)}% foreign background`}</small></span><span className="priority-gap">{fmt(Math.abs(row.deviation))} pp below</span><span className="severity-chip act"><i />{severityText(row.severity)}</span><span className="row-arrow">↗</span></button>)}</div>{!outreach && <div className="chart-empty">Outreach priorities are not available for this indicator and year.</div>}</section>}
          {section === "trends" && <section className="below-fold panel"><div className="panel-kicker">PROGRESS OVER TIME</div><h2>Regional trend for {selectedRegion?.name}</h2><p className="section-description">The line shows annual participation. Gaps in the series stay visible so missing years are not mistaken for steady progress.</p><div className="large-chart"><Sparkline points={summary?.trend ?? []} target={indicator?.target ?? null} /></div></section>}
          {section === "strategy" && <section className="below-fold panel" id="strategy"><div className="panel-kicker">POLICY CONTEXT</div><h2>National Cancer Strategy</h2>{summary?.action ? <><h3>{summary.action.title}</h3><p>{summary.action.text}</p><div className="action-source">Source: {summary.action.source}</div></> : <p className="section-description">Strategy actions appear here when they are linked to the selected indicator.</p>}</section>}
          {section === "overview" && <section className="priority-strip"><div><span className="strip-icon">↗</span><span><strong>{outreach?.rows.length ?? "—"} regions</strong> currently below the target for {indicator?.name ?? "this indicator"}</span></div><button onClick={() => setSection("outreach")}>Review priorities <span>→</span></button></section>}
          <footer className="page-foot"><span>Data describes regions, not individuals.</span><span>Sources: THL · Finnish Cancer Registry · Statistics Finland</span></footer>
        </div>
      </section>

      <aside className={`assistant-rail ${chatOpen ? "expanded" : ""}`} aria-label="Data assistant"><div className="assistant-head"><div className="assistant-orb">✦</div>{chatOpen && <div><strong>Ask Reach Loop</strong><span>Preview · uses verified figures</span></div>}<button className="assistant-toggle" onClick={() => setChatOpen(!chatOpen)} aria-expanded={chatOpen} aria-label={chatOpen ? "Collapse assistant" : "Expand assistant"}>{chatOpen ? "×" : "↑"}</button></div>{chatOpen ? <><div className="assistant-content"><p className="assistant-prompt">Explore this gap</p><button className="suggestion" onClick={() => setSubmittedQuestion(`Why is ${selectedRegion?.name ?? "this region"} below target?`)}>Why is this region below target?</button><button className="suggestion" onClick={() => setSubmittedQuestion("Which regions are furthest from target?")}>Which regions need attention?</button><button className="suggestion" onClick={() => setSubmittedQuestion("How has participation changed over time?")}>How has the trend changed?</button>{submittedQuestion && <div className="assistant-response"><div className="response-question">{submittedQuestion}</div><p>{answerQuestion(submittedQuestion)}</p><small>This preview only uses verified dashboard values.</small></div>}<div className="assistant-limit">Regional patterns can guide where to look, but they do not prove what causes a gap or who is affected.</div></div><form className="assistant-form" onSubmit={submitChat}><input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Ask about this data…" aria-label="Ask about this data" /><button aria-label="Send question">↑</button></form></> : <button className="assistant-collapsed" onClick={() => setChatOpen(true)}><span>✦</span>Ask about the data</button>}</aside>
    </main>
  );
}
