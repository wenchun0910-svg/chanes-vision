/**
 * 長安願景島 - UI 互動管理模組
 * 包含：標籤追蹤投影、側邊面板、對話泡泡、背包交易、小測驗與證書、問答小嚮導、流星雨 Canvas、第一人稱漫遊
 */

window.IslandUI = (function() {
  let content = null;
  let activeDialogue = null;
  let currentIslandId = null;
  let meteorAnimId = null;

  // 背包資料 (存在 localStorage)
  let inventory = {
    '🐚 貝殼': 3
  };

  // 漫遊狀態
  let isWalking = false;
  let walkPos = new THREE.Vector3(0, 4.7, 0);
  let walkYaw = 0;
  let walkPitch = 0;
  let walkKeys = { forward: false, backward: false, left: false, right: false };

  function init(contentData) {
    content = contentData;
    loadInventory();
    setupEventListeners();
    setupMeteorRain();
  }

  // 1. 讀取與儲存背包
  function loadInventory() {
    try {
      const saved = localStorage.getItem('chanes_inventory');
      if (saved) {
        inventory = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    updateBackpackUI();
  }

  function saveInventory() {
    try {
      localStorage.setItem('chanes_inventory', JSON.stringify(inventory));
    } catch (e) {}
    updateBackpackUI();
  }

  function addShell() {
    inventory['🐚 貝殼'] = (inventory['🐚 貝殼'] || 0) + 1;
    saveInventory();
    showToast('🐚 拾得沙灘貝殼！背包貝殼數量 +1');
  }

  function updateBackpackUI() {
    const badge = document.getElementById('dock-shell-count');
    if (badge) {
      badge.textContent = inventory['🐚 貝殼'] || 0;
    }
  }

  // 2. 3D 浮動標籤投影與羅盤 (穩定 DOM 不銷毀重建)
  const labelMap = {};

  function updateLabels(camera, layout) {
    const container = document.getElementById('labels-container');
    if (!container || isWalking) return;

    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;

    for (let id in layout) {
      const isConfig = layout[id];
      let label = labelMap[id];
      if (!label) {
        label = document.createElement('div');
        label.className = 'island-label';
        label.innerHTML = `<span>${isConfig.name}</span><span class="badge">${isConfig.title}</span>`;
        label.addEventListener('click', (e) => {
          e.stopPropagation();
          openIslandDrawer(id);
        });
        container.appendChild(label);
        labelMap[id] = label;
      }

      // 標籤世界坐標投影
      const pos = new THREE.Vector3(isConfig.x, 8.5, isConfig.z);
      pos.project(camera);

      // 判斷是否在螢幕前方且在可見範圍內
      if (pos.z < 1) {
        const x = (pos.x * widthHalf) + widthHalf;
        const y = -(pos.y * heightHalf) + heightHalf;
        if (x >= 20 && x <= window.innerWidth - 20 && y >= 20 && y <= window.innerHeight - 20) {
          label.style.left = `${x}px`;
          label.style.top = `${y}px`;
          label.style.display = 'flex';
        } else {
          label.style.display = 'none';
        }
      } else {
        label.style.display = 'none';
      }
    }

    // 更新右側羅盤指示器
    const needle = document.getElementById('compass-needle');
    if (needle) {
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      const angle = Math.atan2(camDir.x, camDir.z);
      needle.style.transform = `rotate(${angle}rad)`;
    }
  }

  // 3. 側邊抽屜面板 (點島展開)
  function openIslandDrawer(islandId) {
    currentIslandId = islandId;
    const drawer = document.getElementById('drawer-panel');
    const title = document.getElementById('drawer-title');
    const tag = document.getElementById('drawer-tag');
    const body = document.getElementById('drawer-body');

    // 平滑運鏡飛向該島
    window.IslandScene.flyToIsland(islandId);

    if (islandId === 'center') {
      const center = content.centerIsland;
      title.textContent = center.name;
      tag.textContent = center.role;

      let statsHtml = center.stats.map(s => `
        <div class="stat-card">
          <div class="stat-value">${s.value}</div>
          <div class="stat-label">${s.label} (${s.hint})</div>
        </div>
      `).join('');

      let visionsHtml = center.coreVisions.map(v => `
        <div class="vision-card">
          <div class="vision-role">${v.role} ｜ ${v.core}</div>
          <div class="vision-desc">${v.desc}</div>
        </div>
      `).join('');

      body.innerHTML = `
        <p style="font-size: 13.5px; line-height: 1.6; color: var(--muted);">${center.description}</p>
        <div>
          <h4 style="font-size: 14px; margin-bottom: 8px; color: var(--primary);">📊 全校即時指標</h4>
          <div class="stats-grid">${statsHtml}</div>
        </div>
        <div>
          <h4 style="font-size: 14px; margin-bottom: 8px; color: var(--primary);">🎯 四大核心願景</h4>
          <div class="vision-list">${visionsHtml}</div>
        </div>
        <div style="font-size: 11px; color: var(--muted); text-align: right;">最後更新時間：${center.lastUpdate}</div>
        <a href="https://chanes.tc.edu.tw/" target="_blank" rel="noopener noreferrer" class="link-btn-block">
          🌐 瀏覽長安國小官方網站 ↗
        </a>
      `;
    } else {
      const island = content.islands.find(i => i.id === islandId);
      if (!island) return;

      title.textContent = island.name;
      tag.textContent = island.group || '校園頻道';

      let statsHtml = (island.stats || []).map(s => `
        <div class="stat-card">
          <div class="stat-value">${s.value}</div>
          <div class="stat-label">${s.label}</div>
        </div>
      `).join('');

      let pointsHtml = (island.points || []).map(p => `<li>${p}</li>`).join('');

      body.innerHTML = `
        <p style="font-size: 14px; line-height: 1.6; font-weight: 500;">${island.intro}</p>
        ${statsHtml ? `<div><h4 style="font-size: 14px; margin-bottom: 8px; color: var(--primary);">📈 重點數據</h4><div class="stats-grid">${statsHtml}</div></div>` : ''}
        <div>
          <h4 style="font-size: 14px; margin-bottom: 8px; color: var(--primary);">✦ 內容亮點與指標</h4>
          <ul class="points-list">${pointsHtml}</ul>
        </div>
        <div style="border-top: 1px dashed var(--line); padding-top: 12px;">
          <p style="font-size: 12px; color: var(--muted); margin-bottom: 10px;">
            📌 ${island.extraLabel || '資料來源'}：<br>
            <a href="${island.extra || island.link}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); word-break: break-all;">
              ${island.extra || island.link}
            </a>
          </p>
          <a href="${island.link || island.extra}" target="_blank" rel="noopener noreferrer" class="link-btn-block">
            🚀 前往 ${island.name} 專屬頁面 ↗
          </a>
        </div>
      `;
    }

    drawer.classList.add('open');
  }

  function closeIslandDrawer() {
    const drawer = document.getElementById('drawer-panel');
    if (drawer && drawer.classList.contains('open')) {
      drawer.classList.remove('open');
      window.IslandScene.flyToOverview();
      currentIslandId = null;
    }
  }

  // 4. 對話泡泡 (點擊居民與動物)
  function showNPCDialogue(mesh, npcData) {
    closeActiveBubble();

    const container = document.getElementById('labels-container');
    const bubble = document.createElement('div');
    bubble.className = 'dialogue-bubble';

    let dIndex = 0;
    const dialogues = npcData.dialogues || ["你好呀！歡迎來到長安願景島！"];

    function renderBubbleContent() {
      bubble.innerHTML = `
        <div class="bubble-header">
          <div>
            <div class="bubble-name">${npcData.name}</div>
            <div class="bubble-role">${npcData.role} · ${npcData.islandName}</div>
          </div>
          <button class="bubble-close" aria-label="關閉">✕</button>
        </div>
        <div class="bubble-text">${dialogues[dIndex % dialogues.length]}</div>
        <div class="bubble-actions">
          <button class="bubble-btn" id="bubble-chat-btn">💬 再聊聊</button>
          ${npcData.trade ? `<button class="bubble-btn trade" id="bubble-trade-btn">🔁 交易</button>` : ''}
        </div>
      `;

      bubble.querySelector('.bubble-close').addEventListener('click', closeActiveBubble);

      bubble.querySelector('#bubble-chat-btn').addEventListener('click', () => {
        dIndex++;
        renderBubbleContent();
      });

      if (npcData.trade) {
        bubble.querySelector('#bubble-trade-btn').addEventListener('click', () => {
          executeTrade(npcData.trade);
        });
      }
    }

    renderBubbleContent();
    container.appendChild(bubble);
    activeDialogue = { element: bubble, targetMesh: mesh };
    updateBubblePosition();
  }

  function showAnimalBubble(mesh, animalData) {
    closeActiveBubble();

    const container = document.getElementById('labels-container');
    const bubble = document.createElement('div');
    bubble.className = 'dialogue-bubble';

    bubble.innerHTML = `
      <div class="bubble-header">
        <div class="bubble-name">${animalData.icon} ${animalData.name}</div>
        <button class="bubble-close" aria-label="關閉">✕</button>
      </div>
      <div class="bubble-text">${animalData.dialogue || "嗨！我是島上的動物夥伴！"}</div>
    `;

    bubble.querySelector('.bubble-close').addEventListener('click', closeActiveBubble);
    container.appendChild(bubble);
    activeDialogue = { element: bubble, targetMesh: mesh };
    updateBubblePosition();
  }

  function updateBubblePosition() {
    if (!activeDialogue) return;
    const camera = window.IslandScene.getCamera();
    const pos = activeDialogue.targetMesh.position.clone();
    pos.y += 2.2;
    pos.project(camera);

    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;
    const x = (pos.x * widthHalf) + widthHalf;
    const y = -(pos.y * heightHalf) + heightHalf;

    activeDialogue.element.style.left = `${x}px`;
    activeDialogue.element.style.top = `${y}px`;
  }

  function closeActiveBubble() {
    if (activeDialogue) {
      activeDialogue.element.remove();
      activeDialogue = null;
    }
  }

  // 5. 交易交換邏輯
  function executeTrade(trade) {
    const costItem = trade.cost;
    const costAmount = trade.amount || 1;
    const giveItem = trade.give;

    const currentCost = inventory[costItem] || 0;
    if (currentCost < costAmount) {
      showToast(`⚠️ 交易失敗：需要 ${costAmount} 個 ${costItem}，目前僅有 ${currentCost} 個！`);
      return;
    }

    // 扣除並給予
    inventory[costItem] -= costAmount;
    if (inventory[costItem] <= 0) delete inventory[costItem];
    inventory[giveItem] = (inventory[giveItem] || 0) + 1;

    saveInventory();
    showToast(`🎉 交易成功！獲得「${giveItem}」！`);
    openBackpackModal();
  }

  // 6. 背包彈跳視窗
  function openBackpackModal() {
    const modal = document.getElementById('main-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = '🎒 我的長安冒險背包';

    let itemsHtml = Object.keys(inventory).map(name => `
      <div class="inventory-item">
        <div class="inventory-icon">${name.split(' ')[0] || '🎁'}</div>
        <div class="inventory-name">${name}</div>
        <div class="inventory-count">持有：${inventory[name]}</div>
      </div>
    `).join('');

    body.innerHTML = `
      <p style="font-size: 13px; color: var(--muted); margin-bottom: 12px;">
        在沙灘上可撿到發光 🐚 貝殼；與各島居民對話，就能交換創校卷軸、綠葉、指南針與島主明信片等紀念特產！
      </p>
      <div class="inventory-grid">${itemsHtml || '<p>背包空空如也，快去沙灘拾取貝殼吧！</p>'}</div>
      <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
        <button class="btn-pill" id="clear-bag-btn" style="color: #ef4444; border-color: #ef4444;">
          🗑️ 清空重置背包
        </button>
      </div>
    `;

    document.getElementById('clear-bag-btn').addEventListener('click', () => {
      inventory = { '🐚 貝殼': 3 };
      saveInventory();
      openBackpackModal();
      showToast('背包已重置為初始狀態（3 個貝殼）。');
    });

    modal.classList.add('open');
  }

  // 7. 地點清單 Modal (無 3D 亦能閱覽)
  function openListModal() {
    const modal = document.getElementById('main-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = '📋 群島地點導覽清單';

    let islandsHtml = content.islands.map(i => `
      <div style="border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin-bottom: 10px; background: var(--surface);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h4 style="font-family: var(--font-title); color: var(--primary);">${i.name}</h4>
          <span style="font-size: 11px; background: var(--accent); color: #fff; padding: 2px 8px; border-radius: 10px;">${i.group || '校園頻道'}</span>
        </div>
        <p style="font-size: 13px; margin: 6px 0; color: var(--ink);">${i.intro}</p>
        <button class="bubble-btn" style="margin-top: 4px;" onclick="IslandUI.openIslandDrawer('${i.id}'); document.getElementById('main-modal').classList.remove('open');">
          🔍 前往該島
        </button>
      </div>
    `).join('');

    body.innerHTML = `
      <div style="border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin-bottom: 10px; background: var(--primary-light);">
        <h4 style="font-family: var(--font-title); color: var(--primary);">長安願景島（中央即時總看板）</h4>
        <p style="font-size: 13px; margin: 4px 0;">全校 32 班、752 位學生，四大面向核心指標匯聚中心。</p>
        <button class="bubble-btn" style="margin-top: 4px;" onclick="IslandUI.openIslandDrawer('center'); document.getElementById('main-modal').classList.remove('open');">
          🔍 前往中央島
        </button>
      </div>
      ${islandsHtml}
    `;

    modal.classList.add('open');
  }

  // 8. 探索小測驗與證書
  function openQuizModal() {
    const modal = document.getElementById('main-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = '📝 長安願景島探索小測驗';

    let currentQ = 0;
    let score = 0;
    const quizList = content.quiz || [];

    function renderQuestion() {
      if (currentQ >= quizList.length) {
        // 完成測驗，頒發證書
        body.innerHTML = `
          <div class="certificate-preview" id="cert-box">
            <div class="cert-title">🏆 長安願景島生態榮譽證書</div>
            <p style="font-size: 14px; margin: 6px 0;">茲證明 <b>熱心訪客</b> 成功探索長安願景群島</p>
            <p style="font-size: 13px; color: #92400e;">以 ${score} / ${quizList.length} 題優異成績掌握校園核心願景與生態知識！</p>
            <div class="cert-seal">長安國小<br>核可認證</div>
          </div>
          <div style="display: flex; gap: 10px; justify-content: center; margin-top: 14px;">
            <button class="btn-pill" onclick="window.print();">🖨️ 列印證書</button>
            <button class="btn-pill" id="cert-restart-btn">🔄 再測一次</button>
          </div>
        `;
        body.querySelector('#cert-restart-btn').addEventListener('click', () => {
          currentQ = 0;
          score = 0;
          renderQuestion();
        });
        return;
      }

      const q = quizList[currentQ];
      const optHtml = q.options.map((opt, idx) => `
        <button class="bubble-btn" style="text-align: left; padding: 10px; margin-bottom: 8px; width: 100%; border-radius: 8px;" data-idx="${idx}">
          ${String.fromCharCode(65 + idx)}. ${opt}
        </button>
      `).join('');

      body.innerHTML = `
        <div style="font-size: 12px; color: var(--accent); font-weight: bold; margin-bottom: 6px;">第 ${currentQ + 1} 題 / 共 ${quizList.length} 題</div>
        <h4 style="font-size: 15px; margin-bottom: 12px; line-height: 1.5;">${q.question}</h4>
        <div id="quiz-opts">${optHtml}</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 8px;">💡 提示：${q.hint}</div>
      `;

      body.querySelectorAll('#quiz-opts button').forEach(btn => {
        btn.addEventListener('click', () => {
          const selected = parseInt(btn.getAttribute('data-idx'));
          if (selected === q.answer) {
            score++;
            showToast('✅ 答對了！太厲害了！');
          } else {
            showToast(`❌ 答錯囉！正解是：${q.options[q.answer]}`);
          }
          currentQ++;
          renderQuestion();
        });
      });
    }

    renderQuestion();
    modal.classList.add('open');
  }

  // 9. 小安智能問答
  function openGuideModal() {
    const modal = document.getElementById('main-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = '💡 毛毛蟲小安 · 智慧校園小嚮導';

    body.innerHTML = `
      <div style="display: flex; gap: 10px; margin-bottom: 12px;">
        <input type="text" id="guide-input" placeholder="請輸入關鍵字（例如：校長、生態、電話、班級、榮譽...）" style="flex: 1; padding: 10px 14px; border: 1.5px solid var(--primary); border-radius: 12px; font-size: 13.5px; background: var(--surface); color: var(--ink);">
        <button class="btn-pill" id="guide-ask-btn" style="background: var(--primary); color: #fff;">查詢</button>
      </div>
      <div id="guide-result" style="background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px; min-height: 120px; line-height: 1.6; font-size: 13.5px;">
        🐛 你好！我是長安國小吉祥物小安！想了解學校的任何事，都可以直接問我喔！
      </div>
      <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px;">
        <button class="bubble-btn q-tag" data-kw="班級">班級規模</button>
        <button class="bubble-btn q-tag" data-kw="校長">校長理念</button>
        <button class="bubble-btn q-tag" data-kw="生態">生態設施</button>
        <button class="bubble-btn q-tag" data-kw="榮譽">榮譽得獎</button>
        <button class="bubble-btn q-tag" data-kw="亮點">非凡亮點</button>
      </div>
    `;

    function doQuery(keyword) {
      const qResult = document.getElementById('guide-result');
      if (!keyword.trim()) return;

      const matched = (content.guideQA || []).find(qa => {
        return qa.keywords.some(k => keyword.includes(k) || k.includes(keyword));
      });

      if (matched) {
        qResult.innerHTML = `
          <div style="font-weight: bold; color: var(--primary); margin-bottom: 6px;">🐛 小安回答您：</div>
          <div>${matched.answer}</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 8px;">出處：${matched.source}</div>
        `;
      } else {
        qResult.innerHTML = `
          <div style="color: var(--muted);">
            🐛 找不到完全符合「${keyword}」的資料，建議試試「校長」、「生態」、「班級」、「榮譽」或「亮點」等關鍵字！
          </div>
        `;
      }
    }

    document.getElementById('guide-ask-btn').addEventListener('click', () => {
      const input = document.getElementById('guide-input');
      doQuery(input.value);
    });

    document.getElementById('guide-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doQuery(e.target.value);
    });

    body.querySelectorAll('.q-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const kw = tag.getAttribute('data-kw');
        document.getElementById('guide-input').value = kw;
        doQuery(kw);
      });
    });

    modal.classList.add('open');
  }

  // 10. 校園地圖對照 Modal
  function openMapModal() {
    const modal = document.getElementById('main-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = '🗺️ 校園地圖對照與示意說明';

    body.innerHTML = `
      <div style="text-align: center; margin-bottom: 12px;">
        <div style="background: var(--surface); border: 2px dashed var(--line); border-radius: 16px; padding: 20px;">
          <div style="font-size: 36px; margin-bottom: 8px;">🧭 🏫 🌿</div>
          <p style="font-weight: bold; color: var(--primary);">臺中市西屯區長安國小 校園方位配置</p>
          <p style="font-size: 13px; color: var(--muted); margin-top: 4px;">
            校門朝南（毛毛蟲藝術），中庭為生態水池與大蝴蝶教室，後側為行政大樓與運動操場。
          </p>
        </div>
      </div>
      <div style="background: var(--primary-light); padding: 12px; border-radius: 10px; font-size: 12.5px; line-height: 1.6; color: var(--ink);">
        ⚠️ <b>聲明事項</b>：<br>
        本 3D 群島模型為長安國小願景意象之藝術化微縮示意，實際建築方位、比例與現場景觀以長安國小實際校園為準。
      </div>
    `;

    modal.classList.add('open');
  }

  // 11. 流星雨 Canvas 系統
  function setupMeteorRain() {
    const canvas = document.getElementById('meteor-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    let meteors = [];

    function spawnMeteor() {
      meteors.push({
        x: Math.random() * canvas.width * 1.2,
        y: -50,
        len: 80 + Math.random() * 80,
        speed: 12 + Math.random() * 8,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.1,
        life: 1.0
      });
    }

    function renderMeteors() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const tod = window.IslandScene.getTimeOfDay();
      // 只在夜晚出現
      if (tod === 'night') {
        if (Math.random() < 0.02) spawnMeteor();

        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i];
          m.x -= Math.cos(m.angle) * m.speed;
          m.y += Math.sin(m.angle) * m.speed;
          m.life -= 0.015;

          if (m.life <= 0 || m.y > canvas.height) {
            meteors.splice(i, 1);
            continue;
          }

          const grad = ctx.createLinearGradient(
            m.x, m.y,
            m.x + Math.cos(m.angle) * m.len,
            m.y - Math.sin(m.angle) * m.len
          );
          grad.addColorStop(0, `rgba(255, 255, 255, ${m.life})`);
          grad.addColorStop(0.3, `rgba(254, 240, 138, ${m.life * 0.8})`);
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x + Math.cos(m.angle) * m.len, m.y - Math.sin(m.angle) * m.len);
          ctx.stroke();
        }
      } else {
        meteors = [];
      }

      meteorAnimId = requestAnimationFrame(renderMeteors);
    }
    renderMeteors();

    // 許願按鈕觸發整陣流星雨
    window.triggerMeteorShower = function() {
      window.IslandScene.setTimeOfDay('night');
      showToast('🌠 流星雨來了！對著長安願景星空許個願吧！');
      for (let i = 0; i < 15; i++) {
        setTimeout(spawnMeteor, i * 150);
      }
    };
  }

  // 12. 第一人稱地面漫遊 (WASD / 虛擬搖桿)
  function startWalkMode() {
    isWalking = true;
    closeIslandDrawer();
    closeActiveBubble();

    const hud = document.getElementById('walk-hud');
    hud.classList.add('active');

    const controls = window.IslandScene.getControls();
    controls.enabled = false;

    const camera = window.IslandScene.getCamera();
    walkPos.set(0, 5.2, 0); // 從中央島出發
    camera.position.copy(walkPos);

    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e) => {
      if (e.target.closest('#walk-hud') && !e.target.classList.contains('dpad-btn')) {
        isDragging = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    };

    const onMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        walkYaw -= dx * 0.004;
        walkPitch -= dy * 0.004;
        walkPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, walkPitch));
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    };

    const onMouseUp = () => { isDragging = false; };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    function walkLoop() {
      if (!isWalking) {
        window.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        return;
      }

      const speed = 0.22;
      const forward = new THREE.Vector3(-Math.sin(walkYaw), 0, -Math.cos(walkYaw));
      const right = new THREE.Vector3(Math.cos(walkYaw), 0, -Math.sin(walkYaw));

      if (walkKeys.forward) walkPos.addScaledVector(forward, speed);
      if (walkKeys.backward) walkPos.addScaledVector(forward, -speed);
      if (walkKeys.left) walkPos.addScaledVector(right, -speed);
      if (walkKeys.right) walkPos.addScaledVector(right, speed);

      // 防掉入海中邊界拘束 (-55 ~ 55)
      walkPos.x = Math.max(-55, Math.min(55, walkPos.x));
      walkPos.z = Math.max(-55, Math.min(55, walkPos.z));
      walkPos.y = 5.2;

      camera.position.copy(walkPos);
      const lookTarget = walkPos.clone().add(new THREE.Vector3(
        -Math.sin(walkYaw) * Math.cos(walkPitch),
        Math.sin(walkPitch),
        -Math.cos(walkYaw) * Math.cos(walkPitch)
      ));
      camera.lookAt(lookTarget);

      requestAnimationFrame(walkLoop);
    }
    requestAnimationFrame(walkLoop);
  }

  function exitWalkMode() {
    isWalking = false;
    const hud = document.getElementById('walk-hud');
    hud.classList.remove('active');
    const controls = window.IslandScene.getControls();
    controls.enabled = true;
    window.IslandScene.flyToOverview();
  }

  // 提示訊息小彈窗 Toast
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--surface-solid);
      border: 1.5px solid var(--accent);
      color: var(--ink);
      padding: 10px 18px;
      border-radius: 20px;
      box-shadow: var(--shadow-lg);
      font-size: 13.5px;
      font-weight: 600;
      z-index: 200;
      animation: popIn 0.3s ease;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(() => toast.remove(), 500);
    }, 3200);
  }

  // 綁定所有點擊與操作監聽
  function setupEventListeners() {
    // 側邊面板關閉
    document.getElementById('drawer-close').addEventListener('click', closeIslandDrawer);

    // Modal 關閉
    document.getElementById('modal-close').addEventListener('click', () => {
      document.getElementById('main-modal').classList.remove('open');
    });

    // 鍵盤 Esc
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isWalking) exitWalkMode();
        closeIslandDrawer();
        closeActiveBubble();
        document.getElementById('main-modal').classList.remove('open');
        document.getElementById('intro-modal').classList.remove('open');
      }
      // 漫遊鍵盤
      if (isWalking) {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') walkKeys.forward = true;
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') walkKeys.backward = true;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') walkKeys.left = true;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') walkKeys.right = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (isWalking) {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') walkKeys.forward = false;
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') walkKeys.backward = false;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') walkKeys.left = false;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') walkKeys.right = false;
      }
    });

    // 漫遊退出與手機方向鈕
    document.getElementById('walk-exit-btn').addEventListener('click', exitWalkMode);

    const setupDpad = (id, key) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); walkKeys[key] = true; });
      btn.addEventListener('touchend', (e) => { e.preventDefault(); walkKeys[key] = false; });
      btn.addEventListener('mousedown', () => { walkKeys[key] = true; });
      btn.addEventListener('mouseup', () => { walkKeys[key] = false; });
    };
    setupDpad('dpad-up', 'forward');
    setupDpad('dpad-down', 'backward');
    setupDpad('dpad-left', 'left');
    setupDpad('dpad-right', 'right');

    // 頂部按鈕
    document.getElementById('walk-btn').addEventListener('click', () => {
      if (!isWalking) startWalkMode();
      else exitWalkMode();
    });

    document.getElementById('map-btn').addEventListener('click', openMapModal);
    document.getElementById('wish-btn').addEventListener('click', () => {
      window.triggerMeteorShower();
    });

    document.getElementById('replay-btn').addEventListener('click', () => {
      closeIslandDrawer();
      window.IslandScene.playIntroCamera();
    });

    document.getElementById('compass-btn').addEventListener('click', () => {
      window.IslandScene.flyToOverview();
      showToast('🧭 視角已重設回正北朝向！');
    });

    // 底部工作列按鈕
    document.getElementById('dock-home').addEventListener('click', () => {
      closeIslandDrawer();
      window.IslandScene.flyToOverview();
    });

    document.getElementById('dock-list').addEventListener('click', openListModal);
    document.getElementById('dock-bag').addEventListener('click', openBackpackModal);
    document.getElementById('dock-quiz').addEventListener('click', openQuizModal);
    document.getElementById('dock-guide').addEventListener('click', openGuideModal);
    document.getElementById('mascot-btn').addEventListener('click', openGuideModal);

    // 留言板按鈕
    document.getElementById('dock-guestbook').addEventListener('click', () => {
      if (window.IslandGuestbook && window.IslandGuestbook.open) {
        window.IslandGuestbook.open();
      }
    });

    // 開場歡迎 Modal
    const introClose = document.getElementById('intro-close');
    const introStart = document.getElementById('intro-start-btn');
    const introModal = document.getElementById('intro-modal');
    if (introClose && introStart) {
      const closeIntro = () => { introModal.classList.remove('open'); };
      introClose.addEventListener('click', closeIntro);
      introStart.addEventListener('click', closeIntro);
    }
  }

  return {
    init,
    updateLabels,
    openIslandDrawer,
    closeIslandDrawer,
    showNPCDialogue,
    showAnimalBubble,
    addShell,
    showToast
  };
})();
