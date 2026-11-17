import { Icon, type IconName } from "@/components/ui/icons";
import type { TFn } from "@/lib/i18n";

/** Sahne B: ürünümüzün üç gerçek ekranı (takvim, rapor, SMS). İçerik örnektir. */
export function Phones({ t }: { t: TFn }) {
  const days = t("home.ph.rep.days").split(",");
  const bars = [46, 62, 54, 78, 100, 70, 38];
  const rows: [string, string, string, string, boolean][] = [
    ["10:00", t("home.ph.cal.e1"), t("home.ph.cal.e1s"), "#1F5A60", false],
    ["11:00", t("home.ph.cal.e2"), t("home.ph.cal.e2s"), "#A8432B", true],
    ["12:00", t("home.ph.cal.e3"), t("home.ph.cal.e3s"), "#4A5A36", false],
  ];
  return (
    <>
      <div className="ph ph-l"><div className="ph-scr">
        <div className="ph-top"><p className="ph-h">{t("home.ph.cal.title")}</p><p className="ph-sub">{t("home.ph.cal.sub")}</p></div>
        <div className="cal">
          {rows.map(([time, n, s, c, wait]) => (
            <div key={time} className="cal-row"><span className="cal-t">{time}</span><div className={`cal-ev${wait ? " wait" : ""}`} style={{ "--c": c } as React.CSSProperties}><b>{n}</b><span>{s}</span></div></div>
          ))}
          <span className="cal-now" style={{ top: "5.5em" }} aria-hidden />
        </div>
      </div></div>

      <div className="ph ph-r"><div className="ph-scr">
        <div className="ph-top"><p className="ph-h">{t("home.ph.sms.title")}</p><p className="ph-sub">{t("home.ph.sms.sub")}</p></div>
        <div className="sm-wrap">
          <p className="sm-b">{t("home.ph.sms.b1")} <span className="sm-link">kibrisrandevu.com/r/…</span></p>
          <p className="sm-meta">{t("home.ph.sms.meta")}</p>
          <p className="sm-b me">{t("home.ph.sms.b2")}</p>
        </div>
      </div></div>

      <div className="ph ph-c"><div className="ph-scr">
        <div className="ph-top"><p className="ph-sub" style={{ marginTop: 0 }}>{t("home.ph.rep.title")}</p><p className="rp-num">42 <span style={{ fontSize: ".3em", letterSpacing: 0 }} className="font-sans">{t("home.ph.rep.unit")}</span></p></div>
        <div className="rp-bars" aria-hidden>{bars.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
        <div className="rp-days" aria-hidden>{days.map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="rp-row"><span>{t("home.ph.rep.r1")}</span><em>39</em></div>
        <div className="rp-row" style={{ marginTop: ".6em", borderTop: 0, paddingTop: 0 }}><span>{t("home.ph.rep.r2")}</span><em style={{ color: "#A8432B" }}>3</em></div>
      </div></div>
    </>
  );
}

export type CardSpec = { cls: string; icon: IconName; tone?: "warm" | "gold" | "green"; t: string; d: string };
export function FloatCards({ items }: { items: CardSpec[] }) {
  return (
    <>
      {items.map((c) => (
        <div key={c.cls} className={`fc ${c.cls}${c.tone ? ` ${c.tone}` : ""}`}>
          <i><Icon name={c.icon} size={20} /></i>
          <span><b>{c.t}</b><small>{c.d}</small></span>
        </div>
      ))}
    </>
  );
}
