import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { H1, Small, Lead } from "@/components/ui/typography";

const benefits = [
  "AI-driven location insights tailored to your industry",
  "Connect with nearby businesses instantly",
  "Free to join — get started in minutes",
];

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden py-12 md:py-20 mt-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-6 md:flex-row md:gap-10 md:px-10">
        {/* Left: Text & CTAs */}
        <div className="flex-1 flex flex-col items-start text-left">
          <Small className="mb-4">For Growth-Minded Founders</Small>

          <H1 className="mb-3">
            <span className="text-accent">Smart</span> Locations.{" "}
            <span className="text-accent">Stronger </span>
            Connections. Powered by <span className="text-accent">AI</span>.
          </H1>

          <Lead className="mb-6 max-w-xl">
            An AI-powered system that helps choose business locations and
            connects local businesses in your city.
          </Lead>

          <div className="mb-8 flex gap-3">
            <Button asChild>
              <Link to="/register">Join BizNest Now</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/about">See How AI Helps</Link>
            </Button>
          </div>

          <ul className="space-y-2">
            {benefits.map((benefit, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-base text-foreground/90 md:text-lg"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/50 shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: Sample Image */}
        <div className="flex-1 flex justify-center items-center">
          <div className="w-full max-w-lg aspect-[4/3] rounded-2xl overflow-hidden bg-white/5 border border-primary/10 shadow-xl relative">
            {/* Image fills the entire card */}
            <img
              src="/images/map.jpeg"
              alt="Sample map"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* optional overlay for subtle vignette */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent to-black/10 mix-blend-multiply" />
          </div>
        </div>
      </div>

      <div className="mt-10 w-full border-t border-border/90 px-6 pt-8 md:mt-12 md:px-10 md:pt-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-6 md:flex-row md:gap-12">
          <span className="text-md font-semibold uppercase tracking-widest text-muted-foreground text-center">
            In partnership with
          </span>

          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {[
              { name: "Navigatu TBI", src: "/images/navigatu.jpg" },
              { name: "Caraga State University", src: "/images/csu.png" },
            ].map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-3 transition-all duration-300 cursor-default"
              >
                <img
                  src={p.src}
                  alt={p.name}
                  className="h-8 md:h-12 w-auto object-contain rounded-full dark:brightness-80"
                  onError={(e) =>
                    ((e.currentTarget as HTMLImageElement).style.display =
                      "none")
                  }
                />
                <span className="text-md md:text-lg font-medium text-foreground/90">
                  {p.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
