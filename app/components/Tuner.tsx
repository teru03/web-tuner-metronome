'use client'

import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import Script from 'next/script'

interface Note {
  name: string
  frequency: number
  octave: number
  value: number
  cents: number
}

export default function Tuner() {
  const [a4, setA4] = useState(442)
  const [isAutoMode, setIsAutoMode] = useState(true)
  const [isTunerActive, setIsTunerActive] = useState(false)
  const [currentNote, setCurrentNote] = useState<Note>({
    name: 'A',
    frequency: 442,
    octave: 4,
    value: 69,
    cents: 0
  })

  const tunerRef = useRef<any>(null)
  const meterPointerRef = useRef<HTMLDivElement>(null)
  const notesListRef = useRef<HTMLDivElement>(null)
  const frequencyRef = useRef<HTMLDivElement>(null)
  const notesWrapperRef = useRef<HTMLDivElement>(null)

  const noteStrings = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

  useEffect(() => {
    const savedA4 = localStorage.getItem('a4')
    if (savedA4) {
      setA4(parseInt(savedA4))
    }
  }, [])

  useEffect(() => {
    createNotes()
  }, [a4])

  const getNote = (frequency: number) => {
    const note = 12 * (Math.log(frequency / a4) / Math.log(2))
    return Math.round(note) + 69
  }

  const getStandardFrequency = (note: number) => {
    return a4 * Math.pow(2, (note - 69) / 12)
  }

  const getCents = (frequency: number, note: number) => {
    return Math.floor((1200 * Math.log(frequency / getStandardFrequency(note))) / Math.log(2))
  }

  const createNotes = () => {
    if (!notesListRef.current) return

    notesListRef.current.innerHTML = ''
    const minOctave = 1
    const maxOctave = 8

    for (let octave = minOctave; octave <= maxOctave; octave++) {
      for (let n = 0; n < 12; n++) {
        const noteElement = document.createElement('div')
        noteElement.className = 'note'
        const noteValue = 12 * (octave + 1) + n
        noteElement.dataset.name = noteStrings[n]
        noteElement.dataset.value = noteValue.toString()
        noteElement.dataset.octave = octave.toString()
        noteElement.dataset.frequency = getStandardFrequency(noteValue).toString()
        
        noteElement.innerHTML = 
          noteStrings[n][0] +
          '<span class="note-sharp">' + (noteStrings[n][1] || '') + '</span>' +
          '<span class="note-octave">' + octave + '</span>'
        
        notesListRef.current.appendChild(noteElement)
      }
    }
  }

  const updateMeter = (cents: number) => {
    if (meterPointerRef.current) {
      const deg = (cents / 50) * 45
      meterPointerRef.current.style.transform = `rotate(${deg}deg)`
    }
  }

  const updateNotes = (note: Note) => {
    if (!notesListRef.current || !notesWrapperRef.current || !frequencyRef.current) return

    const activeNote = notesListRef.current.querySelector('.active')
    if (activeNote) {
      activeNote.classList.remove('active')
    }

    const noteElement = notesListRef.current.querySelector(`[data-value="${note.value}"]`)
    if (noteElement) {
      noteElement.classList.add('active')
      const noteElementTyped = noteElement as HTMLElement
      notesWrapperRef.current.scrollLeft = 
        noteElementTyped.offsetLeft - (notesWrapperRef.current.clientWidth - noteElementTyped.clientWidth) / 2
    }

    frequencyRef.current.childNodes[0].textContent = note.frequency.toFixed(1)
  }

  const initializeTuner = async () => {
    try {
      const audioContext = new AudioContext()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      const analyser = audioContext.createAnalyser()
      const bufferSize = /Android/i.test(navigator.userAgent) ? 2048 : 4096

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      // Wait for aubio to be loaded
      if (typeof window !== 'undefined' && (window as any).aubio) {
        const aubioInstance = await (window as any).aubio()
        const pitchDetector = new aubioInstance.Pitch('default', bufferSize, 1, audioContext.sampleRate)

        const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1)
        analyser.connect(scriptProcessor)
        scriptProcessor.connect(audioContext.destination)

        scriptProcessor.addEventListener('audioprocess', (event) => {
          const frequency = pitchDetector.do(event.inputBuffer.getChannelData(0))
          if (frequency && isAutoMode) {
            const noteValue = getNote(frequency)
            const noteName = noteStrings[noteValue % 12]
            const octave = Math.floor(noteValue / 12) - 1
            const cents = getCents(frequency, noteValue)

            const newNote = {
              name: noteName,
              value: noteValue,
              cents,
              octave,
              frequency
            }

            setCurrentNote(newNote)
            updateNotes(newNote)
            updateMeter(cents)
          }
        })

        tunerRef.current = { audioContext, analyser, scriptProcessor, pitchDetector, stream }
      } else {
        throw new Error('Aubio not loaded')
      }
    } catch (error) {
      console.error('Failed to initialize tuner:', error)
      alert('チューナーの初期化に失敗しました。マイクの使用を許可してください。')
    }
  }

  const handleA4Click = async () => {
    const result = await Swal.fire({
      input: 'number',
      inputValue: a4,
      title: 'A4周波数を設定'
    })

    if (result.value && parseInt(result.value) !== a4) {
      const newA4 = parseInt(result.value)
      setA4(newA4)
      localStorage.setItem('a4', newA4.toString())
    }
  }

  const handleToggleTuner = () => {
    if (isTunerActive) {
      // Stop tuner
      if (tunerRef.current) {
        tunerRef.current.scriptProcessor?.disconnect()
        tunerRef.current.analyser?.disconnect()
        tunerRef.current = null
      }
      setIsTunerActive(false)
    } else {
      // Start tuner
      initializeTuner()
      setIsTunerActive(true)
    }
  }

  useEffect(() => {
    // Create meter scales
    const meterElement = document.querySelector('.meter')
    if (meterElement) {
      for (let i = 0; i <= 10; i++) {
        const scale = document.createElement('div')
        scale.className = 'meter-scale'
        scale.style.transform = `rotate(${i * 9 - 45}deg)`
        if (i % 5 === 0) {
          scale.classList.add('meter-scale-strong')
        }
        meterElement.appendChild(scale)
      }
    }

    return () => {
      if (tunerRef.current) {
        tunerRef.current.scriptProcessor?.disconnect()
        tunerRef.current.analyser?.disconnect()
      }
    }
  }, [])

  return (
    <>
      <Script 
        src="https://cdn.jsdelivr.net/npm/aubiojs@0.1.1/build/aubio.min.js" 
        strategy="beforeInteractive"
      />
      <div className="box-tuner">
        <div className="tuner-controls">
          <div className="tuner-play">
            <button
              onClick={handleToggleTuner}
              className={`tuner-start-btn ${isTunerActive ? 'active' : ''}`}
            >
              {isTunerActive ? 'Stop' : 'Start'}
            </button>
            <div className="a4-controls">
              <span>A<sub>4</sub> =</span>
              <div className="a4-stepper">
                <button 
                  className="a4-btn" 
                  onClick={() => setA4(Math.max(400, a4 - 1))}
                >
                  −
                </button>
                <input
                  type="number"
                  value={a4}
                  onChange={(e) => {
                    const newA4 = Math.min(480, Math.max(400, Number(e.target.value) || 442))
                    setA4(newA4)
                    localStorage.setItem('a4', newA4.toString())
                  }}
                  className="a4-input"
                  min="400"
                  max="480"
                />
                <button 
                  className="a4-btn" 
                  onClick={() => setA4(Math.min(480, a4 + 1))}
                >
                  +
                </button>
              </div>
              <span>Hz</span>
            </div>
          </div>
        </div>
        <div className="meter">
        <div className="meter-dot"></div>
        <div className="meter-pointer" ref={meterPointerRef}></div>
      </div>
      <div className="notes-wrapper" ref={notesWrapperRef}>
        <div className="notes-list" ref={notesListRef}></div>
      </div>
      <div className="frequency" ref={frequencyRef}>
        <span>Hz</span>
      </div>

      </div>
    </>
  )
}