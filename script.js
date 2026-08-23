// ==========================================
// 1. CẤU HÌNH FIREBASE ONLINE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDEQLXAKLqYka8RXqJXrOIGTJicHVw2Rjs",
    authDomain: "may-chu-lmh-f42e0.firebaseapp.com",
    databaseURL: "https://may-chu-lmh-f42e0-default-rtdb.firebaseio.com",
    projectId: "may-chu-lmh-f42e0",
    storageBucket: "may-chu-lmh-f42e0.firebasestorage.app",
    messagingSenderId: "498997200625",
    appId: "1:498997200625:web:9a8260bb3e5d35a2264b50"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// 2. BIẾN TOÀN CỤC & TRẠNG THÁI GAME
// ==========================================
let playerId = localStorage.getItem('blockBlastPlayerId');
let playerName = "";
let playerMoney = 0;
let highScore = 0;
let score = 0;
let reviveCost = 1; 

const gridSize = 8;
let board = Array.from({length: gridSize}, () => Array(gridSize).fill(0));
let currentChoices = [];

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const reviveModal = document.getElementById('revive-modal');
const gameBoardEl = document.getElementById('game-board');
const choicesEl = document.getElementById('block-choices');

// ==========================================
// 3. KHỞI TẠO TÀI KHOẢN & DATA
// ==========================================
window.onload = () => {
    if (!playerId) {
        loginScreen.classList.remove('hidden');
    } else {
        loadUserData();
    }
};

document.getElementById('btn-register').addEventListener('click', () => {
    const nameInput = document.getElementById('new-player-name').value.trim();
    if (nameInput.length < 2) return alert("Tên phải dài hơn 2 ký tự!");
    
    // Check trùng tên
    db.ref('blockblast/users').orderByChild('name').equalTo(nameInput).once('value', snapshot => {
        if (snapshot.exists()) {
            alert("Tên này đã có người dùng! Đổi tên khác nhé sếp.");
        } else {
            playerId = 'user_' + Date.now();
            localStorage.setItem('blockBlastPlayerId', playerId);
            
            db.ref(`blockblast/users/${playerId}`).set({
                name: nameInput,
                money: 20, // Quà tân thủ
                score: 0,
                lastTop3Reward: Date.now()
            }).then(() => {
                alert("🎉 Đăng ký thành công! Bạn nhận được 20$ quà khởi nghiệp!");
                loginScreen.classList.add('hidden');
                loadUserData();
            });
        }
    });
});

function loadUserData() {
    db.ref(`blockblast/users/${playerId}`).on('value', snap => {
        if (!snap.exists()) return;
        const data = snap.val();
        playerName = data.name;
        playerMoney = data.money || 0;
        highScore = data.score || 0;
        
        document.getElementById('player-name-display').innerText = playerName;
        document.getElementById('player-money-display').innerText = playerMoney;
        document.getElementById('high-score').innerText = highScore;

        // Check Hộp thư
        if (data.inbox) {
            let unread = Object.values(data.inbox).filter(msg => !msg.isRead).length;
            const badge = document.getElementById('inbox-badge');
            if(unread > 0) {
                badge.innerText = unread;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
        
        // Quà Top 3 mỗi giờ
        checkTop3Reward(data.lastTop3Reward);
    });
}

// Logic Tặng tiền Top 3 (1 tiếng = 20$)
function checkTop3Reward(lastRewardTime) {
    db.ref('blockblast/users').orderByChild('score').limitToLast(3).once('value', snap => {
        let topPlayers = [];
        snap.forEach(child => { topPlayers.push(child.key); });
        
        if (topPlayers.includes(playerId)) {
            const now = Date.now();
            if (!lastRewardTime || (now - lastRewardTime >= 3600000)) { // 3600000ms = 1 giờ
                db.ref(`blockblast/users/${playerId}/inbox`).push({
                    sender: "HỆ THỐNG", amount: 20, isRead: false,
                    message: "Thưởng duy trì TOP 3 Cao thủ! (Mỗi giờ nhận 1 lần)"
                });
                db.ref(`blockblast/users/${playerId}`).update({ lastTop3Reward: now });
            }
        }
    });
}

// ==========================================
// 4. MENU CHỨC NĂNG (CODE, CHUYỂN TIỀN, HỘP THƯ)
// ==========================================
function switchScreen(hideId, showId) {
    document.querySelectorAll('.screen').forEach(el => {
        el.classList.remove('active');
        if(!el.classList.contains('overlay-screen')) el.classList.add('hidden');
    });
    document.getElementById(showId).classList.remove('hidden');
    document.getElementById(showId).classList.add('active');
}
function backToMenu() { switchScreen('any', 'menu-screen'); }

document.getElementById('btn-giftcode').onclick = () => switchScreen('menu-screen', 'code-screen');
document.getElementById('btn-transfer').onclick = () => switchScreen('menu-screen', 'transfer-screen');
document.getElementById('btn-inbox').onclick = () => {
    switchScreen('menu-screen', 'inbox-screen');
    renderInbox();
};
document.getElementById('btn-leaderboard').onclick = () => {
    switchScreen('menu-screen', 'leaderboard-screen');
    loadLeaderboard();
};

// Nhập Giftcode
document.getElementById('btn-submit-code').onclick = () => {
    let code = document.getElementById('giftcode-input').value.trim().toUpperCase();
    if(!code) return;
    
    db.ref(`blockblast/codes/${code}`).once('value', snap => {
        if(!snap.exists()) return alert("Mã không tồn tại hoặc đã hết hạn!");
        let codeData = snap.val();
        
        if(codeData.usedBy && codeData.usedBy[playerId]) return alert("Bạn đã nhập mã này rồi!");
        
        db.ref(`blockblast/codes/${code}/usedBy/${playerId}`).set(true);
        db.ref(`blockblast/users/${playerId}/money`).set(playerMoney + codeData.amount);
        alert(`🎉 Thành công! Bạn nhận được ${codeData.amount}$ từ mã ${code}`);
        document.getElementById('giftcode-input').value = "";
    });
};

// Chuyển tiền
document.getElementById('btn-submit-transfer').onclick = () => {
    let targetName = document.getElementById('transfer-receiver').value.trim();
    let amount = parseInt(document.getElementById('transfer-amount').value);
    let msg = document.getElementById('transfer-message').value || "Gửi cho bạn ít tiền nè!";
    
    if(!targetName || amount <= 0 || isNaN(amount)) return alert("Vui lòng điền đúng thông tin!");
    if(amount > playerMoney) return alert("Bạn không đủ tiền để chuyển!");
    if(targetName === playerName) return alert("Không thể tự chuyển cho chính mình!");

    db.ref('blockblast/users').orderByChild('name').equalTo(targetName).once('value', snap => {
        if(!snap.exists()) return alert("Không tìm thấy người chơi này!");
        
        let targetId = Object.keys(snap.val())[0];
        // Trừ tiền người gửi
        db.ref(`blockblast/users/${playerId}/money`).set(playerMoney - amount);
        // Bắn vào hộp thư người nhận
        db.ref(`blockblast/users/${targetId}/inbox`).push({
            sender: playerName, amount: amount, message: msg, isRead: false
        });
        alert(`✅ Đã chuyển thành công ${amount}$ cho ${targetName}!`);
    });
};

// Mở hộp thư
function renderInbox() {
    db.ref(`blockblast/users/${playerId}/inbox`).once('value', snap => {
        const list = document.getElementById('inbox-list');
        if (!snap.exists()) { list.innerHTML = '<div class="empty-msg">Hộp thư trống!</div>'; return; }
        
        list.innerHTML = '';
        snap.forEach(child => {
            let id = child.key;
            let msg = child.val();
            let div = document.createElement('div');
            div.className = 'inbox-item';
            div.innerHTML = `
                <span class="sender">Từ: ${msg.sender}</span>
                <span class="amount">+${msg.amount}$</span>
                <div class="msg">"${msg.message}"</div>
                ${!msg.isRead ? `<button onclick="claimMail('${id}', ${msg.amount})" style="margin-top:10px; padding:5px; background:#00f5d4; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">NHẬN TIỀN</button>` : `<span style="color:#64748b; font-size:12px; float:right; margin-top:10px;">Đã nhận</span>`}
            `;
            list.prepend(div);
        });
    });
}

window.claimMail = function(mailId, amount) {
    db.ref(`blockblast/users/${playerId}/money`).set(playerMoney + amount);
    db.ref(`blockblast/users/${playerId}/inbox/${mailId}/isRead`).set(true);
    alert(`Đã nhận ${amount}$ vào tài khoản!`);
    renderInbox();
};

function loadLeaderboard() {
    db.ref('blockblast/users').orderByChild('score').limitToLast(20).once('value', snap => {
        let scores = [];
        snap.forEach(child => { scores.push(child.val()); });
        scores.sort((a, b) => b.score - a.score);
        
        let html = '';
        scores.forEach((p, i) => {
            html += `<tr>
                <td style="${i<3 ? 'color:#f3ca20; font-size:20px;' : ''}">${i+1}</td>
                <td style="${i<3 ? 'color:#f3ca20;' : ''}">${p.name}</td>
                <td class="text-gold">${p.score}</td>
            </tr>`;
        });
        document.getElementById('leaderboard-body').innerHTML = html;
    });
}

// ==========================================
// 5. LOGIC GAME CORE (BLOCK BLAST)
// ==========================================
const SHAPES = [
    { map: [[1]], color: 'color-1' }, // 1x1
    { map: [[1,1],[1,1]], color: 'color-2' }, // 2x2 vuông
    { map: [[1,1,1],[1,1,1],[1,1,1]], color: 'color-3' }, // 3x3 vuông
    { map: [[1,1,1,1]], color: 'color-4' }, // 1x4 ngang
    { map: [[1],[1],[1],[1]], color: 'color-4' }, // 1x4 dọc
    { map: [[1,0],[1,1]], color: 'color-5' }, // L nhỏ
    { map: [[1,1,1],[1,0,0],[1,0,0]], color: 'color-6' }, // L lớn
    { map: [[1,1,1],[0,1,0],[0,1,0]], color: 'color-7' } // Chữ T
];

document.getElementById('btn-play').onclick = () => {
    switchScreen('menu-screen', 'game-screen');
    startGame();
};
document.getElementById('btn-quit').onclick = () => {
    if(confirm("Thoát game sẽ mất điểm ván này. Đồng ý thoát?")) {
        backToMenu();
    }
};

function startGame() {
    board = Array.from({length: gridSize}, () => Array(gridSize).fill(0));
    score = 0;
    reviveCost = 1;
    document.getElementById('current-score').innerText = score;
    reviveModal.classList.add('hidden');
    drawBoard();
    spawnShapes();
}

function drawBoard() {
    gameBoardEl.innerHTML = '';
    for(let r=0; r<gridSize; r++) {
        for(let c=0; c<gridSize; c++) {
            let cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${r}-${c}`;
            if(board[r][c] !== 0) cell.classList.add('block-unit', board[r][c]);
            gameBoardEl.appendChild(cell);
        }
    }
}

function spawnShapes() {
    choicesEl.innerHTML = '';
    currentChoices = [];
    for(let i=0; i<3; i++) {
        let shapeInfo = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        currentChoices.push(shapeInfo);
        
        let slot = document.createElement('div');
        slot.className = 'choice-slot';
        
        let shapeEl = document.createElement('div');
        shapeEl.className = 'draggable-shape';
        shapeEl.style.gridTemplateColumns = `repeat(${shapeInfo.map[0].length}, 40px)`;
        shapeEl.dataset.index = i;
        
        // Vẽ ô nhỏ trong khối
        for(let r=0; r<shapeInfo.map.length; r++) {
            for(let c=0; c<shapeInfo.map[0].length; c++) {
                let p = document.createElement('div');
                if(shapeInfo.map[r][c]) p.className = `block-unit ${shapeInfo.color}`;
                shapeEl.appendChild(p);
            }
        }
        
        slot.appendChild(shapeEl);
        choicesEl.appendChild(slot);
        
        // Thêm sự kiện Kéo Thả bằng Chuột/Cảm ứng
        makeDraggable(shapeEl, shapeInfo, i);
    }
    checkGameOver();
}

// Logic Kéo thả và Xếp khối (Hỗ trợ cả Mobile vuốt chạm và PC)
let activeDrag = null;
function makeDraggable(el, shape, index) {
    let startX, startY;
    
    function startDrag(e) {
        let touch = e.type.includes('touch') ? e.touches[0] : e;
        activeDrag = el.cloneNode(true);
        activeDrag.style.position = 'fixed';
        activeDrag.style.pointerEvents = 'none'; // Để xét tia xuyên qua xuống bàn cờ
        activeDrag.style.zIndex = '999';
        activeDrag.style.transform = 'scale(1) translate(-50%, -50%)'; // Phóng to khi kéo
        document.body.appendChild(activeDrag);
        
        el.style.opacity = '0.3';
        moveDrag(e);
    }
    
    function moveDrag(e) {
        if(!activeDrag) return;
        let touch = e.type.includes('touch') ? e.touches[0] : e;
        activeDrag.style.left = touch.clientX + 'px';
        activeDrag.style.top = (touch.clientY - 40) + 'px'; // Nhích lên để khỏi che ngón tay
    }
    
    function endDrag(e) {
        if(!activeDrag) return;
        let touch = e.type.includes('touch') ? e.changedTouches[0] : e;
        let dropTarget = document.elementFromPoint(touch.clientX, touch.clientY - 40);
        
        activeDrag.remove();
        activeDrag = null;
        el.style.opacity = '1';
        
        if(dropTarget && dropTarget.id && dropTarget.id.startsWith('cell-')) {
            let parts = dropTarget.id.split('-');
            let r = parseInt(parts[1]);
            let c = parseInt(parts[2]);
            
            if(canPlace(shape, r, c)) {
                placeShape(shape, r, c);
                el.parentElement.innerHTML = ''; // Xóa khối ở khay
                currentChoices[index] = null;
                
                checkLines();
                
                // Nếu dùng hết 3 khối thì sinh 3 khối mới
                if(currentChoices.every(s => s === null)) {
                    spawnShapes();
                } else {
                    checkGameOver();
                }
            }
        }
    }
    
    el.addEventListener('mousedown', startDrag);
    el.addEventListener('touchstart', startDrag, {passive: false});
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('touchmove', moveDrag, {passive: false});
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
}

function canPlace(shape, startR, startC) {
    for(let r=0; r<shape.map.length; r++) {
        for(let c=0; c<shape.map[0].length; c++) {
            if(shape.map[r][c]) {
                let br = startR + r;
                let bc = startC + c;
                if(br >= gridSize || bc >= gridSize || board[br][bc] !== 0) return false;
            }
        }
    }
    return true;
}

function placeShape(shape, startR, startC) {
    let blocksPlaced = 0;
    for(let r=0; r<shape.map.length; r++) {
        for(let c=0; c<shape.map[0].length; c++) {
            if(shape.map[r][c]) {
                board[startR + r][startC + c] = shape.color;
                blocksPlaced++;
            }
        }
    }
    score += blocksPlaced;
    updateScore();
    drawBoard();
}

function checkLines() {
    let rowsToClear = [];
    let colsToClear = [];
    
    for(let r=0; r<gridSize; r++) {
        if(board[r].every(cell => cell !== 0)) rowsToClear.push(r);
    }
    for(let c=0; c<gridSize; c++) {
        let isFull = true;
        for(let r=0; r<gridSize; r++) {
            if(board[r][c] === 0) isFull = false;
        }
        if(isFull) colsToClear.push(c);
    }
    
    if(rowsToClear.length === 0 && colsToClear.length === 0) return;
    
    rowsToClear.forEach(r => { for(let c=0; c<gridSize; c++) board[r][c] = 0; });
    colsToClear.forEach(c => { for(let r=0; r<gridSize; r++) board[r][c] = 0; });
    
    let lines = rowsToClear.length + colsToClear.length;
    score += lines * 10; // 10 điểm 1 hàng
    
    updateScore();
    drawBoard();
}

function updateScore() {
    document.getElementById('current-score').innerText = score;
}

// Logic kiểm tra Thua và Hồi Sinh (Kinh tế)
function checkGameOver() {
    let canMove = false;
    currentChoices.forEach(shape => {
        if(shape !== null) {
            for(let r=0; r<gridSize; r++) {
                for(let c=0; c<gridSize; c++) {
                    if(canPlace(shape, r, c)) canMove = true;
                }
            }
        }
    });
    
    if(!canMove) {
        document.getElementById('revive-price').innerText = reviveCost;
        reviveModal.classList.remove('hidden');
    }
}

document.getElementById('btn-do-revive').onclick = () => {
    if(playerMoney >= reviveCost) {
        // Trừ tiền hồi sinh
        db.ref(`blockblast/users/${playerId}/money`).set(playerMoney - reviveCost);
        reviveCost *= 2; // Lần sau tăng gấp đôi
        reviveModal.classList.add('hidden');
        
        // Giải phóng 3 hàng bất kỳ để người chơi chơi tiếp
        for(let r=5; r<8; r++) {
            for(let c=0; c<gridSize; c++) board[r][c] = 0;
        }
        drawBoard();
        alert("Đã dùng tiền để phá các khối dưới cùng. Tiếp tục thôi!");
    } else {
        alert("Bạn không đủ tiền để hồi sinh! Hãy nạp Code hoặc xin bạn bè nhé.");
    }
};

document.getElementById('btn-die').onclick = () => {
    reviveModal.classList.add('hidden');
    let msg = `Game Over!\nĐiểm của bạn: ${score}`;
    
    if(score > highScore) {
        msg += `\n🎉 PHÁ KỶ LỤC CÁ NHÂN! Tặng ngay 10$`;
        db.ref(`blockblast/users/${playerId}/score`).set(score);
        db.ref(`blockblast/users/${playerId}/money`).set(playerMoney + 10);
    }
    alert(msg);
    backToMenu();
};
// ==========================================
// 6. XỬ LÝ ẢNH NỀN TÙY CHỌN BỞI NGƯỜI CHƠI
// ==========================================
const bgUpload = document.getElementById('bg-upload');
const gameScreenBg = document.getElementById('game-screen');

// Kiểm tra xem máy người chơi đã từng lưu ảnh nền nào chưa
const savedBg = localStorage.getItem('blockBlastCustomBg');
if (savedBg) {
    // Phủ thêm 1 lớp màu đen mờ (0.6) lên ảnh để khối gạch dễ nhìn hơn
    gameScreenBg.style.backgroundImage = `linear-gradient(rgba(5, 10, 21, 0.6), rgba(5, 10, 21, 0.6)), url('${savedBg}')`;
}

// Khi người chơi bấm tải ảnh lên
bgUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // Giới hạn dung lượng ảnh (không bắt buộc nhưng tốt cho Web)
        if (file.size > 5 * 1024 * 1024) {
            alert("Ảnh quá nặng! Vui lòng chọn ảnh dưới 5MB sếp nhé.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const imgUrl = event.target.result;
            // Áp dụng luôn vào nền lúc chơi
            gameScreenBg.style.backgroundImage = `linear-gradient(rgba(5, 10, 21, 0.6), rgba(5, 10, 21, 0.6)), url('${imgUrl}')`;
            
            // Lưu chết vào bộ nhớ trình duyệt để lần sau vào game vẫn còn
            localStorage.setItem('blockBlastCustomBg', imgUrl);
            
            alert("✅ Đã đổi ảnh nền thành công! Bấm BẮT ĐẦU CHƠI để xem thành quả nhé!");
        }
        reader.readAsDataURL(file);
    }
});