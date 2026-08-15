import { Game } from './core/Game.js';

const game = new Game(document.querySelector('#game'));
game.start().catch((error) => {
  console.error(error);
  document.querySelector('#loading').classList.add('hidden');
  document.querySelector('#error').classList.remove('hidden');
  document.querySelector('#errorText').textContent = error?.message || String(error);
});
