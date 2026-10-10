import { AppShowcase } from "@/components/sections/AppShowcase";
import { Assistant } from "@/components/sections/Assistant";
import { About, FinalCta, Footer } from "@/components/sections/Closing";
import { ForceStage } from "@/components/sections/ForceStage";
import { Hardware } from "@/components/sections/Hardware";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { MiamiFocus } from "@/components/sections/MiamiFocus";
import { Nav } from "@/components/sections/Nav";
import { SignalChain } from "@/components/sections/SignalChain";
import { LiveDataProvider } from "@/lib/live-data";

export function App() {
  return (
    <LiveDataProvider>
      <Nav />
      <main id="main">
        <Hero />
        <SignalChain />
        <ForceStage />
        <MiamiFocus />
        <HowItWorks />
        <Assistant />
        <AppShowcase />
        <Hardware />
        <About />
        <FinalCta />
      </main>
      <Footer />
    </LiveDataProvider>
  );
}
