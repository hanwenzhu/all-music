import './style.sass';
import { musicEnumerable } from './music';
import { Display, VexDisplay } from './display';
import { Player, ToneJSPlayer } from './player';
import { Parser, MusicXMLParser } from './parser';

var page = 0n;

const sheetDisplay = document.getElementById('sheet-display');
const pageNumber = document.getElementById('page-number');
const play = document.getElementById('play');
const goto = document.getElementById('goto');
const navigator = document.getElementById('navigator');
const numberInput = document.getElementById('number-input') as HTMLTextAreaElement;
const uploadInput = document.getElementById('upload-input') as HTMLInputElement;

const display: Display = new VexDisplay();
const player: Player = new ToneJSPlayer();
const parser: Parser = new MusicXMLParser();
player.setup(document.body);
display.setup(sheetDisplay);

function ellipsize(string: string, maxWidth: number = 30): string {
  if (string.length > maxWidth) {
    return string.substring(0, 10) + '...' + string.substring(string.length - 17);
  } else {
    return string;
  }
}

function render() {
  const value = musicEnumerable.decode(page);
  const encoded = musicEnumerable.encode(value);
  pageNumber.innerText = ellipsize(page.toString());
  display.render(value);
  console.log('Rendering', value);
  console.assert(page === encoded);
  console.log('Render complete');
}

function toggleNavigator() {
  numberInput.value = page.toString();
  numberInput.parentElement.dataset.replicatedValue = numberInput.value;
  navigator.classList.toggle('expanded');
}

numberInput.addEventListener('input', event => {
  if (/[^0-9]/g.test(numberInput.value)) {
    numberInput.value = page.toString();
    return false;
  }
  numberInput.parentElement.dataset.replicatedValue = numberInput.value;
  page = BigInt(numberInput.value);
  render();
});

uploadInput.addEventListener('change', async event => {
  if (uploadInput.files.length === 0)
    return;
  
  const file = uploadInput.files[0];
  loadMusic(file.name.endsWith('.musicxml') ? await file.text() : file);
});

var playing = false;
play.addEventListener('click', () => {
  playing = !playing;
  if (playing) {
    const value = musicEnumerable.decode(page);
    player.load(value);
    player.start();
    play.innerText = 'Stop';
  } else {
    player.stop();
    play.innerText = 'Play';
  }
});

goto.addEventListener('click', toggleNavigator);

async function loadMusic(source: string | File) {
  const music = await parser.parse(source);
  console.log('Loaded music', music);
  const encoding = musicEnumerable.encode(music);
  page = encoding;
  numberInput.value = page.toString();
  numberInput.parentElement.dataset.replicatedValue = numberInput.value;
  render();
}

fetch('/static/musicxml/SchbAvMaSample.musicxml')
  .then(response => response.text())
  .then(loadMusic);
