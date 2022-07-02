import timepartSource from './xsl/timepart.xsl';
import { Bridge, Decoration, fifthsToKeySignature, midiToPitch, MIN_DIVISION, Music, Pitch, stringToMidi, TimedNote, untimeNotes, Voice } from './music';

export interface Parser {
  parseMusicXML?(source: any, compress?: boolean): Music
  parseMidi?(source: any, compress?: boolean): Music
}

export class MusicXMLParser implements Parser {
  parser: DOMParser;
  xml: Document;
  timepartConverter: XSLTProcessor;

  divisions: number;
  enharmonicMajor: number;
  tracks: TimedNote[][];
  currentTrack: TimedNote[];
  currentNote: TimedNote;
  currentBeat: number;

  constructor() {
    this.parser = new DOMParser();

    // XSLT converter from timewise to partwise MusicXML
    this.timepartConverter = new XSLTProcessor();
    const timepartXSL = this.parser.parseFromString(timepartSource, 'text/xml');
    this.timepartConverter.importStylesheet(timepartXSL);
  }

  getNumber(context: Node, xpath: string): number {
    const result = this.xml.evaluate(
      xpath, context, null,
      XPathResult.NUMBER_TYPE, null
    );
    return result.numberValue;
  }

  getString(context: Node, xpath: string): string {
    const result = this.xml.evaluate(
      xpath, context, null,
      XPathResult.STRING_TYPE, null
    );
    return result.stringValue;
  }

  getNode(context: Node, xpath: string): Node {
    const result = this.xml.evaluate(
      xpath, context, null,
      XPathResult.FIRST_ORDERED_NODE_TYPE, null
    );
    return result.singleNodeValue;
  }

  getNodes(context: Node, xpath: string): Node[] {
    const result = this.xml.evaluate(
      xpath, context, null,
      XPathResult.ORDERED_NODE_ITERATOR_TYPE, null
    );
    let node: Node;
    const nodes: Node[] = [];
    while (node = result.iterateNext())
      nodes.push(node);
    return nodes;
  }

  /** Sets this.currentTrack to one that currently ends at endBeat. */
  setTrack(endBeat: number) {
    const tracksBeforeEndBeat = this.tracks
      .map<[TimedNote[], number]>(track => [
        track,
        track.map(timedNote => timedNote.numBeats).reduce((n, m) => n + m, 0)
      ])
      .filter(([track, trackEndBeat]) => trackEndBeat <= endBeat)
      .sort(([t, n], [s, m]) => m - n);

    if (tracksBeforeEndBeat.length > 0) {
      const [track, trackEndBeat] = tracksBeforeEndBeat[0];
      // pad track to endBeat by a rest
      track.push({
        numBeats: endBeat - trackEndBeat,
        chord: [],
        bridge: Bridge.None,
        decoration: Decoration.None,
      });
      this.currentTrack = track;
    } else {
      const track: TimedNote[] = [];
      this.tracks.push(track);
      this.currentTrack = track;
    }
    this.currentBeat = endBeat;
  }

  /** Parses <key> node to set this.enharmonicMajor in fifths. */
  parseKey(keyNode: Node) {
    if (!keyNode)
      return;

    let fifths = this.getNumber(keyNode, 'number(./fifths)');
    if (Number.isNaN(fifths)) {
      console.warn(`Non-traditional key signature may not be supported.`);
      fifths = this.getNodes(keyNode, './key-alter')
        .map(keyAlterNode => this.getNumber(keyAlterNode, 'number(.)'))
        .reduce((x, y) => x + y, 0);
    }

    if (!Number.isNaN(fifths)) {
      if (this.enharmonicMajor != null && this.enharmonicMajor !== fifths)
        console.warn('Modulation to enharmonically different key is not supported. Ignoring.')
      else
        this.enharmonicMajor = fifths;
    }
  }

  parseMeasure(measure: Node) {
    // determine divisions
    const measureDivisions = this.getNumber(measure, 'number(./attributes/divisions)');
    if (!Number.isNaN(measureDivisions))
      this.divisions = measureDivisions;

    // write key to this.enharmonicMajor
    this.parseKey(this.getNode(measure, './attributes/key'));

    // <divisions>: number of divisions of a quarter note as denominator
    const durationUnit = MIN_DIVISION / (4 * this.divisions);
    if (!Number.isInteger(durationUnit)) {
      console.warn(`Minimum division in MusicXML should be a multiple of ${MIN_DIVISION}th beat. Using nearest approximation.`);
    }

    this.getNodes(measure, './*').forEach(step => {
      if (step.nodeName === 'backup' || step.nodeName === 'forward') {
        let numDurationUnits = this.getNumber(step, 'number(./duration)');
        if (step.nodeName === 'backup')
          numDurationUnits = -numDurationUnits;
        const beatOffset = durationUnit * numDurationUnits;
        this.currentBeat += beatOffset;

        // select track that allows starting from current beat
        this.setTrack(this.currentBeat);
        return;
      } else if (step.nodeName !== 'note') {
        return;
      }

      const pitchNode = this.getNode(step, './pitch');
      const restNode = this.getNode(step, './rest');
      const numDurationUnits = this.getNumber(step, 'number(./duration)');
      
      const startsTie = this.getNode(step, './tie[@type="start"]') ? true : false;
      const stopsTie = this.getNode(step, './tie[@type="stop"]') ? true : false;
      const startsSlur = this.getNode(step, './slur[@type="start"]') ? true : false;
      const continuesSlur = this.getNode(step, './slur[@type="continue"]') ? true : false;
      const stopsSlur = this.getNode(step, './slur[@type="stop"]') ? true : false;
      const continuesChord = this.getNode(step, './chord') ? true : false;
      
      let pitch: Pitch;
      if (pitchNode) {
        const step = this.getString(pitchNode, 'string(./step)').toUpperCase();
        const alter = this.getNumber(pitchNode, 'number(./alter)') || 0;
        const octave = this.getNumber(pitchNode, 'number(./octave)');
        const value = stringToMidi(`${step}${octave}`) + alter;
        pitch = midiToPitch(value);
      }

      const numBeats: number = durationUnit * numDurationUnits;
      const bridge: Bridge = stopsTie || continuesSlur || stopsSlur ? Bridge.Slur : Bridge.None;
      const decoration: Decoration = Decoration.None;

      if (this.currentNote && continuesChord) {
        if (pitch != null)
          this.currentNote.chord.push(pitch);
        // MusicXML requires chord's first note to have longest duration
        // If it's not the only duration, use the longest duration
        if (this.currentNote.numBeats !== numBeats)
          console.warn('Chord with different durations is not allowed. Suppressing.');
        if (this.currentNote.bridge === Bridge.None)
          this.currentNote.bridge = bridge;
        if (this.currentNote.decoration === Decoration.None)
          this.currentNote.decoration = decoration;
      } else {
        this.currentNote = {
          chord: pitch != null ? [pitch] : [],
          numBeats,
          bridge,
          decoration
        };
        this.currentTrack.push(this.currentNote);
        this.currentBeat += numBeats;
      }
    });
  }

  /**
   * Compresses this.tracks to minimize its length.
   * Changes note tracks, loses bridge information.
   */
  compressTracks() {
    const allNotes: { beat: number, note: TimedNote }[] = [];
    for (const track of this.tracks) {
      let beat = 0;
      for (const note of track) {
        note.bridge = Bridge.None;
        if (note.chord.length > 0)
          allNotes.push({ beat, note });
        beat += note.numBeats;
      }
    }

    // sort by increasing note onset time
    allNotes.sort(
      ({ beat: b1, note: n1 }, { beat: b2, note: n2 }) => b1 - b2
    );

    this.tracks = [];
    for (const { beat, note } of allNotes) {
      this.setTrack(beat);
      this.currentTrack.push(note);
    }
  }

  /**
   * Parses a MusicXML document.
   * @param source MusicXML source in raw XML string
   * @param compress If true, tries to reduce number of voices
   * @returns Parsed music
   */
  parseMusicXML(source: string, compress: boolean = false): Music {
    this.xml = this.parser.parseFromString(source, 'text/xml');

    if (!this.getNode(this.xml, '/score-partwise')) {
      // transform timewise score to partwise
      this.xml = this.timepartConverter.transformToDocument(this.xml);
    }

    const root = this.getNode(this.xml, '/score-partwise');
    const scoreParts = this.getNodes(root, './part-list/score-part');

    // values to write to
    this.enharmonicMajor = null;
    this.tracks = [];

    scoreParts.forEach((scorePart, i) => {
      const partId = this.getString(scorePart, 'string(./@id)');
      const part = this.getNode(root, `./part[@id="${partId}"]`);
      const measures = this.getNodes(part, './measure');

      // cursors
      this.setTrack(0);
      this.currentNote = null;
  
      // trackers
      this.divisions = null;

      for (const measure of measures)
        this.parseMeasure(measure);
    });

    if (compress)
      this.compressTracks();

    const keySignature = fifthsToKeySignature(this.enharmonicMajor);
    const voices = this.tracks.map(untimeNotes);

    return { keySignature, voices };
  }
}
