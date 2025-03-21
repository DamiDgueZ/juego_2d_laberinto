document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    const mazeSize = 15;
    const cellSize = 40;

    canvas.width = mazeSize * cellSize;
    canvas.height = mazeSize * cellSize;

    let level = 1;
    let player = { x: 30, y: 30, radius: 10, speed: 5 };
    let goal = { x: canvas.width - 30, y: canvas.height - 30, width: 20, height: 20 };
    let walls = [];
    let grid;
    let keys = {};
    let lasers = [];
    let coins = [];
    let score = 0;
    let highScore = localStorage.getItem("highScore") ? parseInt(localStorage.getItem("highScore")) : 0;

    let gameLoopId;  // Control del bucle principal
    let isLevelPopupOpen = false;  // Evitar múltiples ventanas emergentes

    function nextLevel() {
        if (isLevelPopupOpen) return;  // Evita múltiples llamadas
        isLevelPopupOpen = true;
    
        levelUpSound.play();
        level++;
    
        // Actualiza el nivel mostrado en la ventana emergente
        document.getElementById("nextLevel").textContent = level;
    
        // Muestra la ventana emergente
        document.getElementById("levelUpPopup").style.display = "flex";
    
        // Pausa el juego
        cancelAnimationFrame(gameLoopId);
    }
    
    function closeLevelPopup() {
        // Oculta la ventana emergente
        document.getElementById("levelUpPopup").style.display = "none";
    
        // Restablece la variable de bloqueo
        isLevelPopupOpen = false;
    
        // Reinicia el nivel
        resetLevel();
    
        // Reanuda el juego
        gameLoopId = requestAnimationFrame(gameLoop);
    }
    
    // Inicia el juego correctamente al cargar la página
    document.addEventListener("DOMContentLoaded", () => {
        gameLoopId = requestAnimationFrame(gameLoop);
    });
    
    let enemies = Array.from({ length: 3 }, () => ({
        x: Math.floor(Math.random() * mazeSize) * cellSize + cellSize / 2,
        y: Math.floor(Math.random() * mazeSize) * cellSize + cellSize / 2,
        radius: 10,
        speed: 2,
        direction: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"][Math.floor(Math.random() * 4)],
        changeDirectionCooldown: 0
    }));

    canvas.addEventListener("contextmenu", event => {
        event.preventDefault(); // Evita el menú contextual
        shootLaser();
    });    

    function generateMaze() {
        walls = [];
        grid = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(true));
        
        function carveMaze(x, y) {
            grid[y][x] = false;
            let directions = [
                [0, -1], [1, 0], [0, 1], [-1, 0]
            ].sort(() => Math.random() - 0.5);
            
            for (let [dx, dy] of directions) {
                let nx = x + dx * 2, ny = y + dy * 2;
                if (nx >= 0 && ny >= 0 && nx < mazeSize && ny < mazeSize && grid[ny][nx]) {
                    grid[y + dy][x + dx] = false;
                    carveMaze(nx, ny);
                }
            }
        }
        
        carveMaze(0, 0);
        grid[mazeSize - 1][mazeSize - 1] = false;
        
        for (let y = 0; y < mazeSize; y++) {
            for (let x = 0; x < mazeSize; x++) {
                if (grid[y][x]) {
                    walls.push({ x: x * cellSize, y: y * cellSize, width: cellSize, height: 4 });
                    walls.push({ x: x * cellSize, y: y * cellSize, width: 4, height: cellSize });
                }
            }
        }
    }

    function updateHighScore() {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem("highScore", highScore);
        }
        document.getElementById("highScore").textContent = highScore;
    }
    
    function generateCoins() {
        coins = [];
        for (let i = 0; i < 10; i++) { // Genera 10 monedas en lugares aleatorios
            let { x, y } = getRandomFreePosition();
            coins.push({ x, y, radius: 5 });
        }
    }

    function ensureOneSolution() {
        for (let y = 0; y < mazeSize; y++) {
            for (let x = 0; x < mazeSize; x++) {
                if (x === mazeSize - 1 && y === mazeSize - 1) continue;
                if (grid[y][x]) walls.push({ x: x * cellSize, y: y * cellSize, width: cellSize, height: cellSize });
            }
        }
    }

    function movePlayer() {
        let newX = player.x;
        let newY = player.y;

        if (keys["ArrowUp"] && player.y - player.radius > 0) newY -= player.speed;
        if (keys["ArrowDown"] && player.y + player.radius < canvas.height) newY += player.speed;
        if (keys["ArrowLeft"] && player.x - player.radius > 0) newX -= player.speed;
        if (keys["ArrowRight"] && player.x + player.radius < canvas.width) newX += player.speed;
    
        if (!walls.some(wall =>
            newX + player.radius > wall.x &&
            newX - player.radius < wall.x + wall.width &&
            newY + player.radius > wall.y &&
            newY - player.radius < wall.y + wall.height
        )) {
            player.x = newX;
            player.y = newY;
        }
    }    

    function moveEnemies() {
        enemies.forEach(enemy => {
            let newX = enemy.x;
            let newY = enemy.y;

            if (enemy.direction === "ArrowUp") newY -= enemy.speed;
            if (enemy.direction === "ArrowDown") newY += enemy.speed;
            if (enemy.direction === "ArrowLeft") newX -= enemy.speed;
            if (enemy.direction === "ArrowRight") newX += enemy.speed;
    
            let collision = walls.some(wall =>
                newX + enemy.radius > wall.x &&
                newX - enemy.radius < wall.x + wall.width &&
                newY + enemy.radius > wall.y &&
                newY - enemy.radius < wall.y + wall.height
            );
    
            // Evitar que los enemigos salgan del canvas
            if (newX - enemy.radius < 0 || newX + enemy.radius > canvas.width || 
                newY - enemy.radius < 0 || newY + enemy.radius > canvas.height) {
                collision = true;
            }
    
            if (!collision) {
                enemy.x = newX;
                enemy.y = newY;
            } else {
                enemy.direction = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"][Math.floor(Math.random() * 4)];
            }
        });
    }    
                
    function getRandomFreePosition() {
        let x, y;
        do {
            let gridX = Math.floor(Math.random() * mazeSize);
            let gridY = Math.floor(Math.random() * mazeSize);
            if (!grid[gridY][gridX]) { // Solo celdas libres
                x = gridX * cellSize + cellSize / 2;
                y = gridY * cellSize + cellSize / 2;
            }
        } while (!x || !y);
        return { x, y };
    }
    
    function startGame() {
        document.getElementById("startScreen").style.display = "none";
        document.getElementById("gameCanvas").style.display = "block";
        gameLoop();
    }    


    function resetLevel(resetScore = false) {
        generateMaze();
        ensureOneSolution();
        generateCoins(); 
        
        grid[0][0] = false;
        player.x = 30;
        player.y = 30;
        player.speed = Math.max(5 - level * 0.2, 2);
        keys = {};
    
        if (resetScore) {
            updateHighScore(); // Actualiza el puntaje más alto antes de reiniciar
            score = 0; 
        }
    
        let enemyCount = 2 + level;
        enemies = Array.from({ length: enemyCount }, () => {
            let { x, y } = getRandomFreePosition();
            return {
                x,
                y,
                radius: 10,
                speed: 2,
                direction: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"][Math.floor(Math.random() * 4)],
                changeDirectionCooldown: 0
            };
        });
    
        updateHighScore(); // Asegura que se muestre el puntaje más alto actualizado
    }   

    resetLevel();

    function checkCollisionWithEnemies() {
        for (let i = 0; i < enemies.length; i++) {
            let enemy = enemies[i];
    
            // Calcular la distancia entre el jugador y el enemigo
            let dx = player.x - enemy.x;
            let dy = player.y - enemy.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
    
            if (distance < player.radius + enemy.radius) {
                // Si hay colisión, termina el juego
                let level = parseInt(document.getElementById("level").textContent);
                let score = parseInt(document.getElementById("score").textContent);
                let highScore = Math.max(score, parseInt(document.getElementById("highScore").textContent));
    
                document.getElementById("highScore").textContent = highScore; 
                gameOver(level, score, highScore);
                return;  // Sal del bucle para evitar múltiples llamadas
            }
        }
    }    

    document.addEventListener("keydown", function (event) {
        keys[event.key] = true;
        
        // Guarda la última dirección para que el láser dispare correctamente
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            lastDirection = event.key;
        }

        if (event.key === " ") { 
            shootLaser(); // Disparar láser con la barra espaciadora
        }
    });

    document.addEventListener("keyup", function (event) {
        keys[event.key] = false;
    });

    function gameOver() {
        gameOverSound.play();
    
        // Guarda el puntaje actual antes de reiniciar
        let finalScore = score;  
        let finalHighScore = Math.max(score, highScore); 
    
        // Actualiza el puntaje final en el modal
        document.getElementById("finalScore").textContent = finalScore;
        document.getElementById("finalHighScore").textContent = finalHighScore;
    
        // Mostrar el modal de Bootstrap
        let gameOverModal = new bootstrap.Modal(document.getElementById("gameOverModal"));
        gameOverModal.show();
    
        // Actualizar el puntaje más alto
        updateHighScore();
    
        // Reiniciar el nivel (resetear el puntaje después de mostrarlo)
        resetLevel(true);
    }      
    
    window.addEventListener("keydown", (event) => {
        // Verifica si la tecla presionada es una flecha o la barra espaciadora
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
            event.preventDefault();  // Evita que la página se desplace
        }
    });       
    
    const laserSound = new Audio("laser.mp3");
    const explosionSound = new Audio("explosion.mp3");
    const levelUpSound = new Audio("nivel.mp3"); // Nuevo sonido para subir de nivel 
    const gameOverSound = new Audio("gameover.mp3"); // Sonido de Game Over   
    const coinSound = new Audio("coin.mp3");

    function shootLaser() {
        if (!lastDirection) return;
    
        let laserSound = new Audio("laser.mp3"); // Nueva instancia para cada disparo
        laserSound.play();
    
        let laserSpeed = 7;
        let laser = {
            x: player.x,
            y: player.y,
            radius: 4,
            speed: laserSpeed,
            direction: lastDirection
        };
    
        lasers.push(laser);
    }        

    function moveLasers() {
        lasers = lasers.filter(laser => {
            let newX = laser.x;
            let newY = laser.y;
    
            if (laser.direction === "ArrowUp") newY -= laser.speed;
            if (laser.direction === "ArrowDown") newY += laser.speed;
            if (laser.direction === "ArrowLeft") newX -= laser.speed;
            if (laser.direction === "ArrowRight") newX += laser.speed;
    
            // Verificar colisión con paredes
            let collision = walls.some(wall =>
                newX + laser.radius > wall.x &&
                newX - laser.radius < wall.x + wall.width &&
                newY + laser.radius > wall.y &&
                newY - laser.radius < wall.y + wall.height
            );
    
            if (collision) {
                return false; // Eliminar el láser si choca con una pared
            }
    
            // Actualizar posición si no hay colisión
            laser.x = newX;
            laser.y = newY;
    
            // Mantener el láser en la lista solo si sigue dentro del canvas
            return laser.x > 0 && laser.x < canvas.width && laser.y > 0 && laser.y < canvas.height;
        });
    }
    
    function checkLaserCollisions() {
        for (let i = lasers.length - 1; i >= 0; i--) {
            for (let j = enemies.length - 1; j >= 0; j--) {
                let dx = lasers[i].x - enemies[j].x;
                let dy = lasers[i].y - enemies[j].y;
                let distance = Math.sqrt(dx * dx + dy * dy);
    
                if (distance < lasers[i].radius + enemies[j].radius) {
                    score += 50; // Aumentar puntaje en 50 al eliminar un enemigo
    
                    // Reproducir sonido de explosión
                    let explosionSound = new Audio("explosion.mp3"); 
                    explosionSound.play();
    
                    enemies.splice(j, 1); // Eliminar enemigo
                    lasers.splice(i, 1); // Eliminar láser
                    document.getElementById("score").textContent = score; // Actualizar puntaje en pantalla
                    break; // Salir del bucle interno para evitar errores
                }
            }
        }
    }                
    
    function checkGoal() {
        return player.x + player.radius > goal.x &&
            player.x - player.radius < goal.x + goal.width &&
            player.y + player.radius > goal.y &&
            player.y - player.radius < goal.y + goal.height;
    }

    function nextLevel() {
        if (isLevelPopupOpen) return;
    
        isLevelPopupOpen = true;
        levelUpSound.play();
        level++;
    
        // Actualiza el nivel en la ventana emergente
        document.getElementById("nextLevel").textContent = level;
    
        // Muestra la ventana emergente
        const popup = document.getElementById("levelUpPopup");
        popup.style.display = "flex";
    
        // Pausa el juego
        cancelAnimationFrame(gameLoopId);
    
        // Asegúrate de asociar correctamente el evento al botón
        const closeButton = document.getElementById("closeLevelButton");
        closeButton.onclick = closeLevelPopup;
    }
    
    function closeLevelPopup() {
        // Oculta la ventana emergente correctamente
        const popup = document.getElementById("levelUpPopup");
        popup.style.display = "none";
    
        // Restablece la variable de bloqueo
        isLevelPopupOpen = false;
    
        // Reinicia el nivel
        resetLevel();
    
        // Reanuda el juego
        gameLoopId = requestAnimationFrame(gameLoop);
    }
    
    function goBack() {
        var gameOverModal = bootstrap.Modal.getInstance(document.getElementById('gameOverModal'));
        gameOverModal.hide();
    
        var instructionsModal = new bootstrap.Modal(document.getElementById('instructionsModal'));
        instructionsModal.show();
    }
    
    function restartGame() {
        location.reload(); // Recarga la página para reiniciar todo
    }      
    
    function checkCoinCollection() {
        for (let i = coins.length - 1; i >= 0; i--) {
            let dx = player.x - coins[i].x;
            let dy = player.y - coins[i].y;
            let distance = Math.sqrt(dx * dx + dy * dy);
    
            if (distance < player.radius + coins[i].radius) {
                score += 5; // Sumar 5 puntos
                coinSound.play(); // 🔹 Reproducir sonido de moneda
                coins.splice(i, 1); // Eliminar la moneda recolectada
                document.getElementById("score").textContent = score; // Actualizar el puntaje en pantalla
            }
        }
    }      
    
    let fondo = new Image();
    fondo.src = "tierra.jpg";

    let granjeroImg = new Image();
    granjeroImg.src = "granjero.png";

    let maizImg = new Image();
    maizImg.src = "maiz.png";
    
    let enemyImg = new Image();
    enemyImg.src = "marvin.png";

    function draw() {
        ctx.drawImage(fondo, 0, 0, canvas.width, canvas.height);
    
        ctx.fillStyle = "#018D06"; 
        walls.forEach(wall => {
            ctx.shadowColor = "#3F9228";
            ctx.shadowBlur = 2;
            ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
        });
    
        ctx.fillStyle = "gold";
        ctx.beginPath();
        ctx.arc(goal.x + goal.width / 2, goal.y + goal.height / 2, 10 + Math.sin(Date.now() * 0.005) * 5, 0, Math.PI * 2);
        ctx.fill();
    
        ctx.shadowBlur = 0; // Elimina el sombreado
        let imgWidth = player.radius * 4;
        let imgHeight = player.radius * 4;
        ctx.drawImage(granjeroImg, player.x - imgWidth / 2, player.y - imgHeight / 2, imgWidth, imgHeight);

    
        const enemyImgSize = new Image();
        enemyImgSize.src = "marvin.png";

        enemyImg.onload = () => {
            console.log("Imagen cargada");
        };

        enemies.forEach(enemy => {
            let enemyImgSize = enemy.radius * 3;
            ctx.drawImage(enemyImg, enemy.x - enemyImgSize / 2, enemy.y - enemyImgSize / 2, enemyImgSize, enemyImgSize);
        });
    
        ctx.fillStyle = "yellow";
        ctx.shadowColor = "gold";
        ctx.shadowBlur = 15;
        lasers.forEach(laser => {
            ctx.beginPath();
            ctx.arc(laser.x, laser.y, 6, 0, Math.PI * 2);
            ctx.fill();
        });
    
        ctx.fillStyle = "gold";
        ctx.shadowColor = "orange";
        ctx.shadowBlur = 10;

        const coinSize = 35;
        
        coins.forEach(coin => {
            ctx.drawImage(maizImg, coin.x - coinSize / 2, coin.y - coinSize / 2, coinSize, coinSize); // Centrar la imagen
        });
    
        document.getElementById("score").textContent = score;
        document.getElementById("level").textContent = level;
        document.getElementById("highScore").textContent = highScore;
    }
    
    // Inicializar el puntaje más alto en la interfaz
    document.addEventListener("DOMContentLoaded", function () {
        document.getElementById("highScore").textContent = highScore;
    });
    
    let lastDirection = "ArrowRight"; // Dirección predeterminada

    document.addEventListener("keydown", function (event) {
        keys[event.key] = true;
    
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            lastDirection = event.key; // Actualiza la última dirección presionada
        }
    
        if (event.key === " ") { // Disparo con la barra espaciadora
            shootLaser();
        }
    });    
    
    document.addEventListener("keyup", function (event) {
        keys[event.key] = false;
    });       


    function gameLoop() {
        movePlayer();
        moveEnemies();
        moveLasers();
        checkLaserCollisions();
        checkCollisionWithEnemies();
        checkCoinCollection();

        if (checkGoal()) {
            nextLevel();
            return;  // Pausa el juego temporalmente para mostrar la ventana
        }

        draw();
        gameLoopId = requestAnimationFrame(gameLoop);
    }
    gameLoop();

    function startGame() {
        resetLevel();
        gameLoopId = requestAnimationFrame(gameLoop);
    }
    startGame();
});