import { Navbar } from '../components/landing/Navbar'
import { Hero } from '../components/landing/Hero'
import { Features } from '../components/landing/Features'
import { TechStack } from '../components/landing/TechStack'
import { About } from '../components/landing/About'
import { Contact } from '../components/landing/Contact'
import { Footer } from '../components/landing/Footer'
import ClickSpark from '../components/landing/ClickSpark'
import GradualBlur from '../components/landing/GradualBlur'

export function LandingPage() {
  return (
    <ClickSpark sparkColor="#b18ddd" sparkSize={10} sparkRadius={30} sparkCount={8} duration={400}>
      <GradualBlur
        position="bottom"
        target="page"
        height="3rem"
        strength={3}
        divCount={5}
        exponential={true}
        opacity={0.7}
        curve="ease-out"
        style={{ zIndex: 49 }}
      />
      <Navbar />
      <Hero />
      <Features />
      <TechStack />
      <About />
      <Contact />
      <Footer />
    </ClickSpark>
  )
}
