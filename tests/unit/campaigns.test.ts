import { describe, expect, it } from "bun:test";
import { validateCampaignSpec } from "../../packages/contracts/src/campaigns";
import { evaluateProofFormula } from "../../src/lib/campaigns";

const baseCreative = {
  ad_id: "ad_test_01",
  platform: "meta" as const,
  format: "video_short" as const,
  angle_name: "margen-real",
  contrarian_idea: "Trabajar más horas no multiplica tu margen real.",
  target_buyer_profile: "Especialistas consolidados que buscan libertad operativa",
  hook_first_3s: "Si tu negocio se frena cuando apagas el teléfono, necesitas sistema.",
  primary_text: "Instala tu sistema comercial propio en menos de 15 días con calibración real.",
  headline: "Criterio propio + sistema conectado",
  cta_label: "Ver evaluación",
  utm: {
    utm_source: "meta",
    utm_medium: "paid_social",
    utm_campaign: "demo_q4",
    utm_content: "vsl_01",
    allow_on_internal_links: false as const,
  },
};

describe("CampaignLandingSpec & Polymorphic Proof Engine", () => {
  it("accepts a direct VSL/evaluation campaign with lead_magnet.mechanism='none'", () => {
    const parsed = validateCampaignSpec({
      campaign_slug: "direct-eval",
      vertical_slug: "advisory",
      brand_slug: "acme",
      route_path: "/advisory/lp/direct-eval",
      robots: "noindex, follow",
      offer_ring: "core",
      ad_creative: baseCreative,
      hero_h1: "Convierte tu criterio en sistema conectado",
      hero_subheadline: "Arquitectura digital en menos de 15 días sin sumar nómina fija.",
      message_match_keywords: ["sistema", "criterio"],
      contrarian_proof_points: ["Menos fricción operativa.", "Margen sostenible por hora."],
      lead_magnet: { mechanism: "none" },
      primary_cta_label: "Solicitar evaluación",
      primary_cta_href: "/advisory/ready-now",
      wa_email_campaign_tag: "camp:advisory:direct-eval",
      view_content_allowed: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects robots='index, follow' without seo_cluster_id and rejects empty interactive calculator", () => {
    const bad = validateCampaignSpec({
      campaign_slug: "bad-camp",
      vertical_slug: "advisory",
      brand_slug: "acme",
      route_path: "/advisory/lp/bad-camp",
      robots: "index, follow",
      offer_ring: "core",
      ad_creative: baseCreative,
      hero_h1: "Titular de prueba",
      hero_subheadline: "Subtítulo válido para probar la validación estricta.",
      message_match_keywords: ["prueba"],
      contrarian_proof_points: ["Punto 1", "Punto 2"],
      lead_magnet: { mechanism: "freedom_leverage_index", inputs: [], outputs: [] },
      primary_cta_label: "Continuar",
      primary_cta_href: "/advisory/ready-now",
      wa_email_campaign_tag: "camp:advisory:bad-camp",
    });
    expect(bad.success).toBe(false);
  });

  it("computes freedom_leverage_v1 accurately with and without optional payroll toggle", () => {
    const withoutPayroll = evaluateProofFormula("freedom_leverage_v1", {
      net_monthly_profit: 12000000,
      weekly_hours: 40,
      business_model: "services",
      compare_payroll_toggle: false,
    });
    expect(withoutPayroll.real_hourly_rate).toBe(69284);
    expect(withoutPayroll.current_annual_ceiling).toBe(144000000);
    expect(withoutPayroll.annual_payroll_saved).toBe(0);

    const withPayroll = evaluateProofFormula("freedom_leverage_v1", {
      net_monthly_profit: 12000000,
      weekly_hours: 40,
      business_model: "services",
      compare_payroll_toggle: true,
      payroll_roles: 2,
      payroll_monthly_cost: 3000000,
    });
    expect(withPayroll.annual_payroll_saved).toBe(72000000);
  });
});
