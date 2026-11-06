/**
 * 長安願景島 - 3D 場景與島嶼地貌 (Three.js)
 * 風格：沙漠綠洲、精緻微縮模型、日夜光影過渡、平順飛近運鏡
 */

window.IslandScene = (function() {
  let scene, camera, renderer, controls;
  let hemiLight, dirLight, ambientLight;
  let nightLights = [];
  let seaMesh;
  let skyMesh;
  let starsParticles;
  let islandsGroup;
  let bridgesGroup;
  let animId = null;

  // 動態狀態
  let timeOfDay = 'day'; // 'day', 'dusk', 'night'
  let autoCycle = false;
  let cycleTimer = 0;
  let isReducedMotion = false;
  let isAnimatingCamera = false;

  // 原始相機預設全景角度 (40度俯瞰)
  const DEFAULT_CAM_POS = new THREE.Vector3(0, 48, 62);
  const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);

  // 島嶼坐標配置 (依照方位與相對比例)
  const ISLAND_LAYOUT = {
    'center':   { x: 0,   z: 0,   r: 14, name: '長安願景島', title: '即時總看板' },
    'island-01': { x: -28, z: 12,  r: 10, name: '基本概況島', title: '關於長安' },
    'island-02': { x: -22, z: -26, r: 10, name: '生態課程島', title: '環境生態設施' },
    'island-03': { x: 22,  z: -26, r: 10, name: '行政領導',   title: '校務團隊' },
    'island-04': { x: 28,  z: 12,  r: 10.5, name: '非凡亮點島', title: '7大亮點' },
    'island-05': { x: 0,   z: 32,  r: 11, name: '卓越榮譽島', title: '榮譽榜' }
  };

  // 主題與時段色彩定義 (櫻花、奶霜、紫夜)
  const THEME_SKY_COLORS = {
    day: {
      top: 0xfffcf5,
      bottom: 0xf5deb3,
      fog: 0xfbf6ee,
      sun: 0xfff5e6,
      sunIntensity: 1.25,
      hemiSky: 0xfff9e6,
      hemiGround: 0xd4a373,
      sea: 0x48cae4,
      sand: 0xe9c46a
    },
    dusk: {
      top: 0xfbcfe8,
      bottom: 0xfda4af,
      fog: 0xfdf0f2,
      sun: 0xfb923c,
      sunIntensity: 1.1,
      hemiSky: 0xf472b6,
      hemiGround: 0xb45309,
      sea: 0x0284c7,
      sand: 0xd97706
    },
    night: {
      top: 0x0f0b14,
      bottom: 0x2a1f33,
      fog: 0x2a1f33,
      sun: 0x6366f1,
      sunIntensity: 0.35,
      hemiSky: 0x312e81,
      hemiGround: 0x1e1b4b,
      sea: 0x0f172a,
      sand: 0x78350f
    }
  };

  function init(container) {
    // 1. 初始化 Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(THEME_SKY_COLORS.day.fog, 0.007);

    // 2. 初始化 Camera
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 1000);
    // 開場初始在極高空俯瞰 (平順飛近準備)
    camera.position.set(0, 140, 160);
    camera.lookAt(DEFAULT_TARGET);

    // 3. 初始化 Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('three-canvas'),
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // 4. 控制器 OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.08; // 避免沉入海底
    controls.minDistance = 15;
    controls.maxDistance = 180;
    controls.target.copy(DEFAULT_TARGET);

    // 5. 光源配置
    setupLights();

    // 6. 天空球與星星
    setupSkyDome();
    setupStars();

    // 7. 起伏低多邊形海洋
    setupOcean();

    // 8. 建立群島與地標
    islandsGroup = new THREE.Group();
    bridgesGroup = new THREE.Group();
    scene.add(islandsGroup);
    scene.add(bridgesGroup);

    buildAllIslands();
    buildBridges();
    buildDistantMountains();

    // 視窗縮放監聽
    window.addEventListener('resize', onWindowResize);

    // 啟動主渲染迴圈
    animate();

    // 執行開場「平順飛近」運鏡
    playIntroCamera();
  }

  function setupLights() {
    ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(
      THEME_SKY_COLORS.day.hemiSky,
      THEME_SKY_COLORS.day.hemiGround,
      0.65
    );
    scene.add(hemiLight);

    dirLight = new THREE.DirectionalLight(THEME_SKY_COLORS.day.sun, 1.25);
    dirLight.position.set(45, 75, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 260;
    dirLight.shadow.camera.left = -70;
    dirLight.shadow.camera.right = 70;
    dirLight.shadow.camera.top = 70;
    dirLight.shadow.camera.bottom = -70;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // 中央市集溫暖夜間點光源
    const marketLight = new THREE.PointLight(0xffb703, 0, 25);
    marketLight.position.set(0, 5, 0);
    scene.add(marketLight);
    nightLights.push(marketLight);
  }

  function setupSkyDome() {
    const skyGeo = new THREE.SphereGeometry(350, 24, 24);
    const skyMat = new THREE.MeshBasicMaterial({
      color: THEME_SKY_COLORS.day.bottom,
      side: THREE.BackSide
    });
    skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);
  }

  function setupStars() {
    const starGeo = new THREE.BufferGeometry();
    const count = 600;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.8 + 0.2); // 只在上半天頂
      const radius = 320;
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.cos(phi);
      pos[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.8,
      transparent: true,
      opacity: 0
    });
    starsParticles = new THREE.Points(starGeo, starMat);
    scene.add(starsParticles);
  }

  function setupOcean() {
    // 低多邊形波浪海面
    const seaGeo = new THREE.PlaneGeometry(600, 600, 48, 48);
    seaGeo.rotateX(-Math.PI / 2);

    // 保存海面原始頂點以便波浪位移
    seaGeo.userData = { origY: [] };
    const pos = seaGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      seaGeo.userData.origY.push(pos.getY(i));
    }

    const seaMat = new THREE.MeshStandardMaterial({
      color: THEME_SKY_COLORS.day.sea,
      roughness: 0.2,
      metalness: 0.1,
      flatShading: true,
      transparent: true,
      opacity: 0.88
    });
    seaMesh = new THREE.Mesh(seaGeo, seaMat);
    seaMesh.position.y = -0.5;
    seaMesh.receiveShadow = true;
    scene.add(seaMesh);
  }

  // 建立低多邊形沙漠綠洲島嶼
  function createDesertIsland(id, config) {
    const group = new THREE.Group();
    group.name = id;
    group.position.set(config.x, 0, config.z);

    const radius = config.r;
    // 1. 金黃沙丘主體 (分 3 層色階：沙灘、沙丘、砂岩底座)
    const islandGeo = new THREE.CylinderGeometry(radius, radius * 0.75, 7, 36, 4);
    
    // 角度噪聲擾動海岸線，打破正圓/正六角
    const pos = islandGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      if (y > 1.5) {
        // 沙丘頂部波狀起伏
        const noise = Math.sin(x * 0.4) * Math.cos(z * 0.4) * 0.85;
        pos.setY(i, y + noise);
      } else {
        // 海岸線邊緣不規則推擠
        const angle = Math.atan2(z, x);
        const bump = Math.sin(angle * 5) * 0.8 + Math.cos(angle * 3) * 0.6;
        pos.setX(i, x + (x !== 0 ? (x / Math.abs(x)) * bump * 0.5 : 0));
        pos.setZ(i, z + (z !== 0 ? (z / Math.abs(z)) * bump * 0.5 : 0));
      }
    }
    islandGeo.computeVertexNormals();

    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xecd599, // 金黃沙漠色
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true
    });
    const islandMesh = new THREE.Mesh(islandGeo, sandMat);
    islandMesh.position.y = 1.2;
    islandMesh.receiveShadow = true;
    islandMesh.castShadow = true;
    islandMesh.userData = { islandId: id };
    group.add(islandMesh);

    // 2. 海岸白色浪花圈
    const foamGeo = new THREE.RingGeometry(radius * 0.95, radius * 1.15, 32);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.position.y = -0.3;
    group.add(foam);

    // 3. 沙漠綠洲小水池 (每島一汪藍綠綠洲水潭)
    const oasisRadius = radius * 0.35;
    const oasisGeo = new THREE.CircleGeometry(oasisRadius, 18);
    oasisGeo.rotateX(-Math.PI / 2);
    const oasisMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // 藍綠水色
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.9
    });
    const oasis = new THREE.Mesh(oasisGeo, oasisMat);
    oasis.position.set(-radius * 0.25, 4.75, radius * 0.2);
    group.add(oasis);

    // 水池周圍綠草圈
    const grassRingGeo = new THREE.RingGeometry(oasisRadius, oasisRadius * 1.2, 18);
    grassRingGeo.rotateX(-Math.PI / 2);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x84cc16,
      flatShading: true
    });
    const grassRing = new THREE.Mesh(grassRingGeo, grassMat);
    grassRing.position.set(-radius * 0.25, 4.73, radius * 0.2);
    group.add(grassRing);

    // 4. 植被：低多邊形棕櫚樹與仙人掌
    createPalmTree(group, -radius * 0.45, 4.7, radius * 0.35, 1.1);
    createPalmTree(group, -radius * 0.15, 4.7, radius * 0.45, 0.9);
    createCactus(group, radius * 0.4, 4.7, -radius * 0.3);
    createCactus(group, radius * 0.5, 4.7, -radius * 0.15);

    // 5. 精緻微縮模型道具：石板小路、木箱、長椅、路燈、圍籬
    createPathway(group, radius);
    createDetailedProps(group, radius, id);

    // 6. 各島獨特地標建築
    buildLandmark(group, id, radius);

    // 7. 碼頭小棧橋 (連往外海或接駁點)
    createPier(group, radius);

    return group;
  }

  // 棕櫚樹生成
  function createPalmTree(parent, x, y, z, scale = 1) {
    const tree = new THREE.Group();
    tree.position.set(x, y, z);
    tree.scale.set(scale, scale, scale);

    // 彎曲樹幹
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 4; i++) {
      const segGeo = new THREE.CylinderGeometry(0.25 - i * 0.03, 0.3 - i * 0.03, 1.2, 6);
      const seg = new THREE.Mesh(segGeo, trunkMat);
      seg.position.set(i * 0.15, i * 1.1 + 0.6, 0);
      seg.rotation.z = -i * 0.1;
      seg.castShadow = true;
      tree.add(seg);
    }

    // 樹冠葉子 (6片大葉低多邊形)
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6, flatShading: true, side: THREE.DoubleSide });
    for (let a = 0; a < 6; a++) {
      const leafGeo = new THREE.ConeGeometry(0.6, 2.4, 4);
      leafGeo.rotateZ(Math.PI / 2.8);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(0.45, 4.5, 0);
      leaf.rotation.y = (a * Math.PI) / 3;
      leaf.castShadow = true;
      tree.add(leaf);
    }
    parent.add(tree);
  }

  // 仙人掌生成 (柱狀＋分枝)
  function createCactus(parent, x, y, z) {
    const cactus = new THREE.Group();
    cactus.position.set(x, y, z);
    const mat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7, flatShading: true });

    // 主幹
    const mainGeo = new THREE.CylinderGeometry(0.28, 0.32, 2.2, 6);
    const main = new THREE.Mesh(mainGeo, mat);
    main.position.y = 1.1;
    main.castShadow = true;
    cactus.add(main);

    // 左枝
    const leftArmGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.8, 6);
    const leftArm = new THREE.Mesh(leftArmGeo, mat);
    leftArm.position.set(-0.35, 1.3, 0);
    leftArm.rotation.z = Math.PI / 2;
    cactus.add(leftArm);

    const leftUpGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.9, 6);
    const leftUp = new THREE.Mesh(leftUpGeo, mat);
    leftUp.position.set(-0.65, 1.65, 0);
    cactus.add(leftUp);

    // 右枝
    const rightArmGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.7, 6);
    const rightArm = new THREE.Mesh(rightArmGeo, mat);
    rightArm.position.set(0.3, 0.9, 0);
    rightArm.rotation.z = -Math.PI / 2;
    cactus.add(rightArm);

    const rightUpGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.7, 6);
    const rightUp = new THREE.Mesh(rightUpGeo, mat);
    rightUp.position.set(0.55, 1.15, 0);
    cactus.add(rightUp);

    parent.add(cactus);
  }

  // 石板小路
  function createPathway(parent, radius) {
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 7; i++) {
      const stoneGeo = new THREE.BoxGeometry(0.9, 0.12, 0.7);
      const stone = new THREE.Mesh(stoneGeo, pathMat);
      const angle = (i / 7) * Math.PI * 0.8 - 0.4;
      stone.position.set(Math.sin(angle) * (radius * 0.55), 4.75, Math.cos(angle) * (radius * 0.55));
      stone.rotation.y = angle + (Math.random() - 0.5) * 0.3;
      parent.add(stone);
    }
  }

  // 精緻微縮小道具 (長椅、木箱、告示牌、路燈、小水井、櫻花樹)
  function createDetailedProps(parent, radius, id) {
    // 1. 低多邊形小房子 (窗戶夜間亮起)
    const house = new THREE.Group();
    const wallGeo = new THREE.BoxGeometry(2.4, 2, 2.2);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, flatShading: true });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 1;
    wall.castShadow = true;
    house.add(wall);

    const roofGeo = new THREE.ConeGeometry(2.2, 1.4, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xc0567a, flatShading: true });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 2.7;
    roof.castShadow = true;
    house.add(roof);

    // 夜晚發光窗戶
    const winGeo = new THREE.PlaneGeometry(0.6, 0.6);
    const winMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(0, 1.2, 1.12);
    house.add(win);
    nightLights.push({ mesh: win, dayColor: 0x334155, nightColor: 0xfde047 });

    house.position.set(radius * 0.45, 4.7, radius * 0.4);
    parent.add(house);

    // 2. 街角復古路燈 (柱＋發光球)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x374151 });
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(radius * 0.25, 5.9, radius * 0.55);
    parent.add(pole);

    const bulbGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(radius * 0.25, 7.1, radius * 0.55);
    parent.add(bulb);
    nightLights.push({ mesh: bulb, dayColor: 0x94a3b8, nightColor: 0xfef08a });

    // 3. 木箱與告示牌
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), crateMat);
    crate.position.set(radius * 0.35, 5.05, radius * 0.65);
    crate.castShadow = true;
    parent.add(crate);

    // 4. 粉嫩櫻花樹 (點綴規格)
    const sakura = new THREE.Group();
    const sTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 2.2, 5), new THREE.MeshStandardMaterial({ color: 0x78350f, flatShading: true }));
    sTrunk.position.y = 1.1;
    sakura.add(sTrunk);
    const sCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), new THREE.MeshStandardMaterial({ color: 0xf472b6, flatShading: true }));
    sCrown.position.y = 2.6;
    sakura.add(sCrown);
    sakura.position.set(-radius * 0.55, 4.7, -radius * 0.4);
    parent.add(sakura);
  }

  // 碼頭小棧橋
  function createPier(parent, radius) {
    const pier = new THREE.Group();
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8, flatShading: true });
    const dockGeo = new THREE.BoxGeometry(2, 0.25, 4.5);
    const dock = new THREE.Mesh(dockGeo, plankMat);
    dock.position.set(0, -0.1, radius + 1.6);
    dock.receiveShadow = true;
    pier.add(dock);

    // 木樁
    const postMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    for (let px of [-0.9, 0.9]) {
      for (let pz of [radius + 0.2, radius + 3.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), postMat);
        post.position.set(px, -0.3, pz);
        pier.add(post);
      }
    }
    parent.add(pier);
  }

  // 各島獨特地標建築
  function buildLandmark(parent, id, radius) {
    const landmark = new THREE.Group();

    if (id === 'center') {
      // 中央島：智慧願景塔＋中央噴泉水池＋市集驛站
      // 願景塔 (三層八角高塔)
      const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.2, 3, 8), new THREE.MeshStandardMaterial({ color: 0xffedd5, flatShading: true }));
      towerBase.position.y = 6.2;
      landmark.add(towerBase);

      const towerMid = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.3, 3.5, 8), new THREE.MeshStandardMaterial({ color: 0xf0a04b, flatShading: true }));
      towerMid.position.y = 9.4;
      landmark.add(towerMid);

      const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.8, 8), new THREE.MeshStandardMaterial({ color: 0xc0567a, flatShading: true }));
      towerRoof.position.y = 12.5;
      landmark.add(towerRoof);

      // 頂部願景水晶球
      const crystal = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      crystal.position.y = 14.4;
      landmark.add(crystal);
      landmark.userData.crystal = crystal;

      // 噴泉水池 (直徑 4.8)
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, flatShading: true }));
      pool.position.set(0, 4.9, 4.5);
      landmark.add(pool);

      const water = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.45, 16), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 }));
      water.position.set(0, 5.0, 4.5);
      landmark.add(water);

      // 噴水柱
      const spray = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.2, 8), new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.8 }));
      spray.position.set(0, 6.2, 4.5);
      landmark.add(spray);
      landmark.userData.spray = spray;

      // 市集帳篷
      const tentGeo = new THREE.ConeGeometry(1.8, 1.4, 4);
      tentGeo.rotateY(Math.PI / 4);
      const tent = new THREE.Mesh(tentGeo, new THREE.MeshStandardMaterial({ color: 0xf59e0b, flatShading: true }));
      tent.position.set(-4.5, 5.4, -2.5);
      landmark.add(tent);

      // 溫暖營火 (圍石＋火柱)
      const firePit = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.15, 6, 8), new THREE.MeshStandardMaterial({ color: 0x475569 }));
      firePit.rotateX(Math.PI / 2);
      firePit.position.set(4.2, 4.8, -3.2);
      landmark.add(firePit);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 5), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
      flame.position.set(4.2, 5.2, -3.2);
      landmark.add(flame);
      landmark.userData.flame = flame;

    } else if (id === 'island-01') {
      // 基本概況島：長安校門鐘樓＋毛毛蟲公共藝術
      const archL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.2, 0.8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, flatShading: true }));
      archL.position.set(-1.8, 6.8, 0);
      landmark.add(archL);
      const archR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.2, 0.8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, flatShading: true }));
      archR.position.set(1.8, 6.8, 0);
      landmark.add(archR);

      const archTop = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xc0567a, flatShading: true }));
      archTop.position.set(0, 9.2, 0);
      landmark.add(archTop);

      // 鐘樓尖塔
      const spire = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 4), new THREE.MeshStandardMaterial({ color: 0xf0a04b, flatShading: true }));
      spire.rotateY(Math.PI / 4);
      spire.position.set(0, 10.8, 0);
      landmark.add(spire);

      // 毛毛蟲公共藝術 (四節彩球)
      const caterpillar = new THREE.Group();
      const colors = [0x10b981, 0x34d399, 0xa7f3d0, 0xfacc15];
      for (let c = 0; c < 4; c++) {
        const seg = new THREE.Mesh(new THREE.SphereGeometry(0.45 - c * 0.05, 8, 8), new THREE.MeshStandardMaterial({ color: colors[c], flatShading: true }));
        seg.position.set(c * 0.65, Math.sin(c * 0.8) * 0.25, 0);
        caterpillar.add(seg);
      }
      caterpillar.position.set(-1.2, 4.9, 2.8);
      landmark.add(caterpillar);

    } else if (id === 'island-02') {
      // 生態課程島：大蝴蝶生態教室＋太陽能綠葉亭
      // 生態教室圓頂
      const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.8, flatShading: true }));
      dome.position.y = 4.7;
      landmark.add(dome);

      // 頂部大蝴蝶地標
      const butterfly = new THREE.Group();
      const wingGeo = new THREE.CircleGeometry(0.9, 6);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.set(-0.7, 0, 0);
      butterfly.add(wingL);
      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.set(0.7, 0, 0);
      butterfly.add(wingR);
      butterfly.position.set(0, 8.2, 0);
      landmark.add(butterfly);
      landmark.userData.butterfly = butterfly;

      // 太陽能綠葉亭 (大綠葉頂)
      const leafPavilion = new THREE.Group();
      const pPost = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.8, 6), new THREE.MeshStandardMaterial({ color: 0x475569 }));
      pPost.position.y = 1.4;
      leafPavilion.add(pPost);

      const solarLeaf = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.6), new THREE.MeshStandardMaterial({ color: 0x16a34a, flatShading: true }));
      solarLeaf.position.set(0, 2.8, 0);
      solarLeaf.rotation.x = 0.2;
      leafPavilion.add(solarLeaf);
      leafPavilion.position.set(3.2, 4.7, 1.8);
      landmark.add(leafPavilion);

    } else if (id === 'island-03') {
      // 行政領導島：領航圓頂行政樓＋悠閒風車
      const hall = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 3.6, 10), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, flatShading: true }));
      hall.position.y = 6.5;
      landmark.add(hall);

      const domeRoof = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8b5cf6, flatShading: true }));
      domeRoof.position.y = 8.3;
      landmark.add(domeRoof);

      // 微風風車 (點綴)
      const windmill = new THREE.Group();
      const mBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 3.8, 6), new THREE.MeshStandardMaterial({ color: 0xffedd5, flatShading: true }));
      mBase.position.y = 1.9;
      windmill.add(mBase);

      const blades = new THREE.Group();
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, side: THREE.DoubleSide });
      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 2.2), bladeMat);
        blade.position.y = 1.1;
        blade.rotation.z = (b * Math.PI) / 2;
        blades.add(blade);
      }
      blades.position.set(0, 3.4, 1.0);
      windmill.add(blades);
      windmill.position.set(-3.8, 4.7, 2.5);
      landmark.add(windmill);
      landmark.userData.blades = blades;

    } else if (id === 'island-04') {
      // 非凡亮點島：舞動閱讀城堡＋歡樂摩天輪
      const castle = new THREE.Group();
      const cBody = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.2, 3.2), new THREE.MeshStandardMaterial({ color: 0xffedd5, flatShading: true }));
      cBody.position.y = 1.6;
      castle.add(cBody);

      // 4 座角落小圓塔
      for (let cx of [-1.8, 1.8]) {
        for (let cz of [-1.6, 1.6]) {
          const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4.2, 6), new THREE.MeshStandardMaterial({ color: 0xfde047, flatShading: true }));
          turret.position.set(cx, 2.1, cz);
          castle.add(turret);

          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0xc0567a, flatShading: true }));
          cone.position.set(cx, 4.8, cz);
          castle.add(cone);
        }
      }
      castle.position.set(0, 4.7, -1);
      landmark.add(castle);

      // 緩慢旋轉彩色摩天輪 (點綴)
      const ferris = new THREE.Group();
      const fWheel = new THREE.Group();
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 6, 16), rimMat);
      fWheel.add(rim);

      for (let s = 0; s < 6; s++) {
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.8), rimMat);
        spoke.rotation.z = (s * Math.PI) / 6;
        fWheel.add(spoke);

        // 吊艙
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0xf43f5e }));
        pod.position.set(Math.cos((s * Math.PI) / 3) * 2.4, Math.sin((s * Math.PI) / 3) * 2.4, 0);
        fWheel.add(pod);
      }
      fWheel.position.set(0, 3.2, 0);
      ferris.add(fWheel);

      // 支架
      const stand = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 4), new THREE.MeshStandardMaterial({ color: 0x64748b, wireframe: true }));
      stand.position.set(0, 1.6, 0);
      ferris.add(stand);

      ferris.position.set(3.8, 4.7, 2.8);
      ferris.scale.set(0.85, 0.85, 0.85);
      landmark.add(ferris);
      landmark.userData.ferrisWheel = fWheel;

    } else if (id === 'island-05') {
      // 卓越榮譽島：金色榮譽殿堂＋凱旋門＋旋轉光束燈塔
      const temple = new THREE.Group();
      // 圓形立柱殿堂
      const tBase = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.8, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0xfef08a, flatShading: true }));
      tBase.position.y = 0.4;
      temple.add(tBase);

      for (let c = 0; c < 8; c++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
        const angle = (c * Math.PI) / 4;
        col.position.set(Math.cos(angle) * 2.8, 2.0, Math.sin(angle) * 2.8);
        temple.add(col);
      }

      const tRoof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.8, 12), new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.5, roughness: 0.3, flatShading: true }));
      tRoof.position.y = 4.2;
      temple.add(tRoof);

      // 金色榮譽大獎盃
      const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.3, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 }));
      trophy.position.set(0, 1.5, 0);
      temple.add(trophy);
      temple.position.set(0, 4.7, -1.2);
      landmark.add(temple);

      // 紅白相間燈塔 (點綴，夜間光束旋轉)
      const lighthouse = new THREE.Group();
      const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 4.8, 8), new THREE.MeshStandardMaterial({ color: 0xef4444, flatShading: true }));
      lhBase.position.y = 2.4;
      lighthouse.add(lhBase);

      const lhLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      lhLamp.position.y = 5.2;
      lighthouse.add(lhLamp);

      // 光束 (錐體)
      const beam = new THREE.Mesh(new THREE.ConeGeometry(2.5, 14, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
      beam.rotateX(Math.PI / 2);
      beam.position.set(0, 5.2, 7);
      lighthouse.add(beam);
      lighthouse.userData.beam = beam;

      lighthouse.position.set(-4.2, 4.7, 3.2);
      landmark.add(lighthouse);
      landmark.userData.lighthouse = lighthouse;
    }

    parent.add(landmark);
    parent.userData.landmarkGroup = landmark;
  }

  // 建造所有島嶼
  function buildAllIslands() {
    for (let id in ISLAND_LAYOUT) {
      const config = ISLAND_LAYOUT[id];
      const island = createDesertIsland(id, config);
      islandsGroup.add(island);
    }
  }

  // 跨島木橋
  function buildBridges() {
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.9, flatShading: true });
    const railingMat = new THREE.MeshStandardMaterial({ color: 0x78350f, flatShading: true });

    const connections = [
      ['center', 'island-01'],
      ['center', 'island-02'],
      ['center', 'island-03'],
      ['center', 'island-04'],
      ['center', 'island-05'],
      ['island-01', 'island-02'],
      ['island-03', 'island-04']
    ];

    connections.forEach(([fromId, toId]) => {
      const from = ISLAND_LAYOUT[fromId];
      const to = ISLAND_LAYOUT[toId];

      const p1 = new THREE.Vector3(from.x, 3.8, from.z);
      const p2 = new THREE.Vector3(to.x, 3.8, to.z);
      const dist = p1.distanceTo(p2);
      const mid = p1.clone().add(p2).multiplyScalar(0.5);

      const bridge = new THREE.Group();
      bridge.position.copy(mid);
      bridge.lookAt(p2);

      // 橋面板
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, dist * 0.72), bridgeMat);
      deck.castShadow = true;
      deck.receiveShadow = true;
      bridge.add(deck);

      // 橋墩
      for (let s of [-0.25, 0.25]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 4.5, 6), railingMat);
        pillar.position.set(0, -2.1, dist * 0.72 * s);
        bridge.add(pillar);
      }

      bridgesGroup.add(bridge);
    });
  }

  // 遠山森林剪影 (營造微縮場景畫框感)
  function buildDistantMountains() {
    const group = new THREE.Group();
    const mountainMat = new THREE.MeshBasicMaterial({ color: 0xd4a373, transparent: true, opacity: 0.45 });
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const dist = 180 + (Math.sin(i * 3) * 20);
      const mHeight = 25 + Math.random() * 20;
      const mWidth = 35 + Math.random() * 20;
      const m = new THREE.Mesh(new THREE.ConeGeometry(mWidth, mHeight, 5), mountainMat);
      m.position.set(Math.cos(angle) * dist, mHeight * 0.35, Math.sin(angle) * dist);
      group.add(m);
    }
    scene.add(group);
  }

  // 開場運鏡「平順飛近」
  function playIntroCamera(callback) {
    if (isReducedMotion) {
      camera.position.copy(DEFAULT_CAM_POS);
      controls.target.copy(DEFAULT_TARGET);
      controls.update();
      if (callback) callback();
      return;
    }

    isAnimatingCamera = true;
    controls.enabled = false;
    const startPos = new THREE.Vector3(0, 130, 150);
    const endPos = DEFAULT_CAM_POS.clone();
    const startTarget = new THREE.Vector3(0, 0, 0);
    const endTarget = DEFAULT_TARGET.clone();

    const startTime = performance.now();
    const duration = window.innerWidth < 768 ? 1600 : 2400; // 手機縮短 30%

    function step(now) {
      const elapsed = now - startTime;
      let t = Math.min(elapsed / duration, 1);
      // easeInOutCubic 平滑曲線
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      camera.position.lerpVectors(startPos, endPos, ease);
      controls.target.lerpVectors(startTarget, endTarget, ease);
      camera.lookAt(controls.target);

      if (t < 1 && isAnimatingCamera) {
        requestAnimationFrame(step);
      } else {
        isAnimatingCamera = false;
        controls.enabled = true;
        controls.update();
        if (callback) callback();
      }
    }
    requestAnimationFrame(step);
  }

  // 平滑飛近指定島嶼
  function flyToIsland(islandId, callback) {
    const config = ISLAND_LAYOUT[islandId];
    if (!config) return;

    if (isReducedMotion) {
      controls.target.set(config.x, 3.5, config.z);
      camera.position.set(config.x + 10, 16, config.z + 18);
      controls.update();
      if (callback) callback();
      return;
    }

    isAnimatingCamera = true;
    controls.enabled = false;

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();

    const targetPos = new THREE.Vector3(config.x, 4.0, config.z);
    // 飛到該島南側斜上方
    const endPos = new THREE.Vector3(config.x, 16, config.z + config.r * 1.8 + 6);

    const startTime = performance.now();
    const duration = window.innerWidth < 768 ? 1000 : 1400;

    function step(now) {
      const elapsed = now - startTime;
      let t = Math.min(elapsed / duration, 1);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      camera.position.lerpVectors(startPos, endPos, ease);
      controls.target.lerpVectors(startTarget, targetPos, ease);
      camera.lookAt(controls.target);

      if (t < 1 && isAnimatingCamera) {
        requestAnimationFrame(step);
      } else {
        isAnimatingCamera = false;
        controls.enabled = true;
        controls.update();
        if (callback) callback();
      }
    }
    requestAnimationFrame(step);
  }

  // 平滑退回全景
  function flyToOverview(callback) {
    if (isReducedMotion) {
      camera.position.copy(DEFAULT_CAM_POS);
      controls.target.copy(DEFAULT_TARGET);
      controls.update();
      if (callback) callback();
      return;
    }

    isAnimatingCamera = true;
    controls.enabled = false;
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();

    const startTime = performance.now();
    const duration = 1200;

    function step(now) {
      const elapsed = now - startTime;
      let t = Math.min(elapsed / duration, 1);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      camera.position.lerpVectors(startPos, DEFAULT_CAM_POS, ease);
      controls.target.lerpVectors(startTarget, DEFAULT_TARGET, ease);
      camera.lookAt(controls.target);

      if (t < 1 && isAnimatingCamera) {
        requestAnimationFrame(step);
      } else {
        isAnimatingCamera = false;
        controls.enabled = true;
        controls.update();
        if (callback) callback();
      }
    }
    requestAnimationFrame(step);
  }

  // 跳過運鏡
  function skipCameraAnimation() {
    isAnimatingCamera = false;
    controls.enabled = true;
    camera.position.copy(DEFAULT_CAM_POS);
    controls.target.copy(DEFAULT_TARGET);
    controls.update();
  }

  // 時段與光線切換 (白天、黃昏、夜晚)
  function setTimeOfDay(tod) {
    timeOfDay = tod;
    const colors = THEME_SKY_COLORS[tod] || THEME_SKY_COLORS.day;

    // 平滑過渡光色
    dirLight.color.setHex(colors.sun);
    dirLight.intensity = colors.sunIntensity;
    hemiLight.color.setHex(colors.hemiSky);
    hemiLight.groundColor.setHex(colors.hemiGround);
    scene.fog.color.setHex(colors.fog);
    skyMesh.material.color.setHex(colors.bottom);
    seaMesh.material.color.setHex(colors.sea);

    if (tod === 'night') {
      starsParticles.material.opacity = 0.95;
      nightLights.forEach(item => {
        if (item.mesh) {
          item.mesh.material.color.setHex(item.nightColor);
        } else if (item.isPointLight) {
          item.intensity = 1.2;
        }
      });
    } else {
      starsParticles.material.opacity = 0;
      nightLights.forEach(item => {
        if (item.mesh) {
          item.mesh.material.color.setHex(item.dayColor);
        } else if (item.isPointLight) {
          item.intensity = 0;
        }
      });
    }
  }

  // 視窗尺寸改變
  function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  // 主渲染動畫迴圈
  function animate(time) {
    animId = requestAnimationFrame(animate);

    if (!isReducedMotion) {
      // 1. 海面波動位移
      if (seaMesh) {
        const pos = seaMesh.geometry.attributes.position;
        const origY = seaMesh.geometry.userData.origY;
        const t = (time || performance.now()) * 0.0018;
        for (let i = 0; i < pos.count; i++) {
          const u = pos.getX(i);
          const v = pos.getZ(i);
          const wave = Math.sin(u * 0.08 + t) * Math.cos(v * 0.08 + t) * 0.35;
          pos.setY(i, origY[i] + wave);
        }
        pos.needsUpdate = true;
      }

      // 2. 地標機關小動畫 (風車、摩天輪、噴泉、燈塔光束、營火)
      islandsGroup.children.forEach(island => {
        const lm = island.userData.landmarkGroup;
        if (lm) {
          if (lm.userData.blades) lm.userData.blades.rotation.z += 0.035; // 風車轉動
          if (lm.userData.ferrisWheel) lm.userData.ferrisWheel.rotation.z += 0.008; // 摩天輪
          if (lm.userData.crystal) lm.userData.crystal.rotation.y += 0.02; // 水晶旋轉
          if (lm.userData.flame) {
            const fScale = 0.9 + Math.sin((time || performance.now()) * 0.01) * 0.2;
            lm.userData.flame.scale.set(fScale, fScale, fScale);
          }
          if (lm.userData.lighthouse && lm.userData.lighthouse.userData.beam) {
            lm.userData.lighthouse.userData.beam.rotation.y += 0.025; // 燈塔光束旋轉
          }
        }
      });

      // 3. 自動晝夜循環
      if (autoCycle) {
        cycleTimer += 0.0006;
        if (cycleTimer > 3) cycleTimer = 0;
        if (cycleTimer < 1 && timeOfDay !== 'day') setTimeOfDay('day');
        else if (cycleTimer >= 1 && cycleTimer < 2 && timeOfDay !== 'dusk') setTimeOfDay('dusk');
        else if (cycleTimer >= 2 && timeOfDay !== 'night') setTimeOfDay('night');
      }
    }

    if (controls && controls.enabled) {
      controls.update();
    }

    // 呼叫生活感系統動畫 (居民、海龜、雲鳥)
    if (window.IslandWorld && window.IslandWorld.update) {
      window.IslandWorld.update(time || performance.now(), isReducedMotion);
    }

    // 更新 3D 浮動標籤與羅盤
    if (window.IslandUI && window.IslandUI.updateLabels) {
      window.IslandUI.updateLabels(camera, ISLAND_LAYOUT);
    }

    renderer.render(scene, camera);
  }

  return {
    init,
    getScene: () => scene,
    getCamera: () => camera,
    getRenderer: () => renderer,
    getControls: () => controls,
    getLayout: () => ISLAND_LAYOUT,
    flyToIsland,
    flyToOverview,
    playIntroCamera,
    skipCameraAnimation,
    setTimeOfDay,
    getTimeOfDay: () => timeOfDay,
    setAutoCycle: (val) => { autoCycle = val; },
    setReducedMotion: (val) => { isReducedMotion = val; }
  };
})();
