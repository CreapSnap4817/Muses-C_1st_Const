// VTR 第13章〜第18章：再発見、立て直し、クロス運転、再突入、回収と微粒子、残したもの
export default function chaptersC(K) {
  const { THREE, ENV, CUT, PI, V, c01, sm, lerp, eio, R, ctx, ui, T, scene, stage, hb, M, hold, fx, S, cache, get, ito, earth, orbitMap,
    sunDir, sunLight, hemi, fill, stars, sun, setSun, followShadow, cam, place, tweak, detach, useHB, basisQ, UPQ, upYaw, wpos, wdir, lab,
    emitIons, puff, rcsFire, xenonJet, dust, beam, setBeam, ring, chip, glowSprite, hideTop, openBattery, mapScene, mapHud, mapCam, jaxaPhoto } = K;
  const CH = [];
  const quat = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  const axisQ = (ax, a) => new THREE.Quaternion().setFromAxisAngle(ax, a);
  const SD = V(0.25, 0.9, 0.35).normalize();
  const DEAD = [1, 4, 6, 9];                               // 使えなくなった電池（どの4個かは公開資料にないので、位置は仮）
  const cellMat = (i) => hb.mats['cell#c' + i];
  const cellsState = (charge) => { for (let i = 0; i < 11; i++) tweak(cellMat(i), m => { const dead = DEAD.includes(i); m.color.setRGB(dead ? 0.35 : 0.2, dead ? 0.08 : 0.3, dead ? 0.06 : 0.25); m.emissive.setRGB(dead ? 1 : 0.15, dead ? 0.1 : 1, dead ? 0.05 : 0.45); m.emissiveIntensity = dead ? 0.9 : 0.15 + 1.6 * charge; }); };
  const stepCard = (id, title, rows, on) => ui.card(id, `<div class="panel"><h4>${title}</h4><div class="techs" style="grid-template-columns:1fr">${rows.map((r, i) => `<div class="${i === on ? 'act' : 'dim'}"><i>${r[0]}</i>${r[1]}</div>`).join('')}</div></div>`, 'top');

  // ================= 13 再発見 =================
  CH.push({
    date: '2005.12.08 – 2006.03', title: '46日後に届いた電波',
    lines: [
      { t: 'どこにいて、どちらを向いているのかもわからない。ただ、ふらつく回転は、時間がたつと、いちばん安定な軸のまわりにまとまっていく。' },
      { t: 'そうなれば、太陽電池に光が当たり、アンテナが地球の方を向く時期がめぐってくる。チームはその日を待って、毎日呼びかけを続けた。' },
      { t: '2006年1月23日、長野県の臼田にある直径64mのアンテナが、かすかな電波をとらえた。46日ぶりだった。' },
      { t: '電波は弱く、とぎれとぎれで、文章を送れない。そこで、「はい」なら電波を出す、「いいえ」なら止める、という1ビットの会話で、機体の状態を一つずつ聞き出した。' },
      { t: 'わかったのは、バッテリーの11個の電池のうち4個が使えないこと、化学エンジンの燃料がすべて失われたことだった。' },
      { t: 'キセノンガスの噴射で回転を止め、3月には位置もつかめた。イトカワから約1万3千km、地球からは約3億3千万km離れていた。' },
    ],
    shots: [
      { at: 0, setup() {
          setSun(SD, V(0, 0, 0), 5);
          S.ax = V(0.3, 0.9, 0.25).normalize(); S.q0 = basisQ(V(1, 0, 0.3), S.ax); useHB(S.q0); S.ph = 0;
          S.axis = place(beam(0xe2bd72, 0.012, 0.5));
        },
        update(u) {
          const cone = 0.95 * (1 - sm(2, 13, u.st)); S.ph += u.dt * 1.5;
          hold.quaternion.copy(axisQ(V(Math.cos(S.ph * 0.6), 0, Math.sin(S.ph * 0.6)), cone)).multiply(axisQ(S.ax, S.ph)).multiply(S.q0);
          setBeam(S.axis, S.ax.clone().multiplyScalar(-4.5), S.ax.clone().multiplyScalar(4.5)); S.axis.material.opacity = 0.5 * sm(6, 12, u.st);
          const d = lerp(8, 13, sm(0, 14, u.st));
          cam(V(d * 0.62, d * 0.25, d * 0.75), V(0, 0, 0), 40);
          chip('通信がとだえてから', `${Math.floor(sm(0, 14, u.st) * 40)}<small>日</small>`);
          if (u.st > 9 && !S.l) { S.l = true; ui.label('回転の軸がそろう', 'ok', () => S.ax.clone().multiplyScalar(3.2)); }
        } },
      { at: 1, setup() {
          setSun(SD, V(0, 0, 0), 5); ui.hideChip();
          S.ax = V(0.75, 0.62, 0.1).normalize(); S.q0 = basisQ(V(0.3, 0, 1), S.ax); useHB(S.q0); S.ph = 0;
          S.link = place(beam(0x8a8f98, 0.03, 0.35));
          S.e = place(glowSprite(new THREE.Color(0.5, 1.2, 3.0), 1.6));
          ui.label('地球の方向', '', () => S.e.position.clone().add(V(0, 0.8, 0)));
          S.side = V(-0.62, 0.75, 0).normalize();
        },
        update(u) {
          S.ph += u.dt * 1.5; hold.quaternion.copy(axisQ(S.ax, S.ph)).multiply(S.q0);
          const ang = 0.95 * (1 - sm(1, 10, u.st));
          const ed = S.ax.clone().multiplyScalar(Math.cos(ang)).addScaledVector(S.side, Math.sin(ang));
          S.e.position.copy(ed).multiplyScalar(11);
          const p0 = S.ax.clone().multiplyScalar(1.3); setBeam(S.link, p0, S.ax.clone().multiplyScalar(11));
          const ok = ang < 0.1; S.link.material.color.setHex(ok ? 0x8fd0ff : 0x8a8f98); S.link.material.opacity = ok ? 0.6 : 0.3;
          if (ok && !S.c) { S.c = true; ui.card('ok', '<div class="panel"><h4>待っていた瞬間</h4><p>アンテナの向きと、地球の方向が重なる</p></div>', 'top'); }
          cam(V(3.5, 2.2, 16), V(3.4, 1.9, 0), 46);
        } },
      { at: 2, setup() {
          const ant = get('ant', () => ENV.makeBigAntenna()); place(ant);
          setSun(V(-0.5, 0.55, 0.65), V(0, 30, 0), 60, false, 1.8);
          sunLight.color.setHex(0x9fb8ff); hemi.intensity = 0.25;
          ui.card('sig', '<div class="panel"><h4>臼田64mアンテナ　受信信号</h4><canvas id="sigcv" width="600" height="180" style="width:100%;height:auto;display:block"></canvas></div>', 'top');
        },
        update(u) {
          const k = sm(0, 14, u.st);
          cam(V(lerp(110, 80, k), lerp(10, 16, k), lerp(150, 110, k)), V(0, 42, 0), 44);
          ui.signal(sm(3, 7, u.st));
          if (u.st > 7) chip('2006年1月23日', '46日ぶりの電波');
        } },
      { at: 3, setup() {
          setSun(SD, V(0, 0, 0), 5); ui.hideChip();
          S.ax = V(0.3, 0.9, 0.25).normalize(); S.q0 = basisQ(V(1, 0, 0.3), S.ax); useHB(S.q0); S.ph = 0; S.next = 0;
          lab('低利得アンテナ', '', [0, 0, M.hga.top + 0.12]);
        },
        update(u) {
          S.ph += u.dt * 1.2; hold.quaternion.copy(axisQ(S.ax, S.ph)).multiply(S.q0);
          const cyc = u.st % 9, q = Math.floor(u.st / 9) % 2;              // 質問→答え のくり返し
          const answering = cyc > 3.5 && cyc < 8, yes = q === 0;
          if (answering && yes && u.st > S.next) { S.next = u.st + 0.45; const p0 = wpos([0, 0, M.hga.top + 0.15]); ring(p0, S.ax, 0x8fd0ff, 3.2, 2.6, 0.25); }
          stepCard('bit', '1ビットの会話', [['地上から', cyc < 3.5 ? '質問を送っている…' : '質問を送った'], ['はやぶさの答え', !answering ? '…' : yes ? '電波を出す ＝「はい」' : '電波を止める ＝「いいえ」']], answering ? 1 : 0);
          cam(V(6.5, 3.2, 8.5), V(0, 1.6, 0), 42);
        } },
      { at: 4, setup() {
          setSun(SD, V(0, 0, 0), 4);
          useHB(upYaw(0.9)); hb.setXray(1); hideTop(); openBattery(); cellsState(0);
          lab('電池 4個が使えない', 'bad', [M.cells[5][0], M.cells[5][1], M.cells[5][2] + 0.1]);
          lab('燃料 なし', 'bad', [M.chem.fuel[0], M.chem.fuel[1], M.chem.fuel[2] + 0.22]); lab('酸化剤 なし', 'bad', [M.chem.ox[0], M.chem.ox[1], M.chem.ox[2] + 0.25]);
        },
        update(u) {
          const a = 2.4 + u.st * 0.03;
          cam(V(Math.cos(a) * 2.6, 2.1, Math.sin(a) * 2.6), V(0, 0.2, 0), 40);
        } },
      { at: 5, setup() {
          setSun(SD, V(0, 0, 0), 5);
          S.ax = SD.clone(); S.q0 = basisQ(V(1, 0, 0.3), S.ax); useHB(S.q0); S.ph = 0;
        },
        update(u) {
          const w = 1.4 * (1 - sm(1, 11, u.st)); S.ph += u.dt * w;
          hold.quaternion.copy(axisQ(S.ax, S.ph)).multiply(S.q0);
          if (w > 0.12 && (u.st % 2.2) < 1.3) { xenonJet(0, u.dt); xenonJet(3, u.dt); }
          const a = 0.7 + u.st * 0.02;
          cam(V(Math.cos(a) * 7.5, 3.4, Math.sin(a) * 7.5), V(0, 0.3, 0), 40);
          if (u.st > 8) chip('イトカワから', '約1万3千<small>km</small>'); else chip('回転', w > 0.6 ? '速い' : w > 0.12 ? 'ゆるやか' : '止まった');
        } },
    ],
  });

  // ================= 14 立て直し =================
  CH.push({
    date: '2006 – 2007.04', title: '壊れた機体を立て直す',
    lines: [
      { t: '帰るためには、まず機体を立て直さなければならない。ヒーターで機体を温め、中に残った燃料をガスにして追い出した。' },
      { t: '向きを保つ方法も作り直した。使うのは、太陽の光が物を押す、ごく弱い力だ。パドルに当たる光の力がつり合う向きに、機体はひとりでに落ち着く。' },
      { t: '傷んだバッテリーは、残る7個の電池を充電した。いきなり充電すると危ないので、別の細い回路から、時間をかけて少しずつ電気を流しこんだ。' },
      { t: 'その電気で、2007年1月、砂の入った容器をカプセルの中へ押しこみ、ふたを閉めた。熱を加えると伸びる、形状記憶合金のばねが容器を押す。' },
      { t: '2007年4月25日、はやぶさは地球へ向けて出発した。向きは、残った1台のホイールと、エンジンの首ふりと、太陽の光で保つ。到着は、予定より3年遅い2010年になる。' },
      { t: '帰り道では、太陽のまわりをおよそ2周する。2007年10月まで加速を続け、そのあと2009年2月までは、エンジンを止めて慣性で進んだ。' },
    ],
    shots: [
      { at: 0, setup() {
          setSun(SD, V(0, 0, 0), 4);
          useHB(upYaw(0.6)); hb.setXray(1);
          S.vents = [[0.5, 0.3, -0.56], [-0.3, 0.51, -0.2], [0.2, -0.51, -0.45], [-0.81, 0.2, 0.1], [0.1, 0.3, 0.56]];
          lab('ヒーターで温める', '', M.loops.mf);
        },
        update(u) {
          const heat = sm(0.5, 5, u.st);
          tweak(hb.mats.pipeA, m => { m.emissive.setRGB(1, 0.35, 0.08); m.emissiveIntensity = heat * (0.8 + 0.2 * Math.sin(u.t * 3)); });
          tweak(hb.mats.pipeB, m => { m.emissive.setRGB(1, 0.35, 0.08); m.emissiveIntensity = heat * (0.8 + 0.2 * Math.sin(u.t * 3 + 1)); });
          const gas = sm(3, 6, u.st) * (1 - sm(12, 16, u.st));
          if (gas > 0.05) S.vents.forEach((v) => puff(wpos(v), wdir(v), 26 * u.dt * gas, { speed: 0.5, spread: 0.5, col: [1.0, 0.9, 0.7], alpha: 0.3, size: 0.035, grow: 0.08, life: 3 }));
          const a = 1.2 + u.st * 0.03;
          cam(V(Math.cos(a) * 3.8, -0.9, Math.sin(a) * 3.8), V(0, -0.1, 0), 40);
        } },
      { at: 1, setup() {
          setSun(V(-0.2, 0.9, 0.4), V(0, 0, 0), 5);
          S.q0 = basisQ(V(1, 0, 0.2), sunDir); useHB(S.q0); S.ph = 0;
          ui.label('太陽の光が押す力', '', () => sunDir.clone().multiplyScalar(4.2).add(V(1.2, 0, 0)));
        },
        update(u) {
          S.ph += u.dt * 0.35;
          const off = 0.3 * Math.exp(-u.st * 0.16) * Math.cos(u.st * 0.9);
          hold.quaternion.copy(axisQ(V(1, 0, 0), off)).multiply(axisQ(sunDir, S.ph)).multiply(S.q0);
          if (u.dt > 0) for (let i = 0; i < 9; i++) fx.glow.emit(p => {
            const o = V((R() - .5) * 6.5, 0, (R() - .5) * 4.5), s = sunDir.clone().multiplyScalar(8).add(o), v = sunDir.clone().multiplyScalar(-6.5);
            p.pos = [s.x, s.y, s.z]; p.vel = [v.x, v.y, v.z]; p.col = [1.6, 1.3, 0.6]; p.alpha = 0.8; p.size = 0.07; p.life = 1.12;
          });
          cam(V(8.2, 2.6, 6.4), V(0, 1.0, 0), 44);
          chip('機体の傾き', `${Math.abs(Math.round(off * 180 / PI))}<small>度</small>`);
        } },
      { at: 2, setup() {
          setSun(SD, V(0, 0, 0), 4); ui.hideChip();
          useHB(upYaw(0.9)); hb.setXray(1);
          hideTop(); openBattery();
          lab('バッテリー　電池11個', '', [M.cells[5][0], M.cells[5][1] - 0.08, M.cells[5][2] + 0.06]);
        },
        update(u) {
          const ch = sm(1, 13, u.st); cellsState(ch);
          const c = wpos([M.cells[5][0], M.cells[5][1], M.cells[5][2]]); const a = 2.2 + u.st * 0.02;
          cam(c.clone().add(V(Math.cos(a) * 0.75, 0.62, Math.sin(a) * 0.75)), c, 38);
          chip('充電', `${Math.round(ch * 100)}<small>%</small>`);
        } },
      { at: 3, setup() {
          setSun(SD, V(0, 0, 0), 4); ui.hideChip();
          useHB(upYaw(2.4)); hb.setXray(1);
          // カプセルの外側は隠して、中のサンプル容器だけを見せる
          const cont = hb.named.container;
          hb.parts.capsule.meshes.forEach(m => { if (m.parent !== cont) m.visible = false; });
          const sp0 = M.sampler; lab('容器', 'ok', [sp0.catcher[0], 0, sp0.zc + 0.06]); lab('形状記憶合金のばね', '', [sp0.spring[0], 0, sp0.zc + 0.05]); lab('カプセルの中の入れ物', '', [sp0.container[0], 0, sp0.zc + 0.07]);
        },
        update(u) {
          const tube = hb.named.samplerTube, body = hb.named.catcherBody, sp = hb.named.smaSpring;
          const k1 = sm(1, 3.5, u.st), k2 = sm(4, 10, u.st);
          tube.position.z = tube.userData.base.z - M.sampler.tubeDrop * k1;
          body.position.x = body.userData.base.x - M.sampler.travel * k2; sp.scale.x = 1 + M.sampler.travel / M.sampler.springLen * k2;
          tweak(hb.mats.copper, m => { m.emissive.setRGB(1, 0.3, 0.05); m.emissiveIntensity = sm(3.5, 5, u.st) * 0.9; });
          const c = wpos([M.sampler.hx - 0.02, 0, M.sampler.zc]);
          const cp = c.clone().add(wdir([0.3, 0.45, 0.84]).multiplyScalar(0.7));
          cam(cp, c, 36);
          if (k2 > 0.98) chip('2007年1月', 'ふたを閉めた');
        } },
      { at: 4, setup() {
          const it = ito(); place(it); it.position.set(-2500, -900, -5200); it.quaternion.identity(); it.rotation.set(0.3, 0.6, 0.2);
          setSun(V(-0.4, 0.6, 0.65), V(0, 0, 0), 5); ui.hideChip();
          useHB(basisQ(V(-1, 0, -0.3), V(-0.4, 0.6, 0.65)));
          ui.card('att', '<div class="panel"><h4>向きを保つ3つの方法</h4><div class="techs" style="grid-template-columns:1fr 1fr 1fr"><div><i>01</i>残った1台のホイール</div><div><i>02</i>エンジンの首ふり</div><div><i>03</i>太陽の光の力</div></div></div>', 'top');
        },
        update(u) {
          const k = sm(1, 5, u.st); hb.setThrust([0, 0, 0, 0.85 * k]); emitIons(u.dt, 120);
          hold.position.x = u.st * 0.25;
          cam(hold.position.clone().add(V(-6.5, 2.4, 7.5)), hold.position.clone().add(V(-0.6, 0, -1.5)), 42);
          chip('イトカワを出発', '2007<small>年</small>4<small>月</small>25<small>日</small>');
        } },
      { at: 5, setup() { mapScene(); },
        update(u) {
          const map = orbitMap(); mapHud(map, lerp(map.TM.D, map.EV.p2.jd, eio(u.st / 15)), 150);
          mapCam(2.2 + u.st * 0.02);
        } },
    ],
  });

  // ================= 15 クロス運転 =================
  const circuit = `<div class="panel"><h4>クロス運転の回路</h4>
    <svg viewBox="0 0 340 150" width="100%" role="img" aria-label="エンジンAの中和器とエンジンBのイオン源を、ダイオードを通る回路でつなぐ">
      <rect x="8" y="14" width="120" height="50" rx="8" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.35)"/><text x="20" y="36" font-size="12" fill="#ddd" font-weight="700">エンジンAの電源</text><text x="20" y="54" font-size="11" fill="#a7abb3">イオン源Aは使わない</text>
      <rect x="212" y="14" width="120" height="50" rx="8" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.35)"/><text x="224" y="36" font-size="12" fill="#ddd" font-weight="700">エンジンBの電源</text><text x="224" y="54" font-size="11" fill="#a7abb3">中和器Bは使わない</text>
      <circle cx="68" cy="118" r="20" fill="rgba(105,227,161,.14)" stroke="#69e3a1"/><text x="48" y="122" font-size="12" fill="#d6ffe8" font-weight="700">中和器A</text>
      <circle cx="272" cy="118" r="24" fill="rgba(143,208,255,.14)" stroke="#8fd0ff"/><text x="247" y="122" font-size="12" fill="#dff1ff" font-weight="700">イオン源B</text>
      <path d="M68 64 V98 M272 64 V94" stroke="#e2bd72" stroke-width="2.5" fill="none"/>
      <path d="M128 39 H156 M184 39 H212" stroke="#e2bd72" stroke-width="2.5"/><path d="M156 27 L180 39 L156 51 Z" fill="#e2bd72"/><path d="M182 27 V51" stroke="#e2bd72" stroke-width="3"/>
      <text x="138" y="18" font-size="12" fill="#ffe2a0" font-weight="900">ダイオード</text>
      <path d="M90 118 H246" stroke="#ffcf6a" stroke-width="2" stroke-dasharray="4 5"><animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.8s" repeatCount="indefinite"/></path>
      <text x="128" y="110" font-size="11" fill="#ffcf6a" font-weight="700">電子が宇宙を渡る</text></svg></div>`;
  const ionRear = (yaw = 0) => { setSun(V(0.35, 0.85, 0.4), V(0.6, 0, 0), 3); useHB(upYaw(yaw)); };
  const thLab = (i, text, cls, neut = false) => {
    const th = hb.thrusters[i]; const p = neut ? th.neut : th.exit; const sy = Math.sign(p.y), upper = p.z > 0;
    return lab(text, cls, neut ? [p.x + 0.03, p.y + sy * 0.05, p.z + 0.03] : [p.x + 0.04, p.y + sy * 0.12, upper ? p.z + 0.1 : p.z - 0.12]);
  };
  CH.push({
    date: '2009.11.04', title: 'エンジンの停止とクロス運転',
    lines: [
      { t: '2009年11月4日、地球まであと7か月のところで、動いていたエンジンDが自動で止まった。中和器が古くなり、電子を出すのに必要な電圧が、上限をこえたためだ。' },
      { t: 'このとき、Aは打ち上げ直後から休ませたまま。Bは2007年に、中和器が先に弱って止めてあった。Cも弱っていて、1台だけでは地球に届かない。' },
      { t: 'イオンエンジンは、イオンを噴くイオン源と、電子を出す中和器の、2つで1組だ。' },
      { t: 'Aの中和器はほとんど使っておらず、Bのイオン源もまだ動く。そこで、この2つを組にして動かした。離れた2つのあいだを、電子が宇宙空間を渡ってつなぐ。これをクロス運転という。' },
      { t: '本来、別々のエンジンの部品は、回路としてつながっていない。開発のとき、万一に備えて加えてあった小さな部品、ダイオードが、電気の通り道になった。' },
      { t: '2台分のガスと電気を使うが、帰るには足りる。2010年3月27日、エンジンは最後の長い加速を終えた。' },
      { t: 'イオンエンジンが動いた時間は、4台の合計で約4万時間。7年のあいだに、はやぶさは太陽のまわりをおよそ5周した。' },
    ],
    shots: [
      { at: 0, setup() { ionRear(0.25); S.l = thLab(3, 'D', ''); },
        update(u) {
          const d = u.st < 4 ? 0.75 : u.st < 5 ? (R() < 0.5 ? 0.75 : 0.1) : 0;
          hb.setThrust([0, 0, 0, d]); emitIons(u.dt, 130);
          if (u.st > 5 && !S.al) { S.al = true; S.l.set('D　自動で停止', 'bad'); ui.card('alert', '<div class="panel alert"><span class="dot"></span><p>中和器の電圧が上限に達した</p></div>', 'top'); }
          const a = 0.55 - u.st * 0.012;
          cam(V(0.75 + Math.cos(a) * 2.6, 0.45, Math.sin(a) * 2.6), V(0.72, -0.05, 0), 40);
        } },
      { at: 1, setup() {
          ionRear(0.25);
          thLab(0, 'A　不安定で休止', 'bad'); thLab(1, 'B　中和器が劣化', 'bad'); thLab(2, 'C　力が弱い', ''); thLab(3, 'D　中和器が限界', 'bad');
        },
        update(u) {
          const a = 0.45 - u.st * 0.01;
          cam(V(0.75 + Math.cos(a) * 2.3, 0.3, Math.sin(a) * 2.3), V(0.72, -0.02, 0), 40);
        } },
      { at: 2, setup() {
          ionRear(0.25);
          thLab(2, 'イオン源', ''); thLab(2, '中和器', '', true);
        },
        update(u) {
          const c = wpos(hb.thrusters[2].exit); const a = 0.4 + u.st * 0.02;
          cam(c.clone().add(V(Math.cos(a) * 0.95, 0.22, Math.sin(a) * 0.95)), c.clone().add(V(0, 0.02, 0)), 38);
        } },
      { at: 3, setup() {
          ionRear(0.25);
          thLab(0, 'Aの中和器', 'ok', true); thLab(1, 'Bのイオン源', 'ok');
        },
        update(u) {
          const k = sm(2, 5.5, u.st);
          hb.setThrust([0, 0.8 * k, 0, 0]); hb.thrusters[1].nGlow.material.opacity = 0; hb.thrusters[0].nGlow.material.opacity = k;
          emitIons(u.dt, 140);
          // Aの中和器からBのビームへ渡る電子
          const A = hb.thrusters[0], B = hb.thrusters[1];
          const p0 = wpos(A.neut), p1 = wpos([A.neut.x + 0.22, A.neut.y - 0.12, A.neut.z + 0.02]), p2 = wpos([B.exit.x + 0.5, B.exit.y + 0.03, B.exit.z]);
          if (u.dt > 0 && k > 0.1) for (let i = 0; i < 14; i++) {
            const s = (u.t * 0.8 + i / 14 + R() * 0.03) % 1, q = 1 - s;
            const p = p0.clone().multiplyScalar(q * q).addScaledVector(p1, 2 * q * s).addScaledVector(p2, s * s);
            fx.glow.emit(e => { e.pos = [p.x, p.y, p.z]; e.vel = [0, 0, 0]; e.col = [1.6, 1.25, 0.5]; e.alpha = 0.9 * k; e.size = 0.012; e.life = 0.09; });
          }
          if (u.line >= 4) ui.card('circ', circuit, 'top');
          const c = wpos([M.ies.xp + 0.05, 0, M.ies.zc + 0.1]); const a = 0.5 + Math.sin(u.st * 0.1) * 0.15;
          cam(c.clone().add(V(Math.cos(a) * 1.5, 0.45, Math.sin(a) * 1.5)), c, 40);
        } },
      { at: 5, setup() {
          setSun(V(-0.4, 0.55, 0.7), V(0, 0, 0), 5);
          useHB(basisQ(V(-1, 0, 0.1), V(-0.4, 0.55, 0.7)));
          const e = earth(); place(e); e.position.set(90000, -20000, -160000);
        },
        update(u) {
          const k = 1 - sm(9, 12, u.st); hb.setThrust([0, 0.8 * k, 0, 0]); hb.thrusters[1].nGlow.material.opacity = 0; hb.thrusters[0].nGlow.material.opacity = k;
          emitIons(u.dt, 120);
          const a = 2.25 + u.st * 0.03, r = 10.5;
          cam(V(Math.cos(a) * r, 2.0, Math.sin(a) * r), V(-0.8, 0, 0), 36);
          chip(u.st > 10 ? '2010年3月27日' : '消費', u.st > 10 ? '加速を終了' : 'ガスも電気も2台分');
        } },
      { at: 6, setup() { mapScene(); },
        update(u) {
          const map = orbitMap(); mapHud(map, lerp(map.EV.p2.jd, map.TM.R, eio(u.st / 13)), 130);
          mapCam(3.4 + u.st * 0.02);
        } },
    ],
  });

  // ================= 16 再突入 =================
  const EP = V(0.12, 0.1, 1).normalize();
  function earthScene() {
    const e = earth(); place(e); e.position.set(0, 0, 0);
    e.quaternion.setFromUnitVectors(ENV.latLonDir(-28, 134), V(0.2, 0.15, 1).normalize());
    setSun(V(1, 0.2, -0.15), V(0, 0, 0), 5);
    return e;
  }
  const VH = V(0.978, -0.208, 0);                          // 突入の向き（水平から約12度下向き）
  function entryScene(cut) {
    const e = earth(); place(e); e.position.set(0, -6371 - 70, 0);
    e.quaternion.setFromUnitVectors(ENV.latLonDir(-30, 136), V(0, 1, 0));
    setSun(V(-0.5, -0.25, -0.8), V(0, 0, 0), 2, false, 0.5); hemi.intensity = 0.05;
    const cap = get(cut ? 'capCut' : 'capFull', () => CUT.makeCapsule(T, { cut })); place(cap);
    cap.front.visible = cap.aft.visible = true; cap.front.position.set(0, 0, 0); cap.aft.position.set(0, 0, 0);
    cap.quaternion.setFromUnitVectors(V(0, -1, 0), VH); if (cut) cap.quaternion.multiply(axisQ(V(0, 1, 0), 2.2));
    const shock = new THREE.Mesh(new THREE.SphereGeometry(0.33, 40, 16, 0, PI * 2, 0, 1.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.75, 0.32), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    shock.quaternion.setFromUnitVectors(V(0, 1, 0), VH); shock.position.copy(VH).multiplyScalar(-0.1); place(shock);
    const gl = place(glowSprite(new THREE.Color(1.3, 0.7, 0.3), 0.7)); gl.material.opacity = 0.55; gl.position.copy(VH).multiplyScalar(0.22);
    const pl = new THREE.PointLight(0xffa860, 9, 20, 1.6); pl.position.copy(VH).multiplyScalar(0.5); place(pl);
    const pl2 = new THREE.PointLight(0x9fb4ff, 2.5, 20, 1.6); pl2.position.set(-0.6, 0.8, 1.2); place(pl2);
    ctx.setBloom(0.4, 0.5, 1.15);
    S.cap = cap; S.shock = shock; S.gl = gl;
    return cap;
  }
  function entryFX(u, k = 1) {
    S.shock.material.opacity = (0.17 + 0.04 * Math.sin(u.t * 37)) * k; S.gl.scale.setScalar((0.7 + 0.05 * Math.sin(u.t * 29)) * k); S.cap.setHeat(k * 0.55);
    if (u.dt > 0) for (let i = 0; i < 16; i++) fx.glow.emit(p => {
      const a = R() * PI * 2, r = 0.2 + R() * 0.07; const side = V(0, 0, 1).multiplyScalar(Math.cos(a) * r).add(V(0.208, 0.978, 0).multiplyScalar(Math.sin(a) * r));
      const p0 = side.clone().addScaledVector(VH, 0.02), v = VH.clone().multiplyScalar(-(7 + R() * 5)).addScaledVector(side, 1.2);
      p.pos = [p0.x, p0.y, p0.z]; p.vel = [v.x, v.y, v.z]; p.col = [1.5, 0.7 + R() * 0.4, 0.25]; p.alpha = 0.35 * k; p.size = 0.012 + R() * 0.02; p.grow = 0.02; p.life = 0.3 + R() * 0.3;
    });
  }
  const capLab = (text, key, cls = '') => ui.label(text, cls, () => S.cap.localToWorld(S.cap.anchors[key].clone()));
  CH.push({
    date: '2010.06.13', title: '地球への帰還と大気圏再突入',
    lines: [
      { t: '2010年の4月から6月にかけて、はやぶさは小さな加速を5回くり返し、落ちる場所をオーストラリアのウーメラ砂漠に合わせていった。' },
      { t: '6月13日、日本時間の午後7時51分。地球から約7万kmで、カプセルを切り離した。ばねで押し出しながら回転を与える。回るものは向きが変わりにくく、耐熱材を前に向けたまま進む。' },
      { t: '役目を終えたはやぶさは、約2時間かけて向きを変え、カメラを地球に向けた。最後の1枚は、送信の途中で通信が切れ、下の部分が欠けている。' },
      { t: '午後10時51分、秒速12kmで大気圏に突入した。カプセルの前では空気が押しつぶされて約1万度になり、耐熱材の表面は約3000度に達する。' },
      { t: '耐熱材は、自分が少しずつ焦げてガスになることで、熱を持ち去る。そのおかげで、中の温度は50度ほどにおさまった。' },
      { t: 'はやぶさの本体には、熱を防ぐものがない。ばらばらになりながら、光の尾を引いて燃えつきた。' },
      { t: '高度約5kmで、カプセルは前後の耐熱材を捨て、パラシュートを開いた。電波で居場所を知らせながら、砂漠へ降りていく。' },
    ],
    shots: [
      { at: 0, setup() {
          const e = earthScene(); useHB();
          S.mark = new THREE.Mesh(new THREE.RingGeometry(260, 330, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.6), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
          const d = ENV.latLonDir(-31, 136.5); S.mark.position.copy(d).multiplyScalar(6371 * 1.012); S.mark.quaternion.setFromUnitVectors(V(0, 0, 1), d); e.add(S.mark); S.mark.userData.temp = true;
          ui.label('ウーメラ砂漠', '', () => S.mark.getWorldPosition(V(0, 0, 0)));
        },
        update(u) {
          const d = Math.exp(lerp(Math.log(90000), Math.log(30000), sm(0, 12, u.st)));
          const p = EP.clone().multiplyScalar(d);
          hold.position.copy(p); hold.quaternion.copy(basisQ(p.clone().negate().add(V(0.3, 0, 0).multiplyScalar(d)), sunDir));
          const burn = (u.st % 4) < 2.2 ? 0.7 : 0; hb.setThrust([0, burn, 0, 0]); hb.thrusters[1].nGlow.material.opacity = 0; hb.thrusters[0].nGlow.material.opacity = burn; emitIons(u.dt, 100);
          followShadow(p, 5);
          cam(p.clone().add(V(4.5, 2.5, 9)), V(0, 0, 0).lerp(p, 0.6), 40);
          cache.earth.clouds.rotation.y += u.dt * 0.004;
          chip('軌道の微調整', '5<small>回</small>');
        } },
      { at: 1, setup() {
          earthScene(); useHB(); if (S.mark) S.mark.visible = false;
          const p = EP.clone().multiplyScalar(26000); S.p = p;
          hold.position.copy(p); hold.quaternion.copy(basisQ(V(-0.9, 0.1, -0.4), V(0.3, 0.9, 0.3))); hold.updateMatrixWorld(true);
          followShadow(p, 5); S.sep = false;
          lab('再突入カプセル', '', [M.capsule.center[0] - 0.12, 0, M.capsule.center[2] + 0.28]);
          chip('地球まで', '約7<small>万km</small>');
        },
        update(u) {
          if (u.st > 3.2 && !S.sep) { S.sep = true; ui.clearLabels(); S.c = detach('capsule'); S.ax = wdir([-1, 0, 0]); ui.label('カプセル', 'ok', () => S.c.position.clone().add(V(0, 0.32, 0))); }
          if (S.sep) { S.c.position.addScaledVector(S.ax, 0.22 * u.dt); S.c.rotateOnWorldAxis(S.ax, u.dt * 2.2); }
          const c = wpos(M.capsule.center);
          const a = 0.2 + u.st * 0.02;
          cam(c.clone().addScaledVector(wdir([-1, 0.5, 0.45]), 2.3).add(V(Math.sin(a) * 0.4, 0, 0)), c.clone().addScaledVector(wdir([-1, 0, 0]), 0.5), 40);
        } },
      { at: 2, setup() {
          earthScene(); useHB(); ui.hideChip(); hb.named.capsule.visible = false;
          const p = EP.clone().multiplyScalar(22000); S.p = p; hold.position.copy(p); followShadow(p, 5);
          const e = p.clone().negate().normalize(), z = V(0, 1, 0).addScaledVector(e, -e.y).normalize(), x = e.clone().negate().cross(z);
          S.q0 = basisQ(V(-0.9, 0.1, -0.4), V(0.3, 0.9, 0.3)); S.q1 = basisQ(x, z); S.shot = false;
          lab('横向きのカメラ', '', [M.oncw2.pos[0], M.oncw2.pos[1] - 0.05, M.oncw2.pos[2] + 0.1]);
        },
        update(u) {
          const k = sm(0.5, 6, u.st);
          hold.quaternion.copy(S.q0).slerp(S.q1, k);
          cam(S.p.clone().add(V(5.5, 2.2, 5.5)), S.p.clone().add(V(0, 0.2, 0)), 42);
          if (u.st < 6) chip('向きを変える時間', '約2<small>時間</small>');
          if (u.st > 6.6 && !S.shot) {
            S.shot = true; ui.hideChip(); jaxaPhoto('earth');
          }
        } },
      { at: 3, setup() {
          entryScene(false); ui.hideCard('photo');
          capLab('押しつぶされた空気　約1万度', 'shock', 'bad'); capLab('耐熱材の表面　約3000度', 'ablator');
        },
        update(u) {
          entryFX(u, sm(0, 2.5, u.st));
          const a = 0.9 + u.st * 0.03;
          cam(V(Math.cos(a) * 1.5 + 0.1, 0.35, Math.sin(a) * 1.5), V(0.12, -0.05, 0), 40);
          chip('突入の速さ', '秒速 12<small>km</small>');
        } },
      { at: 4, setup() {
          entryScene(true); ui.hideChip();
          capLab('耐熱材', 'ablator'); capLab('中は約50度', 'chute', 'ok');
          ui.card('abl', '<div class="panel"><h4>カプセルの断面</h4><p>耐熱材が焦げてガスになり、熱を持ち去る</p></div>', 'top');
        },
        update(u) {
          entryFX(u, 0.8);
          const a = 1.25 + Math.sin(u.st * 0.15) * 0.2;
          cam(V(Math.cos(a) * 0.95 - 0.1, 0.32, Math.sin(a) * 0.95), V(-0.02, -0.02, 0), 40);
        } },
      { at: 5, setup() {
          ui.hideCard('abl');
          const ds = get('desertN', () => ENV.makeDesert(T, true)); place(ds); ds.position.y = 0;
          const sky = get('sky', () => ENV.makeSky()); place(sky); sky.material.uniforms.uDark.value = 0.97; sky.material.uniforms.uTint.value.setRGB(0.25, 0.3, 0.5);
          setSun(V(-0.3, 0.6, 0.5), V(0, 0, 0), 60, false, 0.25); sunLight.color.setHex(0x7d8fbf); hemi.intensity = 0.08;
          S.head = V(-650, 400, -1100); S.v = V(105, -20, 0);
          S.frags = []; S.broke = false; S.capP = null;
          S.pl = new THREE.PointLight(0xffb070, 0, 4000, 1.2); place(S.pl);
          S.hs = place(glowSprite(new THREE.Color(1.8, 1.4, 0.9), 110));
          ctx.setBloom(0.8, 0.6, 0.75);
        },
        update(u) {
          const st = u.st, dt = u.dt;
          S.head.addScaledVector(S.v, dt);
          if (st > 3.2 && !S.broke) {
            S.broke = true;
            for (let i = 0; i < 12; i++) S.frags.push({ p: S.head.clone(), v: S.v.clone().add(V((R() - .5) * 26, (R() - .5) * 18 - 6, (R() - .5) * 20)).multiplyScalar(0.92 + R() * 0.08), life: 5 + R() * 6, age: 0, k: 0.4 + R() * 0.8 });
            S.capP = S.head.clone(); S.capV = S.v.clone().multiplyScalar(1.03);
            ui.label('はやぶさ本体', '', () => S.frags[0].p.clone().add(V(0, 30, 0))); ui.label('カプセル', 'ok', () => S.capP.clone().add(V(0, 30, 0)));
          }
          const trail = (p, k, col) => { if (dt > 0) for (let i = 0; i < 3; i++) fx.glow.emit(q => { q.pos = [p.x + (R() - .5) * 2, p.y + (R() - .5) * 2, p.z + (R() - .5) * 2]; q.vel = [(R() - .5) * 4, (R() - .5) * 4, (R() - .5) * 4]; q.col = col; q.alpha = 0.8 * k; q.size = 14 * k + R() * 8; q.grow = -2; q.life = 1.4 + R() * 0.9; }); };
          if (!S.broke) { trail(S.head, 1.3, [2.6, 1.6, 0.7]); S.hs.position.copy(S.head); }
          else {
            S.frags.forEach(f => { f.age += dt; if (f.age < f.life) { f.p.addScaledVector(f.v, dt); trail(f.p, f.k * (1 - f.age / f.life), [2.4, 1.2, 0.45]); } });
            S.capP.addScaledVector(S.capV, dt); trail(S.capP, 1.0, [3, 2.7, 2.2]);
            S.hs.position.copy(S.capP); S.hs.scale.setScalar(45);
          }
          S.pl.position.copy(S.hs.position).add(V(0, -100, 400)); S.pl.intensity = 2500 * (0.8 + R() * 0.4);
          cam(V(0, 1.7, 0), V(-60 + st * 9, 200, -1100), 62);
        } },
      { at: 6, setup() {
          const ds = get('desertN', () => ENV.makeDesert(T, true)); place(ds); ds.position.y = -420;
          const sky = get('sky', () => ENV.makeSky()); place(sky); sky.material.uniforms.uDark.value = 0.97; sky.material.uniforms.uTint.value.setRGB(0.25, 0.3, 0.5);
          setSun(V(-0.4, 0.7, 0.45), V(0, 0, 0), 8, false, 1.1); sunLight.color.setHex(0xa9b9e6); hemi.intensity = 0.35; hemi.color.setHex(0x8fa4d8);
          const cap = get('capFull', () => CUT.makeCapsule(T, { cut: false })); place(cap); cap.quaternion.identity(); cap.setHeat(0);
          const ch = get('chute', () => CUT.makeCrossChute()); cap.add(ch); ch.position.y = 3.3;
          S.cap = cap; S.ch = ch; S.next = 0;
          ui.label('前面の耐熱材', '', () => cap.front.getWorldPosition(V(0, 0, 0)).add(V(0, -0.15, 0)));
          ui.label('背面の耐熱材', '', () => cap.aft.getWorldPosition(V(0, 0, 0)).add(V(0, 0.2, 0)));
          chip('高度', '約5<small>km</small>');
        },
        update(u) {
          const cap = S.cap, k = sm(1.5, 2.2, u.st), o = sm(2, 5.5, u.st);
          cap.front.position.set(0.25 * k * u.st * 0.3, -Math.max(0, u.st - 1.5) * 1.6 * k, 0); cap.front.rotation.z = Math.max(0, u.st - 1.5) * 0.5;
          cap.aft.position.set(-Math.max(0, u.st - 1.5) * 0.9, Math.max(0, u.st - 1.5) * 0.35 - Math.pow(Math.max(0, u.st - 1.5), 2) * 0.12, 0.3 * Math.max(0, u.st - 1.5)); cap.aft.rotation.x = Math.max(0, u.st - 1.5) * 0.8;
          S.ch.scale.set(0.12 + 0.88 * o, 0.5 + 0.5 * o, 0.12 + 0.88 * o); S.ch.visible = u.st > 1.8;
          cap.rotation.z = Math.sin(u.st * 1.1) * 0.08 * o;
          if (u.st > 6 && u.st > S.next) { S.next = u.st + 0.9; ring(V(0, 0, 0), V(0.3, 0.2, 1).normalize(), 0x8fd0ff, 1.5, 2.2, 0.15); }
          if (u.st > 6 && !S.b) { S.b = true; ui.clearLabels(); ui.label('電波で居場所を知らせる', 'ok', () => V(0, 0.35, 0)); }
          const a = 0.9 + u.st * 0.03;
          cam(V(Math.cos(a) * 8.5, 0.4, Math.sin(a) * 8.5), V(0, 1.35, 0), 44);
        } },
    ],
  });

  // ================= 17 回収と微粒子 =================
  CH.push({
    date: '2010.06.14 – 11', title: 'カプセルの回収と、イトカワの粒',
    lines: [
      { t: '午後11時8分ごろ、カプセルは砂漠に着地した。電波をたよりにヘリコプターが向かい、1時間たたないうちに見つけた。' },
      { t: '日本に運ばれたカプセルは、外の空気が入らない装置の中で開けられた。容器の内側をテフロンのへらでそっとなでると、目に見えないほど小さな粒がついてきた。' },
      { t: '電子顕微鏡で一つずつ調べ、2010年11月、約1,500個がイトカワの粒だと確かめられた。多くは0.01mmより小さい。' },
      { t: '成分は、地球に落ちてくる隕石でいちばん多い種類とよく似ていた。その隕石のふるさとが小惑星であることが、実物で初めて確かめられた。' },
    ],
    shots: [
      { at: 0, setup() {
          const ds = get('desertD', () => ENV.makeDesert(T, false)); place(ds); ds.position.y = 0;
          const sky = get('sky', () => ENV.makeSky()); place(sky); sky.material.uniforms.uDark.value = 0; sky.material.uniforms.uTint.value.setRGB(1.05, 0.82, 0.68);
          sky.material.uniforms.uSun.value.copy(V(0.85, 0.12, 0.3).normalize());
          stars.setOpacity(0); hemi.intensity = 0.45; hemi.color.setHex(0xffd8b0); hemi.groundColor.setHex(0x5a3a20);
          const cp = get('capLand', () => ENV.makeLandedCapsule()); place(cp); cp.position.set(0, 0, 0);
          setSun(V(0.85, 0.16, 0.3), V(-1, 0, 0), 6, false, 2.0); sunLight.color.setHex(0xffc890);
        },
        update(u) {
          const a = 0.8 + u.st * 0.05;
          cam(V(Math.cos(a) * 3.0 - 0.8, 0.9, Math.sin(a) * 3.0), V(-0.6, 0.05, 0.2), 42);
          if (u.st > 4) chip('見つかるまで', '約50<small>分</small>');
        } },
      { at: 1, setup() {
          ui.hideChip(); stars.setOpacity(0); hemi.intensity = 0.04; scene.environment = null; ctx.setBloom(0.2, 0.3, 1.2);
          const gr = get('grains', () => ENV.makeGrains()); place(gr);
          setSun(V(-0.6, 0.7, 0.4), V(0, 0, 0), 10, false, 1.6); sunLight.color.setHex(0xffffff);
          ui.card('scale', '<div class="panel scalebar" style="display:inline-flex"><i></i>0.01mm</div>', 'top');
        },
        update(u) {
          cache.grains.grains.forEach(m => { m.rotation.y += m.userData.spin * u.dt; m.rotation.x += m.userData.spin * 0.5 * u.dt; });
          const k = u.st * 0.03;
          cam(V(Math.sin(k) * 2, 0.6 - k * 0.5, 9.5 - u.st * 0.08), V(0, 0, 0), 40);
          if (u.line === 2) { const n = Math.min(1500, Math.floor(sm(0.5, 5, u.lt) * 1500)); ui.card('cnt', `<div class="panel" style="text-align:center"><h4>イトカワの粒と確かめられた数</h4><div class="big">約${n.toLocaleString()}<small>個</small></div></div>`, 'mid'); }
          if (u.line === 3 && !S.cnt) { S.cnt = true; ui.hideCard('cnt'); ui.card('met', '<div class="panel"><h4>成分がよく似ていた</h4><p>イトカワの粒　≒　普通コンドライト<br><span style="font-weight:400;font-size:.9em;color:#cfcfcf">地球に落ちてくる隕石でいちばん多い種類</span></p></div>', 'mid'); }
        } },
    ],
  });

  // ================= 18 残したもの =================
  CH.push({
    date: '2003 – 2010', title: 'はやぶさが残したもの',
    lines: [
      { t: '7年、約60億kmの旅で、はやぶさは計画していた4つの技術をすべて確かめた。' },
      { t: 'イオンエンジンによる長い航行、自分で判断して降りる自律航法、重力がほとんどない場所での採取、そして惑星のあいだから地球へ戻るカプセル。' },
      { t: 'その経験は「はやぶさ2」に引き継がれた。はやぶさ2は2020年、小惑星リュウグウの砂、約5.4gを地球に届けた。', s: 'その経験は、はやぶさツーに引き継がれた。はやぶさツーは2020年、小惑星リュウグウの砂、約5.4グラムを地球に届けた。' },
    ],
    shots: [
      { at: 0, setup() {
          const map = mapScene(false); map.setTime(map.TM.R); ui.hideChip(); S.evLab.set('', 'flat');
          for (const id of ['launch', 'arrive']) { const e = map.EV[id]; ui.label(`${e.y}.${e.m}　${e.name}`, 'flat', () => map.localToWorld(e.pos.clone())); }
          ui.card('stats', '<div class="panel"><div class="stats"><div><b>7<small style="font-size:.5em">年</small></b><span>旅の期間</span></div><div><b>60<small style="font-size:.5em">億km</small></b><span>往復の道のり</span></div><div><b>4</b><span>確かめた技術</span></div></div></div>', 'top');
        },
        update(u) {
          mapCam(0.6 + u.st * 0.02);
          if (u.line === 1 && !S.t) { S.t = true; ui.hideCard('stats'); ui.card('tech', '<div class="panel"><h4>はやぶさが確かめた4つの技術</h4><div class="techs"><div><i>01</i>イオンエンジンでの長い航行</div><div><i>02</i>自分で判断して降りる自律航法</div><div><i>03</i>重力がほとんどない場所での採取</div><div><i>04</i>惑星のあいだから戻るカプセル</div></div></div>', 'top'); }
          if (u.line === 2 && !S.h2) { S.h2 = true; ui.hideCard('tech'); ui.card('h2', '<div class="panel"><h4>はやぶさ2</h4><p>2020年12月、小惑星リュウグウの砂 約5.4gを地球へ</p></div>', 'top'); }
        } },
    ],
  });

  return CH;
}
