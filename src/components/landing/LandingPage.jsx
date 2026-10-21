import Boot from './Boot'
import Header from './Header'
import Footer from './Footer'
import HeroPetsIntro from './HeroPetsIntro'
import Bento from './sections/Bento'
import Showcase from './sections/Showcase'
import Walkthrough from './sections/Walkthrough'
import Metrics from './sections/Metrics'
import './landing.css'
import './pets.css'

export default function LandingPage() {
  return (
    <div className="vx-page min-h-screen text-[#1E1538] font-sans">
      <Boot />
      <Header />
      <HeroPetsIntro />
      <main>
        <Bento />
        <Showcase />
        <Walkthrough />
        <Metrics />
      </main>
      <Footer />
    </div>
  )
}
