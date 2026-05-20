import { Check, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { H2, H3, Muted } from "@/components/ui/typography";

const problems = [
  {
    title: "Stressful & Manual Guessing",
    points: [
      "Choosing locations by foot traffic alone often leads to expensive guesswork.",
      "A single wrong location decision can stall growth and burn precious runway.",
      "Manual research across maps, permits, and demographics is slow and exhausting.",
    ],
    icon: X,
    iconBg: "bg-destructive/10 border-destructive/20",
    iconColor: "text-destructive",
  },
];

const solutions = [
  {
    title: "Smart & Data-Driven",
    points: [
      "AI-backed market data highlights where demand, competition, and opportunity align.",
      "Tailored location scoring ranks the best spots for your exact business profile.",
      "Instant local business connections help you partner, grow, and launch with confidence.",
    ],
    icon: Check,
    iconBg: "bg-green-500/10 border-green-500/20",
    iconColor: "text-green-500",
  },
];

function ProblemCard({
  title,
  points,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  title: string;
  points: string[];
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md md:p-8">
      <div className="mb-6">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${iconBg}`}
        >
          <Icon className={`h-7 w-7 ${iconColor}`} />
        </div>
      </div>

      <H3 className="mb-4">{title}</H3>

      <ul className="space-y-3">
        {points.map((point, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            <Muted className="md:text-base">{point}</Muted>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function ProblemsSection() {
  return (
    <section className="w-full py-14 md:py-20">
      <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
        {/* Heading */}
        <div className="mx-auto mb-14 max-w-4xl text-center md:mb-16">
          <H2 className="border-0 pb-0">
            Finding a profitable location is usually a guessing game.{" "}
            <span className="text-accent">We turned it into a science.</span>
          </H2>
        </div>

        {/* Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {problems.map((problem, i) => (
            <ProblemCard key={i} {...problem} />
          ))}
          {solutions.map((solution, i) => (
            <ProblemCard key={`solution-${i}`} {...solution} />
          ))}
        </div>
      </div>
    </section>
  );
}
