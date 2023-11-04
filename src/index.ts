import './style.sass';
import { musicEnumerable } from './music';
import { Display, VexDisplay } from './display';
import { Player, ToneJSPlayer } from './player';
import { Parser, MusicXMLParser } from './parser';

var page = 0n;

const sheetDisplay = document.getElementById('sheet-display');
const play = document.getElementById('play');
const pageInput = document.getElementById('page-input') as HTMLTextAreaElement;
const uploadInput = document.getElementById('upload-input') as HTMLInputElement;
const pagePrev = document.getElementById('page-prev');
const pageNext = document.getElementById('page-next');

const display: Display = new VexDisplay();
const player: Player = new ToneJSPlayer();
const parser: Parser = new MusicXMLParser();
player.setup(document.body);
display.setup(sheetDisplay);

var playing = false;
function startPlayer() {
  playing = true;
  player.start();
  play.innerText = 'Stop';
}
function stopPlayer() {
  playing = false;
  player.stop();
  play.innerText = 'Play'
}

function render() {
  const value = musicEnumerable.decode(page);
  stopPlayer();
  console.log('Rendering', value);
  display.render(value);
  pageInput.value = page.toString();
  const encoded = musicEnumerable.encode(value);
  console.assert(page === encoded);
  console.log('Render complete');
}

pageInput.addEventListener('input', event => {
  if (/[^0-9]/g.test(pageInput.value)) {
    pageInput.value = page.toString();
    return false;
  }
  page = BigInt(pageInput.value);
  render();
});

uploadInput.addEventListener('change', async () => {
  if (uploadInput.files.length === 0)
    return;
  const file = uploadInput.files[0];
  loadMusic(file.name.endsWith('.musicxml') ? await file.text() : file);
});

pagePrev.addEventListener('click', () => {
  if (page === 0n)
    return;
  page--;
  render();
});

pageNext.addEventListener('click', () => {
  if (page === 0n)
    return;
  page++;
  render();
});

play.addEventListener('click', () => {
  if (!playing) {
    const value = musicEnumerable.decode(page);
    player.load(value);
    startPlayer();
  } else {
    stopPlayer();
  }
});

async function loadMusic(source: string | File) {
  const music = await parser.parse(source);
  console.log('Loaded music', music);
  const encoding = musicEnumerable.encode(music);
  page = encoding;
  pageInput.value = page.toString();
  render();
}

page = BigInt(Math.floor(Math.random() * 1e10)) << 1000n + BigInt(Math.floor(Math.random() * 1000));
render();
