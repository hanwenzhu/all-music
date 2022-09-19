import { Voice, noteNames, timeNotes, Music } from './music';
import * as Tone from 'tone';

export interface Player {
  setup(container: HTMLElement): void
  load(music: Music): void
  start?(): void
  pause?(): void
  stop?(): void
}

export class ToneJSPlayer implements Player {
  synth: Tone.PolySynth;
  toneEvent: Tone.ToneEvent;

  setup(container: HTMLElement) {
    this.synth = new Tone.PolySynth<Tone.FMSynth>({ maxPolyphony: 72 }).toDestination();
  }

  load(music: Music) {
    this.stop();

    const noteTimes: [{ '32n': number }, { notes: string[], duration: { '32n': number } }][] = [];

    for (const notes of music.voices) {
      const timedNotes = timeNotes(notes);
      let beat = 0;
      for (const { numBeats, chord } of timedNotes) {
        noteTimes.push([{ '32n': beat }, { notes: noteNames(chord), duration: { '32n': numBeats } }]);
        beat += numBeats;
      }
    }
    this.toneEvent = new Tone.Part((time, { notes, duration }) => {
      this.synth.triggerAttackRelease(notes, duration, time);
    }, noteTimes).start();
  }

  start() {
    Tone.Transport.start();
    Tone.start();
  }

  stop() {
    this.synth.releaseAll();
    Tone.Transport.cancel();
  }

  pause() {
    this.synth.releaseAll();
    Tone.Transport.pause();
  }
}
