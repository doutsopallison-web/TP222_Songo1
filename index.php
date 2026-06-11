<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jeu de Songo Traditionnel - Pro</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

    <h1>Le Jeu de Songo</h1>
    
    <div id="status-panel">Initialisation...</div>

    <div id="score-board">
        <div class="score-box score-nord">NORD (Haut) : <span id="score-nord-val">0</span> cagnottes</div>
        <div class="score-box score-sud">SUD (Bas) : <span id="score-sud-val">0</span> cagnottes</div>
    </div>

    <div id="board-wrapper">
        <div id="board">
            <div class="row row-nord" id="row-nord"></div>

            <hr style="border: 0; border-top: 2px dashed #4a2e14; width: 100%; margin: 0;">

            <div class="row row-sud" id="row-sud"></div>
        </div>
    </div>

    <div id="controls">
        <button id="btn-restart" onclick="initGame()">Réinitialiser la partie</button>
    </div>

    <div id="logs"></div>

    <script src="script.js"></script>
</body>
</html>
