import fs from "node:fs";
import path from "node:path";
import {
  CampaignLandingSpecSchema,
  type CampaignLandingSpec,
} from "@astrobranding/contracts";

export function resolveCampaignFilePaths(vertical: string, slug: string): string[] {
  const safeVertical = vertical.replace(/[^a-z0-9-]/gi, "");
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "");
  const envDir = process.env.CAMPAIGNS_DATA_DIR;
  const projectSlug = process.env.PROJECT_NAME || "";
  const candidates: string[] = [];

  if (envDir) {
    candidates.push(path.join(envDir, `${safeSlug}.json`));
    candidates.push(path.join(envDir, safeVertical, "campaigns", `${safeSlug}.json`));
  }
  candidates.push(path.resolve(process.cwd(), "src/data/campaigns", safeVertical, `${safeSlug}.json`));
  candidates.push(path.resolve(process.cwd(), "src/data/campaigns", `${safeSlug}.json`));
  if (projectSlug) {
    candidates.push(`/mnt/localstorage/${projectSlug}/dev/workspaces/${safeVertical}/campaigns/${safeSlug}.json`);
  }
  return candidates;
}

export function loadCampaignLanding(vertical: string, slug: string): CampaignLandingSpec | null {
  for (const filePath of resolveCampaignFilePaths(vertical, slug)) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const parsed = CampaignLandingSpecSchema.safeParse(raw);
      if (!parsed.success) continue;
      if (parsed.data.vertical_slug !== vertical || parsed.data.campaign_slug !== slug) continue;
      return parsed.data;
    } catch {
      continue;
    }
  }
  return null;
}

export type ProofFormulaInputs = Record<string, number | string | boolean>;

export function evaluateProofFormula(
  formulaProfile: string,
  inputs: ProofFormulaInputs
): Record<string, number | string> {
  const num = (key: string, fallback = 0): number => {
    const raw = Number(inputs[key]);
    return Number.isFinite(raw) ? raw : fallback;
  };
  const bool = (key: string): boolean => {
    const v = inputs[key];
    return v === true || v === "true" || v === 1 || v === "1";
  };

  if (formulaProfile === "freedom_leverage_v1") {
    const netMonthlyProfit = Math.max(0, num("net_monthly_profit", 12000000));
    const weeklyHours = Math.max(1, num("weekly_hours", 40));
    const monthlyHours = weeklyHours * 4.33;
    const realHourlyRate = Math.round(netMonthlyProfit / monthlyHours);
    const currentAnnualCeiling = Math.round(netMonthlyProfit * 12);
    const manualFrictionShare = inputs.business_model === "products" ? 0.32 : 0.38;
    const annualHoursReclaimed = Math.round(weeklyHours * manualFrictionShare * 50);
    const opportunityCostAnnual = Math.round(annualHoursReclaimed * realHourlyRate);
    const leveragedProjectionAnnual = Math.round(currentAnnualCeiling * 1.45 + opportunityCostAnnual * 0.5);

    const comparePayroll = bool("compare_payroll_toggle");
    const payrollRoles = comparePayroll ? Math.max(1, num("payroll_roles", 1)) : 0;
    const payrollMonthlyUnit = num("payroll_monthly_cost", 2909290);
    const annualPayrollSaved = comparePayroll ? Math.round(payrollRoles * payrollMonthlyUnit * 12) : 0;

    return {
      real_hourly_rate: realHourlyRate,
      current_annual_ceiling: currentAnnualCeiling,
      annual_hours_reclaimed: annualHoursReclaimed,
      opportunity_cost_annual: opportunityCostAnnual,
      leveraged_projection_annual: leveragedProjectionAnnual,
      annual_payroll_saved: annualPayrollSaved,
    };
  }

  if (formulaProfile === "roi_cost_gap_v1") {
    const monthlyCost = Math.max(0, num("monthly_operating_cost", 5000000));
    const rolesCount = Math.max(1, num("roles_count", 1));
    const weeklyHoursLost = Math.max(0, num("weekly_hours_lost", 15));
    const hourlyValue = Math.max(0, num("hourly_value", 80000));
    const monthlySavings = Math.round(monthlyCost * rolesCount * 0.65);
    const annualSavings = monthlySavings * 12 + Math.round(weeklyHoursLost * 50 * hourlyValue);
    return {
      monthly_savings: monthlySavings,
      annual_savings: annualSavings,
      annual_hours_reclaimed: Math.round(weeklyHoursLost * 50),
    };
  }

  if (formulaProfile === "commission_tier_v1") {
    const referrals = Math.max(0, num("referrals_count", 3));
    const ticketValue = Math.max(0, num("average_ticket", 500));
    const rate = num("commission_rate", 0.25);
    const estimatedCommission = Math.round(referrals * ticketValue * rate);
    return {
      estimated_commission: estimatedCommission,
      annual_recurring_projection: estimatedCommission * 12,
    };
  }

  if (formulaProfile === "diagnostic_score_v1") {
    const clarity = Math.min(10, Math.max(1, num("clarity_score", 6)));
    const systems = Math.min(10, Math.max(1, num("systems_score", 5)));
    const composite = Math.round(((clarity + systems) / 20) * 100);
    return {
      readiness_score: composite,
    };
  }

  return {};
}
