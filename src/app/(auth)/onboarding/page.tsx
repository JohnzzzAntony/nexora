import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrganizationContext } from "@/lib/tenancy/context";
import { loadOnboardingData } from "@/server/onboarding/service";
import { LAST_STEP } from "@/server/onboarding/steps";
import { OnboardingFrame } from "./_components/onboarding-frame";
import { CreateOrganizationStep } from "./_components/create-organization-step";
import { OnboardingWizard } from "./_components/onboarding-wizard";

export const metadata: Metadata = { title: "Set up your workspace" };

function timezones() {
  return ["UTC", ...Intl.supportedValuesOf("timeZone").filter(tz => tz !== "UTC")];
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");
  const ctx = await getOrganizationContext();

  if (!ctx) {
    return (
      <OnboardingFrame userEmail={user.email}>
        <CreateOrganizationStep timezones={timezones()} />
      </OnboardingFrame>
    );
  }
  if (ctx.isCustomer) redirect("/portal");
  if (!ctx.can("settings.manage") || ctx.organization.onboardingDoneAt) redirect("/dashboard");

  const data = await loadOnboardingData(ctx);
  const { step: raw } = await searchParams;
  const requested = Number(Array.isArray(raw) ? raw[0] : raw);
  // Users may revisit completed steps but cannot jump past the furthest step reached.
  const step = Number.isInteger(requested) && requested >= 1 && requested <= Math.min(data.onboardingStep, LAST_STEP) ? requested : data.onboardingStep;

  return (
    <OnboardingFrame userEmail={user.email} organizationName={data.company.name}>
      <OnboardingWizard step={step} data={data} timezones={timezones()} />
    </OnboardingFrame>
  );
}
