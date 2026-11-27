import { z } from "zod";

export const LeadMagnetMechanismSchema = z.enum([
  "none",
  "freedom_leverage_index",
  "diagnostic_quiz",
  "roi_cost_gap",
  "commission_simulator",
  "resource_guide",
  "micro_trial",
]);

export type LeadMagnetMechanism = z.infer<typeof LeadMagnetMechanismSchema>;

export const InteractiveProofOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const InteractiveProofInputSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(2),
  type: z.enum(["range", "select", "number", "toggle"]),
  min_val: z.number().optional().nullable(),
  max_val: z.number().optional().nullable(),
  step: z.number().optional().nullable(),
  default_value: z.union([z.number(), z.string(), z.boolean()]).optional().nullable(),
  options: z.array(InteractiveProofOptionSchema).default([]),
  unit: z.string().optional().nullable(),
  optional_toggle: z.boolean().default(false),
});

export type InteractiveProofInput = z.infer<typeof InteractiveProofInputSchema>;

export const InteractiveProofOutputSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(2),
  formula_key: z.string().min(1),
  format: z.enum(["currency", "number", "hours", "percent", "ratio", "text"]),
  emphasis: z.enum(["primary", "secondary"]).default("secondary"),
});

export type InteractiveProofOutput = z.infer<typeof InteractiveProofOutputSchema>;

export const InteractiveProofSpecSchema = z.object({
  mechanism: LeadMagnetMechanismSchema.default("none"),
  title: z.string().default(""),
  subtitle: z.string().default(""),
  formula_profile: z.string().default("none"),
  inputs: z.array(InteractiveProofInputSchema).default([]),
  outputs: z.array(InteractiveProofOutputSchema).default([]),
  share_card_enabled: z.boolean().default(false),
  wa_form_rescue: z.boolean().default(true),
  post_submit_route: z.string().optional().nullable(),
});

export type InteractiveProofSpec = z.infer<typeof InteractiveProofSpecSchema>;

export const CampaignUtmContractSchema = z.object({
  utm_source: z.string().min(2),
  utm_medium: z.string().min(2),
  utm_campaign: z.string().min(2),
  utm_content: z.string().min(2),
  utm_term: z.string().optional().nullable(),
  allow_on_internal_links: z.literal(false).default(false),
});

export const AdCreativeSpecSchema = z.object({
  ad_id: z.string().min(2),
  platform: z.enum(["meta", "google", "tiktok", "linkedin", "youtube"]),
  format: z.enum(["video_short", "vsl_ad", "static_card", "carousel"]),
  angle_name: z.string().min(2),
  contrarian_idea: z.string().min(5),
  target_buyer_profile: z.string().min(5),
  hook_first_3s: z.string().min(5),
  primary_text: z.string().min(10),
  headline: z.string().min(3),
  cta_label: z.string().min(2),
  utm: CampaignUtmContractSchema,
  source_ad_library_refs: z.array(z.string()).default([]),
});

export type AdCreativeSpec = z.infer<typeof AdCreativeSpecSchema>;

export const CampaignFaqItemSchema = z.object({
  question: z.string().min(3),
  answer: z.string().min(3),
});

export const CampaignLandingSpecSchema = z
  .object({
    campaign_slug: z.string().regex(/^[a-z0-9-]+$/),
    vertical_slug: z.string().regex(/^[a-z0-9-]+$/),
    brand_slug: z.string().min(2),
    route_path: z.string().startsWith("/"),
    robots: z.enum(["noindex, follow", "index, follow", "noindex, nofollow"]).default("noindex, follow"),
    seo_cluster_id: z.string().optional().nullable(),
    barista_rotation_window: z.string().optional().nullable(),
    offer_ring: z.string().min(1),
    ad_creative: AdCreativeSpecSchema,
    hero_h1: z.string().min(5),
    hero_subheadline: z.string().min(10),
    message_match_keywords: z.array(z.string().min(1)).min(1),
    contrarian_proof_points: z.array(z.string().min(2)).min(2),
    lead_magnet: InteractiveProofSpecSchema.default({ mechanism: "none" }),
    primary_cta_label: z.string().min(2),
    primary_cta_href: z.string().min(1),
    wa_email_campaign_tag: z.string().regex(/^(camp|entered):/),
    view_content_allowed: z.boolean().default(true),
    faq_items: z.array(CampaignFaqItemSchema).default([]),
  })
  .superRefine((val, ctx) => {
    if (val.robots.startsWith("index") && !val.seo_cluster_id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["seo_cluster_id"],
        message: "robots='index, follow' requires an explicit seo_cluster_id to prevent SEO cannibalization.",
      });
    }
    const interactiveMechanisms = new Set([
      "freedom_leverage_index",
      "diagnostic_quiz",
      "roi_cost_gap",
      "commission_simulator",
    ]);
    if (interactiveMechanisms.has(val.lead_magnet.mechanism)) {
      if (val.lead_magnet.inputs.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lead_magnet", "inputs"],
          message: `Interactive mechanism '${val.lead_magnet.mechanism}' requires at least 1 input.`,
        });
      }
      if (val.lead_magnet.outputs.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lead_magnet", "outputs"],
          message: `Interactive mechanism '${val.lead_magnet.mechanism}' requires at least 1 output.`,
        });
      }
    }
  });

export type CampaignLandingSpec = z.infer<typeof CampaignLandingSpecSchema>;

export function validateCampaignSpec(raw: unknown) {
  return CampaignLandingSpecSchema.safeParse(raw);
}
