const feedsLeftEl = document.getElementById("feeds-left");
const moodEl = document.getElementById("mood");
const hayPercentEl = document.getElementById("hay-percent");
const greensPercentEl = document.getElementById("greens-percent");
const pelletPercentEl = document.getElementById("pellet-percent");
const treatPercentEl = document.getElementById("treat-percent");
const messageEl = document.getElementById("message");
const foodPieces = [...document.querySelectorAll(".food-piece")];
const mouthZone = document.getElementById("mouth-zone");
const bunnyEl = document.getElementById("bunny");
const sceneEl = document.querySelector(".scene");
const plateEl = document.getElementById("plate");
const hoverCardEl = document.getElementById("hover-card");
const hoverTitleEl = document.getElementById("hover-title");
const hoverNoteEl = document.getElementById("hover-note");

let audioContext;
let audioUnlocked = false;
let draggedFoodKey = null;
let chewTimer = null;
let activeDrag = null;

const foodDefs = {
  hay: { label: "Hay Bundle", value: 6, group: "hay", mood: "Content", color: "#f1d372", sound: [420, 560] },
  romaine: { label: "Romaine", value: 1, group: "greens", mood: "Crunchy", color: "#97d86e", sound: [620, 760] },
  cilantro: { label: "Cilantro", value: 1, group: "greens", mood: "Fresh", color: "#7bcf77", sound: [650, 810] },
  parsley: { label: "Parsley", value: 1, group: "greens", mood: "Perky", color: "#64c15f", sound: [680, 840] },
  pellets: { label: "Pellet Scoop", value: 1, group: "pellets", mood: "Calm", color: "#bb946f", sound: [360, 470] },
  strawberry: { label: "Strawberry", value: 1, group: "treats", mood: "Excited", color: "#ee6f8f", sound: [720, 920] },
  blueberry: { label: "Blueberries", value: 1, group: "treats", mood: "Bouncy", color: "#6f84eb", sound: [690, 900] },
  banana: { label: "Banana Slice", value: 1, group: "treats", mood: "Curious", color: "#f3d873", sound: [610, 790] }
};

const game = {
  maxFeeds: 6,
  feedsUsed: 0,
  over: false,
  counts: {
    hay: 0,
    greens: 0,
    pellets: 0,
    treats: 0
  }
};

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

async function unlockAudio() {
  const context = getAudioContext();
  if (!context || audioUnlocked) return;
  if (context.state === "suspended") {
    await context.resume();
  }
  audioUnlocked = true;
}

function playTone({ frequency, duration, type = "triangle", volume = 0.028, slideTo }) {
  const context = getAudioContext();
  if (!context || !audioUnlocked) return;

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  }

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function playFeedSound(foodKey) {
  const [first, second] = foodDefs[foodKey].sound;
  playTone({ frequency: first, duration: 0.12, slideTo: second });
  setTimeout(() => {
    playTone({ frequency: second, duration: 0.16, type: "sine", volume: 0.02, slideTo: second * 1.06 });
  }, 55);
}

function playWinSound() {
  [520, 660, 784, 988].forEach((note, index) => {
    setTimeout(() => {
      playTone({ frequency: note, duration: 0.2, volume: 0.03, slideTo: note * 1.05 });
    }, index * 120);
  });
}

function playLoseSound() {
  [430, 360, 310].forEach((note, index) => {
    setTimeout(() => {
      playTone({ frequency: note, duration: 0.18, type: "sine", volume: 0.02, slideTo: note * 0.94 });
    }, index * 120);
  });
}

function playPuffSound() {
  playTone({ frequency: 360, duration: 0.09, type: "triangle", volume: 0.018, slideTo: 290 });
  setTimeout(() => {
    playTone({ frequency: 290, duration: 0.12, type: "sine", volume: 0.014, slideTo: 220 });
  }, 40);
}

function totalValue() {
  return game.counts.hay + game.counts.greens + game.counts.pellets + game.counts.treats;
}

function percentFor(key) {
  const total = totalValue();
  if (!total) return 0;
  return Math.round((game.counts[key] / total) * 100);
}

function updateHud() {
  feedsLeftEl.textContent = String(game.maxFeeds - game.feedsUsed);
  hayPercentEl.textContent = `${percentFor("hay")}%`;
  greensPercentEl.textContent = `${percentFor("greens")}%`;
  pelletPercentEl.textContent = `${percentFor("pellets")}%`;
  treatPercentEl.textContent = `${percentFor("treats")}%`;

  foodPieces.forEach((piece) => {
    piece.draggable = !game.over;
    piece.setAttribute("aria-disabled", String(game.over));
    piece.style.pointerEvents = game.over ? "none" : "auto";
  });
}

function setMessage(title, text) {
  messageEl.innerHTML = `<h2>${title}</h2><p>${text}</p>`;
}

function chew() {
  bunnyEl.classList.add("is-eating");
  clearTimeout(chewTimer);
  chewTimer = setTimeout(() => {
    bunnyEl.classList.remove("is-eating");
  }, 260);
}

function evaluateGame() {
  const hay = percentFor("hay");
  const greens = percentFor("greens");
  const pellets = percentFor("pellets");
  const treats = percentFor("treats");

  const hayOk = hay >= 80 && hay <= 90;
  const greensOk = greens >= 10 && greens <= 15;
  const pelletsOk = pellets <= 5;
  const treatsOk = treats <= 5;

  game.over = true;
  updateHud();

  if (hayOk && greensOk && pelletsOk && treatsOk) {
    moodEl.textContent = "Thriving";
    setMessage("Perfect bunny balance.", `Final mix: ${hay}% hay, ${greens}% greens, ${pellets}% pellets, ${treats}% fruit.`);
    playWinSound();
    return;
  }

  moodEl.textContent = "Still Learning";
  setMessage("That menu missed the healthiest balance.", `Final mix: ${hay}% hay, ${greens}% greens, ${pellets}% pellets, ${treats}% fruit. Try a gentler plate next round.`);
  playLoseSound();
}

function feedBunny(foodKey) {
  if (!foodDefs[foodKey] || game.over) return;

  const food = foodDefs[foodKey];
  game.feedsUsed += 1;
  game.counts[food.group] += food.value;
  moodEl.textContent = food.mood;
  chew();
  playFeedSound(foodKey);
  updateHud();

  const feedsLeft = game.maxFeeds - game.feedsUsed;
  if (feedsLeft > 0) {
    setMessage(`${food.label} served.`, `${feedsLeft} feeds left. Hay should stay dominant, greens should stay modest, and pellets plus fruit should stay tiny.`);
  } else {
    evaluateGame();
  }
}

function handleDrop(foodKey) {
  if (!foodKey || game.over) return;
  unlockAudio().catch(() => {});
  feedBunny(foodKey);
}

function showHoverCard(piece) {
  hoverTitleEl.textContent = piece.dataset.label || "";
  hoverNoteEl.textContent = piece.dataset.note || "";
  hoverCardEl.hidden = false;
}

function moveHoverCard(clientX, clientY) {
  const sceneRect = sceneEl.getBoundingClientRect();
  const offset = 10;
  const localX = clientX - sceneRect.left;
  const localY = clientY - sceneRect.top;
  const maxX = sceneRect.width - hoverCardEl.offsetWidth - 12;
  const maxY = sceneRect.height - hoverCardEl.offsetHeight - 12;
  const left = Math.min(localX + offset, maxX);
  const top = Math.min(localY + offset, maxY);
  hoverCardEl.style.left = `${Math.max(12, left)}px`;
  hoverCardEl.style.top = `${Math.max(12, top)}px`;
}

function hideHoverCard() {
  hoverCardEl.hidden = true;
}

function pointInRect(clientX, clientY, rect) {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function pointInPlate(clientX, clientY) {
  const rect = plateEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radiusX = rect.width / 2;
  const radiusY = rect.height / 2;
  const dx = (clientX - centerX) / radiusX;
  const dy = (clientY - centerY) / radiusY;
  return dx * dx + dy * dy <= 1;
}

function plateLocalToScene(leftInPlate, topInPlate, pieceWidth, pieceHeight) {
  const sceneRect = sceneEl.getBoundingClientRect();
  const plateRect = plateEl.getBoundingClientRect();
  return {
    left: plateRect.left - sceneRect.left + leftInPlate,
    top: plateRect.top - sceneRect.top + topInPlate
  };
}

function choosePlateLanding(clientX, clientY, pieceWidth, pieceHeight) {
  const plateRect = plateEl.getBoundingClientRect();
  const centerX = plateRect.left + plateRect.width / 2;
  const centerY = plateRect.top + plateRect.height / 2;
  const rx = plateRect.width / 2 - pieceWidth * 0.45;
  const ry = plateRect.height / 2 - pieceHeight * 0.45;

  let dx = clientX - centerX;
  let dy = clientY - centerY;

  if (dy < -ry) dy = -ry;

  const ellipseValue = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  if (ellipseValue > 1) {
    const scale = Math.sqrt(ellipseValue);
    dx /= scale;
    dy /= scale;
  }

  const topInset = 12;
  const leftInPlate = plateRect.width / 2 + dx - pieceWidth / 2;
  const topInPlate = Math.max(topInset, plateRect.height / 2 + dy - pieceHeight / 2);

  return {
    leftInPlate,
    topInPlate,
    leftPercent: (leftInPlate / plateRect.width) * 100,
    topPercent: (topInPlate / plateRect.height) * 100
  };
}

function spawnPuff(clientX, clientY) {
  const sceneRect = sceneEl.getBoundingClientRect();
  const puff = document.createElement("div");
  puff.className = "puff";
  puff.style.left = `${clientX - sceneRect.left}px`;
  puff.style.top = `${clientY - sceneRect.top}px`;
  sceneEl.appendChild(puff);
  setTimeout(() => puff.remove(), 520);
}

function cleanupPiece(piece) {
  piece.classList.remove("is-dragging", "is-floating");
  piece.style.left = "";
  piece.style.top = "";
  piece.style.width = "";
  piece.style.height = "";
}

function restorePieceToPlate(piece) {
  if (piece.parentElement !== plateEl) {
    plateEl.appendChild(piece);
  }
}

function placePieceOnPlate(piece, landing) {
  restorePieceToPlate(piece);
  piece.style.left = `${landing.leftPercent}%`;
  piece.style.top = `${landing.topPercent}%`;
}

function animatePieceTo(piece, targetLeft, targetTop, onDone) {
  const currentLeft = parseFloat(piece.style.left || "0");
  const currentTop = parseFloat(piece.style.top || "0");
  const dx = currentLeft - targetLeft;
  const dy = currentTop - targetTop;

  piece.style.left = `${targetLeft}px`;
  piece.style.top = `${targetTop}px`;
  piece.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(1.04)` },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + 18}px) scale(1.02)`, offset: 0.55 },
      { transform: "translate(0, 0) scale(1)" }
    ],
    {
      duration: 340,
      easing: "cubic-bezier(.2,.8,.2,1)"
    }
  ).finished.finally(() => {
    if (onDone) onDone();
  });
}

function endDrag(clientX, clientY) {
  if (!activeDrag) return;

  const { piece, homeLeft, homeTop } = activeDrag;
  const mouthRect = mouthZone.getBoundingClientRect();
  const hitMouth = pointInRect(clientX, clientY, mouthRect);
  const hitPlate = pointInPlate(clientX, clientY);
  const sceneRect = sceneEl.getBoundingClientRect();
  const releasedInScene = pointInRect(clientX, clientY, sceneRect);

  mouthZone.classList.remove("is-over");
  hideHoverCard();

  if (hitMouth) {
    const targetLeft = mouthRect.left - sceneRect.left + mouthRect.width / 2 - piece.offsetWidth / 2;
    const targetTop = mouthRect.top - sceneRect.top + mouthRect.height / 2 - piece.offsetHeight / 2;
    animatePieceTo(piece, targetLeft, targetTop, () => {
      cleanupPiece(piece);
      restorePieceToPlate(piece);
      feedBunny(piece.dataset.food);
    });
  } else if (hitPlate || releasedInScene) {
    const landing = choosePlateLanding(clientX, clientY, piece.offsetWidth, piece.offsetHeight);
    const target = plateLocalToScene(landing.leftInPlate, landing.topInPlate, piece.offsetWidth, piece.offsetHeight);
    animatePieceTo(piece, target.left, target.top, () => {
      cleanupPiece(piece);
      placePieceOnPlate(piece, landing);
    });
  } else {
    spawnPuff(clientX, clientY);
    playPuffSound();
    piece.classList.add("is-gone");
    cleanupPiece(piece);
  }

  if (activeDrag.pointerId !== undefined && piece.hasPointerCapture?.(activeDrag.pointerId)) {
    piece.releasePointerCapture(activeDrag.pointerId);
  }

  activeDrag = null;
  draggedFoodKey = null;
}

function handlePointerMove(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;

  const sceneRect = sceneEl.getBoundingClientRect();
  const nextLeft = event.clientX - sceneRect.left - activeDrag.offsetX;
  const nextTop = event.clientY - sceneRect.top - activeDrag.offsetY;

  activeDrag.piece.style.left = `${nextLeft}px`;
  activeDrag.piece.style.top = `${nextTop}px`;
  draggedFoodKey = activeDrag.piece.dataset.food;

  if (pointInRect(event.clientX, event.clientY, mouthZone.getBoundingClientRect())) {
    mouthZone.classList.add("is-over");
  } else {
    mouthZone.classList.remove("is-over");
  }
}

function handlePointerUp(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
  endDrag(event.clientX, event.clientY);
}

foodPieces.forEach((piece) => {
  piece.addEventListener("mouseenter", (event) => {
    if (activeDrag?.piece === piece) return;
    showHoverCard(piece);
    moveHoverCard(event.clientX, event.clientY);
  });

  piece.addEventListener("mousemove", (event) => {
    if (!hoverCardEl.hidden) {
      moveHoverCard(event.clientX, event.clientY);
    }
  });

  piece.addEventListener("focus", () => {
    showHoverCard(piece);
    const rect = piece.getBoundingClientRect();
    moveHoverCard(rect.right, rect.top);
  });

  piece.addEventListener("mouseleave", () => {
    hideHoverCard();
  });

  piece.addEventListener("blur", () => {
    hideHoverCard();
  });

  piece.addEventListener("pointerdown", (event) => {
    if (game.over) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    unlockAudio().catch(() => {});
    hideHoverCard();

    const sceneRect = sceneEl.getBoundingClientRect();
    const pieceRect = piece.getBoundingClientRect();
    const homeLeft = pieceRect.left - sceneRect.left;
    const homeTop = pieceRect.top - sceneRect.top;

    sceneEl.appendChild(piece);
    activeDrag = {
      piece,
      pointerId: event.pointerId,
      offsetX: event.clientX - pieceRect.left,
      offsetY: event.clientY - pieceRect.top,
      homeLeft,
      homeTop
    };

    piece.classList.add("is-dragging", "is-floating");
    piece.style.width = `${pieceRect.width}px`;
    piece.style.height = `${pieceRect.height}px`;
    piece.style.left = `${homeLeft}px`;
    piece.style.top = `${homeTop}px`;
    piece.setPointerCapture?.(event.pointerId);
    draggedFoodKey = piece.dataset.food;
  });

  piece.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDrop(piece.dataset.food);
    }
  });
});

window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);
window.addEventListener("pointercancel", handlePointerUp);

window.addEventListener("pointerdown", () => {
  unlockAudio().catch(() => {});
}, { once: true });

updateHud();
