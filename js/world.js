/**
 * 長安願景島 - 生活感世界 (Living World)
 * 包含：16 位居民 NPC、22 種動物、海龜接駁巡航、雲鳥帆船、沙灘貝殼拾取
 */

window.IslandWorld = (function() {
  let residents = [];
  let animals = [];
  let clouds = [];
  let birds = [];
  let boats = [];
  let seaTurtleGuide = null;
  let pickupShells = [];
  let worldGroup = null;

  // 16 位居民資料 (從 content.json 讀取後快取)
  let residentData = [];
  let animalData = [];

  function init(scene, contentData) {
    worldGroup = new THREE.Group();
    worldGroup.name = 'livingWorld';
    scene.add(worldGroup);

    residentData = contentData.residents || [];
    animalData = contentData.animals || [];

    setupNPCs();
    setupAnimals();
    setupSeaTurtleGuide();
    setupCloudsAndBirds();
    setupSailboats();
    setupPickupShells();

    // 點擊 3D 物件射線檢測 (點居民、動物、貝殼)
    setupRaycasting();
  }

  // 1. 建立 Q 版低多邊形 NPC
  function createHumanFigure(colorHex = 0xc0567a, hasBox = false) {
    const human = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.8 });
    const clothMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7, flatShading: true });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x451a03, flatShading: true });

    // 身體 (短圓柱)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.85, 6), clothMat);
    body.position.y = 0.85;
    body.castShadow = true;
    human.add(body);

    // 頭部
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), skinMat);
    head.position.y = 1.45;
    head.castShadow = true;
    human.add(head);

    // 頭髮或帽子
    const hair = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.3, 6), hairMat);
    hair.position.y = 1.68;
    human.add(hair);

    // 兩手
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 5);
    const leftArm = new THREE.Mesh(armGeo, clothMat);
    leftArm.position.set(-0.4, 0.85, 0);
    human.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, clothMat);
    rightArm.position.set(0.4, 0.85, 0);
    human.add(rightArm);

    // 兩腳
    const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 5);
    const leftLeg = new THREE.Mesh(legGeo, clothMat);
    leftLeg.position.set(-0.16, 0.25, 0);
    human.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, clothMat);
    rightLeg.position.set(0.16, 0.25, 0);
    human.add(rightLeg);

    // 送貨員貨箱
    if (hasBox) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
      box.position.set(0, 1.15, -0.35);
      box.castShadow = true;
      human.add(box);
      human.userData.cargoBox = box;
    }

    human.userData.leftArm = leftArm;
    human.userData.rightArm = rightArm;
    human.userData.leftLeg = leftLeg;
    human.userData.rightLeg = rightLeg;

    return human;
  }

  function setupNPCs() {
    const layout = window.IslandScene.getLayout();

    residentData.forEach((data, index) => {
      const isCarrier = data.carrier === true;
      const mesh = createHumanFigure(data.color ? parseInt(data.color.replace('#', '0x')) : 0xc0567a, isCarrier);

      // 起始坐標
      let basePos = new THREE.Vector3(0, 4.7, 0);
      if (layout[data.islandId]) {
        basePos.set(layout[data.islandId].x, 4.7, layout[data.islandId].z);
      }
      if (data.pos) {
        mesh.position.set(basePos.x + data.pos[0] * 5, 4.7, basePos.z + data.pos[1] * 5);
      } else {
        mesh.position.copy(basePos);
      }

      mesh.userData.npcData = data;
      mesh.userData.basePos = basePos.clone();
      mesh.userData.walkAngle = Math.random() * Math.PI * 2;
      mesh.userData.walkRadius = 3.5 + Math.random() * 2.5;
      mesh.userData.state = 'walk'; // 'walk', 'idle', 'waving'
      mesh.userData.timer = 0;
      mesh.userData.carrierFrom = 'center';
      mesh.userData.carrierTo = ['island-01', 'island-02', 'island-04'][index % 3];

      worldGroup.add(mesh);
      residents.push(mesh);
    });
  }

  // 2. 建立 22 種低多邊形動物
  function setupAnimals() {
    const layout = window.IslandScene.getLayout();

    animalData.forEach(item => {
      const animalGroup = new THREE.Group();
      animalGroup.userData.animalData = item;

      // 依位置配置
      let base = { x: 0, z: 0 };
      if (layout[item.islandId]) {
        base = layout[item.islandId];
      }

      if (item.where === 'sea') {
        // 海中游動動物 (海豚、鯨魚、海龜)
        const seaObj = createSeaCreature(item.id);
        animalGroup.add(seaObj);
        animalGroup.position.set((Math.random() - 0.5) * 80, -0.1, (Math.random() - 0.5) * 80);
        animalGroup.userData.orbitR = 35 + Math.random() * 25;
        animalGroup.userData.angle = Math.random() * Math.PI * 2;
        animalGroup.userData.speed = item.id === 'dolphin' ? 0.012 : 0.006;
      } else if (item.where === 'air') {
        // 空中飛行 (海鷗、蝴蝶)
        const flyer = createAirCreature(item.id);
        animalGroup.add(flyer);
        animalGroup.position.set(base.x + (Math.random() - 0.5) * 8, 9 + Math.random() * 4, base.z + (Math.random() - 0.5) * 8);
        animalGroup.userData.flyAngle = Math.random() * Math.PI * 2;
      } else if (item.where === 'shore') {
        // 岸邊 (鴨子、企鵝、螃蟹、青蛙、海豹)
        const shoreCreature = createLandAnimal(item.id);
        animalGroup.add(shoreCreature);
        const a = Math.random() * Math.PI * 2;
        const r = (layout[item.islandId] ? layout[item.islandId].r : 10) * 0.85;
        animalGroup.position.set(base.x + Math.sin(a) * r, 4.6, base.z + Math.cos(a) * r);
      } else {
        // 陸地 (松鼠、兔子、小狗、乳牛、貓咪、綿羊、小鹿、狐狸、熊貓、刺蝟、小豬、小雞)
        const landCreature = createLandAnimal(item.id);
        animalGroup.add(landCreature);
        animalGroup.position.set(base.x + (Math.random() - 0.5) * 6, 4.7, base.z + (Math.random() - 0.5) * 6);
      }

      worldGroup.add(animalGroup);
      animals.push(animalGroup);
    });
  }

  function createSeaCreature(type) {
    const grp = new THREE.Group();
    if (type === 'dolphin') {
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0x38bdf8, flatShading: true }));
      body.rotateX(Math.PI / 2);
      grp.add(body);
      // 背鰭
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
      fin.position.set(0, 0.45, 0);
      grp.add(fin);
    } else if (type === 'whale') {
      const wBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 3.8), new THREE.MeshStandardMaterial({ color: 0x1e293b, flatShading: true }));
      grp.add(wBody);
      // 水柱 (偶爾噴水)
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.4, 2.2, 6), new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.7 }));
      spout.position.set(0, 1.8, 0.8);
      grp.add(spout);
      grp.userData.spout = spout;
    } else {
      // 悠游小海龜
      const tShell = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 6), new THREE.MeshStandardMaterial({ color: 0x15803d, flatShading: true }));
      tShell.scale.set(1, 0.4, 1.2);
      grp.add(tShell);
    }
    return grp;
  }

  function createAirCreature(type) {
    const grp = new THREE.Group();
    if (type === 'butterfly') {
      const wingMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, side: THREE.DoubleSide });
      const wL = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), wingMat);
      wL.position.x = -0.22;
      grp.add(wL);
      const wR = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), wingMat);
      wR.position.x = 0.22;
      grp.add(wR);
      grp.userData.wL = wL;
      grp.userData.wR = wR;
    } else {
      // 海鷗 (V 型白翅)
      const bBody = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      bBody.rotateX(Math.PI / 2);
      grp.add(bBody);
      const wings = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide }));
      grp.add(wings);
      grp.userData.wings = wings;
    }
    return grp;
  }

  function createLandAnimal(type) {
    const grp = new THREE.Group();
    // 低多邊形小巧身體＋頭部
    let color = 0xd97706;
    if (type === 'panda') color = 0x0f172a;
    else if (type === 'cow') color = 0xffffff;
    else if (type === 'rabbit') color = 0xf8fafc;
    else if (type === 'frog') color = 0x22c55e;
    else if (type === 'penguin') color = 0x0284c7;
    else if (type === 'sheep') color = 0xfef08a;

    const b = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.5, 0.9), new THREE.MeshStandardMaterial({ color: color, flatShading: true }));
    b.position.y = 0.35;
    b.castShadow = true;
    grp.add(b);

    const h = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), new THREE.MeshStandardMaterial({ color: color, flatShading: true }));
    h.position.set(0, 0.65, 0.45);
    grp.add(h);

    return grp;
  }

  // 3. 海龜接駁嚮導 (Sea Guide)
  function setupSeaTurtleGuide() {
    const turtle = new THREE.Group();
    // 龜殼
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8, flatShading: true });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), shellMat);
    shell.scale.set(1.1, 0.45, 1.4);
    shell.position.y = 0.4;
    turtle.add(shell);

    // 龜頭
    const headMat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
    const tHead = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 6), headMat);
    tHead.position.set(0, 0.6, 2.8);
    turtle.add(tHead);

    // 四隻游動鰭足
    for (let f of [-1.8, 1.8]) {
      const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 1.6), headMat);
      flipper.position.set(f, 0.2, 1.0);
      turtle.add(flipper);
    }

    // 龜背上載的小人物
    const rider = createHumanFigure(0x38bdf8);
    rider.position.set(0, 1.3, 0);
    rider.scale.set(0.8, 0.8, 0.8);
    turtle.add(rider);

    turtle.position.set(38, -0.2, 0);
    turtle.userData.angle = 0;
    turtle.userData.dockTimer = 0;
    turtle.userData.isDocked = false;

    worldGroup.add(turtle);
    seaTurtleGuide = turtle;
  }

  // 4. 雲朵飄移與鳥群
  function setupCloudsAndBirds() {
    // 8 朵低多邊形白雲
    for (let c = 0; c < 8; c++) {
      const cloud = new THREE.Group();
      const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, flatShading: true });
      for (let s = 0; s < 4; s++) {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6 + Math.random() * 0.8), cloudMat);
        puff.position.set((s - 1.5) * 1.5, Math.sin(s) * 0.5, (Math.random() - 0.5) * 1.2);
        cloud.add(puff);
      }
      const dist = 55 + Math.random() * 30;
      const angle = (c / 8) * Math.PI * 2;
      cloud.position.set(Math.cos(angle) * dist, 28 + Math.random() * 10, Math.sin(angle) * dist);
      cloud.userData.angle = angle;
      cloud.userData.dist = dist;
      cloud.userData.speed = 0.0012 + Math.random() * 0.0008;

      worldGroup.add(cloud);
      clouds.push(cloud);
    }
  }

  // 5. 外海帆船
  function setupSailboats() {
    for (let b = 0; b < 2; b++) {
      const boat = new THREE.Group();
      // 船身
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 4.2), new THREE.MeshStandardMaterial({ color: 0x9a3412, flatShading: true }));
      boat.add(hull);
      // 白帆
      const sail = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.6, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      sail.position.set(0, 2.2, 0);
      boat.add(sail);

      const radius = 68 + b * 20;
      boat.position.set(radius, 0.1, 0);
      boat.userData.orbitR = radius;
      boat.userData.angle = b * Math.PI;

      worldGroup.add(boat);
      boats.push(boat);
    }
  }

  // 6. 沙灘貝殼拾取 (+1 貝殼)
  function setupPickupShells() {
    const layout = window.IslandScene.getLayout();
    for (let id in layout) {
      const isConfig = layout[id];
      const shellGeo = new THREE.DodecahedronGeometry(0.45);
      const shellMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.35, roughness: 0.4 });
      const shell = new THREE.Mesh(shellGeo, shellMat);

      // 放在沙灘邊緣
      const angle = Math.random() * Math.PI * 2;
      shell.position.set(isConfig.x + Math.sin(angle) * (isConfig.r * 0.88), 4.75, isConfig.z + Math.cos(angle) * (isConfig.r * 0.88));
      shell.userData.isPickupShell = true;
      shell.userData.active = true;

      worldGroup.add(shell);
      pickupShells.push(shell);
    }
  }

  // 3D 射線檢測 (Raycasting)
  function setupRaycasting() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('click', (event) => {
      // 點擊 UI 或抽屜時忽略
      if (event.target.closest('.drawer-panel') || event.target.closest('.modal-overlay') || event.target.closest('.bottom-dock') || event.target.closest('.top-header') || event.target.closest('.right-hud')) {
        return;
      }

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      const camera = window.IslandScene.getCamera();
      raycaster.setFromCamera(mouse, camera);

      // 1. 檢測貝殼拾取
      const shellHits = raycaster.intersectObjects(pickupShells);
      if (shellHits.length > 0) {
        const hitShell = shellHits[0].object;
        if (hitShell.userData.active) {
          hitShell.userData.active = false;
          hitShell.visible = false;
          // 背包 +1 貝殼
          if (window.IslandUI) {
            window.IslandUI.addShell();
          }
          // 20 秒後重生
          setTimeout(() => {
            hitShell.visible = true;
            hitShell.userData.active = true;
          }, 20000);
          return;
        }
      }

      // 2. 檢測居民 NPC
      const npcs = residents.map(r => r.children[0]); // 身體
      const npcHits = raycaster.intersectObjects(npcs, true);
      if (npcHits.length > 0) {
        let parent = npcHits[0].object;
        while (parent && !parent.userData.npcData) {
          parent = parent.parent;
        }
        if (parent && parent.userData.npcData) {
          // 居民停下、揮手並展開對話泡泡
          parent.userData.state = 'waving';
          parent.userData.timer = 8;
          if (window.IslandUI) {
            window.IslandUI.showNPCDialogue(parent, parent.userData.npcData);
          }
          return;
        }
      }

      // 3. 檢測動物
      const animalObjs = animals.map(a => a.children[0]);
      const animalHits = raycaster.intersectObjects(animalObjs, true);
      if (animalHits.length > 0) {
        let aParent = animalHits[0].object;
        while (aParent && !aParent.userData.animalData) {
          aParent = aParent.parent;
        }
        if (aParent && aParent.userData.animalData) {
          // 跳一下
          aParent.position.y += 0.8;
          setTimeout(() => { aParent.position.y -= 0.8; }, 300);
          if (window.IslandUI) {
            window.IslandUI.showAnimalBubble(aParent, aParent.userData.animalData);
          }
          return;
        }
      }

      // 4. 點擊海龜嚮導
      if (seaTurtleGuide) {
        const turtleHits = raycaster.intersectObject(seaTurtleGuide, true);
        if (turtleHits.length > 0) {
          if (window.IslandUI) {
            window.IslandUI.showToast('🐢 海龜嚮導：「下一站靠岸：基本概況島！請大家坐穩囉！」');
          }
        }
      }
    });
  }

  // 每幀更新動畫
  function update(now, isReducedMotion) {
    if (isReducedMotion) return;

    const t = now * 0.001;

    // 1. 居民走路與擺手動作
    residents.forEach(res => {
      const data = res.userData;
      if (data.state === 'walk') {
        data.walkAngle += 0.012;
        const targetX = data.basePos.x + Math.sin(data.walkAngle) * data.walkRadius;
        const targetZ = data.basePos.z + Math.cos(data.walkAngle) * data.walkRadius;
        res.position.x = targetX;
        res.position.z = targetZ;
        res.rotation.y = data.walkAngle + Math.PI / 2;

        // 手腳前後擺動
        if (res.userData.leftLeg) {
          res.userData.leftLeg.rotation.x = Math.sin(t * 8) * 0.4;
          res.userData.rightLeg.rotation.x = -Math.sin(t * 8) * 0.4;
          res.userData.leftArm.rotation.x = -Math.sin(t * 8) * 0.4;
          res.userData.rightArm.rotation.x = Math.sin(t * 8) * 0.4;
        }

        // 偶爾停下
        if (Math.random() < 0.004) {
          data.state = 'idle';
          data.timer = 120 + Math.random() * 100;
        }
      } else if (data.state === 'idle') {
        data.timer--;
        if (res.userData.leftLeg) {
          res.userData.leftLeg.rotation.x = 0;
          res.userData.rightLeg.rotation.x = 0;
        }
        if (data.timer <= 0) {
          data.state = 'walk';
        }
      } else if (data.state === 'waving') {
        // 揮手
        if (res.userData.rightArm) {
          res.userData.rightArm.rotation.z = Math.PI - Math.sin(t * 12) * 0.3;
        }
        data.timer -= 0.02;
        if (data.timer <= 0) {
          data.state = 'walk';
          if (res.userData.rightArm) res.userData.rightArm.rotation.z = 0;
        }
      }
    });

    // 2. 海龜接駁巡航
    if (seaTurtleGuide) {
      if (!seaTurtleGuide.userData.isDocked) {
        seaTurtleGuide.userData.angle += 0.004;
        const r = 44;
        seaTurtleGuide.position.x = Math.cos(seaTurtleGuide.userData.angle) * r;
        seaTurtleGuide.position.z = Math.sin(seaTurtleGuide.userData.angle) * r;
        seaTurtleGuide.rotation.y = -seaTurtleGuide.userData.angle - Math.PI / 2;
        // 划水起伏
        seaTurtleGuide.position.y = -0.1 + Math.sin(t * 3) * 0.15;
      }
    }

    // 3. 雲朵飄移
    clouds.forEach(c => {
      c.userData.angle += c.userData.speed;
      c.position.x = Math.cos(c.userData.angle) * c.userData.dist;
      c.position.z = Math.sin(c.userData.angle) * c.userData.dist;
    });

    // 4. 外海帆船巡航
    boats.forEach(b => {
      b.userData.angle += 0.003;
      b.position.x = Math.cos(b.userData.angle) * b.userData.orbitR;
      b.position.z = Math.sin(b.userData.angle) * b.userData.orbitR;
      b.rotation.y = -b.userData.angle - Math.PI / 2;
      b.rotation.z = Math.sin(t * 2) * 0.05; // 隨浪搖晃
    });

    // 5. 蝴蝶與海鷗拍翅
    animals.forEach(a => {
      if (a.userData.animalData && a.userData.animalData.where === 'air') {
        const sub = a.children[0];
        if (sub && sub.userData.wings) {
          sub.userData.wings.rotation.z = Math.sin(t * 12) * 0.3;
        }
      }
    });
  }

  return {
    init,
    update
  };
})();
