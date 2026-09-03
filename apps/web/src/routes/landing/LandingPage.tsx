import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { ServicesSection } from './ServicesSection';
import { AboutSection } from './AboutSection';
import { PortalTeaserSection } from './PortalTeaserSection';
import { GallerySection } from './GallerySection';
import { QuoteForm } from './QuoteForm';
import { LandingFooter } from './LandingFooter';

// Port a React de docs/landing/landing.html — mismo contenido y diseño,
// referencia de docs/05-landing-page-notas.md. Dos diferencias a propósito
// respecto al HTML original:
//   1. El botón "Iniciar sesión" ya no abre el modal de demostración: ahora
//      es un <Link to="/login"> real, porque el login de verdad existe.
//   2. Las fotos siguen siendo placeholders (pendiente de las fotos reales
//      del salón, igual que en el original).
export default function LandingPage() {
  return (
    <div className="bg-paper text-ink">
      <LandingHeader />
      <HeroSection />
      <ServicesSection />
      <AboutSection />
      <PortalTeaserSection />
      <GallerySection />
      <QuoteForm />
      <LandingFooter />
    </div>
  );
}
