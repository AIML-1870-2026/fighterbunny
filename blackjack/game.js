'use strict';

// ============================================================
// STATE
// ============================================================

const state = {
  deck: [],
  playerHand: [],
  dealerHand: [],
  balance: 1000,
  bet: 25,
  // 'betting' | 'player' | 'dealer' | 'done'
  phase: 'betting',
  firstAction: true,   // can double this action?
  stats: {
    rounds: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    biggestWin: 0,
    streak: 0,
    streakType: null,  // 'win' | 'loss' | null
    netGain: 0
  },
  history: [],
  muted: false,
  roundNum: 0,
  hintTimer: null
};

// ============================================================
// DECK UTILITIES
// ============================================================

const SUITS = ['♥', '♦', '♠', '♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handTotal(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === 'A')                          { aces++;  total += 11; }
    else if (['J','Q','K'].includes(c.rank))     { total += 10; }
    else                                         { total += parseInt(c.rank); }
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isSoftHand(hand) {
  let total = 0, aces = 0;
  for (const c of hand) {
    if (c.rank === 'A')                        { aces++; total += 11; }
    else if (['J','Q','K'].includes(c.rank))   { total += 10; }
    else                                       { total += parseInt(c.rank); }
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return aces > 0; // at least one ace still counted as 11
}

function cardRankValue(card) {
  if (card.rank === 'A') return 11;
  if (['J','Q','K'].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

function isBlackjack(hand) {
  return hand.length === 2 && handTotal(hand) === 21;
}

// ============================================================
// AUDIO (Web Audio API procedural sounds)
// ============================================================

let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  return _audioCtx;
}

function playTone(freq, dur, type = 'sine', vol = 0.22) {
  if (state.muted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch (e) {}
}

function playSound(type) {
  if (state.muted) return;
  // Resume suspended context (needed on some browsers after first user gesture)
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();

  switch (type) {
    case 'card':
      playTone(880, 0.08, 'sine',     0.12);
      break;
    case 'chip':
      playTone(600, 0.12, 'triangle', 0.18);
      setTimeout(() => playTone(720, 0.09, 'triangle', 0.14), 90);
      break;
    case 'button':
      playTone(1000, 0.05, 'sine',    0.10);
      break;
    case 'win':
      [523, 659, 784].forEach((f, i) =>
        setTimeout(() => playTone(f, 0.22, 'sine', 0.28), i * 180));
      break;
    case 'blackjack':
      [523, 659, 784, 1046].forEach((f, i) =>
        setTimeout(() => playTone(f, 0.24, 'sine', 0.32), i * 140));
      break;
    case 'lose':
      [400, 350, 300].forEach((f, i) =>
        setTimeout(() => playTone(f, 0.2, 'sawtooth', 0.18), i * 200));
      break;
    case 'push':
      playTone(440, 0.3, 'sine', 0.18);
      break;
  }
}

// ============================================================
// CARD ELEMENT CREATION
// ============================================================

function suitColor(suit) {
  return (suit === '♥' || suit === '♦') ? '#F48FB1' : '#C2185B';
}

function createCardEl(card, faceDown = true) {
  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.setAttribute('aria-label', faceDown
    ? 'Face-down card'
    : `${card.rank} of ${card.suit}`);

  const inner = document.createElement('div');
  inner.className = 'card-inner';

  // Back
  const back = document.createElement('div');
  back.className = 'card-back';
  inner.appendChild(back);

  // Front
  const front = document.createElement('div');
  front.className = 'card-front';
  const color = suitColor(card.suit);
  front.innerHTML = `
    <div class="card-corner top-left" style="color:${color}">
      <div class="card-rank">${card.rank}</div>
      <div class="card-suit-corner">${card.suit}</div>
    </div>
    <div class="card-center" style="color:${color}">${card.suit}</div>
    <div class="card-corner bottom-right" style="color:${color}">
      <div class="card-rank">${card.rank}</div>
      <div class="card-suit-corner">${card.suit}</div>
    </div>
  `;
  inner.appendChild(front);
  wrap.appendChild(inner);

  if (!faceDown) wrap.classList.add('flipped');
  return wrap;
}

// ============================================================
// ANIMATED CARD DEAL
// ============================================================

function dealCard(container, card, faceDown, delay) {
  return new Promise(resolve => {
    setTimeout(() => {
      const el = createCardEl(card, true);
      el.classList.add('dealing');
      container.appendChild(el);

      playSound('card');

      // Slide completes at ~300 ms
      setTimeout(() => {
        el.classList.remove('dealing');
        if (!faceDown) {
          // Small pause then flip
          setTimeout(() => {
            el.classList.add('flipped');
            setTimeout(resolve, 420); // wait for flip transition
          }, 80);
        } else {
          resolve();
        }
      }, 300);
    }, delay);
  });
}

function flipDealerHiddenCard() {
  return new Promise(resolve => {
    const cards = document.getElementById('dealer-hand').querySelectorAll('.card');
    const hidden = cards[1]; // second card was dealt face-down
    if (hidden && !hidden.classList.contains('flipped')) {
      playSound('card');
      hidden.classList.add('flipped');
    }
    setTimeout(resolve, 450);
  });
}

// ============================================================
// SCORE CHIP HELPERS
// ============================================================

function setScoreChip(who, hand, showAll) {
  const el = document.getElementById(who + '-score');
  if (!hand || hand.length === 0) {
    el.className = 'score-chip';
    el.textContent = '';
    return;
  }
  const visibleHand = (who === 'dealer' && !showAll) ? [hand[0]] : hand;
  const total = handTotal(visibleHand);
  el.textContent = (who === 'dealer' && !showAll) ? total : (total > 21 ? total + ' BUST' : total);
  el.className = 'score-chip show' + (total > 21 ? ' bust' : '');
}

// ============================================================
// BUTTON STATE MANAGEMENT
// ============================================================

function setBtn(id, enabled) {
  const btn = document.getElementById(id);
  btn.disabled = !enabled;
  btn.setAttribute('aria-disabled', String(!enabled));
  if (!enabled) btn.setAttribute('tabindex', '-1');
  else          btn.removeAttribute('tabindex');
}

function setBetControls(enabled) {
  document.getElementById('btn-bet-minus').disabled = !enabled;
  document.getElementById('btn-bet-plus').disabled  = !enabled;
  document.getElementById('custom-bet').disabled     = !enabled;
}

function applyButtonStates() {
  const p = state.phase;
  const fa = state.firstAction;
  const canAffordDouble = state.bet <= state.balance; // balance already minus initial bet

  switch (p) {
    case 'betting':
      setBtn('btn-deal',   true);
      setBtn('btn-hit',    false);
      setBtn('btn-stand',  false);
      setBtn('btn-double', false);
      setBtn('btn-hint',   false);
      setBetControls(true);
      document.getElementById('btn-deal').textContent = 'DEAL [D]';
      document.getElementById('btn-deal').classList.remove('glow-pulse');
      break;

    case 'player':
      setBtn('btn-deal',   false);
      setBtn('btn-hit',    true);
      setBtn('btn-stand',  true);
      setBtn('btn-double', fa && canAffordDouble);
      setBtn('btn-hint',   true);
      setBetControls(false);
      break;

    case 'dealer':
      setBtn('btn-deal',   false);
      setBtn('btn-hit',    false);
      setBtn('btn-stand',  false);
      setBtn('btn-double', false);
      setBtn('btn-hint',   false);
      setBetControls(false);
      break;

    case 'done':
      setBtn('btn-deal',   true);
      setBtn('btn-hit',    false);
      setBtn('btn-stand',  false);
      setBtn('btn-double', false);
      setBtn('btn-hint',   false);
      setBetControls(true);
      document.getElementById('btn-deal').textContent = 'NEW ROUND [D]';
      document.getElementById('btn-deal').classList.add('glow-pulse');
      break;
  }
}

// ============================================================
// BET DISPLAY HELPERS
// ============================================================

function updateBetDisplay() {
  document.getElementById('bet-display').textContent = '$' + state.bet;
}

function updateBalanceDisplay() {
  document.getElementById('balance').textContent = '$' + state.balance.toLocaleString();
}

// ============================================================
// QUICK STATS BAR
// ============================================================

function updateQuickStats() {
  const { stats } = state;
  document.getElementById('balance').textContent = '$' + state.balance.toLocaleString();

  const winPct = stats.rounds > 0
    ? Math.round((stats.wins / stats.rounds) * 100) + '%'
    : '—';
  document.getElementById('win-pct').textContent = winPct;
  document.getElementById('biggest-win').textContent =
    stats.biggestWin > 0 ? '$' + stats.biggestWin : '—';

  let streak = '—';
  if (stats.streak > 0 && stats.streakType) {
    streak = stats.streakType === 'win'
      ? '🔥' + stats.streak
      : '❄️' + stats.streak;
  }
  document.getElementById('streak-display').textContent = streak;
}

// ============================================================
// STATS PANEL
// ============================================================

function updateStatsPanel() {
  const { stats } = state;
  document.getElementById('stat-rounds').textContent  = stats.rounds;
  document.getElementById('stat-winrate').textContent =
    stats.rounds > 0 ? Math.round((stats.wins / stats.rounds) * 100) + '%' : '—';
  document.getElementById('stat-biggest').textContent =
    stats.biggestWin > 0 ? '$' + stats.biggestWin : '—';

  const netEl = document.getElementById('stat-net');
  const net = stats.netGain;
  netEl.textContent = (net >= 0 ? '+' : '') + '$' + Math.abs(net);
  netEl.style.color = net >= 0 ? 'var(--gold)' : '#FF6B9D';
}

// ============================================================
// HINT SYSTEM (Basic Strategy)
// ============================================================

function getBasicStrategyHint() {
  const playerTotal = handTotal(state.playerHand);
  const soft        = isSoftHand(state.playerHand);
  const dealerUp    = cardRankValue(state.dealerHand[0]);

  if (soft) {
    if (playerTotal >= 19)                             return 'Stand';
    if (playerTotal === 18) {
      if (dealerUp >= 2 && dealerUp <= 6)              return 'Double (or Stand)';
      if (dealerUp >= 7 && dealerUp <= 8)              return 'Stand';
      return 'Hit';
    }
    if (playerTotal === 17) {
      if (dealerUp >= 3 && dealerUp <= 6)              return 'Double (or Hit)';
      return 'Hit';
    }
    if (playerTotal >= 15 && playerTotal <= 16) {
      if (dealerUp >= 4 && dealerUp <= 6)              return 'Double (or Hit)';
      return 'Hit';
    }
    if (playerTotal >= 13 && playerTotal <= 14) {
      if (dealerUp >= 5 && dealerUp <= 6)              return 'Double (or Hit)';
      return 'Hit';
    }
    return 'Hit';
  }

  // Hard totals
  if (playerTotal >= 17)                               return 'Stand';
  if (playerTotal >= 13 && playerTotal <= 16) {
    if (dealerUp >= 2 && dealerUp <= 6)                return 'Stand';
    return 'Hit';
  }
  if (playerTotal === 12) {
    if (dealerUp >= 4 && dealerUp <= 6)                return 'Stand';
    return 'Hit';
  }
  if (playerTotal === 11) {
    if (dealerUp >= 2 && dealerUp <= 10)               return 'Double (or Hit)';
    return 'Hit';
  }
  if (playerTotal === 10) {
    if (dealerUp >= 2 && dealerUp <= 9)                return 'Double (or Hit)';
    return 'Hit';
  }
  if (playerTotal === 9) {
    if (dealerUp >= 3 && dealerUp <= 6)                return 'Double (or Hit)';
    return 'Hit';
  }
  return 'Hit';
}

function showHint() {
  if (state.phase !== 'player') return;
  const hint = getBasicStrategyHint();
  const bubble = document.getElementById('hint-bubble');
  bubble.textContent = '💡 ' + hint;
  bubble.classList.add('show');
  clearTimeout(state.hintTimer);
  state.hintTimer = setTimeout(hideHint, 4000);
}

function hideHint() {
  document.getElementById('hint-bubble').classList.remove('show');
  clearTimeout(state.hintTimer);
}

// ============================================================
// CELEBRATIONS & ANIMATIONS
// ============================================================

function showWinCelebration(isBigWin, isBlackjack) {
  const container = document.createElement('div');
  container.className = 'celebration-container';

  const flash = document.createElement('div');
  flash.className = 'win-flash';
  container.appendChild(flash);

  const count  = isBlackjack ? 45 : isBigWin ? 30 : 20;
  const emojis = isBlackjack ? ['🪙','💵','✨','💖','⭐'] : ['🪙','💵'];

  for (let i = 0; i < count; i++) {
    const item = document.createElement('span');
    item.className = 'falling-item';
    item.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    item.style.left             = Math.random() * 100 + 'vw';
    item.style.animationDelay   = (Math.random() * 1.5) + 's';
    item.style.animationDuration= (2 + Math.random() * 1.5) + 's';
    item.style.fontSize         = (1.4 + Math.random() * 1.4) + 'rem';
    container.appendChild(item);
  }

  document.body.appendChild(container);
  setTimeout(() => container.remove(), 4500);
}

function showLoseAnimation() {
  document.body.classList.add('lose-flash');
  setTimeout(() => document.body.classList.remove('lose-flash'), 700);

  const hand = document.getElementById('player-hand');
  hand.classList.add('shake');
  setTimeout(() => hand.classList.remove('shake'), 600);
}

// ============================================================
// ENCOURAGEMENT MESSAGES
// ============================================================

function showEncouragement(result, netGain) {
  const { stats } = state;
  let msg = '';

  if (result === 'blackjack') {
    msg = '🌟 Blackjack! You\'re incredible!';
  } else if (result === 'win') {
    if (netGain >= state.bet) {
      msg = '✨ BIG WIN! You\'re amazing! 🎰';
    } else if (stats.streak >= 3 && stats.streakType === 'win') {
      msg = '🔥 You\'re on fire! Keep it up!';
    } else {
      msg = '💖 Nice win! The table loves you!';
    }
  } else if (result === 'bust') {
    msg = 'Oops! The cards were sneaky this time 🃏';
  } else if (result === 'lose') {
    if (stats.streak >= 3 && stats.streakType === 'loss') {
      msg = 'You\'re so close — the cards are about to turn! 🌸';
    } else {
      msg = '💔 So close! Better luck next round!';
    }
  } else if (result === 'push') {
    msg = 'Almost! Try again! 💖';
  }

  const el = document.getElementById('encouragement');
  el.textContent = msg;
}

// ============================================================
// BETTING HISTORY
// ============================================================

const MAX_VISIBLE = 20;
let showingAll = false;

function addHistoryEntry(result, netGain) {
  state.history.unshift({
    round:   state.roundNum,
    bet:     state.bet,
    result:  result.toUpperCase(),
    net:     netGain,
    balance: state.balance
  });
  renderHistory();
}

function renderHistory() {
  const list    = document.getElementById('history-list');
  const moreBtn = document.getElementById('btn-show-more');
  const entries = showingAll ? state.history : state.history.slice(0, MAX_VISIBLE);

  list.innerHTML = entries.map(e => {
    const isWin  = e.result === 'WIN' || e.result === 'BLACKJACK';
    const isLose = e.result === 'LOSE' || e.result === 'LOSS' || e.result === 'BUST';
    const cls    = isWin ? 'history-win' : isLose ? 'history-lose' : 'history-push';
    const netStr = (e.net >= 0 ? '+' : '') + '$' + Math.abs(e.net);
    return `<div class="history-entry ${cls}">
      Round ${e.round} | Bet: $${e.bet} | ${e.result} | Net: ${netStr} | Balance: $${e.balance.toLocaleString()}
    </div>`;
  }).join('');

  if (state.history.length > MAX_VISIBLE) {
    moreBtn.classList.remove('hidden');
    moreBtn.textContent = showingAll
      ? 'Show Less'
      : `Show More (${state.history.length - MAX_VISIBLE} more)`;
  } else {
    moreBtn.classList.add('hidden');
  }
}

// ============================================================
// RESULT BANNER
// ============================================================

function showResultBanner(text, type) {
  const el = document.getElementById('result-banner');
  el.textContent = text;
  el.className = `result-banner result-${type} visible`;
}

function clearResultBanner() {
  const el = document.getElementById('result-banner');
  el.className = 'result-banner';
  el.textContent = '';
}

// ============================================================
// BROKE STATE
// ============================================================

function handleBrokeState() {
  showResultBanner("You're out of chips! 💸", 'lose');
  setTimeout(() => {
    if (confirm("You're out of chips!\nReset balance to $1,000?")) {
      state.balance = 1000;
      state.bet     = Math.min(25, state.balance);
      state.phase   = 'betting';
      updateBetDisplay();
      updateBalanceDisplay();
      updateQuickStats();
      applyButtonStates();
      clearResultBanner();
    }
  }, 600);
}

// ============================================================
// ROUND RESOLUTION
// ============================================================

async function endRound(result) {
  state.phase = 'done';
  applyButtonStates();

  // Ensure dealer score is fully visible
  setScoreChip('dealer', state.dealerHand, true);

  let netGain = 0;

  switch (result) {
    case 'blackjack':
      netGain         = Math.ceil(state.bet * 1.5);
      state.balance  += state.bet + netGain;
      showResultBanner(`💖 Blackjack! +$${netGain}`, 'win');
      playSound('blackjack');
      showWinCelebration(true, true);
      break;

    case 'win':
      netGain         = state.bet;
      state.balance  += state.bet * 2;
      showResultBanner(`💖 You Win! +$${netGain}`, 'win');
      playSound('win');
      showWinCelebration(netGain >= state.bet * 2, false);
      break;

    case 'bust':
      netGain = -state.bet;
      showResultBanner(`💔 Bust! -$${state.bet}`, 'lose');
      playSound('lose');
      showLoseAnimation();
      break;

    case 'lose':
      netGain = -state.bet;
      showResultBanner(`💔 You Lose! -$${state.bet}`, 'lose');
      playSound('lose');
      showLoseAnimation();
      break;

    case 'push':
      netGain         = 0;
      state.balance  += state.bet;
      showResultBanner('🤝 Push — Bet Returned!', 'push');
      playSound('push');
      break;
  }

  // Update statistics
  const { stats } = state;
  stats.rounds++;
  stats.netGain += netGain;

  if (result === 'win' || result === 'blackjack') {
    stats.wins++;
    if (stats.streakType === 'win') { stats.streak++; }
    else { stats.streakType = 'win'; stats.streak = 1; }
    if (netGain > stats.biggestWin) stats.biggestWin = netGain;
  } else if (result === 'lose' || result === 'bust') {
    stats.losses++;
    if (stats.streakType === 'loss') { stats.streak++; }
    else { stats.streakType = 'loss'; stats.streak = 1; }
  } else {
    stats.pushes++;
    stats.streak     = 0;
    stats.streakType = null;
  }

  showEncouragement(result, netGain);
  addHistoryEntry(result, netGain);
  updateQuickStats();
  updateStatsPanel();

  // Check broke
  if (state.balance < 5) {
    setTimeout(handleBrokeState, 1800);
  }
}

// ============================================================
// DEALER TURN
// ============================================================

async function dealerTurn() {
  state.phase = 'dealer';
  applyButtonStates();

  await flipDealerHiddenCard();
  setScoreChip('dealer', state.dealerHand, true);

  await sleep(300);

  while (handTotal(state.dealerHand) < 17) {
    await sleep(480);
    const card = state.deck.pop();
    state.dealerHand.push(card);
    await dealCard(document.getElementById('dealer-hand'), card, false, 0);
    setScoreChip('dealer', state.dealerHand, true);
  }

  await sleep(300);

  const playerTotal = handTotal(state.playerHand);
  const dealerTotal = handTotal(state.dealerHand);

  if (dealerTotal > 21)               await endRound('win');
  else if (playerTotal > dealerTotal) await endRound('win');
  else if (dealerTotal > playerTotal) await endRound('lose');
  else                                await endRound('push');
}

// ============================================================
// PLAYER ACTIONS
// ============================================================

async function playerHit() {
  if (state.phase !== 'player') return;
  playSound('button');
  hideHint();
  state.firstAction = false;
  applyButtonStates();

  const card = state.deck.pop();
  state.playerHand.push(card);
  await dealCard(document.getElementById('player-hand'), card, false, 0);
  setScoreChip('player', state.playerHand, true);

  const total = handTotal(state.playerHand);
  if (total > 21) {
    await endRound('bust');
  } else if (total === 21) {
    await dealerTurn(); // auto-stand at 21
  }
}

async function playerStand() {
  if (state.phase !== 'player') return;
  playSound('button');
  hideHint();
  await dealerTurn();
}

async function playerDouble() {
  if (state.phase !== 'player' || !state.firstAction) return;
  if (state.bet > state.balance) return;

  playSound('chip');
  hideHint();

  state.balance -= state.bet;
  state.bet     *= 2;
  updateBetDisplay();
  updateBalanceDisplay();

  state.firstAction = false;
  applyButtonStates();

  const card = state.deck.pop();
  state.playerHand.push(card);
  await dealCard(document.getElementById('player-hand'), card, false, 0);
  setScoreChip('player', state.playerHand, true);

  const total = handTotal(state.playerHand);
  if (total > 21) {
    await endRound('bust');
  } else {
    await dealerTurn();
  }
}

// ============================================================
// ROUND START
// ============================================================

async function startRound() {
  if (state.phase !== 'betting' && state.phase !== 'done') return;

  // Guard: insufficient balance
  if (state.balance < 5) { handleBrokeState(); return; }

  // Cap bet at balance
  if (state.bet > state.balance) state.bet = state.balance;
  if (state.bet < 5)             state.bet = 5;

  playSound('chip');

  // Deduct initial bet
  state.balance -= state.bet;
  state.roundNum++;

  // Reset UI
  clearResultBanner();
  document.getElementById('encouragement').textContent = '';
  document.getElementById('player-hand').innerHTML = '';
  document.getElementById('dealer-hand').innerHTML = '';
  setScoreChip('player', [], true);
  setScoreChip('dealer', [], true);
  hideHint();

  state.playerHand = [];
  state.dealerHand = [];
  state.firstAction = true;
  state.phase = 'dealer'; // disable buttons during dealing
  applyButtonStates();
  updateBetDisplay();
  updateBalanceDisplay();

  // Fresh shuffled deck
  state.deck = shuffle(createDeck());

  // Draw cards: p1, d1, p2, d2
  const p1 = state.deck.pop();
  const d1 = state.deck.pop();
  const p2 = state.deck.pop();
  const d2 = state.deck.pop();
  state.playerHand.push(p1, p2);
  state.dealerHand.push(d1, d2);

  const ph = document.getElementById('player-hand');
  const dh = document.getElementById('dealer-hand');

  await dealCard(ph, p1, false, 0);
  await dealCard(dh, d1, false, 0);
  await dealCard(ph, p2, false, 0);
  await dealCard(dh, d2, true,  0); // d2 stays face-down

  setScoreChip('player', state.playerHand, true);
  setScoreChip('dealer', state.dealerHand, false); // show only visible card

  // Check for blackjack
  if (isBlackjack(state.playerHand)) {
    state.phase = 'player';
    if (isBlackjack(state.dealerHand)) {
      await endRound('push');
    } else {
      await endRound('blackjack');
    }
    return;
  }

  state.phase = 'player';
  applyButtonStates();
}

// ============================================================
// UTILITY
// ============================================================

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// VIEW SWITCHING
// ============================================================

function showView(view) {
  document.getElementById('game-view').classList.toggle('hidden', view !== 'game');
  document.getElementById('about-view').classList.toggle('hidden', view !== 'about');
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', e => {
  // Skip if typing in the custom bet input
  if (document.activeElement === document.getElementById('custom-bet')) return;
  // Skip if on about page
  if (!document.getElementById('about-view').classList.contains('hidden')) return;

  switch (e.key.toLowerCase()) {
    case 'h': if (state.phase === 'player') playerHit();                         break;
    case 's': if (state.phase === 'player') playerStand();                       break;
    case 'd':
      if (state.phase === 'betting' || state.phase === 'done') startRound();
      break;
    case 'm': document.getElementById('mute-btn').click();                       break;
  }
});

// ============================================================
// EVENT LISTENERS — INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // Navigation
  document.getElementById('nav-about').addEventListener('click', () => showView('about'));
  document.getElementById('btn-back').addEventListener('click',  () => showView('game'));

  // Mute toggle
  document.getElementById('mute-btn').addEventListener('click', () => {
    state.muted = !state.muted;
    document.getElementById('mute-btn').textContent = state.muted ? '🔇' : '🔊';
    // Resume audio context on first user gesture
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  });

  // Bet minus
  document.getElementById('btn-bet-minus').addEventListener('click', () => {
    if (state.phase !== 'betting' && state.phase !== 'done') return;
    state.bet = Math.max(5, state.bet - 25);
    document.getElementById('custom-bet').value = '';
    updateBetDisplay();
    playSound('button');
  });

  // Bet plus
  document.getElementById('btn-bet-plus').addEventListener('click', () => {
    if (state.phase !== 'betting' && state.phase !== 'done') return;
    state.bet = Math.min(state.balance, state.bet + 25);
    document.getElementById('custom-bet').value = '';
    updateBetDisplay();
    playSound('button');
  });

  // Custom bet input
  document.getElementById('custom-bet').addEventListener('change', e => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 5 && val <= state.balance) {
      state.bet = val;
      updateBetDisplay();
    }
    e.target.value = '';
  });

  // Game action buttons
  document.getElementById('btn-deal').addEventListener('click',   startRound);
  document.getElementById('btn-hit').addEventListener('click',    playerHit);
  document.getElementById('btn-stand').addEventListener('click',  playerStand);
  document.getElementById('btn-double').addEventListener('click', playerDouble);
  document.getElementById('btn-hint').addEventListener('click',   showHint);

  // Reset stats
  document.getElementById('btn-reset-stats').addEventListener('click', () => {
    state.stats = {
      rounds: 0, wins: 0, losses: 0, pushes: 0,
      biggestWin: 0, streak: 0, streakType: null, netGain: 0
    };
    state.history  = [];
    state.roundNum = 0;
    showingAll     = false;
    renderHistory();
    updateQuickStats();
    updateStatsPanel();
  });

  // Show more history
  document.getElementById('btn-show-more').addEventListener('click', () => {
    showingAll = !showingAll;
    renderHistory();
  });

  // Initial render
  updateBetDisplay();
  updateBalanceDisplay();
  updateQuickStats();
  updateStatsPanel();
  applyButtonStates();
});
