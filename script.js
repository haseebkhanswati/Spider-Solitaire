const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
let deck = [];
let piles = Array.from({ length: 10 }, () => []);
let gameHistory = [];
let moves = 0;
let score = 0;
let startTime = Date.now();
let timerInterval = null;
let difficulty = 'medium';
let selected = null;
let hintCards = [];
let lastHintMove = null;
let shownHints = [];
let isPaused = false;
let totalPausedTime = 0;
let pauseStartTime = 0;

function createAndShuffleDeck() {
  deck = [];
  
  for (let i = 0; i < 8; i++) {
    for (let r of RANKS) {
      deck.push({ rank: r, suit: "♠", faceUp: false, id: `${r}_${i}` });
    }
  }
  
  // Better distribution shuffle
  for (let shuffle = 0; shuffle < 10; shuffle++) {
    for (let i = deck.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  
  // Ensure playable distribution by spreading high cards
  let highCards = deck.filter(c => ['K', 'Q', 'J'].includes(c.rank));
  let otherCards = deck.filter(c => !['K', 'Q', 'J'].includes(c.rank));
  
  deck = [];
  for (let i = 0; i < Math.max(highCards.length, otherCards.length); i++) {
    if (i < otherCards.length) deck.push(otherCards[i]);
    if (i < highCards.length) deck.push(highCards[i]);
  }
  
  // Final shuffle to randomize while maintaining distribution
  for (let i = 0; i < 3; i++) {
    for (let j = deck.length - 1; j > 0; j--) {
      let k = Math.floor(Math.random() * (j + 1));
      [deck[j], deck[k]] = [deck[k], deck[j]];
    }
  }
}

function setDifficulty(level) {
  difficulty = level;
  document.getElementById('difficulty').textContent = level.charAt(0).toUpperCase() + level.slice(1);
  
  document.getElementById('easyBtn').style.background = level === 'easy' ? 'linear-gradient(145deg, #4CAF50, #45a049)' : 'linear-gradient(145deg, #666, #555)';
  document.getElementById('mediumBtn').style.background = level === 'medium' ? 'linear-gradient(145deg, #FF9800, #F57C00)' : 'linear-gradient(145deg, #666, #555)';
  document.getElementById('hardBtn').style.background = level === 'hard' ? 'linear-gradient(145deg, #f44336, #d32f2f)' : 'linear-gradient(145deg, #666, #555)';
  
  newGame();
}

function newGame() {
  piles = Array.from({ length: 10 }, () => []);
  gameHistory = [];
  moves = 0;
  score = 0;
  selected = null;
  hintCards = [];
  lastHintMove = null;
  shownHints = [];
  isPaused = false;
  totalPausedTime = 0;
  pauseStartTime = 0;
  document.getElementById('pauseBtn').textContent = '⏸️ Pause';
  
  createAndShuffleDeck();
  
  for (let i = 0; i < 10; i++) {
    let count = i < 4 ? 6 : 5;
    for (let j = 0; j < count; j++) {
      piles[i].push(deck.pop());
    }
    piles[i][piles[i].length - 1].faceUp = true;
  }
  
  document.getElementById('moves').textContent = '0';
  document.getElementById('score').textContent = '0';
  document.getElementById('undoBtn').disabled = true;
  
  if (timerInterval) clearInterval(timerInterval);
  startTimer();
  saveGameState();
  render();
}

function render() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  for (let i = 0; i < piles.length; i++) {
    let pileDiv = document.createElement("div");
    pileDiv.className = "pile";
    let dynamicHeight = Math.max(250, piles[i].length * 30 + 120);
    pileDiv.style.minHeight = `${dynamicHeight}px`;

    let totalOffset = 5;
    
    piles[i].forEach((card, index) => {
      let cardDiv = document.createElement("div");
      cardDiv.className = "card";
      cardDiv.style.setProperty('--card-offset', index);
      
      cardDiv.style.top = `${totalOffset}px`;
      let spacing = card.faceUp ? (piles[i].length > 8 ? Math.max(25, 300 / piles[i].length) : 30) : 15;
      totalOffset += spacing;
      cardDiv.style.zIndex = index + 1;

      if (card.faceUp) {
        const content = document.createElement('div');
        content.className = 'card-content';
        
        const rank = document.createElement('div');
        rank.className = 'rank';
        rank.textContent = card.rank;
        
        const suit = document.createElement('div');
        suit.className = 'suit';
        suit.textContent = card.suit;
        
        content.appendChild(rank);
        content.appendChild(suit);
        cardDiv.appendChild(content);
        
        cardDiv.classList.add('black');
      } else {
        cardDiv.classList.add('face-down');
      }

      if (selected && selected.pileIndex === i && index >= selected.cardIndex && index < selected.cardIndex + selected.length) {
        cardDiv.classList.add('selected');
        cardDiv.style.zIndex = 150;
      }
      
      if (hintCards.some(h => h.pile === i && h.card === index)) {
        cardDiv.classList.add('hint-highlight');
        cardDiv.style.zIndex = 200;
      }

      cardDiv.onclick = (e) => {
        e.stopPropagation();
        handleClick(i, index);
      };

      pileDiv.appendChild(cardDiv);
    });

    pileDiv.onclick = () => {
      handleClick(i, piles[i].length);
    };

    board.appendChild(pileDiv);
  }
  
  const foundation = document.getElementById('foundation');
  foundation.innerHTML = '';
  const maxSlots = { easy: 1, medium: 2, hard: 8 };
  for (let i = 0; i < maxSlots[difficulty]; i++) {
    const slot = document.createElement('div');
    slot.className = 'foundation-slot';
    if (i < score / 100) {
      slot.classList.add('filled');
      slot.textContent = '✓';
    }
    foundation.appendChild(slot);
  }
  
  checkCompletedRuns();
  checkWin();
}

function handleClick(pileIndex, cardIndex) {
  if (isPaused) return;
  let pile = piles[pileIndex];

  if (!selected) {
    if (pile[cardIndex] && pile[cardIndex].faceUp) {
      let canSelect = false;
      let validLength = 1;
      
      if (cardIndex === pile.length - 1) {
        canSelect = true;
      } else {
        canSelect = true;
        for (let i = cardIndex + 1; i < pile.length; i++) {
          if (rankValue(pile[i-1].rank) === rankValue(pile[i].rank) + 1 && pile[i-1].suit === pile[i].suit) {
            validLength++;
          } else {
            canSelect = false;
            break;
          }
        }
      }
      
      if (canSelect) {
        selected = { pileIndex, cardIndex, length: validLength };
      }
    }
  } else {
    let fromPile = piles[selected.pileIndex];
    
    if (selected.cardIndex + selected.length !== fromPile.length) {
      selected = null;
      render();
      return;
    }
    
    let moving = fromPile.slice(selected.cardIndex);
    let targetPile = piles[pileIndex];
    let targetTop = targetPile[targetPile.length - 1];

    let canMove = !targetTop || (targetTop.faceUp && rankValue(targetTop.rank) === rankValue(moving[0].rank) + 1);

    if (canMove) {
      saveGameState();
      moves++;
      document.getElementById('moves').textContent = moves;
      
      piles[pileIndex] = targetPile.concat(moving);
      piles[selected.pileIndex] = fromPile.slice(0, selected.cardIndex);

      let fp = piles[selected.pileIndex];
      if (fp.length > 0) {
        fp[fp.length - 1].faceUp = true;
      }
    }

    selected = null;
  }

  render(); 
}

function rankValue(rank) {
  return RANKS.indexOf(rank);
}

function deal() {
  if (isPaused) return;
  if (piles.some((p) => p.length === 0)) {
    const hintDisplay = document.getElementById('hintDisplay');
    hintDisplay.textContent = '❌ Cannot deal when piles are empty!';
    hintDisplay.style.display = 'block';
    setTimeout(() => hintDisplay.style.display = 'none', 3000);
    return;
  }

  saveGameState();
  moves++;
  document.getElementById('moves').textContent = moves;
  
  for (let i = 0; i < 10; i++) {
    if (deck.length === 0) break;
    let card = deck.pop();
    card.faceUp = true;
    piles[i].push(card);
  }

  render();
}

function checkCompletedRuns() {
  for (let i = 0; i < piles.length; i++) {
    let pile = piles[i];
    if (pile.length >= 13) {
      for (let startIdx = pile.length - 13; startIdx >= 0; startIdx--) {
        let potentialRun = pile.slice(startIdx, startIdx + 13);
        
        if (isCompleteRun(potentialRun)) {
          piles[i] = pile.slice(0, startIdx);
          score += 100;
          document.getElementById('score').textContent = score;
          
          if (piles[i].length > 0) {
            piles[i][piles[i].length - 1].faceUp = true;
          }
          
          i--;
          break;
        }
      }
    }
  }
}

function isCompleteRun(cards) {
  if (cards.length !== 13) return false;
  
  for (let i = 0; i < cards.length - 1; i++) {
    if (rankValue(cards[i].rank) !== rankValue(cards[i + 1].rank) + 1) {
      return false;
    }
    if (cards[i].suit !== cards[i + 1].suit) {
      return false;
    }
    if (!cards[i].faceUp || !cards[i + 1].faceUp) {
      return false;
    }
  }
  
  return cards[0].rank === "K" && cards[12].rank === "A";
}

function checkWin() {
  const requiredSequences = { easy: 1, medium: 2, hard: 4 };
  const completedSequences = score / 100;
  
  if (completedSequences >= requiredSequences[difficulty]) {
    clearInterval(timerInterval);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    
    setTimeout(() => {
      document.getElementById('winDifficulty').textContent = `🎯 Level: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
      document.getElementById('winTime').textContent = `⏱️ Time: ${mins}:${secs.toString().padStart(2, '0')}`;
      document.getElementById('winMoves').textContent = `🎯 Moves: ${moves}`;
      document.getElementById('winScore').textContent = `⭐ Score: ${score}`;
      document.getElementById('winPopup').style.display = 'flex';
    }, 500);
  }
}

function saveGameState() {
  gameHistory.push({
    piles: JSON.parse(JSON.stringify(piles)),
    deck: JSON.parse(JSON.stringify(deck)),
    moves: moves,
    score: score
  });
  if (gameHistory.length > 50) gameHistory.shift();
  document.getElementById('undoBtn').disabled = gameHistory.length <= 1;
}

function undoMove() {
  if (gameHistory.length <= 1) {
    return;
  }
  
  gameHistory.pop();
  const lastState = gameHistory[gameHistory.length - 1];
  
  piles = JSON.parse(JSON.stringify(lastState.piles));
  deck = JSON.parse(JSON.stringify(lastState.deck));
  moves = lastState.moves;
  score = lastState.score;
  selected = null;
  hintCards = [];
  lastHintMove = null;
  shownHints = [];
  
  document.getElementById('moves').textContent = moves;
  document.getElementById('score').textContent = score;
  document.getElementById('undoBtn').disabled = gameHistory.length <= 1;
  render();
}

function showHint() {
  const hintDisplay = document.getElementById('hintDisplay');
  let possibleMoves = [];
  
  for (let fromPile = 0; fromPile < piles.length; fromPile++) {
    let pile = piles[fromPile];
    if (pile.length === 0) continue;
    
    for (let cardIndex = 0; cardIndex < pile.length; cardIndex++) {
      if (!pile[cardIndex].faceUp) continue;
      
      let canMove = cardIndex === pile.length - 1;
      let sequenceLength = 1;
      
      if (cardIndex < pile.length - 1) {
        canMove = true;
        for (let i = cardIndex + 1; i < pile.length; i++) {
          if (rankValue(pile[i-1].rank) === rankValue(pile[i].rank) + 1 && 
              pile[i-1].suit === pile[i].suit) {
            sequenceLength++;
          } else {
            canMove = false;
            break;
          }
        }
      }
      
      if (canMove) {
        let movingCard = pile[cardIndex];
        
        for (let toPile = 0; toPile < piles.length; toPile++) {
          if (toPile === fromPile) continue;
          
          let targetPile = piles[toPile];
          let targetTop = targetPile[targetPile.length - 1];
          
          let canPlace = !targetTop || (targetTop.faceUp && 
            rankValue(targetTop.rank) === rankValue(movingCard.rank) + 1);
          
          if (canPlace) {
            possibleMoves.push({
              from: fromPile,
              to: toPile,
              card: movingCard,
              length: sequenceLength
            });
          }
        }
      }
    }
  }
  
  if (possibleMoves.length === 0) {
    hintDisplay.textContent = 'No moves available. Try dealing new cards!';
    hintDisplay.style.display = 'block';
    setTimeout(() => hintDisplay.style.display = 'none', 3000);
    return;
  }
  
  // Filter out already shown hints
  let newMoves = possibleMoves.filter(move => 
    !shownHints.some(hint => hint.from === move.from && hint.to === move.to && hint.card === move.card.rank)
  );
  
  if (newMoves.length === 0) {
    shownHints = [];
    newMoves = possibleMoves;
  }
  
  let bestMove = newMoves.find(move => {
    let fromPile = piles[move.from];
    return fromPile.length > move.length && !fromPile[fromPile.length - move.length - 1].faceUp;
  }) || newMoves[0];
  
  shownHints.push({from: bestMove.from, to: bestMove.to, card: bestMove.card.rank});
  
  let moveText = bestMove.length > 1 ? 
    `💡 Move ${bestMove.card.rank}${bestMove.card.suit} (+${bestMove.length-1}) from column ${bestMove.from + 1} to ${bestMove.to + 1}` :
    `💡 Move ${bestMove.card.rank}${bestMove.card.suit} from column ${bestMove.from + 1} to ${bestMove.to + 1}`;
  
  hintDisplay.textContent = moveText;
  hintDisplay.style.display = 'block';
  setTimeout(() => hintDisplay.style.display = 'none', 5000);
}

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    if (isPaused) return;
    const elapsed = Math.floor((Date.now() - startTime - totalPausedTime) / 1000);
    const remaining = 900 - elapsed; // 15 minutes = 900 seconds
    
    if (remaining <= 0) {
      clearInterval(timerInterval);
      setTimeout(() => {
        const hintDisplay = document.getElementById('hintDisplay');
        hintDisplay.textContent = '⏰ TIME UP! Game Over!';
        hintDisplay.style.display = 'block';
        setTimeout(() => hintDisplay.style.display = 'none', 3000);
        newGame();
      }, 100);
      return;
    }
    
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timerElement = document.getElementById('timer');
    timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    // Change color when time is running low
    if (remaining <= 60) {
      timerElement.style.color = '#ff4444';
    } else if (remaining <= 300) {
      timerElement.style.color = '#ff9800';
    } else {
      timerElement.style.color = '#FFD700';
    }
  }, 1000);
}

function closeWinPopup() {
  document.getElementById('winPopup').style.display = 'none';
  newGame();
}

function togglePause() {
  isPaused = !isPaused;
  const pauseBtn = document.getElementById('pauseBtn');
  const pausePopup = document.getElementById('pausePopup');
  
  if (isPaused) {
    pauseBtn.textContent = '▶️ Resume';
    pauseStartTime = Date.now();
    pausePopup.style.display = 'flex';
  } else {
    pauseBtn.textContent = '⏸️ Pause';
    totalPausedTime += Date.now() - pauseStartTime;
    pausePopup.style.display = 'none';
  }
}

// Initialize game
setDifficulty('medium');