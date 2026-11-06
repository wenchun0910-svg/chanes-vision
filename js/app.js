/**
 * 長安願景島 - 主應用程式入口 (App Main)
 * 整合資料載入、主題色彩、日夜光影、Web Audio 背景音樂、留言板與訪客計數器
 */

window.IslandApp = (function() {
  let content = null;
  let currentTheme = 'auto'; // 'sakura', 'cream', 'night', 'auto'
  let currentTimeMode = 'auto'; // 'day', 'dusk', 'night', 'auto', 'realtime'
  let isReducedMotion = false;
  let bgmPlaying = false;
  let audioCtx = null;
  let bgmTimer = null;

  async function start() {
    try {
      // 1. 載入資料
      const res = await fetch('data/content.json');
      content = await res.json();

      // 2. 初始化 3D 場景
      window.IslandScene.init(document.getElementById('canvas-container'));

      // 3. 初始化生活感世界 (NPC、動物、海龜)
      window.IslandWorld.init(window.IslandScene.getScene(), content);

      // 4. 初始化 UI
      window.IslandUI.init(content);

      // 5. 設定主題與時鐘
      setupThemeAndDayNight();

      // 6. 整合訪客留言板與計數器
      setupGuestbookAndCounter();

      // 7. 音樂與動態按鈕
      setupAudioAndMotion();

      // 8. 首次到訪歡迎
      checkFirstVisit();

      console.log('長安願景島 3D 網站初始化完成！');
    } catch (err) {
      console.error('長安願景島載入失敗:', err);
      // WebGL 失敗或錯誤時提供降級文字清單
      showFallbackView();
    }
  }

  // 1. 主題底色與日夜光影
  function setupThemeAndDayNight() {
    const themeBtn = document.getElementById('theme-btn');
    const themeText = document.getElementById('theme-btn-text');
    const timeBtn = document.getElementById('time-btn');
    const timeIcon = document.getElementById('time-btn-icon');
    const timeText = document.getElementById('time-btn-text');
    const clockText = document.getElementById('clock-text');

    const themes = [
      { id: 'auto', name: '自動', icon: '🌅' },
      { id: 'sakura', name: '櫻花', bg: '#fdf0f2' },
      { id: 'cream', name: '奶霜', bg: '#fbf6ee' },
      { id: 'night', name: '紫夜', bg: '#2a1f33' }
    ];

    let tIndex = 0;
    const savedTheme = localStorage.getItem('chanes_theme');
    if (savedTheme) {
      currentTheme = savedTheme;
      tIndex = Math.max(0, themes.findIndex(t => t.id === savedTheme));
    }

    function applyTheme(tid) {
      currentTheme = tid;
      localStorage.setItem('chanes_theme', tid);

      if (tid === 'auto') {
        themeText.textContent = '自動';
        syncThemeWithTime();
      } else {
        document.documentElement.setAttribute('data-theme', tid);
        themeText.textContent = themes.find(t => t.id === tid).name;
      }
    }

    themeBtn.addEventListener('click', () => {
      tIndex = (tIndex + 1) % themes.length;
      applyTheme(themes[tIndex].id);
      window.IslandUI.showToast(`🎨 已切換底色主題：${themes[tIndex].name}`);
    });

    applyTheme(currentTheme);

    // 日夜切換
    const times = [
      { id: 'day', name: '白天', icon: '☀️' },
      { id: 'dusk', name: '黃昏', icon: '🌇' },
      { id: 'night', name: '夜晚', icon: '🌙' },
      { id: 'auto', name: '自動輪播', icon: '⏱️' }
    ];

    let timeIdx = 0;
    timeBtn.addEventListener('click', () => {
      timeIdx = (timeIdx + 1) % times.length;
      const t = times[timeIdx];
      timeIcon.textContent = t.icon;
      timeText.textContent = t.name;

      if (t.id === 'auto') {
        window.IslandScene.setAutoCycle(true);
      } else {
        window.IslandScene.setAutoCycle(false);
        window.IslandScene.setTimeOfDay(t.id);
      }

      if (currentTheme === 'auto') {
        syncThemeWithTime();
      }
      window.IslandUI.showToast(`天色切換為：${t.name}`);
    });

    // 每秒更新即時時鐘顯示
    setInterval(() => {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const tod = window.IslandScene.getTimeOfDay();
      const todName = tod === 'night' ? '夜晚' : (tod === 'dusk' ? '黃昏' : '白天');
      if (clockText) {
        clockText.textContent = `${todName} ${hrs}:${mins}`;
      }
    }, 1000);
  }

  // 依日出日落自動匹配主題底色
  function syncThemeWithTime() {
    if (currentTheme !== 'auto') return;
    const tod = window.IslandScene.getTimeOfDay();
    if (tod === 'night') {
      document.documentElement.setAttribute('data-theme', 'night');
    } else if (tod === 'dusk') {
      document.documentElement.setAttribute('data-theme', 'sakura');
    } else {
      document.documentElement.setAttribute('data-theme', 'cream');
    }
  }

  // 2. 背景音樂 (Web Audio 合成，原創溫馨微風小調，免音檔)
  function setupAudioAndMotion() {
    const musicBtn = document.getElementById('music-btn');
    const musicIcon = document.getElementById('music-icon');
    const motionBtn = document.getElementById('motion-btn');
    const motionIcon = document.getElementById('motion-icon');

    // 溫暖八音盒音階 (長安願景主題小調 C 大調五度調和)
    const melody = [
      261.63, 329.63, 392.00, 523.25,
      392.00, 329.63, 261.63, 392.00,
      440.00, 523.25, 440.00, 392.00,
      329.63, 293.66, 261.63, 329.63
    ];
    let noteIdx = 0;

    function playNote(freq) {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle'; // 柔和三角波微風感
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.3);
    }

    musicBtn.addEventListener('click', () => {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      bgmPlaying = !bgmPlaying;
      if (bgmPlaying) {
        musicIcon.textContent = '🎵';
        musicBtn.classList.add('active');
        window.IslandUI.showToast('🎵 背景音樂已開啟（長安願景微風小調）');
        bgmTimer = setInterval(() => {
          playNote(melody[noteIdx % melody.length]);
          noteIdx++;
        }, 600);
      } else {
        musicIcon.textContent = '🔇';
        musicBtn.classList.remove('active');
        clearInterval(bgmTimer);
        window.IslandUI.showToast('🔇 背景音樂已關閉');
      }
    });

    // 減少動態切換
    motionBtn.addEventListener('click', () => {
      isReducedMotion = !isReducedMotion;
      document.body.classList.toggle('reduced-motion', isReducedMotion);
      window.IslandScene.setReducedMotion(isReducedMotion);
      motionBtn.classList.toggle('active', isReducedMotion);
      motionIcon.textContent = isReducedMotion ? '⏸️' : '🌀';
      window.IslandUI.showToast(isReducedMotion ? '已啟用減少動態模式（保護暈眩）' : '已恢復全動態模式');
    });

    // 系統 prefers-reduced-motion 自動感應
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      isReducedMotion = true;
      document.body.classList.add('reduced-motion');
      window.IslandScene.setReducedMotion(true);
      motionIcon.textContent = '⏸️';
    }
  }

  // 3. 訪客留言板與計數器安裝
  function setupGuestbookAndCounter() {
    // 訪客留名 (Google 試算表 GAS)
    if (window.IslandGuestbook && window.IslandGuestbook.mount) {
      window.IslandGuestbook.mount({
        endpoint: 'https://script.google.com/macros/s/AKfycbykFPcR9SBehAJIelMDfPTUHRw8WOJB7_c4cr3K9LKD7AgOvjWuK3PdwLJLZ8USbNG9tA/exec',
        title: '長安願景島 · 許願留名燈籠',
        islands: ['長安願景島', '基本概況島', '生態課程島', '行政領導', '非凡亮點島', '卓越榮譽島'],
        onEntries: (list, total) => {
          console.log(`留言板載入：共 ${total} 則留言`);
        }
      });
    }

    // 訪客計數器 (真實計數)
    if (window.IslandVisits && window.IslandVisits.mount) {
      window.IslandVisits.mount({
        endpoint: 'https://script.google.com/macros/s/AKfycbykFPcR9SBehAJIelMDfPTUHRw8WOJB7_c4cr3K9LKD7AgOvjWuK3PdwLJLZ8USbNG9tA/exec'
      });
    }
  }

  // 4. 首次到訪歡迎
  function checkFirstVisit() {
    const visited = localStorage.getItem('chanes_visited');
    const introModal = document.getElementById('intro-modal');
    if (!visited && introModal) {
      introModal.classList.add('open');
      localStorage.setItem('chanes_visited', 'true');
    }
  }

  // 5. WebGL 降級文字版
  function showFallbackView() {
    const container = document.getElementById('canvas-container');
    if (container) {
      container.innerHTML = `
        <div style="padding: 40px 20px; max-width: 680px; margin: 0 auto; color: var(--ink);">
          <h2 style="color: var(--primary);">長安願景島 (文字導覽版)</h2>
          <p style="margin: 10px 0;">瀏覽器未開啟 WebGL 或顯示卡受限，您仍可在此查閱完整校園願景內容：</p>
          <div id="fallback-list"></div>
        </div>
      `;
      window.IslandUI.openListModal();
    }
  }

  return {
    start
  };
})();

// DOM 載入後啟動
document.addEventListener('DOMContentLoaded', () => {
  window.IslandApp.start();
});
