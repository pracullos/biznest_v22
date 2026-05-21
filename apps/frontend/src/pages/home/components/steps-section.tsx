import { MapPin, Sparkles, Handshake } from "lucide-react";
import { H2, H3, Small, Muted, Lead } from "@/components/ui/typography";

const steps = [
  {
    step: "Step 01",
    title: "Tell BizNest What You Are Building",
    description:
      "Share your business type, budget range, and ideal customer profile in under 2 minutes.",
    hint: "No spreadsheets, no manual research needed.",
    icon: MapPin,
    color: "text-blue-500",
    badgeColor: "bg-blue-500/15 border-blue-500/40",
  },
  {
    step: "Step 02",
    title: "Review AI-Ranked Location Matches",
    description:
      "Get a clear shortlist of high-potential areas scored by demand, competition, and growth signals.",
    hint: "Focus on the top opportunities first.",
    icon: Sparkles,
    color: "text-amber-500",
    badgeColor: "bg-amber-500/15 border-amber-500/40",
  },
  {
    step: "Step 03",
    title: "Launch Faster With Local Connections",
    description:
      "Connect with nearby businesses and partners to accelerate your opening and reduce launch friction.",
    hint: "Move from idea to opening with confidence.",
    icon: Handshake,
    color: "text-green-500",
    badgeColor: "bg-green-500/15 border-green-500/40",
  },
];

export function StepsSection() {
  return (
    <section className="w-full pt-14 md:pt-20">
      {/* 1. Heading Container */}
      <div className="mx-auto mb-14 w-full max-w-7xl px-6 md:mb-16 md:px-10">
        <div className="mx-auto max-w-4xl text-center">
          <Small className="mb-3 inline-block uppercase tracking-widest text-muted-foreground">
            Your Roadmap
          </Small>
          <H2 className="border-0 pb-0">
            Go from business idea to the right location in 3 smart steps
          </H2>
          <Lead className="mx-auto mt-4 max-w-2xl">
            BizNest helps you decide, validate, and connect, so your next move
            is guided by data instead of guesswork.
          </Lead>
        </div>
      </div>

      {/* 2. Background Container with Blend Mode */}
      <div
        className="w-full overflow-hidden pt-14 pb-20 md:pt-20 md:pb-32 dark:bg-slate-950/60 dark:bg-blend-multiply"
        style={{
          backgroundImage: "url('/images/steps.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Overlay removed! The blending is now handled purely by the parent div's CSS classes. */}

        {/* 3. Cards Container */}
        <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md md:p-8"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl border ${item.badgeColor}`}
                    >
                      <Icon
                        className={`h-5 w-5 ${item.color} transition-transform duration-300 group-hover:scale-110`}
                      />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      {item.step}
                    </span>
                  </div>

                  <H3 className="mb-3">{item.title}</H3>

                  <Muted className="mb-3 md:text-base">
                    {item.description}
                  </Muted>
                  <Small className="text-primary/90">{item.hint}</Small>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
