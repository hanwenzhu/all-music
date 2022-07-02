import './style.css';
import { musicEnumerable } from './music';
import { Display, VexDisplay } from './display';
import { Player, ToneJSPlayer } from './player';
import { Parser, MusicXMLParser } from './parser';

const form = document.createElement('form');
form.style.display = 'flex';
const input = document.createElement('textarea');
input.style.flexGrow = '1';
input.style.height = '10em';
const prev = document.createElement('input');
prev.type = 'button';
prev.value = '<';
const next = document.createElement('input');
next.type = 'button';
next.value = '>';
const play = document.createElement('input');
play.type = 'button';
play.value = 'Play';
form.appendChild(prev);
form.appendChild(input);
form.appendChild(next);
form.appendChild(play);
document.body.appendChild(form);

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

prev.addEventListener('click', () => {
  input.value = (BigInt(input.value) - 1n).toString();
  render();
});

next.addEventListener('click', () => {
  input.value = (BigInt(input.value) + 1n).toString();
  render();
});

play.addEventListener('click', () => player.toggle());

fetch('/static/musicxml/ievan-polkka.xml')
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
