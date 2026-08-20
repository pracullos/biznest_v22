import { HeroSection } from "./components/hero-section";
import { ProblemsSection } from "./components/problems-section";
import { StepsSection } from "./components/steps-section";

export function HomePage() {
  return (
    <div className="w-full">
      <HeroSection />
      <ProblemsSection />
      <StepsSection />
    </div>
  );
}
