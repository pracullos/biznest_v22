import type { LucideIcon } from "lucide-react";
import { H2, Muted } from "@/components/ui/typography";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { problems, solutions } from "@/config/home";

function ProblemCard({
  title,
  points,
  icon: Icon,
  iconBg,
  iconColor,
  imageSrc,
}: {
  title: string;
  points: string[];
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  imageSrc?: string;
}) {
  return (
    <Card className="relative mx-auto w-full bg-card p-0 border-0 max-w-none overflow-hidden h-full rounded-xl shadow-md transition-shadow hover:shadow-lg">
      {imageSrc && (
        <div className="relative w-full leading-none">
          <img
            src={imageSrc}
            alt={title}
            className="block relative z-0 w-full h-52 object-cover md:h-64"
          />
          <div className="absolute inset-0 z-10 bg-black/25 pointer-events-none" />
        </div>
      )}

      <CardHeader className="relative z-20 p-6 md:p-8">
        <div className="flex items-center gap-4 mb-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg border ${iconBg}`}
          >
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
          <CardTitle className="!mb-0">{title}</CardTitle>
        </div>

        <CardDescription>
          <ul className="space-y-2">
            {points.map((point, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                <Muted className="md:text-base">{point}</Muted>
              </li>
            ))}
          </ul>
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function ProblemsSection() {
  return (
    <section className="w-full py-14 md:py-20">
      <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
        {/* Heading */}
        <div className="mx-auto mb-14 max-w-4xl text-center md:mb-16">
          <H2 className="border-0 pb-0">
            Finding a profitable location is usually a guessing game.{" "}
            <span className="text-accent">We turned it into a science.</span>
          </H2>
        </div>

        {/* Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 items-stretch">
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
