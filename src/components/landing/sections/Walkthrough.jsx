import { PulseLed, Clock } from '../ui'
import clinicalSuiteImg from '../assets/clinical-suite.jpg'

import './walkthrough.css'

const IMG = { clinicalSuite: clinicalSuiteImg }

/* 3 · walkthrough banner: info bars around a wide violet banner (text left, photo right) */
export default function Walkthrough() {
  return (
    <section className="walk vx-wrap" id="metrics-film">
      <div className="wbar">
        <span><span className="wdot" />VetechIQ // How It Works</span>
        <span>
          <span className="v"><PulseLed color="bg-[#5B32E8]" />8 modules • One login</span>
        </span>
      </div>

      <div className="walk-in">
        <div className="walk-txt">
          <span className="tagpill white">A Visit at Your Clinic</span>
          <h2>One Login. Your Whole Clinic Connected.</h2>
          <p>A pet arrives and is found or added. The visit joins the live queue. The doctor consults, prescribes and orders tests. The bill is made and paid. Everything is saved in the pet's history for the next visit.</p>
          <div className="wrow">
            <a href="#operational-arms" className="small">See the modules ↓</a>
          </div>
        </div>
        <img alt="Veterinary clinic team at work" src={IMG.clinicalSuite} />
      </div>

      <div className="wbar bottom">
        <span>Find pet</span>
        <span>Book</span>
        <span>Consult</span>
        <span>Bill and pay</span>
        <span className="clk"><Clock /></span>
      </div>
    </section>
  )
}
