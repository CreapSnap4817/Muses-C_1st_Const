// VTR 第1章〜第6章：目的、打ち上げ、イオンエンジン、太陽フレアとスイングバイ、到着、リアクションホイールの故障
export default function chaptersA(K) {
  const { THREE, ENV, CUT, PI, V, c01, sm, lerp, eio, R, ctx, ui, T, scene, stage, hb, M, hold, fx, S, cache, get, ito, earth, orbitMap,
    sunDir, sunLight, hemi, stars, sun, setSun, followShadow, cam, place, tweak, useHB, basisQ, UPQ, upYaw, wpos, wdir, lab, mapScene, mapHud, mapCam,
    emitIons, puff, rcsFire, chip, glowSprite, hideTop, camCut } = K;
  const CH = [];
  const itoFree = () => { const it = ito(); place(it); it.position.set(0, 0, 0); it.quaternion.identity(); it.detail.value = 1; return it; };

  // ================= 1 はやぶさの目的 =================
  CH.push({
    date: '2003 – 2010', title: 'はやぶさの目的',
    lines: [
      { t: '2003年、日本の小惑星探査機「はやぶさ」は、小惑星の砂を地球に持ち帰る旅に出た。' },
      { t: '小惑星は、46億年前に太陽系ができたころの材料が、ほとんど形を変えずに残っている天体だ。' },
      { t: '地球の石は、火山の熱や雨風で何度も作り変えられてきた。小惑星の石には、生まれたころの記録が残っている。' },
      { t: '行き先は小惑星イトカワ。地球と火星のあいだを回り、地球の軌道を横切る小さな天体だ。' },
      { t: '往復の道のりは約60億km。月より遠い天体に着陸し、その砂を持ち帰る、世界で初めての挑戦だった。' },
    ],
    shots: [
      { at: 0, setup() {
          setSun(V(-0.6, 0.45, 0.66), V(0, 0, 0), 5);
          useHB(basisQ(V(1, 0, 0.5), V(-0.35, 0.8, 0.5)));
          hb.setThrust([0, 0.6, 0.6, 0.6]);
        },
        update(u) {
          // 噴射しているエンジンのすぐそばから始め、ゆっくり引いて全体を見せる
          const k = eio(u.st / 10), a = 0.42 + k * 0.6, r = lerp(3.1, 8.6, k);
          cam(V(Math.cos(a) * r + 0.7 * (1 - k), lerp(0.75, 2.5, k), Math.sin(a) * r), V(lerp(0.8, 0.2, k), lerp(-0.05, 0.1, k), lerp(0.25, 0, k)), 36);
          emitIons(u.dt);
        } },
      { at: 1, setup() {
          const it = itoFree(); it.rotation.set(0.25, 0.6, 0.1);
          setSun(V(-0.7, 0.3, 0.65), V(0, 0, 0), 330);
        },
        update(u) {
          cache.ito.rotateOnAxis(V(0, 1, 0), u.dt * 0.05);
          const d = 1500 - u.st * 16;
          cam(V(Math.sin(0.3) * d, 160 - u.st * 3, Math.cos(0.3) * d), V(0, -10, 0), 30);
        } },
      { at: 3, setup() { mapScene(); },
        update(u) {
          const map = orbitMap(); const s = eio(u.st / 15);
          mapHud(map, map.TM.L + (map.TM.R - map.TM.L) * s, 110);
          mapCam(-0.9 + u.st * 0.03);
        } },
    ],
  });

  // ================= 2 打ち上げ =================
  const TILT = -0.15;                                    // 発射台の傾き（M-Vは斜めに打ち上げる）
  const mvRocket = () => { const mv = get('mv', () => ENV.makeMV(T)); mv.resetParts(); mv.position.set(0, 0, 0); mv.rotation.set(0, 0, 0); mv.scale.setScalar(1); return mv; };
  // 宇宙でのロケット。探査機の中心が原点に来るように置く。stage：1なら全段、2なら第2段から上、3なら第3段から上を見せる
  function upperStack(tilt = -1.05, stage = 3) {
    const mv = mvRocket(); mv.b1.visible = stage <= 1; mv.b2.visible = stage <= 2; mv.position.y = -mv.scY;
    const rig = new THREE.Group(); rig.rotation.z = tilt; place(rig); rig.add(mv);
    useHB(UPQ.clone()); rig.add(hold);
    hb.setDeploy(0); hb.setHorn(0);
    return { mv, rig };
  }
  function spaceAboveEarth(y = -6900) {
    const e = earth(); place(e); e.position.set(0, y, 0);
    e.quaternion.setFromUnitVectors(ENV.latLonDir(24, 150), V(0.15, 1, 0.2).normalize());
    setSun(V(-0.35, 0.7, 0.62), V(0, 0, 0), 9);
    return e;
  }
  const flame = (size) => { const s = glowSprite(new THREE.Color(4, 2.4, 1.0), size); return s; };
  // ロケットの噴射：光の玉と、後ろへ流れる火の粉。np はロケットの座標での噴き口の位置
  const jet = (u, rig, np, k, size, n = 4, sp = 14) => {
    S.flame.position.copy(np); S.flame.scale.setScalar(k * size * (1 + Math.sin(u.t * 50) * 0.08));
    if (k > 0.2 && u.dt > 0) { const w = rig.localToWorld(np.clone()), dn = V(0, -1, 0).transformDirection(rig.matrixWorld);
      for (let i = 0; i < n; i++) fx.glow.emit(p => { const v = dn.clone().multiplyScalar(sp * (0.7 + R() * 0.6)), j = sp * 0.16;
        p.pos = [w.x, w.y, w.z]; p.vel = [v.x + (R() - .5) * j, v.y + (R() - .5) * j, v.z + (R() - .5) * j]; p.col = [2.2, 1.4, 0.6]; p.alpha = 0.7; p.size = size * (0.13 + R() * 0.1); p.grow = size * 0.34; p.life = 0.5 + R() * 0.4; }); }
  };
  CH.push({
    date: '2003.05.09', title: 'M-Vロケットで打ち上げ',
    lines: [
      { t: '2003年5月9日午後1時29分25秒、鹿児島県の内之浦から、M-Vロケット5号機が打ち上げられた。', s: '2003年5月9日午後1時29分25秒、鹿児島県の内之浦から、ミューファイブロケット5号機が打ち上げられた。' },
      { t: 'M-Vは全長30.8m、重さ約140トン。全段が固体燃料で、斜めに傾けた発射台から飛び立つ。', s: 'ミューファイブは全長30.8メートル、重さ約140トン。全段が固体燃料で、斜めに傾けた発射台から飛び立つ。' },
      { t: '1段目は1分足らずで燃えつきる。2段目との間は、すき間のある格子でつながっている。発射から1分あまりで、1段目の切り離しと同時に2段目に点火する。炎は格子のすき間から外へ逃げる。' },
      { t: '空気がほとんどない高さまで上がると、先端のカバーが2つに割れて外れる。中から、パドルをたたんだはやぶさが現れる。' },
      { t: '3段目は、ノズルの筒を下へ伸ばしてから点火する。燃えつきると離れ、最後にキックモータが燃える。地球の重力を振り切る速さを、ここで受け取る。' },
      { t: '役目を終えたキックモータを切り離すと、はやぶさは自分でパドルを開いた。端から端まで約5.7mになる。' },
      { t: '続いて、縮めてあったサンプラーホーンを伸ばす。布の蛇腹が、ばねの力で約1mの長さになる。' },
      { t: '重さは燃料を含めて約510kg。打ち上げ前の名前は「MUSES-C」。宇宙に出たあと、「はやぶさ」と名付けられた。', s: '重さは燃料を含めて約510キログラム。打ち上げ前の名前は、ミューゼスシー。宇宙に出たあと、はやぶさと名付けられた。' },
    ],
    shots: [
      { at: 0, setup() {
          const site = get('site', () => ENV.makeLaunchSite(T)); place(site); site.boom.rotation.x = TILT;
          const mv = mvRocket(); place(mv); mv.position.set(0, 6.3, 0); mv.rotation.x = TILT;
          const sky = get('sky', () => ENV.makeSky()); place(sky); sky.material.uniforms.uDark.value = 0; sky.material.uniforms.uTint.value.setRGB(1, 1, 1);
          stars.setOpacity(0); hemi.intensity = 0.55; hemi.color.setHex(0xbcd4ff); hemi.groundColor.setHex(0x3a4a2a);
          setSun(V(0.5, 0.62, 0.6), V(0, 15, 0), 60, false, 2.3);
          scene.environment = ctx.envSpace; ctx.setBloom(0.3, 0.5, 1.7); ctx.setExposure(0.9);
          S.flame = place(flame(0.01));
          S.fl = new THREE.PointLight(0xffa040, 0, 300, 1.5); place(S.fl);
          S.axis = V(0, Math.cos(TILT), Math.sin(TILT));
        },
        update(u) {
          const mv = cache.mv; const ign = 2.0, lift = 2.8;
          const tt = Math.max(0, u.st - lift); const s = 0.5 * 7.5 * tt * tt;
          mv.position.set(0, 6.3, 0).addScaledVector(S.axis, s);
          const noz = mv.localToWorld(V(0, mv.nozzleY, 0));
          const on = u.st > ign; const k = on ? Math.min(1, (u.st - ign) * 2) : 0;
          S.flame.position.copy(noz).addScaledVector(S.axis, -2.5); S.flame.scale.setScalar(k * (17 + Math.sin(u.t * 40) * 1.5));
          S.fl.position.copy(noz); S.fl.intensity = k * 6000;
          if (on && u.dt > 0) {
            for (let i = 0; i < 6; i++) fx.glow.emit(p => { p.pos = [noz.x + (R() - .5) * 1.4, noz.y - R() * 2, noz.z + (R() - .5) * 1.4]; p.vel = [(R() - .5) * 6 - S.axis.x * 30, -30 - R() * 20, (R() - .5) * 6 - S.axis.z * 30]; p.col = [2.2, 1.2, 0.45]; p.alpha = 0.8; p.size = 1.8 + R() * 1.4; p.grow = 4; p.life = 0.35 + R() * 0.25; });
            const nSm = s < 120 ? 4 : 1;
            for (let i = 0; i < nSm; i++) fx.smoke.emit(p => {
              const a = R() * PI * 2; const ground = s < 40;
              const sp = ground ? 18 + R() * 16 : 3;
              p.pos = [noz.x + (R() - .5) * 2, Math.max(2, noz.y - 4 - R() * 4), noz.z + (R() - .5) * 2];
              p.vel = ground ? [Math.cos(a) * sp, 2 + R() * 4, Math.sin(a) * sp] : [(R() - .5) * 3, -6 - R() * 6, (R() - .5) * 3];
              const L = 0.62 + R() * 0.12; p.col = [L, L, L * 0.98]; p.alpha = 0.5; p.size = 6 + R() * 5; p.grow = 5 + R() * 4; p.life = 5 + R() * 3;
            });
          }
          fx.smoke.drag = 0.5;
          const top = mv.localToWorld(V(0, 20, 0));
          const fov = u.st < lift ? 34 : Math.max(9, 34 - s * 0.05);
          cam(V(66, 6 + Math.min(40, s * 0.05), 84), V(0, Math.max(19, top.y - 4), top.z * 0.8), fov);
        } },
      { at: 2, setup() {
          spaceAboveEarth(-6560);
          const { mv, rig } = upperStack(-0.95, 1); S.mv = mv; S.rig = rig;
          S.flame = flame(0.01); rig.add(S.flame);
          S.l1 = ui.label('1段目', '', () => mv.b1.localToWorld(V(1.5, 7, 0)));
          S.l2 = ui.label('2段目', '', () => mv.b2.localToWorld(V(1.5, 18, 0)));
          S.l3 = ui.label('すき間のある格子', 'ok', () => mv.b1.localToWorld(V(1.4, 13.8, 0)));
        },
        update(u) {
          const mv = S.mv; const ign = sm(4.2, 4.8, u.st), sep = sm(5.2, 15, u.st);
          mv.b1.position.set(-sep * 3, -sep * 30, 0); mv.b1.rotation.z = sep * 0.25;                 // 1段目は離れて落ちていく
          const np = V(0, mv.Y.joint + 0.25 - mv.scY, 0);                                            // 第2段のノズルの出口
          jet(u, S.rig, np, ign, 6.5, 6, 26);
          if (ign > 0.3 && sep < 0.25 && u.dt > 0) { const w = S.rig.localToWorld(np.clone());       // 格子のすき間から横へ吹き出す炎
            for (let i = 0; i < 5; i++) fx.glow.emit(p => { const a = R() * PI * 2, d = V(Math.cos(a), -0.25, Math.sin(a)).transformDirection(S.rig.matrixWorld).multiplyScalar(9 + R() * 7);
              p.pos = [w.x, w.y, w.z]; p.vel = [d.x, d.y, d.z]; p.col = [2.4, 1.5, 0.6]; p.alpha = 0.75; p.size = 0.7 + R() * 0.5; p.grow = 2.4; p.life = 0.35 + R() * 0.3; }); }
          cache.earth.clouds.rotation.y += u.dt * 0.002;
          const jw = S.rig.localToWorld(V(0, mv.Y.joint + 1.2 - mv.scY, 0));
          const a = 1.25 - u.st * 0.02, r = 15 + sm(5, 14, u.st) * 9;
          cam(jw.clone().add(V(Math.cos(a) * r, 2.5, Math.sin(a) * r)), jw.clone().add(V(-sep * 1.5, -sep * 2, 0)), 40);
          if (sep > 0.3 && S.l3) { S.l3.remove(); S.l3 = null; }
        } },
      { at: 3, setup() {
          spaceAboveEarth();
          const { mv, rig } = upperStack(-1.05, 2); S.mv = mv; S.rig = rig;
          S.l1 = ui.label('フェアリング', '', () => mv.halves[0].localToWorld(V(1.3, 6.5, 0)));
        },
        update(u) {
          const mv = S.mv; const k = sm(2.2, 9, u.st), d = sm(2.2, 12, u.st);
          mv.halves.forEach((h, i) => { const sg = i ? -1 : 1; h.rotation.z = -sg * k * 0.75; h.position.set(sg * (0.2 * k + d * 4.5), mv.Y.fair - d * 5, 0); });
          cache.earth.clouds.rotation.y += u.dt * 0.002;
          const a = 0.9 - u.st * 0.02;
          cam(V(Math.cos(a) * 15, 3.5 + u.st * 0.1, Math.sin(a) * 15), V(1.5, -0.5, 0), 40);
          if (u.st > 9.5 && S.l1) { S.l1.remove(); S.l1 = null; S.l2 = lab('はやぶさ', 'ok', [0, 0, 0.9], 0.6); }
        } },
      { at: 4, setup() {
          spaceAboveEarth();
          const { mv, rig } = upperStack(-1.05, 2); S.mv = mv; S.rig = rig; mv.halves.forEach(h => h.visible = false);
          S.flame = flame(0.01); rig.add(S.flame); S.spin = 0;
          S.l1 = ui.label('3段目', '', () => mv.upper.localToWorld(V(1.3, 1.9, 0)));
          S.l2 = ui.label('キックモータ', '', () => mv.kick.localToWorld(V(0.8, 0.6, 0)));
        },
        update(u) {
          const mv = S.mv;
          const s2 = sm(0.4, 6, u.st);                                                               // 2段目が離れる
          mv.b2.position.set(-s2 * 2, -s2 * 24, 0); mv.b2.rotation.z = s2 * 0.2;
          const ext = sm(1.6, 3.0, u.st); mv.b3cone.position.y = -0.56 * ext;                        // 3段目のノズルの筒が下へ伸びる
          const b3 = sm(3.3, 3.9, u.st) * (1 - sm(7.2, 7.9, u.st));                                  // 3段目の燃焼
          const s3 = sm(9.0, 15, u.st);                                                              // 3段目が離れる
          mv.upper.position.set(-s3 * 1.6, mv.Y.b3 - s3 * 12, 0); mv.upper.rotation.z = s3 * 0.25;
          const km = sm(10.2, 11, u.st);                                                             // キックモータの燃焼
          S.spin += u.dt * 2.6 * sm(7.6, 9.2, u.st);                                                 // こまのように回して向きを安定させる
          mv.kick.rotation.y = S.spin; if (s3 === 0) mv.upper.rotation.y = S.spin;
          hold.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), S.spin)).multiply(UPQ);
          if (km > 0) jet(u, S.rig, V(0, mv.Y.kick - 0.75 - mv.scY, 0), km, 3.4, 4, 15);
          else jet(u, S.rig, V(0, mv.Y.b3 - 0.55 - mv.scY, 0), b3, 5.2, 5, 20);
          cache.earth.clouds.rotation.y += u.dt * 0.002;
          if (s3 > 0.4 && S.l1) { S.l1.remove(); S.l1 = null; }
          const a = 0.55 + u.st * 0.015, tgt = V(1.2 + 2.2 * (1 - sm(7, 10, u.st)), -0.6 - 1.4 * (1 - sm(7, 10, u.st)), 0);
          cam(V(Math.cos(a) * 14, 3.2, Math.sin(a) * 14).add(tgt), tgt, 40);
        } },
      { at: 5, setup() {
          spaceAboveEarth();
          const { mv, rig } = upperStack(); S.mv = mv; S.rig = rig; mv.halves.forEach(h => h.visible = false); mv.upper.visible = false;
        },
        update(u) {
          const mv = S.mv; const k = sm(0.8, 9, u.st);
          mv.kick.position.y = mv.Y.kick - k * 7; mv.kick.rotation.z = k * 0.4;
          hb.setDeploy(sm(3.2, 10.5, u.st));
          cache.earth.clouds.rotation.y += u.dt * 0.002;
          const a = 0.75 + u.st * 0.025, r = 9 + sm(3, 10, u.st) * 4.5;
          cam(V(Math.cos(a) * r, 3 + u.st * 0.05, Math.sin(a) * r), V(0, 0, 0), 40);
          if (u.st > 9) chip('パドルを広げた幅', '約5.7<small>m</small>');
        } },
      { at: 6, setup() {
          spaceAboveEarth(); setSun(V(-0.75, 0.3, 0.6), V(0, 0, 0), 5);
          useHB(basisQ(V(0.5, 0, -1), V(0.15, 0.95, 0.3))); hb.setHorn(0);
          S.l1 = lab('サンプラーホーン', '', [M.horn.x, 0, M.horn.top - 0.2]);
        },
        update(u) {
          // ばねで一気に伸び、伸びきったところで少し行きすぎて、ゆれながら止まる
          const x = (u.st - 1.6) / 3.6, k = x <= 0 ? 0 : x < 1 ? 1 - Math.pow(1 - x, 3) : 1;
          hb.setHorn(Math.max(0, k + (x > 0.7 ? 0.035 * Math.exp(-(x - 0.7) * 4.5) * Math.sin((x - 0.7) * 15) : 0)));
          const c = wpos([M.horn.x, 0, -1.0]);
          const a = 2.2 + u.st * 0.03;
          cam(c.clone().add(V(Math.cos(a) * 3.3, -0.7, Math.sin(a) * 3.3)), c, 40);
          if (u.st > 6.5) chip('ホーンの長さ', '約1<small>m</small>');
        } },
      { at: 7, setup() {
          spaceAboveEarth();
          useHB(basisQ(V(1, 0, 0.2), V(-0.35, 0.7, 0.62)));
          chip('打ち上げ時の重さ', '約510<small>kg</small>');
        },
        update(u) {
          hold.rotateOnWorldAxis(V(0, 1, 0), u.dt * 0.03);
          cache.earth.clouds.rotation.y += u.dt * 0.002;
          const a = 0.6 + u.st * 0.03, r = 9 + sm(0, 14, u.st) * 5;
          cam(V(Math.cos(a) * r, 2.6 + u.st * 0.05, Math.sin(a) * r), V(0, -0.2, 0), 38);
        } },
    ],
  });

  // ================= 3 イオンエンジン =================
  function ionStage(camP, camT) {
    const g = get('ionCut', () => CUT.makeIonCutaway(T)); place(g); g.position.set(0, 0, 0);
    setSun(V(0.3, 0.8, 0.55), V(0, 0, 0), 1.2, false, 3.0);
    scene.environment = ctx.envRoom; stars.setOpacity(0.25); hemi.intensity = 0.3;
    ctx.setBloom(0.7, 0.5, 0.82);
    S.ion = g; S.camP = camP; S.camT = camT;
    return g;
  }
  const ionLab = (g, text, key, cls = '') => ui.label(text, cls, () => g.localToWorld(g.anchors[key].clone()));
  CH.push({
    date: '2003.05 –', title: 'イオンエンジンのしくみ',
    lines: [
      { t: 'はやぶさの主なエンジンは、イオンエンジンだ。箱の側面に4台、AからDまで並んでいる。' },
      { t: '1台の中をのぞく。まずキセノンというガスを部屋に入れ、電子レンジと同じ仲間の電波、マイクロ波を送りこむ。' },
      { t: '磁石がつかまえた電子が、マイクロ波で勢いをつけてキセノンにぶつかる。キセノンは、プラスの電気を帯びたイオンに変わる。' },
      { t: '出口には、小さな穴が855個あいた板が3枚重なっている。1枚目にプラス1500ボルト、2枚目にマイナスの電圧をかけると、イオンは穴を通りながら一気に加速する。' },
      { t: '噴き出す速さは秒速約30km。ただし1台が押す力は、1円玉1枚の重さより小さい。' },
      { t: 'プラスのイオンだけを捨て続けると、機体にマイナスの電気がたまり、イオンが引き戻されてしまう。そこで、となりの中和器が電子を吹きかけて、電気のつり合いをとる。' },
      { t: '打ち上げ直後、Aは動きが安定せず、予備に回された。残る3台を何か月も休まず動かして、少しずつ速さを変えていく。' },
    ],
    shots: [
      { at: 0, setup() {
          setSun(V(0.35, 0.8, 0.5), V(0.6, 0, 0), 3);
          useHB(upYaw(0));
          hb.thrusters.forEach((th) => lab(th.name, '', [th.exit.x + 0.04, th.exit.y, th.exit.z + (th.exit.z > 0 ? 0.1 : -0.02)]));
        },
        update(u) {
          const k = sm(1.5, 4.5, u.st);
          hb.setThrust([0, k, k, k]); emitIons(u.dt, 150);
          const a = 0.5 - u.st * 0.02;
          cam(V(0.7 + Math.cos(a) * 3.0, 0.6 + u.st * 0.02, Math.sin(a) * 3.0), V(0.75, 0.0, 0), 40);
        } },
      { at: 1, setup() {
          setSun(V(0.35, 0.8, 0.5), V(0.6, 0, 0), 3);
          useHB(upYaw(0)); hb.setThrust([0, 1, 1, 1]); S.ph = 0; S.t1 = 0;
        },
        update(u0) {
          if (!S.ph) {            // 実機のエンジンBへ寄っていき、その中へ入るように断面へ切り替える
            const c = wpos(hb.thrusters[1].exit), k = sm(0, 2.7, u0.st);
            emitIons(u0.dt);
            cam(c.clone().add(V(lerp(1.5, 0.36, k), lerp(0.55, 0.09, k), lerp(1.7, 0.3, k))), c, 38);
            if (u0.st < 2.8) return;
            S.ph = 1; S.t1 = u0.st; ui.cut(); hb.setThrust([0, 0, 0, 0]); hold.removeFromParent(); fx.glow.clear(); camCut();
            const g0 = ionStage();
            ionLab(g0, 'キセノン', 'xe'); ionLab(g0, 'マイクロ波', 'wave');
            ui.card('ion', '<div class="panel"><h4>イオンエンジン μ10 の断面</h4><p style="font-weight:500">実物の直径は約14cm。板の間隔は見やすいように広げてある。</p></div>', 'top');
          }
          const u = { ...u0, st: u0.st - S.t1 };
          const g = S.ion; const power = sm(2.5, 6.5, u.st);
          g.update(u.dt, u.t, { power, neutK: 0, accel: 0 });
          if (u.line >= 2 && !S.l2) { S.l2 = true; ionLab(g, '磁石', 'magnet'); ionLab(g, 'プラズマ', 'plasma', 'ok'); }
          const a = 0.95 - u.st * 0.012;
          cam(V(-0.03 + Math.cos(a) * 0.52, 0.13, Math.sin(a) * 0.52), V(-0.05, -0.02, 0), 36);
        } },
      { at: 3, setup() {
          const g = ionStage();
          ionLab(g, '3枚のグリッド', 'grid');
          ui.card('grid', '<div class="panel"><h4>3枚の板にかける電圧</h4><div class="techs" style="grid-template-columns:1fr 1fr 1fr"><div><i>1枚目</i>＋1500V</div><div><i>2枚目</i>マイナス</div><div><i>3枚目</i>0V</div></div></div>', 'top');
        },
        update(u) {
          const g = S.ion;
          g.update(u.dt, u.t, { power: 1, neutK: u.line >= 4 ? 1 : 0, accel: sm(1.5, 4, u.st) });
          g.grids.forEach((m, i) => { m.material.emissiveIntensity = 0.25 + (i < 2 ? 0.9 * sm(1.5, 4, u.st) : 0); });
          const k = sm(0, 6, u.st), k2 = u.line >= 4 ? sm(0, 4, u.lt) : 0;
          cam(V(lerp(0.2, 0.34, k2), lerp(0.1, 0.12, k2), lerp(0.3, 0.52, k2) - k * 0.03), V(lerp(0.03, 0.14, k2), -0.01, 0), 34);
          if (u.line >= 4) { ui.hideCard('grid'); chip('噴き出す速さ', '秒速 約30<small>km</small>'); }
        } },
      { at: 5, setup() {
          const g = ionStage(); ui.hideChip();
          S.l1 = ionLab(g, '中和器', 'neut');
        },
        update(u) {
          const g = S.ion; const on = sm(7.5, 9, u.st);
          g.update(u.dt, u.t, { power: 1, neutK: on, accel: 1, pull: 1 - on });
          if (u.st < 7.5) ui.card('pull', '<div class="panel alert"><span class="dot"></span><p>中和器がないと、イオンは引き戻される</p></div>', 'top');
          else { ui.hideCard('pull'); ui.card('neut', '<div class="panel"><h4>中和器が電子を出す</h4><p>プラスのイオンと電子が混ざり、電気のつり合いがとれる</p></div>', 'top'); }
          cam(V(0.3, -0.04, 0.62), V(0.14, -0.13, 0), 36);
        } },
      { at: 6, setup() {
          setSun(V(-0.4, 0.55, 0.7), V(0, 0, 0), 5);
          useHB(basisQ(V(-1, 0, 0.1), V(-0.4, 0.55, 0.7)));
          hb.setThrust([0, 0.85, 0.85, 0.85]);
          lab('A　予備', '', [hb.thrusters[0].exit.x + 0.05, hb.thrusters[0].exit.y, hb.thrusters[0].exit.z + 0.12]);
        },
        update(u) {
          emitIons(u.dt, 120);
          const a = 2.25 + u.st * 0.03, r = 10.5 - u.st * 0.08;
          cam(V(Math.cos(a) * r, 2.0, Math.sin(a) * r), V(-0.8, 0, 0), 36);
          chip('同時に動かす台数', '3<small>台</small>');
        } },
    ],
  });

  // ================= 4 太陽フレアと地球スイングバイ =================
  CH.push({
    date: '2003.11 – 2004.05', title: '太陽フレアと地球スイングバイ',
    lines: [
      { t: '2003年11月、観測史上最大級の太陽フレアが起きた。はやぶさは強い放射線を浴び、太陽電池の発電が落ちた。' },
      { t: 'エンジンに回せる電気が減ったぶん、加速に時間がかかる。イトカワへの到着は、3か月遅い2005年9月になった。' },
      { t: '最初の1年、はやぶさは地球とほぼ同じ道を回りながら、イオンエンジンで少しずつ速さを変えていった。太陽に最も近いところは、太陽と地球の距離の0.86倍だった。' },
      { t: '打ち上げから約1年後の2004年5月19日、はやぶさは一度、地球のそばへ戻ってきた。' },
      { t: '地球の上空約3,700kmを通り過ぎるとき、地球の重力に引かれて、進む向きと速さが変わる。これをスイングバイという。' },
      { t: '回る遊具の手すりをつかんで走り抜けると、体が振られて向きと勢いが変わる。地球の重力が、その手すりの役目をする。' },
      { t: 'イオンエンジンで軌道を整え、スイングバイで加速する。この組み合わせは、世界で初めての成功だった。' },
      { t: 'スイングバイのあと、はやぶさはイトカワとほぼ同じ道に乗った。太陽から最も遠いところは、太陽と地球の距離の約1.7倍になる。2005年7月には、地球から見て太陽の向こう側を通った。' },
    ],
    shots: [
      { at: 0, setup() {
          const sd = V(-0.25, 0.5, 0.83);
          setSun(sd, V(0, 0, 0), 5);
          useHB(basisQ(V(1, 0, 0.2), sd));
          hb.setThrust([0, 0.8, 0.8, 0.8]);
          lab('太陽電池パドル', '', [0, 2.4, 0.5]);
        },
        update(u) {
          const fl = sm(1.5, 3.5, u.st) * (1 - sm(11, 15, u.st));
          sun.core.scale.setScalar(5200 * (1 + fl * 1.6)); sun.halo.scale.setScalar(26000 * (1 + fl * 1.2)); ctx.setExposure(1 + fl * 0.25);
          if (fl > 0.1 && u.dt > 0) for (let i = 0; i < 9; i++) fx.glow.emit(p => {
            const o = V((R() - .5) * 9, (R() - .5) * 6, (R() - .5) * 9), s = sunDir.clone().multiplyScalar(14).add(o), v = sunDir.clone().multiplyScalar(-26);
            p.pos = [s.x, s.y, s.z]; p.vel = [v.x, v.y, v.z]; p.col = [1.6, 1.2, 0.7]; p.alpha = 0.6 * fl; p.size = 0.035; p.life = 0.9;
          });
          const dmg = sm(3, 12, u.st);
          tweak(hb.mats.cells, m => m.color.setScalar(1 - 0.38 * dmg));
          const th = 0.8 - 0.3 * (u.line >= 1 ? sm(0, 4, u.lt) : 0);
          hb.setThrust([0, th, th, th]); emitIons(u.dt, 110);
          const a = 0.9 + u.st * 0.02;
          cam(V(Math.cos(a) * 8.5, 2.6, Math.sin(a) * 8.5), V(0, 0.2, 0), 38);
          if (u.line >= 1) chip('イトカワ到着', '3か月<small>遅れる</small>'); else if (u.st > 4) chip('2003年11月', '太陽フレア');
        } },
      { at: 2, setup() { mapScene(); },
        update(u) {
          const map = orbitMap(); mapHud(map, lerp(map.TM.L, map.TM.SB - 6, eio(u.st / 14)), 120);
          mapCam(1.3 + u.st * 0.01, 0.74);
        } },
      { at: 3, setup() {
          ui.hideChip();
          const e = earth(); place(e); e.position.set(0, 0, 0);
          e.quaternion.setFromUnitVectors(ENV.latLonDir(5, -150), V(1, 0.1, 0.2).normalize());
          setSun(V(0.9, 0.25, 0.35), V(0, 0, 0), 5);
          useHB();
          S.path = (tau) => { const rp = 6371 + 3700; const ph = tau * 1.15; const r = rp * (1 + 0.55 * tau * tau); return V(r * Math.cos(ph), r * 0.12 * tau, r * Math.sin(ph)); };
        },
        update(u) {
          const tau = -0.85 + u.st * 0.06;
          const p = S.path(tau), p2 = S.path(tau + 0.001); const head = p2.clone().sub(p).normalize();
          hold.position.copy(p); hold.quaternion.copy(basisQ(head.clone().negate(), sunDir));
          followShadow(p, 5);
          const out = p.clone().normalize(); const side = head.clone().cross(out).normalize();
          cam(p.clone().addScaledVector(out, 9).addScaledVector(side, 4).addScaledVector(head, -9), p.clone().addScaledVector(head, 2), 42);
          cache.earth.clouds.rotation.y += u.dt * 0.004;
          if (u.line >= 4) chip('地球からの高さ', '約3,700<small>km</small>');
        } },
      { at: 6, setup() { mapScene(); },
        update(u) {
          const map = orbitMap(); mapHud(map, lerp(map.TM.SB - 45, map.TM.SB + 150, eio(u.st / 13)), 120);
          const ep = map.parts.earth.position;
          cam(ep.clone().add(V(-30, 120, 95)), ep.clone().lerp(map.parts.hb.position, 0.35), 50);
        } },
      { at: 7, setup() { mapScene(); },
        update(u) {
          const map = orbitMap(); mapHud(map, lerp(map.TM.SB + 150, map.TM.A, eio(u.st / 15)), 100);
          mapCam(0.5 + u.st * 0.02);
        } },
    ],
  });

  // ================= 5 イトカワ到着 =================
  CH.push({
    date: '2005.09.12', title: '小惑星イトカワに到着',
    lines: [
      { t: '2005年7月29日、星を見るカメラが、初めてイトカワを写した。まだ星と同じ、小さな光の点だった。' },
      { t: '9月12日、はやぶさはイトカワから約20kmの位置で止まった。地球からは約3億km離れている。' },
      { t: 'イトカワの長さは約535m。東京スカイツリーの高さより、少し小さい。' },
      { t: 'ラッコにたとえられる細長い形で、約12時間で1回転している。表面は大きな岩だらけだ。' },
      { t: 'その中に、細かい砂利がたまった、なめらかな場所があった。「ミューゼスの海」と名付けられ、着陸地点に選ばれた。' },
      { t: '重力は地球の約10万分の1しかない。岩のかけらがゆるく寄り集まってできた天体と考えられている。' },
    ],
    shots: [
      { at: 0, setup() {
          const it = itoFree(); it.rotation.set(0.15, 0, 0.2);
          setSun(V(0.55, 0.35, 0.75), V(0, 0, 0), 330);
          ui.overlay('finder', '<div class="finder"><span>カメラの視野</span></div>');
        },
        update(u) {
          const d = Math.exp(lerp(Math.log(900000), Math.log(16000), sm(0, 11, u.st)));
          cache.ito.rotateOnAxis(V(0, 1, 0), u.dt * 0.12);
          cam(V(0, 0, d), V(0, 0, 0), 2.6);
          if (d < 100000) chip('イトカワまで', `${Math.round(d / 1000)}<small>km</small>`); else ui.hideChip();
        } },
      { at: 1, setup() {
          ui.overlay('finder', null);
          const it = itoFree(); it.position.set(0, -20000, 0); it.rotation.set(PI / 2, 0, 0.3);
          const sd = V(0.25, 0.93, 0.28);
          setSun(sd, V(0, 0, 0), 5);
          useHB(basisQ(V(1, 0, 0.3), V(0, 1, 0)));
          chip('イトカワまで', '約20<small>km</small>');
        },
        update(u) {
          cache.ito.rotateOnAxis(V(0, 1, 0), u.dt * 0.1);
          cam(V(4.5 - u.st * 0.02, 10, 5), V(2.2, 0, 2.4), 46);
          if (u.line === 1 && u.lt > 4) chip('地球からの距離', '約3<small>億km</small>');
        } },
      { at: 2, setup() {
          ui.hideChip();
          const it = itoFree(); it.rotation.set(0, 0.2, PI / 2); it.position.set(-150, -11, 0);
          setSun(V(0.6, 0.5, 0.6), V(0, 0, 0), 420);
          const tower = new THREE.Mesh(new THREE.CylinderGeometry(9, 32, 634, 6), new THREE.MeshStandardMaterial({ color: 0xd8dde6, transparent: true, opacity: 0.55, roughness: 0.4, metalness: 0.3 }));
          tower.position.set(190, 0, 0); place(tower);
          ui.label('東京スカイツリー 634m', '', () => V(190, 330, 0));
          ui.label('イトカワ 約535m', '', () => V(-150, 262, 0));
        },
        update(u) {
          cam(V(40 + u.st * 3, 30, 1700 - u.st * 9), V(20, 0, 0), 38);
        } },
      { at: 3, setup() {
          const it = itoFree(); it.rotation.set(0, 0, 0);
          setSun(V(0.5, 0.35, 0.8), V(0, 0, 0), 330);
        },
        update(u) {
          const it = cache.ito; it.rotateOnAxis(V(0, 1, 0), u.dt * 0.06);
          const k = sm(0, 16, u.st);
          cam(V(lerp(-200, 120, k), lerp(140, 60, k), lerp(980, 640, k)), V(0, -10, 0), 36);
          if (u.st > 3) chip('1回転', '約12<small>時間</small>');
        } },
      { at: 4, setup() {
          ui.hideChip();
          const it = itoFree(); it.rotation.set(0, 0, 0); it.updateMatrixWorld(true);
          const n = it.site.normal.clone(), p = it.site.point.clone();
          setSun(n.clone().add(V(0.5, 0.2, 0.3)).normalize(), p, 120);
          S.p = p; S.n = n; S.side = V(0, 1, 0).cross(n).normalize();
          ui.label('ミューゼスの海', 'ok', () => p.clone().addScaledVector(n, 6));
        },
        update(u) {
          const k = sm(0, 14, u.st);
          const cp = S.p.clone().addScaledVector(S.n, lerp(420, 95, k)).addScaledVector(S.side, lerp(160, 55, k)).add(V(0, lerp(60, 25, k), 0));
          cam(cp, S.p, 40);
          if (u.line >= 5) chip('イトカワの重力', '地球の約10万分の1');
        } },
    ],
  });

  // ================= 6 リアクションホイールの故障 =================
  const rwPos = (i, dz = 0.12) => [M.rw[i].c[0], M.rw[i].c[1], M.rw[i].c[2] + dz];
  CH.push({
    date: '2005.07.31 / 10.02', title: 'リアクションホイールの故障',
    lines: [
      { t: 'はやぶさは、機体の中で回るこま「リアクションホイール」で向きを変える。こまを速く回すと、その反動で機体は逆向きにゆっくり回る。' },
      { t: 'こまは3台ある。縦、横、奥行きの3方向の回転を、1台ずつ受け持つ。' },
      { t: '2005年7月31日、そのうちの1台が止まった。10月2日には、2台目も止まった。' },
      { t: '残るは1台。足りない2方向は、化学エンジンの小さな噴射で補うことにした。12基のエンジンを、ごく短く、何度も噴く。' },
      { t: 'ただ、噴射の力はこまよりずっと荒い。機体は細かく揺れ、燃料も予定より早く減っていく。その状態のまま、着陸に挑むことになった。' },
    ],
    shots: [
      { at: 0, setup() {
          setSun(V(-0.35, 0.8, 0.5), V(0, 0, 0), 4);
          useHB(upYaw(0.4)); hb.setXray(1); hideTop();
          S.q0 = hold.quaternion.clone();
          S.lz = lab('こま', 'ok', rwPos(2));
        },
        update(u) {
          const w = 9 + 34 * sm(2, 5.5, u.st) - 34 * sm(9, 12.5, u.st);
          hb.wheelSpeed[2] = w;
          hold.quaternion.copy(S.q0).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), -(w - 9) * 0.016));
          if (u.line >= 1 && !S.three) { S.three = true; S.lz.remove(); ['X', 'Y', 'Z'].forEach((n, i) => lab('ホイール' + n, '', rwPos(i))); }
          const a = 0.9 + u.st * 0.02;
          cam(V(Math.cos(a) * 2.5, 2.3, Math.sin(a) * 2.5), V(0, 0.3, 0), 40);
          if (u.line === 0 && u.st > 2.5) chip('こまの回転', w > 20 ? '速い' : 'ふつう'); else if (u.line >= 1) ui.hideChip();
        } },
      { at: 2, setup() {
          setSun(V(-0.35, 0.8, 0.5), V(0, 0, 0), 4);
          useHB(upYaw(0.4)); hb.setXray(1); hideTop();
          S.lab = ['X', 'Y', 'Z'].map((n, i) => lab('ホイール' + n, '', rwPos(i)));
          S.red = [0, 1].map(i => { const s = glowSprite(new THREE.Color(2.2, 0.25, 0.15), 0.01); s.userData.temp = true; s.position.set(...M.rw[i].c); hb.root.add(s); return s; });
        },
        update(u) {
          const k0 = sm(1.5, 3.5, u.st), k1 = sm(6.5, 8.5, u.st);
          hb.wheelSpeed[0] = 9 * (1 - k0); hb.wheelSpeed[1] = 9 * (1 - k1);
          S.red[0].scale.setScalar(k0 * 0.42 * (0.85 + 0.15 * Math.sin(u.t * 6))); S.red[1].scale.setScalar(k1 * 0.42 * (0.85 + 0.15 * Math.sin(u.t * 6)));
          if (k0 > 0.9 && !S.a) { S.a = true; S.lab[0].set('X　7月31日に停止', 'bad'); }
          if (k1 > 0.9 && !S.b) { S.b = true; S.lab[1].set('Y　10月2日に停止', 'bad'); S.lab[2].set('Z　残った1台', 'ok'); }
          const a = 1.4 + u.st * 0.02;
          cam(V(Math.cos(a) * 2.4, 2.3, Math.sin(a) * 2.4), V(0, 0.3, 0), 40);
        } },
      { at: 3, setup() {
          const it = itoFree(); it.position.set(0, -7000, 0); it.rotation.set(PI / 2, 0, 0.3);
          setSun(V(0.2, 0.95, 0.25), V(0, 0, 0), 5);
          useHB(upYaw(0.4)); hb.wheelSpeed[0] = hb.wheelSpeed[1] = 0;
          S.q0 = hold.quaternion.clone(); S.ax = 0; S.ay = 0.01; S.wx = 0.022; S.wy = -0.017; S.fire = [];
        },
        update(u) {
          const dt = u.dt; S.ax += S.wx * dt; S.ay += S.wy * dt;
          const lim = 0.045;
          if (Math.abs(S.ax) > lim && Math.sign(S.ax) === Math.sign(S.wx)) { S.wx = -Math.sign(S.ax) * (0.018 + R() * 0.012); S.fire.push({ i: S.ax > 0 ? [3, 9] : [0, 6], t: 0.22 }); }
          if (Math.abs(S.ay) > lim && Math.sign(S.ay) === Math.sign(S.wy)) { S.wy = -Math.sign(S.ay) * (0.016 + R() * 0.012); S.fire.push({ i: S.ay > 0 ? [0, 3] : [6, 9], t: 0.22 }); }
          S.fire = S.fire.filter(f => { f.t -= dt; f.i.forEach(i => rcsFire(i, dt)); return f.t > 0; });
          hold.quaternion.copy(S.q0).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(S.ax, S.ay, 0)));
          cache.ito.rotateOnAxis(V(0, 1, 0), u.dt * 0.05);
          if (u.line < 4) { const a = 0.7 + u.st * 0.03; cam(V(Math.cos(a) * 5.4, 2.4, Math.sin(a) * 5.4), V(0, 0.1, 0), 40); chip('動いているホイール', '1<small>台</small>'); }
          else { const k = sm(0, 5, u.lt); cam(V(lerp(3.8, 4.6, k), lerp(4, 10, k), lerp(4.5, 5, k)), V(lerp(0, 2.2, k), 0, lerp(0, 2.4, k)), lerp(40, 46, k)); chip('イトカワまで', '約7<small>km</small>'); }
        } },
    ],
  });

  return CH;
}
