const Tuner = function (a4) {
  this.middleA = a4 || 440;
  this.semitone = 69;
  this.bufferSize = 4096;
  this.noteStrings = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ];

  this.initGetUserMedia();
};

Tuner.prototype.initGetUserMedia = function () {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!window.AudioContext) {
    return alert("AudioContext not supported");
  }

  // Older browsers might not implement mediaDevices at all, so we set an empty object first
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }

  // Some browsers partially implement mediaDevices. We can't just assign an object
  // with getUserMedia as it would overwrite existing properties.
  // Here, we will just add the getUserMedia property if it's missing.
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      // First get ahold of the legacy getUserMedia, if present
      const getUserMedia =
        navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

      // Some browsers just don't implement it - return a rejected promise with an error
      // to keep a consistent interface
      if (!getUserMedia) {
        alert("getUserMedia is not implemented in this browser");
      }

      // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  }
};

Tuner.prototype.startRecord = function () {
  const self = this;
  
  // Ensure audio context is running
  if (this.audioContext.state === 'suspended') {
    this.audioContext.resume();
  }

  navigator.mediaDevices
    .getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      } 
    })
    .then(function (stream) {
      const source = self.audioContext.createMediaStreamSource(stream);
      source.connect(self.analyser);
      
      if (self.scriptProcessor) {
        self.analyser.connect(self.scriptProcessor);
        self.scriptProcessor.connect(self.audioContext.destination);
      }
    })
    .catch(function (error) {
      console.error('Error accessing microphone:', error);
      alert("マイクへのアクセスができません。ブラウザの設定でマイクの使用を許可してください。\n" + error.message);
    });
};
};

Tuner.prototype.init = function () {
  try {
    // Ensure we're responding to a user gesture
    if (this.audioContext === undefined) {
      this.audioContext = new window.AudioContext();
    }
    
    // Resume the audio context if it's suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Use a smaller buffer size for Android Chrome to reduce latency
    this.bufferSize = /Android/i.test(navigator.userAgent) ? 2048 : 4096;
    
    this.analyser = this.audioContext.createAnalyser();
    
    // For newer browsers, use AudioWorkletNode instead of ScriptProcessor
    if (this.audioContext.audioWorklet) {
      this.initializeWorklet();
    } else {
      this.scriptProcessor = this.audioContext.createScriptProcessor(
        this.bufferSize,
        1,
        1
      );
      this.initializeScriptProcessor();
    }

    const self = this;
    
    aubio().then(function (aubio) {
      self.pitchDetector = new aubio.Pitch(
        "default",
        self.bufferSize,
        1,
        self.audioContext.sampleRate
      );
      self.startRecord();
    }).catch(function(error) {
      console.error('Failed to initialize aubio:', error);
      alert('Failed to initialize audio processing. Please try reloading the page.');
    });
  } catch (error) {
    console.error('Error initializing audio:', error);
    alert('Failed to initialize audio. Please ensure you\'re using a supported browser and have granted microphone permissions.');
  }
};

/**
 * get musical note from frequency
 *
 * @param {number} frequency
 * @returns {number}
 */
Tuner.prototype.getNote = function (frequency) {
  const note = 12 * (Math.log(frequency / this.middleA) / Math.log(2));
  return Math.round(note) + this.semitone;
};

/**
 * get the musical note's standard frequency
 *
 * @param note
 * @returns {number}
 */
Tuner.prototype.getStandardFrequency = function (note) {
  return this.middleA * Math.pow(2, (note - this.semitone) / 12);
};

/**
 * get cents difference between given frequency and musical note's standard frequency
 *
 * @param {number} frequency
 * @param {number} note
 * @returns {number}
 */
Tuner.prototype.getCents = function (frequency, note) {
  return Math.floor(
    (1200 * Math.log(frequency / this.getStandardFrequency(note))) / Math.log(2)
  );
};

/**
 * play the musical note
 *
 * @param {number} frequency
 */
Tuner.prototype.play = function (frequency) {
  if (!this.oscillator) {
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.connect(this.audioContext.destination);
    this.oscillator.start();
  }
  this.oscillator.frequency.value = frequency;
};

Tuner.prototype.stopOscillator = function () {
  if (this.oscillator) {
    this.oscillator.stop();
    this.oscillator = null;
  }
};

Tuner.prototype.initializeScriptProcessor = function() {
  const self = this;
  this.scriptProcessor.addEventListener("audioprocess", function (event) {
    const frequency = self.pitchDetector.do(
      event.inputBuffer.getChannelData(0)
    );
    if (frequency && self.onNoteDetected) {
      const note = self.getNote(frequency);
      self.onNoteDetected({
        name: self.noteStrings[note % 12],
        value: note,
        cents: self.getCents(frequency, note),
        octave: parseInt(note / 12) - 1,
        frequency: frequency,
      });
    }
  });
};

Tuner.prototype.initializeWorklet = async function() {
  const workletCode = `
    class TunerProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.port.onmessage = (e) => {
          if (e.data.type === 'init') {
            // Initialize any necessary processing here
          }
        };
      }

      process(inputs, outputs, parameters) {
        if (inputs[0] && inputs[0][0]) {
          this.port.postMessage({
            type: 'audio',
            data: inputs[0][0]
          });
        }
        return true;
      }
    }
    registerProcessor('tuner-processor', TunerProcessor);
  `;

  const blob = new Blob([workletCode], { type: 'application/javascript' });
  const workletUrl = URL.createObjectURL(blob);
  
  try {
    await this.audioContext.audioWorklet.addModule(workletUrl);
    const workletNode = new AudioWorkletNode(this.audioContext, 'tuner-processor');
    
    workletNode.port.onmessage = (e) => {
      if (e.data.type === 'audio') {
        const frequency = this.pitchDetector.do(e.data.data);
        if (frequency && this.onNoteDetected) {
          const note = this.getNote(frequency);
          this.onNoteDetected({
            name: this.noteStrings[note % 12],
            value: note,
            cents: this.getCents(frequency, note),
            octave: parseInt(note / 12) - 1,
            frequency: frequency,
          });
        }
      }
    };

    this.analyser.connect(workletNode);
    workletNode.connect(this.audioContext.destination);
  } catch (error) {
    console.warn('AudioWorklet not supported, falling back to ScriptProcessor:', error);
    this.scriptProcessor = this.audioContext.createScriptProcessor(
      this.bufferSize,
      1,
      1
    );
    this.initializeScriptProcessor();
  } finally {
    URL.revokeObjectURL(workletUrl);
  }
};
