import React, { useCallback, useEffect, useRef, useState } from 'react';

// Beat visualizer component to prevent re-rendering of the whole metronome
interface BeatVisualizerProps {
  timeSignature: number;
  currentBeat: number;
}

const BeatVisualizer: React.FC<BeatVisualizerProps> = React.memo(({ timeSignature, currentBeat }) => {
  return (
    <svg width="100%" height="50" viewBox="0 0 400 50">
      {(() => {
        let beatsCount = 4; // default 4/4
        if (timeSignature === 0) beatsCount = 2;  // 2/4
        if (timeSignature === 1) beatsCount = 3;  // 3/4
        if (timeSignature === 3) beatsCount = 2;  // 6/8
        
        const circles = [];
        const spacing = 400 / (beatsCount + 2);
        
        for (let i = 0; i < beatsCount; i++) {
          let fillColor = '#ebf6f7';
          
          let isCurrentBeat = false;
          if (timeSignature === 0) { // 2/4
            isCurrentBeat = currentBeat === i * 4;
          } else if (timeSignature === 1) { // 3/4
            isCurrentBeat = currentBeat === i * 4;
          } else if (timeSignature === 2) { // 4/4
            isCurrentBeat = currentBeat === i * 4;
          } else if (timeSignature === 3) { // 6/8
            isCurrentBeat = currentBeat === i * 6;
          }
          
          if (isCurrentBeat) {
            fillColor = i === 0 ? 'crimson' : 'green';
          }
          
          circles.push(
            <circle
              key={i}
              cx={spacing * (i + 1) + spacing / 2}
              cy={25}
              r={12}
              fill={fillColor}
            />
          );
        }
        
        return circles;
      })()} 
    </svg>
  );
});

BeatVisualizer.displayName = 'BeatVisualizer';

export default function Metronome() {
  const [tempo, setTempo] = useState(80);
  const [inputValue, setInputValue] = useState(String(tempo));
  const [isPlaying, setIsPlaying] = useState(false);
  const [noteResolution, setNoteResolution] = useState(2);
  const [timeSignature, setTimeSignature] = useState(2); // 0: 2/4, 1: 3/4, 2: 4/4, 3: 6/8
  const [isSound, setIsSound] = useState(true);
  const [currentBeat, setCurrentBeat] = useState(-1);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerWorkerRef = useRef<Worker | null>(null);
  const nextNoteTimeRef = useRef(0);
  const current16thNoteRef = useRef(0);
  const notesInQueueRef = useRef<Array<{note: number, time: number}>>([]);
  const last16thNoteDrawnRef = useRef(-1);
  const isPlayingRef = useRef(false);

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

    let animationFrameId: number;
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
      animationFrameId = requestAnimationFrame(updateBeat)
    }

    updateBeat()

    return () => {
      worker.terminate()
      URL.revokeObjectURL(blob.toString())
      cancelAnimationFrame(animationFrameId);
    }
  }, []) // Removed dependencies to prevent re-creation

  const nextNote = useCallback(() => {
    const currentTempo = Math.max(30, Math.min(160, tempo));
    const secondsPerBeat = 60.0 / currentTempo;
    const timeIncrement = timeSignature === 3 ? (1.0 / 8.0) * secondsPerBeat : 0.25 * secondsPerBeat
    nextNoteTimeRef.current += timeIncrement
    current16thNoteRef.current++
    let maxBeats = 16 // default 4/4
    if (timeSignature === 0) maxBeats = 8  // 2/4
    if (timeSignature === 1) maxBeats = 12 // 3/4
    if (timeSignature === 3) maxBeats = 12 // 6/8 (12 eighth notes)
    if (current16thNoteRef.current === maxBeats) {
      current16thNoteRef.current = 0
    }
  }, [tempo, timeSignature])

  const scheduleNote = useCallback((beatNumber: number, time: number) => {
    notesInQueueRef.current.push({ note: beatNumber, time })

    if (timeSignature === 0) { // 2/4 time
      if (noteResolution === 2 && beatNumber !== 0 && beatNumber !== 4) return
      if (noteResolution === 1 && beatNumber % 2 !== 0) return
    } else if (timeSignature === 1) { // 3/4 time
      if (noteResolution === 2 && beatNumber !== 0 && beatNumber !== 4 && beatNumber !== 8) return
      if (noteResolution === 1 && beatNumber % 2 !== 0) return
    } else if (timeSignature === 3) { // 6/8 time
      if (noteResolution === 2 && beatNumber !== 0 && beatNumber !== 6) return
      if (noteResolution === 1 && beatNumber % 2 !== 0) return
    } else {
      if (noteResolution === 1 && (beatNumber % 2 !== 0)) return
      if (noteResolution === 2 && (beatNumber % 4 !== 0)) return
    }

    const audioContext = audioContextRef.current
    if (!audioContext) return

    if (isSound) {
      const osc = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      const filter = audioContext.createBiquadFilter()
      
      osc.type = 'square'
      if (timeSignature === 3 && noteResolution === 1 && (beatNumber === 0 || beatNumber === 6)) {
        osc.frequency.value = 1200
      } else {
        osc.frequency.value = beatNumber % 4 === 0 ? 1000 : 800
      }
      
      filter.type = 'highpass'
      filter.frequency.value = 1000
      
      osc.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      gainNode.gain.setValueAtTime(0, time)
      gainNode.gain.linearRampToValueAtTime(0.3, time + 0.001)
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.02)
      
      osc.start(time)
      osc.stop(time + 0.02)
    }
  }, [timeSignature, noteResolution, isSound])

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

    if (audioContext.state === 'running') {
      const buffer = audioContext.createBuffer(1, 1, 22050)
      const source = audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(audioContext.destination)
      source.start(0)
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    const num = Number(val);
    if (!isNaN(num) && val !== '') {
      setTempo(num);
    }
  };

  const handleInputBlur = () => {
    const clampedTempo = Math.max(30, Math.min(160, tempo));
    setTempo(clampedTempo);
    setInputValue(String(clampedTempo));
  };

  const handlePlusMinusClick = (newTempo: number) => {
    const clamped = Math.max(30, Math.min(160, newTempo));
    setTempo(clamped);
    setInputValue(String(clamped));
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
              onClick={() => handlePlusMinusClick(tempo - 1)}
            >
              −
            </button>
            <input
              type="number"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              className="tempo-input"
              min="30"
              max="160"
            />
            <button 
              className="tempo-btn" 
              onClick={() => handlePlusMinusClick(tempo + 1)}
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
              {timeSignature === 3 ? '付点4分音符' : '4分音符'}
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
        <BeatVisualizer timeSignature={timeSignature} currentBeat={currentBeat} />
      </div>
    </div>
  )
}
