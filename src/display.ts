import { Chord, Duration, Pitch, Voice, Bridge, dotAndTieNotes, noteNames, Music, splitVoice, KeySignature, keySignatureUsesFlat, musicNumBeats, voiceNumBeats, MIN_DIVISION } from './music';
import * as Vex from 'vexflow';

export interface Display {
  music: Music;
  setup(container: HTMLElement): void
  render(music: Music): void
}

export class VexDisplay implements Display {
  private width: number;
  private padding: number;
  private lineHeight: number;

  private outputElement: HTMLDivElement;
  private renderer: Vex.Renderer;
  private context: Vex.RenderContext;

  music: Music;

  setup(container: HTMLElement) {
    this.outputElement = document.createElement('div');
    container.appendChild(this.outputElement);

    this.renderer = new Vex.Renderer(this.outputElement, Vex.Renderer.Backends.SVG);

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.context = this.renderer.getContext();
  }

  resize(lineHeight?: number, padding?: number) {
    this.width = this.outputElement.clientWidth;
    this.lineHeight = lineHeight || this.lineHeight || 120;
    this.padding = padding || this.padding || 10;;

    if (this.music)
      this.render(this.music);
  }

  private readDuration(duration: Duration, isRest: boolean): string {
    const durationName = Duration[duration];
    const match = /D(\d+)/.exec(durationName);
    const denominator = Number.parseInt(match[1]) as 1 | 2 | 4 | 8 | 16 | 32;
    const durationStringMap = { 1: 'w', 2: 'h', 4: 'q', 8: '8', 16: '16', 32: '32' };
    let durationString = durationStringMap[denominator];
    if (isRest)
      durationString += 'r';
    return durationString;
  }

  private readChord(chord: Chord): string[] {
    const keys: string[] = [];

    // sort chord as vexflow requires
    chord = [...chord];
    chord.sort((pitch1, pitch2) => pitch1 - pitch2);

    for (const noteName of noteNames(chord)) {
      const match = /([A-G])(#?)(\d+)/.exec(noteName);
      let key = match[1].toLowerCase();
      let accidental = match[2];
      if (accidental === '#' && keySignatureUsesFlat(this.music.keySignature)) {
        accidental = 'b';
        key =
          key === 'c' ? 'd' :
          key === 'd' ? 'e' :
          key === 'f' ? 'g' :
          key === 'g' ? 'a' :
          key === 'a' ? 'b' : '';
      }
      const octave = match[3];
      keys.push(`${key}${accidental}/${octave}`);
    }
    return keys;
  }

  private getStave(index: number): Vex.Stave {
    // stave at (x, y) with width z
    const stave = new Vex.Stave(
      this.padding,
      this.padding + (index + 1 / 2) * this.lineHeight,
      this.width - 2 * this.padding
    );

    stave.addClef('treble');
    stave.addModifier(new Vex.KeySignature(KeySignature[this.music.keySignature]));

    return stave;
  }

  private toVoice(notes: Voice, numBeats: number):
      { voice: Vex.Voice, decorations: Vex.Element[] } {
    const tieGroups = dotAndTieNotes(notes);

    const staveNotes: Vex.StaveNote[] = [];
    const ties: Vex.StaveTie[] = [];
    const curves: Vex.Curve[] = [];

    let slurStart: Vex.StaveNote = null;
    let slurEnd: Vex.StaveNote = null;
    let inSlur: boolean = false;

    for (const tieGroup of tieGroups) {
      // build notes
      const { chord, bridge, decoration } = tieGroup;

      const isRest = chord.length === 0;
      const keys = isRest ? ['b/4'] : this.readChord(chord);

      const tieStaveNotes: Vex.StaveNote[] = tieGroup.notes.map(note => {
        const { duration, numDots } = note;
        const durationString = this.readDuration(duration, isRest);

        const staveNote = new Vex.StaveNote({
          keys: keys,
          duration: durationString
        });

        // build dots
        for (let i = 0; i < numDots; i++)
          Vex.Dot.buildAndAttach([staveNote], { all: true });

        return staveNote;
      });
        
      staveNotes.push(...tieStaveNotes);
      
      // build ties
      const indices = chord.map((_, i) => i);
      for (let i = 0; i < tieStaveNotes.length - 1; i++) {
        ties.push(new Vex.StaveTie({
          first_note: tieStaveNotes[i], last_note: tieStaveNotes[i + 1],
          first_indices: indices, last_indices: indices
        }));
      }
      
      // build slurs (curves)
      if (bridge === Bridge.Slur) {
        inSlur = true;
        slurEnd = tieStaveNotes[tieStaveNotes.length - 1];
      } else if (bridge === Bridge.None) {
        // commit ended slur
        if (inSlur) {
          inSlur = false;
          curves.push(new Vex.Curve(slurStart, slurEnd, {}));
        }
        slurStart = tieStaveNotes[0];
      }
    }

    // commit trailing slur
    if (inSlur)
      curves.push(new Vex.Curve(slurStart, slurEnd, {}));

    const beams = Vex.Beam.generateBeams(staveNotes);

    const voice = new Vex.Voice({
      num_beats: numBeats,
      beat_value: MIN_DIVISION
    });
    // let vexflow relax about tick time
    voice.setStrict(false);
    voice.addTickables(staveNotes);

    // build accidentals
    Vex.Accidental.applyAccidentals([voice], KeySignature[this.music.keySignature]);

    return { voice, decorations: [...beams, ...curves, ...ties] };
  }

  render(music: Music, trim: boolean = false) {
    this.context.clear();
    
    this.music = music;
    let voices = music.voices.map(voice => [...voice]);
    let numLines = 0;

    // trim trailing rest of voices
    const totalNumBeats = musicNumBeats(music);
    if (trim)
      voices = voices.map(voice => splitVoice(voice, totalNumBeats)[0]);

    // filter empty voices
    voices = voices.filter(
      notes => notes.some(
        ({ chord }) => chord.length > 0));
    // but there should be something to draw
    if (voices.length === 0) {
      this.getStave(0).setContext(this.context).draw();
      numLines++;
    }
    
    console.log(voices);
    
    // NOTE: should each voice have a separate stave?
    while (voices.some(voice => voice.length > 0)) {
      const stave = this.getStave(numLines);
      const justifyWidth = stave.getNoteEndX() - stave.getNoteStartX() - 10;
      let formatter: Vex.Formatter;

      // fit the approx. max possible number of whole notes in a line
      let numWholeNotes = Math.min(
        Math.ceil(totalNumBeats / MIN_DIVISION),
        Math.floor(justifyWidth / 10)
      );
      let width: number;
      let voicesLeft: Voice[];
      let vexVoices: Vex.Voice[];
      let vexDecorations: Vex.Element[];

      console.log(+new Date());
      do {
        const numBeatsInLine = numWholeNotes * MIN_DIVISION;

        const voicesSplit: Voice[] = [];
        voicesLeft = [];
        for (const voice of voices) {
          const [voiceSplit, voiceLeft] = splitVoice(voice, numBeatsInLine);
          voicesSplit.push(voiceSplit);
          voicesLeft.push(voiceLeft);
        }
  
        vexVoices = [];
        vexDecorations = [];
        for (const notes of voicesSplit) {
          const { voice: vexVoice, decorations } = this.toVoice(notes, numBeatsInLine);
          vexVoices.push(vexVoice);
          vexDecorations.push(...decorations);
        }

        formatter = new Vex.Formatter();
        formatter.joinVoices(vexVoices);

        width = formatter.preCalculateMinTotalWidth(vexVoices);
        // approximate number of whole notes
        console.log(justifyWidth, width);
        console.log(numWholeNotes, numWholeNotes * justifyWidth / width);
        numWholeNotes = Math.min(
          numWholeNotes - 1,
          Math.ceil(numWholeNotes * justifyWidth / width)
        );
      } while (
        numWholeNotes > 0 &&
        width > justifyWidth
      );
      console.log(+new Date());

      voices = voicesLeft;

      formatter.formatToStave(vexVoices, stave);

      stave.setContext(this.context).draw();
      vexVoices.forEach(voice => voice.draw(this.context, stave));
      vexDecorations.forEach(element => element.setContext(this.context).draw());

      numLines++;
    }

    this.renderer.resize(this.width, (numLines + 2) * this.lineHeight);
  }
}
