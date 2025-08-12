'use client'

import { useEffect } from 'react'
import Metronome from './components/Metronome'
import Tuner from './components/Tuner'

export default function Home() {
  return (
    <div className="container">
      <Tuner />
      <Metronome />
    </div>
  )
}