import { MapPin, Sparkles, Handshake, Check, X } from "lucide-react";

export const heroBenefits = [
  "AI-driven location insights tailored to your industry",
  "Connect with nearby businesses instantly",
  "Free to join — get started in minutes",
];

export const steps = [
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

export const stepsBackground = "/images/steps.jpg";

export const problems = [
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
    imageSrc: "/images/problem.jpg",
  },
];

export const solutions = [
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
    imageSrc: "/images/solution.jpg",
  },
];

export const footerBackground = "/images/footer.jpg";

export default {
  heroBenefits,
  steps,
  stepsBackground,
  problems,
  solutions,
  footerBackground,
};
