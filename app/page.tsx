'use client'

import Metronome from './components/Metronome'
import Tuner from './components/Tuner'
import PWAInstaller from './components/PWAInstaller'

export default function Home() {
  return (
    <>
      <PWAInstaller />
      <div className="container">
        <Tuner />
        <Metronome />
      </div>
    </>
  )
}