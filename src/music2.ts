import { Enumerable, Enum, List, equals, Struct, Either } from './enumerable';

export const MIN_DIVISION = 32;
export const MAX_CHORD_SIZE = 6;
export const MAX_NUM_NOTES = 6 * 1024 * 4;
export const MAX_NUM_VOICES = 1;

/** Pitch of a key. */
export enum Pitch {
  Rest,
  C0, 'C#0', D0, 'D#0', E0, F0, 'F#0', G0, 'G#0', A0, 'A#0', B0,
  C1, 'C#1', D1, 'D#1', E1, F1, 'F#1', G1, 'G#1', A1, 'A#1', B1,
  C2, 'C#2', D2, 'D#2', E2, F2, 'F#2', G2, 'G#2', A2, 'A#2', B2,
  C3, 'C#3', D3, 'D#3', E3, F3, 'F#3', G3, 'G#3', A3, 'A#3', B3,
  C4, 'C#4', D4, 'D#4', E4, F4, 'F#4', G4, 'G#4', A4, 'A#4', B4,
  C5, 'C#5', D5, 'D#5', E5, F5, 'F#5', G5, 'G#5', A5, 'A#5', B5,
  C6, 'C#6', D6, 'D#6', E6, F6, 'F#6', G6, 'G#6', A6, 'A#6', B6,
  C7, 'C#7', D7, 'D#7', E7, F7, 'F#7', G7, 'G#7', A7, 'A#7', B7,
  count
}

/**
 * Bridge from left to this note.
 * Slur represents both slurs and ties.
 */
export enum Bridge {
  None,
  Slur,
  count
}

/** Decorations to a chord. */
export enum Decoration {
  None,
  count
}

/** Duration as denominator. */
export enum Duration {
  D1,
  D2,
  D4,
  D8,
  D16,
  D32,
  count
}

/** Key signature in enharmonic major. */
export enum KeySignature {
  C, G, D, A, E, B,
  'F#', Db, Ab, Eb, Bb, F,
  count
}

// export type Chord = Pitch[];

export type Note = {
  duration: Duration,
  pitch: Pitch,
  bridge: Bridge,
  decoration: Decoration
};

export type Note2 = Note | Pitch;

export type Voice = (Note2 | Duration)[];

export type Music = {
  voices: Voice[],
  keySignature: KeySignature
}

// TODO: test if eliminating chord and making it a Bridge.Chord reduces entropy
const pitchEnumerable: Enumerable<Pitch> = new Enum(Pitch);
const bridgeEnumerable: Enumerable<Bridge> = new Enum(Bridge);
// const chordEnumerable: Enumerable<Chord> = new List(pitchEnumerable, MAX_CHORD_SIZE);
const decorationEnumerable: Enumerable<Decoration> = new Enum(Decoration);
const keySignatureEnumerable: Enumerable<KeySignature> = new Enum(KeySignature);
const durationEnumerable: Enumerable<Duration> = new Enum(Duration);
const chordStartEnumerable: Enumerable<Note> = new Struct({
  duration: durationEnumerable,
  pitch: pitchEnumerable,
  bridge: bridgeEnumerable,
  decoration: decorationEnumerable
});
const noteEnumerable: Enumerable<Note2> = new Either<Note, Pitch>(chordStartEnumerable, pitchEnumerable, (x): x is Note => typeof x === 'object');
// number being backup
const stepEnumerable: Enumerable<Note2 | Duration> = new Either<Note2, Duration>(noteEnumerable, durationEnumerable, (x): x is Note2 => true);
const voiceEnumerable: Enumerable<Voice> = new List(stepEnumerable, MAX_NUM_NOTES);
const voicesEnumerable: Enumerable<Voice[]> = new List(voiceEnumerable, MAX_NUM_VOICES);
export const musicEnumerable: Enumerable<Music> = new Struct({
  voices: voicesEnumerable,
  keySignature: keySignatureEnumerable
});

console.log(`Entropy of voice (alt): ${voiceEnumerable.entropy / Math.log(2)} bits`);

export const f = 1;

// /**
//  * Returns MIDI value for the pitch frequency
//  * @param pitch the pitch value
//  */
// export function pitchToMidi(pitch: Pitch): number {
//   return pitch - Pitch.C5 + 60;
// }

// /**
//  * Returns Pitch corresponding to a MIDI frequency value
//  * @param midiValue the MIDI value
//  */
// export function midiToPitch(midiValue: number): Pitch {
//   const pitch = midiValue - 60 + Pitch.C5;
//   if (!/[A-G](bb|b||n|#|##)\d+/.test(Pitch[pitch]))
//     throw new Error(`MIDI value ${midiValue} exceeds Pitch range`);
//   return pitch;
// }

// export function stringToMidi(pitchString: string): number {
//   const match = /([A-G])(bb|b||n|#|##)(\d+)/.exec(pitchString);
//   if (!match)
//     throw new Error(`Pitch string ${pitchString} cannot be parsed`);
//   const [_, noteName, accidental, octave] = match;
//   const semitoneInOctave =
//     noteName === 'A' ? 9 :
//     noteName === 'B' ? 11 :
//     noteName === 'C' ? 0 :
//     noteName === 'D' ? 2 :
//     noteName === 'E' ? 4 :
//     noteName === 'F' ? 5 :
//     noteName === 'G' ? 7 : NaN;
//   const accidentalOffset =
//     accidental === 'bb' ? -2 :
//     accidental === 'b' ? -1 :
//     accidental === '#' ? 1 :
//     accidental === '##' ? 2 : 0;
//   return Number.parseInt(octave) * 12 + semitoneInOctave + accidentalOffset;
// }

// export function stringToPitch(pitchString: string): Pitch {
//   return midiToPitch(stringToMidi(pitchString));
// }

// export function noteNames(chord: Chord): string[] {
//   return chord.filter(pitch => pitch !== Pitch.Rest).map(pitch => Pitch[pitch]);
// }

// const durationBeatsMap: [Duration, number][] = [
//   [Duration.D32, 1],
//   [Duration.D16, 2],
//   [Duration.D8, 4],
//   [Duration.D4, 8],
//   [Duration.D2, 16],
//   [Duration.D1, 32],
// ];

// export function durationToBeats(duration: Duration): number {
//   for (const [duration0, numBeats0] of durationBeatsMap)
//     if (duration === duration0)
//       return numBeats0;
//   throw new Error(`duration key ${duration} not translatable to beats`);
// }

// export function beatsToDuration(numBeats: number): Duration {
//   for (const [duration0, numBeats0] of durationBeatsMap)
//     if (numBeats === numBeats0)
//       return duration0;
//   throw new Error(`numBeats ${numBeats} not translatable to Duration`);
// }

// export type TimedNote = {
//   numBeats: number,
//   chord: Chord,
//   bridge: Bridge,
//   decoration: Decoration
// };

// export function timeNotes(notes: Note[]): TimedNote[] {
//   const timedNotes: TimedNote[] = [];
//   notes = [...notes];

//   while (notes.length > 0) {
//     const { duration, chord, bridge, decoration } = notes.shift();
//     let numBeats = durationToBeats(duration);
//     while (notes.length > 0 && notes[0].bridge === Bridge.Slur &&
//            equals(notes[0].chord, chord) && equals(notes[0].decoration, decoration)) {
//       // a tie implied by slur between equal chords & decorations
//       const note = notes.shift();
//       numBeats += durationToBeats(note.duration);
//     }
//     timedNotes.push({ numBeats, chord, bridge, decoration });
//   }

//   return timedNotes;
// }

// export function untimeNotes(timedNotes: TimedNote[]): Note[] {
//   const notes: Note[] = [];
//   const numBeatsDescending: number[] =
//     durationBeatsMap.map(([_, numBeats]) => numBeats).sort((n, m) => m - n);

//   for (const { numBeats, chord, bridge, decoration } of timedNotes) {
//     let numBeatsLeft = numBeats;
//     let tying = false;
//     for (const durationNumBeats of numBeatsDescending) {
//       while (numBeatsLeft >= durationNumBeats) {
//         numBeatsLeft -= durationNumBeats;
//         notes.push({
//           duration: beatsToDuration(durationNumBeats),
//           chord,
//           bridge: tying ? Bridge.Slur : bridge,
//           decoration
//         });
//         // tie chords that are not rests
//         tying = chord.some(pitch => pitch !== Pitch.Rest);
//       }
//     }
//     if (numBeatsLeft > 0)
//       console.warn(`Duration of timed note more accurate than minimum beat. Truncating.`);
//   }

//   return notes;
// }

// export type TieGroup = {
//   notes: {
//     duration: Duration
//     numDots: number,
//   }[],
//   chord: Chord,
//   bridge: Bridge,
//   decoration: Decoration
// };

// /**
//  * Returns an array of ties, each of which is an array of tied notes.
//  */
// export function dotAndTieNotes(notes: Note[]): TieGroup[] {
//   const tieGroups: TieGroup[] = [];
//   notes = [...notes];

//   while (notes.length > 0) {
//     const { duration, chord, bridge, decoration } = notes.shift();
//     let currentDuration = durationToBeats(duration);
//     let currentNote = { duration, numDots: 0 };
//     const notesInTie = [currentNote];

//     while (notes.length > 0 && notes[0].bridge === Bridge.Slur &&
//            equals(notes[0].chord, chord) && equals(notes[0].decoration, decoration)) {
//       // tie implied by slur between equal chords & decorations
//       const note = notes.shift();
//       if (2 * durationToBeats(note.duration) === currentDuration) {
//         // dot a dottable tie
//         currentNote.numDots++;
//       } else {
//         // add as a separate note to tie
//         currentNote = { duration: note.duration, numDots: 0 };
//         notesInTie.push(currentNote);
//       }
//       currentDuration = durationToBeats(note.duration);
//     }

//     tieGroups.push({ notes: notesInTie, chord, bridge, decoration });
//   }

//   return tieGroups;
// }

// /**
//  * Deletes and returns a given number of beats from the start of a voice.
//  * @param voice Voice to extract from
//  * @param beat Time at which to split
//  * @returns [voice <= beat, voice >= beat]
//  */
// export function extractVoice(voice: Voice, beat: number): Voice {
//   const notesSplit: Voice = [];
  
//   // greedily take notes
//   let numBeats = 0;
//   while (voice.length > 0 &&
//          numBeats + durationToBeats(voice[0].duration) <= beat) {
//     const note = voice.shift();
//     notesSplit.push(note);
//     numBeats += durationToBeats(note.duration);
//   }

//   // split at beat
//   if (voice.length > 0 && numBeats < beat) {
//     const note = voice.shift();
//     const [timedNote] = timeNotes([note]);
//     const timedNoteBeforeBeat = {
//       ...timedNote,
//       numBeats: beat - numBeats
//     };
//     const timedNoteAfterBeat = {
//       ...timedNote,
//       numBeats: timedNote.numBeats - timedNoteBeforeBeat.numBeats,
//       bridge: note.chord.some(pitch => pitch !== Pitch.Rest) ? Bridge.Slur : Bridge.None
//     };

//     notesSplit.push(...untimeNotes([timedNoteBeforeBeat]));
//     voice.unshift(...untimeNotes([timedNoteAfterBeat]));
//   }

//   return notesSplit;
// }

// export function fifthsToKeySignature(fifths: number): KeySignature {
//   fifths = (fifths % 12 + 12) % 12;
//   const keySignature =
//     fifths === 0 ? KeySignature.C :
//     fifths === 1 ? KeySignature.G :
//     fifths === 2 ? KeySignature.D :
//     fifths === 3 ? KeySignature.A :
//     fifths === 4 ? KeySignature.E :
//     fifths === 5 ? KeySignature.B :
//     fifths === 6 ? KeySignature['F#'] :
//     fifths === 7 ? KeySignature.Db :
//     fifths === 8 ? KeySignature.Ab :
//     fifths === 9 ? KeySignature.Eb :
//     fifths === 10 ? KeySignature.Bb :
//     fifths === 11 ? KeySignature.F : NaN;
//   return keySignature;
// }

// export function keySignatureUsesFlat(keySignature: KeySignature): boolean {
//   // NOTE: should add ambivalent enharmonics to KeySignature (esp. F# vs Gb)?
//   return keySignature === KeySignature.Db ||
//          keySignature === KeySignature.Ab ||
//          keySignature === KeySignature.Eb ||
//          keySignature === KeySignature.Bb ||
//          keySignature === KeySignature.F;
// }

// /** Returns number of beats in voice, ignoring trailing rest. */
// export function voiceNumBeats(voice: Voice): number {
//   let end = voice.length - 1;
//   while (end >= 0 && voice[end].chord.every(pitch => pitch === Pitch.Rest))
//     end--;

//   let numBeats = 0;
//   for (let i = 0; i <= end; i++)
//     numBeats += durationToBeats(voice[i].duration);

//   return numBeats;
// }

// /** Returns number of beats in music, ignoring trailing rest. */
// export function musicNumBeats(music: Music): number {
//   return Math.max(...music.voices.map(voiceNumBeats));
// }

// const rest: Chord = new Array<Pitch>(MAX_CHORD_SIZE).fill(Pitch.Rest);
// const c4: Chord = [Pitch.C4];
// const c41: Note = { duration: Duration.D1, chord: c4, bridge: Bridge.None, decoration: Decoration.None };
// const c42: Note = { duration: Duration.D2, chord: c4, bridge: Bridge.Slur, decoration: Decoration.None };
// const c0: Chord = [Pitch.C0];
// const c01: Note = { duration: Duration.D1, chord: c0, bridge: Bridge.None, decoration: Decoration.None };
// const c02: Note = { duration: Duration.D2, chord: c0, bridge: Bridge.Slur, decoration: Decoration.None };
// const cx4: Chord = [Pitch['C#4']];
// const cx41: Note = { duration: Duration.D1, chord: cx4, bridge: Bridge.None, decoration: Decoration.None };
// const cx42: Note = { duration: Duration.D2, chord: cx4, bridge: Bridge.Slur, decoration: Decoration.None };
// const restNote: Note = { duration: Duration.D4, chord: rest, bridge: Bridge.Slur, decoration: Decoration.None };
// const piece: Voice = [c41, c42, c42, cx42, cx41, ...new Array(10).fill(restNote)];
// console.log(dotAndTieNotes(piece));
// console.log(voiceEnumerable.encode(piece));
