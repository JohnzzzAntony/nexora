import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { Faq, FeatureRows, FinalCta, Hero, Integrations, Overview, Pricing, Security } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Nexora — Connect. Assign. Achieve.",
  description: "A modern workspace for managing tickets, tasks, teams and everyday business operations.",
  openGraph: {
    title: "Nexora — Connect. Assign. Achieve.",
    description: "A modern workspace for managing tickets, tasks, teams and everyday business operations.",
    type: "website",
  },
};

export default async function LandingPage() {
  const user = await getCurrentUser();
  return (
    <>
      <Hero />
      <Overview />
      <FeatureRows />
      <Integrations />
      <Security />
      <Pricing />
      <Faq />
      <FinalCta signedIn={Boolean(user)} />
    </>
  );
}
