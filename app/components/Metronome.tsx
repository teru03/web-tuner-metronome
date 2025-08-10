'use client'

import { useEffect, useRef, useState } from 'react'

export default function Metronome() {
  const [tempo, setTempo] = useState(120)
  const [isPlaying, setIsPlaying] = useState(false)
  const [noteResolution, setNoteResolution] = useState(0)
  const [isSound, setIsSound] = useState(false)
  const [playButtonText, setPlayButtonText] = useState('play')
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const timerWorkerRef = useRef<Worker | null>(null)
  const nextNoteTimeRef = useRef(0)
  const current16thNoteRef = useRef(0)
  const notesInQueueRef = useRef<Array<{note: number, time: number}>>([])
  const last16thNoteDrawnRef = useRef(-1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const canvasContext = canvas.getContext('2d')
    if (!canvasContext) return

    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.clientWidth
        canvas.height = 50
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

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

    const draw = () => {
      let currentNote = last16thNoteDrawnRef.current
      const audioContext = audioContextRef.current
      
      if (audioContext) {
        const currentTime = audioContext.currentTime
        const notesInQueue = notesInQueueRef.current

        while (notesInQueue.length && notesInQueue[0].time < currentTime) {
          currentNote = notesInQueue[0].note
          notesInQueue.splice(0, 1)
        }

        if (last16thNoteDrawnRef.current !== currentNote) {
          const x = Math.floor(canvas.width / 18)
          const radius = Math.min(x / 4, canvas.height / 4)
          canvasContext.clearRect(0, 0, canvas.width, canvas.height)
          
          for (let i = 0; i < 16; i++) {
            canvasContext.fillStyle = currentNote === i 
              ? (currentNote % 4 === 0 ? 'red' : 'blue') 
              : 'black'
            canvasContext.beginPath()
            canvasContext.arc(x * (i + 1) + x / 2, canvas.height / 2, radius, 0, 2 * Math.PI)
            canvasContext.fill()
          }
          last16thNoteDrawnRef.current = currentNote
        }
      }
      requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      worker.terminate()
      URL.revokeObjectURL(blob.toString())
    }
  }, [])

  const nextNote = () => {
    const secondsPerBeat = 60.0 / tempo
    nextNoteTimeRef.current += 0.25 * secondsPerBeat
    current16thNoteRef.current++
    if (current16thNoteRef.current === 16) {
      current16thNoteRef.current = 0
    }
  }

  const scheduleNote = (beatNumber: number, time: number) => {
    notesInQueueRef.current.push({ note: beatNumber, time })

    if ((noteResolution === 1) && (beatNumber % 2)) return
    if ((noteResolution === 2) && (beatNumber % 4)) return

    const audioContext = audioContextRef.current
    if (!audioContext || !isSound) return

    const osc = audioContext.createOscillator()
    osc.connect(audioContext.destination)
    
    if (beatNumber % 16 === 0) {
      osc.frequency.value = 880.0
    } else if (beatNumber % 4 === 0) {
      osc.frequency.value = 440.0
    } else {
      osc.frequency.value = 220.0
    }

    osc.start(time)
    osc.stop(time + 0.05)
  }

  const scheduler = () => {
    const audioContext = audioContextRef.current
    if (!audioContext) return

    while (nextNoteTimeRef.current < audioContext.currentTime + 0.1) {
      scheduleNote(current16thNoteRef.current, nextNoteTimeRef.current)
      nextNote()
    }
  }

  const handlePlay = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    const audioContext = audioContextRef.current
    
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }

    if (!isPlaying) {
      current16thNoteRef.current = 0
      nextNoteTimeRef.current = audioContext.currentTime
      timerWorkerRef.current?.postMessage('start')
      setPlayButtonText('stop')
      setIsPlaying(true)
    } else {
      timerWorkerRef.current?.postMessage('stop')
      setPlayButtonText('play')
      setIsPlaying(false)
    }
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
              className={`resolution-btn ${noteResolution === 0 ? 'active' : ''}`}
              onClick={() => setNoteResolution(0)}
            >
              16th
            </button>
            <button 
              className={`resolution-btn ${noteResolution === 1 ? 'active' : ''}`}
              onClick={() => setNoteResolution(1)}
            >
              8th
            </button>
            <button 
              className={`resolution-btn ${noteResolution === 2 ? 'active' : ''}`}
              onClick={() => setNoteResolution(2)}
            >
              Quarter
            </button>
          </div>
        </div>

      </div>
      <div className="beatCanvas">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}