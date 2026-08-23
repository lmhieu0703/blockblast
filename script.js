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
let currentChoices = [null, null, null];

// CÁC KHỐI GẠCH 
const SHAPES = [
    { map: [[1]], color: 'color-1' }, // 1x1
    { map: [[1,1],[1,1]], color: 'color-2' }, // 2x2 vuông
    { map: [[1,1,1],[1,1,1],[1,1,1]], color: 'color-3' }, // 3x3 vuông
    { map: [[1,1,1,1]], color: 'color-4' }, // 1x4 ngang
    { map: [[1],[1],[1],[1]], color: 'color-4' }, // 1x4 dọc
    { map: [[1,1],[1,0]], color: 'color-5' }, // L nhỏ
    { map: [[1,1,1],[1,0,0],[1,0,0]], color: 'color-6' }, // L lớn
    { map: [[1,1,1],[0,1,0]], color: 'color-7' } // Chữ T
];

// Lấy các phần tử HTML
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
    
    // Tải ảnh nền nếu có
    const savedBg = localStorage.getItem('blockBlastCustomBg');
    if (savedBg) {
        gameScreen.style.backgroundImage = `linear-gradient(rgba(5, 10, 21, 0.6), rgba(5, 10, 21, 0.6)), url('${savedBg}')`;
    }
};

// FIX LỖI ĐĂNG KÝ (Vào thẳng game không bị kẹt)
document.getElementById('btn-register').addEventListener('click', () => {
    const nameInput = document.getElementById('new-player-name').value.trim();
    if (nameInput.length < 2) {
        alert("Tên phải dài hơn 2 ký tự!");
        return;
    }
    
    playerId = 'user_' + Date.now();
    localStorage.setItem('blockBlastPlayerId', playerId);
    
    // Lưu thẳng lên máy chủ
    db.ref(`blockblast/users/${playerId}`).set({
        name: nameInput,
        money: 20,
        score: 0,
        lastTop3Reward: Date.now()
    }).then(() => {
        alert("🎉 Đăng ký thành công! Bạn nhận được 20$ quà khởi nghiệp!");
        loginScreen.classList.add('hidden');
        loadUserData();
    }).catch((error) => {
        alert("Lỗi kết nối máy chủ: " + error.message);
    });
});

// Tải dữ liệu người chơi
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

        // Xử lý Hộp Thư
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
        checkTop3Reward(data.lastTop3Reward);
    });
}

// Thưởng Top 3 mỗi tiếng 20$
function checkTop3Reward(lastRewardTime) {
    db.ref('blockblast/users').orderByChild('score').limitToLast(3).once('value', snap => {
        let topPlayers = [];
        snap.forEach(child => { topPlayers.push(child.key); });
        
        if (topPlayers.includes(playerId)) {
            const now = Date.now();
            if (!lastRewardTime || (now - lastRewardTime >= 3600000)) { 
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
// 4. LOGIC ĐỔI NỀN & CÁC TÍNH NĂNG KINH TẾ
// ==========================================
document.getElementById('bg-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) return alert("Ảnh quá nặng! Chọn ảnh dưới 5MB nhé.");
        const reader = new FileReader();
        reader.onload = function(event) {
            const imgUrl = event.target.result;
            gameScreen.style.backgroundImage = `linear-gradient(rgba(5, 10, 21, 0.6), rgba(5, 10, 21, 0.6)), url('${imgUrl}')`;
            localStorage.setItem('blockBlastCustomBg', imgUrl);
            alert("✅ Đã đổi ảnh nền thành công! Bấm BẮT ĐẦU CHƠI để xem!");
        }
        reader.readAsDataURL(file);
    }
});

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
document.getElementById('btn-inbox').onclick = () => { switchScreen('menu-screen', 'inbox-screen'); renderInbox(); };
document.getElementById('btn-leaderboard').onclick = () => { switchScreen('menu-screen', 'leaderboard-screen'); loadLeaderboard(); };

// Nhập Code
document.getElementById('btn-submit-code').onclick = () => {
    let code = document.getElementById('giftcode-input').value.trim().toUpperCase();
    if(!code) return;
    
    db.ref(`blockblast/codes/${code}`).once('value', snap => {
        if(!snap.exists()) return alert("Mã không tồn tại hoặc đã bị Admin thu hồi!");
        let codeData = snap.val();
        if(codeData.usedBy && codeData.usedBy[playerId]) return alert("Bạn đã nhận mã này rồi!");
        
        db.ref(`blockblast/codes/${code}/usedBy/${playerId}`).set(true);
        db.ref(`blockblast/users/${playerId}/money`).set(playerMoney + codeData.amount);
        alert(`🎉 Ngon lành! Húp được ${codeData.amount}$ từ mã ${code}`);
        document.getElementById('giftcode-input').value = "";
    });
};

// Chuyển Tiền
document.getElementById('btn-submit-transfer').onclick = () => {
    let targetName = document.getElementById('transfer-receiver').value.trim();
    let amount = parseInt(document.getElementById('transfer-amount').value);
    let msg = document.getElementById('transfer-message').value || "Gửi cho bạn ít tiền nè!";
    
    if(!targetName || amount <= 0 || isNaN(amount)) return alert("Vui lòng điền số tiền hợp lệ!");
    if(amount > playerMoney) return alert("Bạn không đủ tiền để chuyển!");
    if(targetName === playerName) return alert("Không thể tự chuyển cho chính mình!");

    db.ref('blockblast/users').orderByChild('name').equalTo(targetName).once('value', snap => {
        if(!snap.exists()) return alert("Không tìm thấy người chơi này!");
        
        let targetId = Object.keys(snap.val())[0];
        db.ref(`blockblast/users/${playerId}/money`).set(playerMoney - amount);
        db.ref(`blockblast/users/${targetId}/inbox`).push({
            sender: playerName, amount: amount, message: msg, isRead: false
        });
        alert(`✅ Đã chuyển ${amount}$ cho ${targetName} thành công!`);
        document.getElementById('transfer-receiver').value = '';
        document.getElementById('transfer-amount').value = '';
    });
};

// Hộp Thư
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
                ${!msg.isRead ? `<button onclick="claimMail('${id}', ${msg.amount})" class="btn btn-primary" style="margin-top:10px; padding:8px;">NHẬN TIỀN</button>` : `<span style="color:#64748b; font-size:12px; float:right; margin-top:10px;">Đã nhận</span>`}
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

// Bảng Xếp Hạng
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
// 5. CORE GAME LOGIC VÀ ENGINE KÉO THẢ
// ==========================================
document.getElementById('btn-play').onclick = () => {
    switchScreen('menu-screen', 'game-screen');
    startGame();
};
document.getElementById('btn-quit').onclick = () => {
    if(confirm("Thoát bây giờ là mất trắng điểm ván này. Bạn chắc chứ?")) backToMenu();
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
            // CỰC KỲ QUAN TRỌNG ĐỂ KÉO THẢ NHẬN DIỆN Ô:
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
        
        for(let r=0; r<shapeInfo.map.length; r++) {
            for(let c=0; c<shapeInfo.map[0].length; c++) {
                let p = document.createElement('div');
                if(shapeInfo.map[r][c]) p.className = `block-unit ${shapeInfo.color}`;
                shapeEl.appendChild(p);
            }
        }
        
        slot.appendChild(shapeEl);
        choicesEl.appendChild(slot);
        
        makeDraggable(shapeEl, shapeInfo, i);
    }
    checkGameOver();
}

// ----------------------------------------------------
// THUẬT TOÁN KÉO THẢ "MẮT THẦN"
// ----------------------------------------------------
let activeDrag = null;
function makeDraggable(el, shape, index) {
    let offset = 80; // Nhích lên 80px để ngón tay không che mất gạch

    function startDrag(e) {
        let touch = e.type.includes('touch') ? e.touches[0] : e;
        
        activeDrag = el.cloneNode(true);
        activeDrag.style.position = 'fixed';
        activeDrag.style.zIndex = '9999';
        activeDrag.style.pointerEvents = 'none'; // BẮT BUỘC ĐỂ ĐÂM XUYÊN LẤY TỌA ĐỘ
        activeDrag.style.transform = 'scale(1)'; 
        document.body.appendChild(activeDrag);
        
        el.style.opacity = '0.2';
        moveDrag(e);
    }
    
    function moveDrag(e) {
        if(!activeDrag) return;
        let touch = e.type.includes('touch') ? e.touches[0] : e;
        
        activeDrag.style.left = (touch.clientX - (activeDrag.offsetWidth / 2)) + 'px';
        activeDrag.style.top = (touch.clientY - offset) + 'px';
    }
    
    function endDrag(e) {
        if(!activeDrag) return;
        
        // Xác định vị trí góc trên cùng bên trái của viên gạch
        let dragRect = activeDrag.getBoundingClientRect();
        let targetX = dragRect.left + 20; // +20px là vào tâm của ô vuông đầu tiên
        let targetY = dragRect.top + 20;

        // "Mắt thần": Bắn tia từ tọa độ đó xuống dưới xem trúng ô nào
        let dropTarget = document.elementFromPoint(targetX, targetY);

        activeDrag.remove();
        activeDrag = null;
        el.style.opacity = '1';

        // Nếu tia bắn trúng đúng 1 ô trên bàn cờ
        if (dropTarget && dropTarget.id && dropTarget.id.startsWith('cell-')) {
            let parts = dropTarget.id.split('-');
            let r = parseInt(parts[1]);
            let c = parseInt(parts[2]);

            // Kiểm tra xem hình có nhét vừa không
            if(canPlace(shape, r, c)) {
                placeShape(shape, r, c);
                el.parentElement.innerHTML = '';
                currentChoices[index] = null;
                
                checkLines();
                
                if(currentChoices.every(s => s === null)) {
                    spawnShapes();
                } else {
                    checkGameOver();
                }
            }
        }
    }
    
    // Gắn sự kiện (passive: false để chống lỗi cuộn web)
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
    document.getElementById('current-score').innerText = score;
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
    score += lines * 10;
    document.getElementById('current-score').innerText = score;
    drawBoard();
}

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
        db.ref(`blockblast/users/${playerId}/money`).set(playerMoney - reviveCost);
        reviveCost *= 2; 
        reviveModal.classList.add('hidden');
        
        // Phá nát 3 hàng dưới cùng
        for(let r=5; r<8; r++) {
            for(let c=0; c<gridSize; c++) board[r][c] = 0;
        }
        drawBoard();
        alert("💥 BÙM! 3 hàng dưới đã bị phá hủy. Tiếp tục quẩy thôi!");
    } else {
        alert("Ví bạn hết tiền rồi! Nạp Code hoặc xin xỏ bạn bè đi!");
    }
};

document.getElementById('btn-die').onclick = () => {
    reviveModal.classList.add('hidden');
    let msg = `Game Over!\nĐiểm ván này: ${score}`;
    
    if(score > highScore) {
        msg += `\n🎉 ĐỈNH CAO! Phá kỷ lục cá nhân. Hệ thống thưởng nóng 10$!`;
        db.ref(`blockblast/users/${playerId}/score`).set(score);
        db.ref(`blockblast/users/${playerId}/money`).set(playerMoney + 10);
    }
    alert(msg);
    backToMenu();
};