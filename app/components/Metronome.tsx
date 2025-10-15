'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export default function Metronome() {
  const [tempo, setTempo] = useState(80)
  const [isPlaying, setIsPlaying] = useState(false)
  const [noteResolution, setNoteResolution] = useState(2)
  const [timeSignature, setTimeSignature] = useState(2) // 0: 2/4, 1: 3/4, 2: 4/4, 3: 6/8
  const [isSound, setIsSound] = useState(true)
  const [currentBeat, setCurrentBeat] = useState(-1)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const timerWorkerRef = useRef<Worker | null>(null)
  const nextNoteTimeRef = useRef(0)
  const current16thNoteRef = useRef(0)
  const notesInQueueRef = useRef<Array<{note: number, time: number}>>([])
  const last16thNoteDrawnRef = useRef(-1)
  const isPlayingRef = useRef(false)
  const [rhythmPattern, setRhythmPattern] = useState<boolean[]>(new Array(16).fill(false))

  useEffect(() => {
    let maxBeats = 16 // default 4/4
    if (timeSignature === 0) maxBeats = 8  // 2/4
    if (timeSignature === 1) maxBeats = 12 // 3/4
    if (timeSignature === 3) maxBeats = 12 // 6/8
    setRhythmPattern(new Array(maxBeats).fill(false))
  }, [timeSignature])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault()
        if (!isPlaying) return

        setRhythmPattern(prevPattern => {
          const newPattern = [...prevPattern]
          const beatToToggle = current16thNoteRef.current
          newPattern[beatToToggle] = !newPattern[beatToToggle]
          return newPattern
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPlaying])

  useEffect(() => {
    // Web Worker setup
    const workerCode = `
      var timerID=null;
      var interval=100;
      self.onmessage=function(e){
        if (e.data=="start") {
          timerID=setInterval(function(){postMessage("tick");},interval)
        }
        else if (e.data.interval) {
          interval=e.data.interval;
          if (timerID) {
            clearInterval(timerID);
            timerID=setInterval(function(){postMessage("tick");},interval)
          }
        }
        else if (e.data=="stop") {
          clearInterval(timerID);
          timerID=null;
        }
      };
    `
    
    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const worker = new Worker(URL.createObjectURL(blob))
    timerWorkerRef.current = worker

    worker.onmessage = (e) => {
      if (e.data === 'tick') {
        scheduler()
      }
    }

    worker.postMessage({ interval: 25 })

    const updateBeat = () => {
      const audioContext = audioContextRef.current
      
      if (audioContext) {
        const currentTime = audioContext.currentTime
        const notesInQueue = notesInQueueRef.current

        while (notesInQueue.length && notesInQueue[0].time < currentTime) {
          const currentNote = notesInQueue[0].note
          notesInQueue.splice(0, 1)
          
          if (last16thNoteDrawnRef.current !== currentNote) {
            setCurrentBeat(currentNote)
            last16thNoteDrawnRef.current = currentNote
          }
        }
      }
      requestAnimationFrame(updateBeat)
    }

    updateBeat()

    return () => {
      worker.terminate()
      URL.revokeObjectURL(blob.toString())
    }
  }, [])

  const nextNote = useCallback(() => {
    const secondsPerBeat = 60.0 / tempo
    const timeIncrement = timeSignature === 3 ? (1.0 / 8.0) * secondsPerBeat : 0.25 * secondsPerBeat
    nextNoteTimeRef.current += timeIncrement
    current16thNoteRef.current++
    let maxBeats = 16 // default 4/4
    if (timeSignature === 0) maxBeats = 8  // 2/4
    if (timeSignature === 1) maxBeats = 12 // 3/4
    if (timeSignature === 3) maxBeats = 12 // 6/8 (12 eighth notes)
    if (current16thNoteRef.current >= maxBeats) {
      current16thNoteRef.current = 0
    }
  }, [tempo, timeSignature])

  const scheduleNote = useCallback((beatNumber: number, time: number) => {
    notesInQueueRef.current.push({ note: beatNumber, time })

    const userHasRhythm = rhythmPattern.some(v => v);

    if (userHasRhythm) {
      if (!rhythmPattern[beatNumber]) {
        return;
      }
    } else {
      if (timeSignature === 0) { // 2/4 time
        if (noteResolution === 2 && beatNumber % 4 !== 0) return
        if (noteResolution === 1 && beatNumber % 2 !== 0) return
      } else if (timeSignature === 1) { // 3/4 time
        if (noteResolution === 2 && beatNumber % 4 !== 0) return
        if (noteResolution === 1 && beatNumber % 2 !== 0) return
      } else if (timeSignature === 3) { // 6/8 time
        if (noteResolution === 2 && beatNumber % 6 !== 0) return
        if (noteResolution === 1 && beatNumber % 3 !== 0) return
      } else { // 4/4
        if (noteResolution === 2 && beatNumber % 4 !== 0) return
        if (noteResolution === 1 && beatNumber % 2 !== 0) return
      }
    }

    const audioContext = audioContextRef.current
    if (!audioContext) return

    if (isSound) {
      const osc = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      osc.type = 'square'
      if (timeSignature === 3) { // 6/8 time
          osc.frequency.value = (beatNumber === 0 || beatNumber === 6) ? 1200 : 800
      } else { // Other time signatures
          osc.frequency.value = beatNumber % (16 / (timeSignature === 0 ? 8 : timeSignature === 1 ? 12 : 16)) === 0 ? 1000 : 800
      }

      gainNode.gain.setValueAtTime(0, time)
      gainNode.gain.linearRampToValueAtTime(0.3, time + 0.001)
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.02)
      
      osc.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      osc.start(time)
      osc.stop(time + 0.02)
    }
  }, [timeSignature, noteResolution, isSound, tempo, rhythmPattern])

  const scheduler = useCallback(() => {
    const audioContext = audioContextRef.current
    if (!audioContext || !isPlayingRef.current) {
      return
    }

    while (nextNoteTimeRef.current < audioContext.currentTime + 0.1) {
      scheduleNote(current16thNoteRef.current, nextNoteTimeRef.current)
      nextNote()
    }
  }, [scheduleNote, nextNote])

  const handlePlay = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    const audioContext = audioContextRef.current
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    if (!isPlaying) {
      current16thNoteRef.current = 0
      nextNoteTimeRef.current = audioContext.currentTime
      isPlayingRef.current = true
      setIsPlaying(true)
      timerWorkerRef.current?.postMessage('start')
    } else {
      isPlayingRef.current = false
      setIsPlaying(false)
      timerWorkerRef.current?.postMessage('stop')
      notesInQueueRef.current = []
      setCurrentBeat(-1)
    }
  }

  const clearRhythm = () => {
    let maxBeats = 16 // default 4/4
    if (timeSignature === 0) maxBeats = 8  // 2/4
    if (timeSignature === 1) maxBeats = 12 // 3/4
    if (timeSignature === 3) maxBeats = 12 // 6/8
    setRhythmPattern(new Array(maxBeats).fill(false))
  }

  return (
    <div className="box-metronome">
      <div className="metronome-controls">
        <div className="metronome-play">
          <button 
            className={`metronome-start-btn ${isPlaying ? 'active' : ''}`}
            onClick={handlePlay}
          >
            {isPlaying ? 'Stop' : 'Start'}
          </button>
          <label className="sound">
            Sound
            <input
              type="checkbox"
              checked={isSound}
              onChange={(e) => setIsSound(e.target.checked)}
            />
          </label>
        </div>
        <div className="metronome-tempoBox">
          <div className="tempo-stepper">
            <button 
              className="tempo-btn" 
              onClick={() => setTempo(Math.max(30, tempo - 1))}
            >
              −
            </button>
            <input
              type="number"
              value={tempo}
              onChange={(e) => setTempo(Math.min(160, Math.max(30, Number(e.target.value) || 30)))}
              className="tempo-input"
              min="30"
              max="160"
            />
            <button 
              className="tempo-btn" 
              onClick={() => setTempo(Math.min(160, tempo + 1))}
            >
              +
            </button>
          </div>
        </div>
        <div className="resolution-controls">
          <div className="resolution-buttons">
            <button 
              className={`resolution-btn ${noteResolution === 2 ? 'active' : ''}`}
              onClick={() => setNoteResolution(2)}
            >
              {timeSignature === 3 ? 'Dotted Quarter' : 'Quarter'}
            </button>
            <button 
              className={`resolution-btn ${noteResolution === 1 ? 'active' : ''}`}
              onClick={() => setNoteResolution(1)}
            >
              8th
            </button>
            <button 
              className={`resolution-btn ${noteResolution === 0 ? 'active' : ''}`}
              onClick={() => setNoteResolution(0)}
            >
              16th
            </button>
            <button onClick={clearRhythm}>Clear Rhythm</button>
          </div>
        </div>
        <div className="time-signature-controls">
          <div className="time-signature-buttons">
            <button 
              className={`time-signature-btn ${timeSignature === 0 ? 'active' : ''}`}
              onClick={() => setTimeSignature(0)}
            >
              2/4
            </button>
            <button 
              className={`time-signature-btn ${timeSignature === 1 ? 'active' : ''}`}
              onClick={() => setTimeSignature(1)}
            >
              3/4
            </button>
            <button 
              className={`time-signature-btn ${timeSignature === 2 ? 'active' : ''}`}
              onClick={() => setTimeSignature(2)}
            >
              4/4
            </button>
            <button 
              className={`time-signature-btn ${timeSignature === 3 ? 'active' : ''}`}
              onClick={() => setTimeSignature(3)}
            >
              6/8
            </button>
          </div>
        </div>

      </div>
      <div className="beatCanvas">
        <svg width="100%" height="50" viewBox="0 0 400 50">
          {(() => {
            let maxBeats = 16 // default 4/4
            if (timeSignature === 0) maxBeats = 8  // 2/4
            if (timeSignature === 1) maxBeats = 12 // 3/4
            if (timeSignature === 3) maxBeats = 12 // 6/8

            const circles = []
            const spacing = 400 / (maxBeats + 2)
            
            for (let i = 0; i < maxBeats; i++) {
              let fillColor = rhythmPattern[i] ? 'lightblue' : '#ebf6f7'
              if (currentBeat === i) {
                fillColor = rhythmPattern[i] ? 'dodgerblue' : 'green'
              }
              
              circles.push(
                <circle
                  key={i}
                  cx={spacing * (i + 1) + spacing / 2}
                  cy={25}
                  r={8}
                  fill={fillColor}
                />
              )
            }
            
            return circles
          })()} 
        </svg>
      </div>
    </div>
  )
}
