import './style.sass';
import { musicEnumerable } from './music';
import { Display, VexDisplay } from './display';
import { Player, ToneJSPlayer } from './player';
import { Parser, MusicXMLParser } from './parser';

document.body.innerHTML += `
  <form id="opus">
    <div id="previous">〈</div>
    <div id="opus-number">
      <label id="opus-label" for="opus-input">Opus</label>
      <textarea id="opus-input"></textarea>
    </div>
    <div id="next">〉</div>
  </form>
  <div id="media-buttons">
    <span id="play">Play</span>
  </div>
`;

const form = document.getElementById('opus');
const input = document.getElementById('opus-input') as HTMLTextAreaElement;
const previous = document.getElementById('previous');
const next = document.getElementById('next')
const play = document.getElementById('play');

const display: Display = new VexDisplay();
const player: Player = new ToneJSPlayer();
const parser: Parser = new MusicXMLParser();
player.setup(document.body);
display.setup(document.body);

function render() {
  const code = BigInt(input.value);
  const value = musicEnumerable.decode(code);
  const encoded = musicEnumerable.encode(value);
  display.render(value);
  player.load(value);
  console.log(value);
  console.log(code, encoded);
  console.assert(code === encoded);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});

input.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    render();
  }
})

previous.addEventListener('click', () => {
  input.value = (BigInt(input.value) - 1n).toString();
  render();
});

next.addEventListener('click', () => {
  input.value = (BigInt(input.value) + 1n).toString();
  render();
});

play.addEventListener('click', () => player.toggle());

fetch('/static/musicxml/MozartPianoSonata.musicxml')
  .then(response => response.text())
  .then(source => {
    const music = parser.parseMusicXML(source);
    console.log(music);
    console.log(`${music.voices.length} voices found.`);
    // music.voices = [music.voices[Number(window.prompt('Select track'))]];
    const encoding = musicEnumerable.encode(music);
    input.value = encoding.toString();
    render();
  });
