// Ordre de distribution de la boucle cyclique du Songo
const BUCKET_ORDER = [6, 5, 4, 3, 2, 1, 0, 7, 8, 9, 10, 11, 12, 13];

let state = {
    board: Array(14).fill(5), 
    scores: { NORD: 0, SUD: 0 },
    currentPlayer: null, 
    gameOver: false
};

function log(message) {
    const logsDiv = document.getElementById('logs');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
    logsDiv.insertBefore(entry, logsDiv.firstChild);
}

function getCamp(index) {
    return (index >= 0 && index <= 6) ? 'NORD' : 'SUD';
}

function getLabel(index) {
    if (index >= 0 && index <= 6) return index + 1; 
    if (index >= 7 && index <= 13) return 14 - index; 
    return 0;
}

function initGame() {
    state.board = Array(14).fill(5);
    state.scores = { NORD: 0, SUD: 0 };
    state.gameOver = false;
    document.getElementById('logs').innerHTML = '';

    state.currentPlayer = Math.random() < 0.5 ? 'NORD' : 'SUD';
    log(`Partie lancée ! Premier joueur tiré au sort : ${state.currentPlayer}`);
    
    renderBoard();
    checkGameStatus();
}

function getLegalMoves(player) {
    let moves = [];
    let range = player === 'NORD' ? [0,1,2,3,4,5,6] : [7,8,9,10,11,12,13];
    let opponent = player === 'NORD' ? 'SUD' : 'NORD';
    let isOpponentEmpty = isCampEmpty(opponent);

    for (let idx of range) {
        if (state.board[idx] === 0) continue; 

        let simulation = simulateMove(idx, player);

        if (isOpponentEmpty) {
            let maxSeedsPossible = getMaxSeedsDistributable(player);
            if (maxSeedsPossible >= 7) {
                if (simulation.seedsGivenToOpponent < 7) continue;
            } else {
                if (simulation.seedsGivenToOpponent < maxSeedsPossible) continue;
            }
        }
        moves.push(idx);
    }
    return moves;
}

function isCampEmpty(player) {
    let range = player === 'NORD' ? [0,1,2,3,4,5,6] : [7,8,9,10,11,12,13];
    return range.every(idx => state.board[idx] === 0);
}

function getMaxSeedsDistributable(player) {
    let range = player === 'NORD' ? [0,1,2,3,4,5,6] : [7,8,9,10,11,12,13];
    let maxSeeds = 0;
    for (let idx of range) {
        let sim = simulateMove(idx, player);
        if (sim.seedsGivenToOpponent > maxSeeds) {
            maxSeeds = sim.seedsGivenToOpponent;
        }
    }
    return maxSeeds;
}

function simulateMove(startIndex, player) {
    let tempBoard = [...state.board];
    let seeds = tempBoard[startIndex];
    tempBoard[startIndex] = 0;

    let currSequenceIdx = BUCKET_ORDER.indexOf(startIndex);
    let finalIndex = -1;
    let totalDistributed = seeds;
    let originSkipped = false;

    while (seeds > 0) {
        currSequenceIdx = (currSequenceIdx + 1) % 14;
        let targetIdx = BUCKET_ORDER[currSequenceIdx];

        if (totalDistributed > 13 && targetIdx === startIndex && !originSkipped) {
            originSkipped = true;
            continue; 
        }

        tempBoard[targetIdx]++;
        seeds--;
        if (seeds === 0) finalIndex = targetIdx;
    }

    let opponent = player === 'NORD' ? 'SUD' : 'NORD';
    let seedsGiven = 0;
    let oppRange = opponent === 'NORD' ? [0,1,2,3,4,5,6] : [7,8,9,10,11,12,13];
    
    for (let idx of oppRange) {
        seedsGiven += (tempBoard[idx] - state.board[idx]);
    }

    return {
        finalIndex: finalIndex,
        boardAfterDistribution: tempBoard,
        seedsGivenToOpponent: seedsGiven,
        totalSeedsDistributed: totalDistributed
    }
}

function playMove(idx) {
    if (state.gameOver) return;
    
    let player = state.currentPlayer;
    
    // SÉCURITÉ ET BLOCAGE : Empêcher de jouer le camp adverse
    if (getCamp(idx) !== player) {
        triggerErrorAnimation(idx);
        log(`Action bloquée : Vous ne pouvez pas jouer dans le camp adverse !`);
        return;
    }

    let legalMoves = getLegalMoves(player);

    // SÉCURITÉ ET BLOCAGE : Empêcher les coups non réglementés (Solidarité obligatoire)
    if (!legalMoves.includes(idx)) {
        triggerErrorAnimation(idx);
        log(`Coup impossible : Vous devez nourrir l'adversaire (Loi de Solidarité).`);
        return;
    }

    let opponent = player === 'NORD' ? 'SUD' : 'NORD';
    let labelCase = getLabel(idx);
    log(`${player} distribue la case ${labelCase}`);

    let sim = simulateMove(idx, player);
    state.board = sim.boardAfterDistribution;
    
    let finalIdx = sim.finalIndex;
    let totalSeeds = sim.totalSeedsDistributed;

    // Gestion règlementaire de l'interdit de la case 7
    if (labelCase === 7 && sim.seedsGivenToOpponent >= 1 && sim.seedsGivenToOpponent <= 2) {
        log(`Interdit Case 7 actif ! Les graines semées chez le Sud sont confisquées.`);
        state.scores[opponent] += sim.seedsGivenToOpponent;
        
        let currentSeq = BUCKET_ORDER.indexOf(idx);
        let seedsToClean = totalSeeds;
        while(seedsToClean > 0) {
            currentSeq = (currentSeq + 1) % 14;
            let target = BUCKET_ORDER[currentSeq];
            if (getCamp(target) === opponent) {
                state.board[target]--;
            }
            seedsToClean--;
        }
    }

    // CALCUL DES RÉCOLTES RÈGLEMENTAIRES
    let capturedSeeds = 0;
    let finalCamp = getCamp(finalIdx);
    let finalLabel = getLabel(finalIdx);

    if (finalCamp === opponent) {
        let isFirstCaseOpponent = (finalLabel === 1);
        let totalTurns = Math.floor(totalSeeds / 14);

        if (isFirstCaseOpponent && totalTurns >= 1) {
            if (state.board[finalIdx] > 0) {
                capturedSeeds += 1;
                state.board[finalIdx] -= 1;
                log(`Prise spéciale de la Case 1 adverse après tour complet.`);
            }
        } 
        else {
            let currentSeqIdx = BUCKET_ORDER.indexOf(finalIdx);
            let chainIndexes = [];

            while (true) {
                let targetIdx = BUCKET_ORDER[currentSeqIdx];
                if (getCamp(targetIdx) !== opponent) break;

                let label = getLabel(targetIdx);
                if (label === 1 && chainIndexes.length === 0) break; 

                let count = state.board[targetIdx];
                if (count >= 2 && count <= 4) {
                    chainIndexes.push(targetIdx);
                } else {
                    break; 
                }
                currentSeqIdx = (currentSeqIdx - 1 + 14) % 14;
            }

            if (chainIndexes.length > 0) {
                let oppRange = opponent === 'NORD' ? [0,1,2,3,4,5,6] : [7,8,9,10,11,12,13];
                let totalOpponentSeedsLeft = oppRange.reduce((acc, i) => acc + state.board[i], 0);
                let potentialCaptureSum = chainIndexes.reduce((acc, i) => acc + state.board[i], 0);

                if (potentialCaptureSum === totalOpponentSeedsLeft) {
                    log(`Règlement Songo : Prise annulée pour éviter d'affamer complètement l'adversaire.`);
                } else {
                    chainIndexes.forEach(i => {
                        capturedSeeds += state.board[i];
                        state.board[i] = 0;
                    });
                    log(`Récolte effectuée : ${capturedSeeds} graines capturées.`);
                }
            }
        }
    }

    state.scores[player] += capturedSeeds;
    state.currentPlayer = opponent;
    
    renderBoard();
    checkGameStatus();
}

function triggerErrorAnimation(idx) {
    let pitElem = document.getElementById(`pit-${idx}`);
    if(pitElem) {
        pitElem.classList.add('shake');
        setTimeout(() => pitElem.classList.remove('shake'), 400);
    }
}

function checkGameStatus() {
    if (state.scores.NORD >= 40) {
        endGame("Le joueur NORD gagne la partie (Cagnotte >= 40) !");
        return;
    }
    if (state.scores.SUD >= 40) {
        endGame("Le joueur SUD gagne la partie (Cagnotte >= 40) !");
        return;
    }

    let remainingSeeds = state.board.reduce((a, b) => a + b, 0);
    if (remainingSeeds < 10) {
        for(let i=0; i<7; i++) state.scores.NORD += state.board[i];
        for(let i=7; i<14; i++) state.scores.SUD += state.board[i];
        state.board = Array(14).fill(0);
        determineWinner("Moins de 10 graines restantes. Vidage final.");
        return;
    }

    let nextPlayerLegalMoves = getLegalMoves(state.currentPlayer);
    if (nextPlayerLegalMoves.length === 0) {
        let opponent = state.currentPlayer === 'NORD' ? 'SUD' : 'NORD';
        if (isCampEmpty(opponent)) {
            for(let i=0; i<7; i++) state.scores.NORD += state.board[i];
            for(let i=7; i<14; i++) state.scores.SUD += state.board[i];
            state.board = Array(14).fill(0);
            determineWinner(`Fin de partie : Alimentation impossible du camp de ${opponent}.`);
            return;
        }
    }

    document.getElementById('status-panel').innerText = `Tour du joueur : ${state.currentPlayer}`;
    let currentThemeColor = state.currentPlayer === 'NORD' ? 'var(--nord-color)' : 'var(--sud-color)';
    document.getElementById('status-panel').style.borderColor = currentThemeColor;
    highlightPlayablePits();
}

function determineWinner(contextMessage) {
    renderBoard();
    if (state.scores.NORD > state.scores.SUD) {
        endGame(`${contextMessage} Victoire finale de NORD (${state.scores.NORD} vs ${state.scores.SUD})`);
    } else if (state.scores.SUD > state.scores.NORD) {
        endGame(`${contextMessage} Victoire finale de SUD (${state.scores.SUD} vs ${state.scores.NORD})`);
    } else {
        endGame(`${contextMessage} Match nul parfait (${state.scores.NORD} partout) !`);
    }
}

function endGame(msg) {
    state.gameOver = true;
    document.getElementById('status-panel').innerHTML = `<strong style="color:#2ecc71;">${msg}</strong>`;
    log(`FIN : ${msg}`);
    document.querySelectorAll('.pit').forEach(p => p.classList.remove('playable'));
}

function highlightPlayablePits() {
    document.querySelectorAll('.pit').forEach(p => {
        p.classList.remove('playable');
        p.classList.add('not-playable');
    });
    if (state.gameOver) return;

    let legals = getLegalMoves(state.currentPlayer);
    legals.forEach(idx => {
        let pitElem = document.getElementById(`pit-${idx}`);
        if (pitElem) {
            pitElem.classList.add('playable');
            pitElem.classList.remove('not-playable');
        }
    });
}

// Fonction mathématique pour distribuer spatialement les graines de façon circulaire dans chaque trou
function generateSeedsHTML(count) {
    let seedsHTML = '';
    for (let i = 0; i < count; i++) {
        let angle = (i * (360 / Math.min(count, 8))) * (Math.PI / 180);
        let radius = count <= 5 ? 12 : 22; 
        if (i >= 8) radius = 32; 

        let left = 35 + radius * Math.cos(angle);
        let top = 35 + radius * Math.sin(angle);

        seedsHTML += `<div class="seed" style="left: ${left}px; top: ${top}px;"></div>`;
    }
    return seedsHTML;
}

function renderBoard() {
    const rowNord = document.getElementById('row-nord');
    const rowSud = document.getElementById('row-sud');

    // Génération Nord (De N1 à N7 de gauche à droite)
    let nordHTML = '';
    for (let i = 0; i <= 6; i++) {
        nordHTML += `
            <div class="pit-container">
                <span class="pit-label">N${getLabel(i)}</span>
                <div id="pit-${i}" class="pit" onclick="playMove(${i})">
                    <div class="pit-counter">${state.board[i]}</div>
                    <div class="seeds-container">${generateSeedsHTML(state.board[i])}</div>
                </div>
            </div>`;
    }
    rowNord.innerHTML = nordHTML;

    // Génération Sud (De S7 à S1 de gauche à droite)
    let sudHTML = '';
    for (let i = 7; i <= 13; i++) {
        sudHTML += `
            <div class="pit-container">
                <div id="pit-${i}" class="pit" onclick="playMove(${i})">
                    <div class="pit-counter">${state.board[i]}</div>
                    <div class="seeds-container">${generateSeedsHTML(state.board[i])}</div>
                </div>
                <span class="pit-label">S${getLabel(i)}</span>
            </div>`;
    }
    rowSud.innerHTML = sudHTML;

    document.getElementById('score-nord-val').innerText = state.scores.NORD;
    document.getElementById('score-sud-val').innerText = state.scores.SUD;

    highlightPlayablePits();
}

window.onload = initGame;
