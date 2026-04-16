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

let audioContext;
let audioUnlocked = false;
let draggedFoodKey = null;
let chewTimer = null;

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

foodPieces.forEach((piece) => {
  piece.addEventListener("dragstart", (event) => {
    if (game.over) {
      event.preventDefault();
      return;
    }
    draggedFoodKey = piece.dataset.food;
    piece.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", draggedFoodKey);
  });

  piece.addEventListener("dragend", () => {
    draggedFoodKey = null;
    piece.classList.remove("is-dragging");
    mouthZone.classList.remove("is-over");
  });

  piece.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDrop(piece.dataset.food);
    }
  });
});

mouthZone.addEventListener("dragover", (event) => {
  if (game.over) return;
  event.preventDefault();
  mouthZone.classList.add("is-over");
  event.dataTransfer.dropEffect = "copy";
});

mouthZone.addEventListener("dragleave", () => {
  mouthZone.classList.remove("is-over");
});

mouthZone.addEventListener("drop", (event) => {
  if (game.over) return;
  event.preventDefault();
  mouthZone.classList.remove("is-over");
  const foodKey = event.dataTransfer.getData("text/plain") || draggedFoodKey;
  handleDrop(foodKey);
});

window.addEventListener("pointerdown", () => {
  unlockAudio().catch(() => {});
}, { once: true });

updateHud();
