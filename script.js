
// Ordre de distribution de la boucle cyclique du Songo (Sens anti-horaire)
const BUCKET_ORDER = [6, 5, 4, 3, 2, 1, 0, 7, 8, 9, 10, 11, 12, 13];

let state = {
    board: Array(14).fill(5), 
    scores: { NORD: 0, SUD: 0 },
    currentPlayer: null, 
    gameOver: false
};

function log(message) {
    const logsDiv = document.getElementById('logs');
    if (!logsDiv) return;
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
    const logsDiv = document.getElementById('logs');
    if (logsDiv) logsDiv.innerHTML = '';

    state.currentPlayer = Math.random() < 0.5 ? 'NORD' : 'SUD';
    log(`Partie lancée ! Premier joueur tiré au sort : ${state.currentPlayer}`);
    
    renderBoard();
    checkGameStatus();
}

/**
 * RÈGLE : GESTION DES COUPS LÉGAUX ET RESTRICTIONS
 */
function getLegalMoves(player) {
    let moves = [];
    let range = player === 'NORD' ? [0,1,2,3,4,5,6] : [7,8,9,10,11,12,13];
    let opponent = player === 'NORD' ? 'SUD' : 'NORD';
    let isOpponentEmpty = isCampEmpty(opponent);

    for (let idx of range) {
        if (state.board[idx] === 0) continue; 

        let labelCase = getLabel(idx);
        let simulation = simulateMove(idx, player);

        // 1. RÈGLE INTERDIT CASE 7 (BLOQUANT AMONT) : Interdiction de jouer la case 7 si elle ne nourrit pas l'adversaire
        if (labelCase === 7 && simulation.seedsGivenToOpponent === 0) {
            continue; 
        }

        // 2. LOI DE SOLIDARITÉ : Obligation de nourrir un adversaire affamé
        if (isOpponentEmpty) {
            let maxSeedsPossible = getMaxSeedsDistributable(player);
            if (maxSeedsPossible >= 7) {
                // Doit distribuer au moins 7 graines si c'est mathématiquement possible
                if (simulation.seedsGivenToOpponent < 7) continue;
            } else {
                // Sinon, doit distribuer le maximum possible de son jeu
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

/**
 * RÈGLE : SIMULATION DE LA DISTRIBUTION ET SAUT DU GRENIER
 */
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

        // RÈGLE DU GRENIER : Si plus de 13 graines, on saute la case de départ au premier tour complet
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
    
    if (getCamp(idx) !== player) {
        triggerErrorAnimation(idx);
        log(`Action bloquée : Vous ne pouvez pas jouer dans le camp adverse !`);
        return;
    }

    let legalMoves = getLegalMoves(player);

    if (!legalMoves.includes(idx)) {
        triggerErrorAnimation(idx);
        log(`Coup impossible : Vérifiez la loi de Solidarité ou l'interdit de la Case 7.`);
        return;
    }

    let opponent = player === 'NORD' ? 'SUD' : 'NORD';
    let labelCase = getLabel(idx);
    log(`${player} distribue la case ${labelCase}`);

    let sim = simulateMove(idx, player);
    state.board = sim.boardAfterDistribution;
    
    let finalIdx = sim.finalIndex;
    let totalSeeds = sim.totalSeedsDistributed;

    // 3. RÈGLE DE L'INTERDIT DE LA CASE 7 (CONFISCATION)
    if (labelCase === 7 && sim.seedsGivenToOpponent >= 1 && sim.seedsGivenToOpponent <= 2) {
        log(`Interdit Case 7 actif ! Les graines semées chez le Sud sont confisquées et vont à ses scores.`);
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

    // 4. CALCUL DES RÉCOLTES ET RAFLES À LA CHAÎNE
    let capturedSeeds = 0;
    let finalCamp = getCamp(finalIdx);
    let finalLabel = getLabel(finalIdx);

    if (finalCamp === opponent) {
        let isFirstCaseOpponent = (finalLabel === 1);
        let totalTurns = Math.floor(totalSeeds / 14);

        // Cas particulier : Prise unique sur la case 1 adverse après un tour complet
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

            // Remonter le flux à l'envers de la distribution (Sens horaire : +1 dans le BUCKET_ORDER)
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
                currentSeqIdx = (currentSeqIdx + 1) % 14;
            }

            // 5. RÈGLE DE PROTECTION CONTRE LA FAMINE
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

/**
 * CONDITIONS DE FIN DE PARTIE TRADITIONNELLES
 */
function checkGameStatus() {
    if (state.scores.NORD >= 40) {
        endGame("Le joueur NORD gagne la partie (Cagnotte >= 40) !");
        return;
    }
    if (state.scores.SUD >= 40) {
        endGame("Le joueur SUD gagne la partie (Cagnotte >= 40) !");
        return;
    }

    // Fin par manque de graines (Moins de 10 graines sur le plateau)
    let remainingSeeds = state.board.reduce((a, b) => a + b, 0);
    if (remainingSeeds < 10) {
        for(let i=0; i<7; i++) state.scores.NORD += state.board[i];
        for(let i=7; i<14; i++) state.scores.SUD += state.board[i];
        state.board = Array(14).fill(0);
        determineWinner("Moins de 10 graines restantes. Vidage et décompte final.");
        return;
    }

    // Fin par impossibilité d'alimentation réciproque
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

    const statusPanel = document.getElementById('status-panel');
    if (statusPanel) {
        statusPanel.innerText = `Tour du joueur : ${state.currentPlayer}`;
        let currentThemeColor = state.currentPlayer === 'NORD' ? 'var(--nord-color)' : 'var(--sud-color)';
        statusPanel.style.borderColor = currentThemeColor;
    }
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
    const statusPanel = document.getElementById('status-panel');
    if (statusPanel) statusPanel.innerHTML = `<strong style="color:#2ecc71;">${msg}</strong>`;
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

/**
 * ALGORITHME DE PLACEMENT : AGENCEMENT NATUREL SEMI-CIRCULAIRE (IMAGE DE RÉFÉRENCE)
 * Centre théorique de la case de 70px : 35px. Diamètre de la graine : 10px.
 */
function generateSeedsHTML(count) {
    let seedsHTML = '';
    
    // Définition d'une matrice de coordonnées physiques (X, Y) relatives au coin supérieur gauche du conteneur (70x70)
    // Les coordonnées forcent un regroupement organique incurvé, orienté vers le bas
    const clusterPositions = [
        {x: 30, y: 44}, // Graine 1 : Centre bas
        {x: 18, y: 38}, // Graine 2 : Bas Gauche
        {x: 42, y: 38}, // Graine 3 : Bas Droite
        {x: 30, y: 32}, // Graine 4 : Centre Milieu
        {x: 6,  y: 28}, // Graine 5 : Extrême Gauche élevé
        {x: 54, y: 28}, // Graine 6 : Extrême Droite élevé
        {x: 18, y: 22}, // Graine 7 : Rangée supérieure Gauche
        {x: 42, y: 22}, // Graine 8 : Rangée supérieure Droite
        {x: 30, y: 14}, // Graine 9 : Sommet central
        {x: 18, y: 50}, // Graine 10 : Élargissement bas gauche
        {x: 42, y: 50}, // Graine 11 : Élargissement bas droite
        {x: 6,  y: 40}, // Graine 12 : Flanc gauche bas
        {x: 54, y: 40}  // Graine 13 : Flanc droit bas
    ];

    for (let i = 0; i < count; i++) {
        let left, top;

        if (i < clusterPositions.length) {
            // Utilise la cartographie pré-calculée pour correspondre au visuel fourni
            left = clusterPositions[i].x;
            top = clusterPositions[i].y;
        } else {
            // Sécurité mathématique empilée au centre si le nombre dépasse exceptionnellement 13 graines
            let angle = (i * 45) * (Math.PI / 180);
            left = 30 + 12 * Math.cos(angle);
            top = 30 + 12 * Math.sin(angle);
        }

        seedsHTML += `<div class="seed" style="left: ${left}px; top: ${top}px;"></div>`;
    }
    return seedsHTML;
}

function renderBoard() {
    const rowNord = document.getElementById('row-nord');
    const rowSud = document.getElementById('row-sud');
    if (!rowNord || !rowSud) return;

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

    const scoreNordVal = document.getElementById('score-nord-val');
    const scoreSudVal = document.getElementById('score-sud-val');
    if (scoreNordVal) scoreNordVal.innerText = state.scores.NORD;
    if (scoreSudVal) scoreSudVal.innerText = state.scores.SUD;

    highlightPlayablePits();
}

window.onload = initGame;
