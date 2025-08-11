'use client'

import { useEffect, useRef, useState } from 'react'

export default function Metronome() {
  const [tempo, setTempo] = useState(80)
  const [isPlaying, setIsPlaying] = useState(false)
  const [noteResolution, setNoteResolution] = useState(2)
  const [timeSignature, setTimeSignature] = useState(2) // 0: 2/4, 1: 3/4, 2: 4/4, 3: 6/8
  const [isSound, setIsSound] = useState(true)
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
              ? (currentNote % 4 === 0 ? 'crimson' : 'green') 
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
  }, [noteResolution])

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

    // Skip notes based on resolution - use current noteResolution value
    const currentResolution = noteResolution
    if (currentResolution === 1 && (beatNumber % 2 !== 0)) return  // 8th notes: skip odd beats
    if (currentResolution === 2 && (beatNumber % 4 !== 0)) return  // Quarter notes: skip non-quarter beats

    const audioContext = audioContextRef.current
    if (!audioContext || !isSound) return

    // Create click sound using noise and filtering
    const osc = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    const filter = audioContext.createBiquadFilter()
    
    osc.type = 'square'
    osc.frequency.value = beatNumber % 4 === 0 ? 1000 : 800
    
    filter.type = 'highpass'
    filter.frequency.value = 1000
    
    osc.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // Sharp attack and quick decay for click sound
    gainNode.gain.setValueAtTime(0, time)
    gainNode.gain.linearRampToValueAtTime(0.3, time + 0.001)
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.02)
    
    osc.start(time)
    osc.stop(time + 0.02)
  }

  const scheduler = () => {
    const audioContext = audioContextRef.current
    if (!audioContext) return

    while (nextNoteTimeRef.current < audioContext.currentTime + 0.1) {
      scheduleNote(current16thNoteRef.current, nextNoteTimeRef.current)
      nextNote()
    }
  }

  const handlePlay = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    const audioContext = audioContextRef.current
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    // Unlock audio context with a silent buffer
    if (audioContext.state === 'running' && isSound) {
      const buffer = audioContext.createBuffer(1, 1, 22050)
      const source = audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(audioContext.destination)
      source.start(0)
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
              className={`resolution-btn ${noteResolution === 2 ? 'active' : ''}`}
              onClick={() => setNoteResolution(2)}
            >
              4分音符
            </button>
            <button 
              className={`resolution-btn ${noteResolution === 1 ? 'active' : ''}`}
              onClick={() => setNoteResolution(1)}
            >
              8分音符
            </button>
            <button 
              className={`resolution-btn ${noteResolution === 0 ? 'active' : ''}`}
              onClick={() => setNoteResolution(0)}
            >
              16分音符
            </button>
          </div>
        </div>
        <div className="time-signature-controls">
          <span>Time:</span>
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
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}