import type { Metadata } from "next";
import { CalendarCheck, Compass, MessagesSquare } from "lucide-react";
import { isContactConfigured } from "./config";
import { DemoRequestForm } from "./demo-request-form";

export const metadata: Metadata = {
  title: "Book a demo",
  description: "Talk to the Nexora team about tickets, tasks, SLAs and service operations for your organization.",
};

const POINTS = [
  { icon: Compass, title: "A tailored walkthrough", text: "We focus on the workflows your teams actually run — IT, HR, facilities or customer support." },
  { icon: MessagesSquare, title: "Answers to your questions", text: "Security, integrations, SLAs, migration from your current tool — bring them all." },
  { icon: CalendarCheck, title: "A clear next step", text: "Leave with a plan for setting up your workspace and rolling it out." },
];

export default function ContactPage() {
  const configured = isContactConfigured();
  return (
    <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:px-8">
      <div className="space-y-8">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-primary">Book a demo</p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">See Nexora with your own workflows</h1>
          <p className="text-lg text-muted-foreground">Tell us a little about your team and we&apos;ll get back to you to schedule a time.</p>
        </div>
        <ul className="space-y-6">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
              <div><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{text}</p></div>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <DemoRequestForm configured={configured} />
      </div>
    </div>
  );
}
