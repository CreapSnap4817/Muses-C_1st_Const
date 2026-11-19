// VTR 第7章〜第12章：降下のための目、ミネルバ、1回目の着地、サンプラー、2回目の着地、燃料もれ
export default function chaptersB(K) {
  const { THREE, ENV, CUT, PI, V, c01, sm, lerp, eio, R, ctx, ui, T, scene, stage, hb, M, hold, fx, S, cache, get, ito,
    sunDir, sunLight, hemi, stars, setSun, followShadow, cam, place, tweak, detach, useHB, basisQ, UPQ, upYaw, wpos, wdir, lab,
    emitIons, puff, rcsFire, xenonJet, dust, beam, setBeam, fbsFans, ring, chip, glowSprite, groundY, tdScene, setAlt, downBeams, wideCam, hideTop, openBattery, HORN_TIP, jaxaPhoto } = K;
  const CH = [];
  const BOTTOM = [1, 4, 7, 10], TOP = [0, 3, 6, 9];         // 下向き・上向きに噴く化学エンジンの番号
  const quat = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  // 地面にもぐらないカメラ
  const camG = (p, t, fov) => { p.y = Math.max(p.y, groundY(p.x, p.z) + 0.6); cam(p, t, fov); };
  const tipW = () => wpos([M.horn.x, 0, M.horn.tip]);
  // ターゲットマーカを放して落とす。戻り値は毎フレーム呼ぶ更新関数
  function tmDrop(speed = 0.7, name = 'tm0') {
    const tm = detach(name); const st = { v: -speed, done: false, tm };
    tm.scale.setScalar(1);
    st.update = (dt) => {
      if (st.done) return;
      const gy = groundY(tm.position.x, tm.position.z) + 0.05;
      tm.position.y += st.v * dt; tm.rotation.x += dt * 1.2;
      if (tm.position.y <= gy) { tm.position.y = gy; if (Math.abs(st.v) < 0.12) { st.done = true; st.v = 0; } else { st.v = -st.v * 0.22; dust(tm.position, 6, 0.25); } }
      else st.v -= 0.25 * dt;
    };
    return st;
  }
  const stepCard = (id, title, rows, on) => ui.card(id, `<div class="panel"><h4>${title}</h4><div class="techs" style="grid-template-columns:1fr">${rows.map((r, i) => `<div class="${i === on ? 'act' : 'dim'}"><i>${r[0]}</i>${r[1]}</div>`).join('')}</div></div>`, 'top');

  // ================= 7 降下のための目 =================
  CH.push({
    date: '2005.11', title: '自分で測り、自分で降りる',
    lines: [
      { t: 'イトカワまでは約3億km。電波でも片道16分かかるので、地上から操縦していては間に合わない。' },
      { t: '最後は、はやぶさが自分で測って、自分で判断して降りる。そのための目が、機体の下の面に集まっている。' },
      { t: '高いところでは、レーザー高度計が1本のレーザーで、地面までの距離を測り続ける。' },
      { t: '高度約40mで、目印のターゲットマーカを落とす。中に小さな粒をつめた袋になっていて、お手玉のように、弾まずに止まる。' },
      { t: 'フラッシュをたいた写真と、たかない写真を見比べると、光をはね返すマーカだけが浮かび上がる。それを追いかけて、横へのずれを消す。' },
      { t: '高度約30mからは、4本のレーザーを斜めに出す近距離センサに交代する。4か所の距離の差から地面の傾きがわかり、機体を地面と平行にそろえる。' },
      { t: 'パドルの下では、扇形の光が障害物を見張る。何かが光をさえぎったら、降下をやめる決まりだった。' },
    ],
    shots: [
      { at: 0, setup() {
          tdScene({ yaw: 0.5 }); setAlt(140); followShadow(V(0, 60, 0), 90);
          ui.card('delay', `<div class="panel"><h4>地球からの指令が届くまで</h4>
            <svg viewBox="0 0 320 64" width="100%" role="img" aria-label="地球から出た電波が、はやぶさに届くまで16分かかる">
              <circle cx="22" cy="32" r="12" fill="#3d8bff"/><text x="10" y="60" font-size="11" fill="#ddd" font-weight="700">地球</text>
              <rect x="286" y="24" width="16" height="16" fill="#e2bd72"/><text x="262" y="60" font-size="11" fill="#ddd" font-weight="700">はやぶさ</text>
              <line x1="40" y1="32" x2="280" y2="32" stroke="rgba(255,255,255,.3)" stroke-dasharray="3 5"/>
              <circle r="5" cy="32" fill="#8fd0ff"><animate attributeName="cx" from="40" to="280" dur="4s" repeatCount="indefinite"/></circle>
              <text x="118" y="20" font-size="15" fill="#fff" font-weight="900">片道 16分</text></svg></div>`, 'top');
        },
        update(u) {
          const h = lerp(140, 110, sm(0, 14, u.st)); setAlt(h); followShadow(V(0, h / 2, 0), 90);
          wideCam(h, 0.3 + u.st * 0.012, 46, 0.8);
        } },
      { at: 1, setup() {
          tdScene({ yaw: 0.5 }); setAlt(60); followShadow(hold.position, 8);
          S.set = -1;
        },
        update(u) {
          const p = hold.position; const a = 1.0 + u.st * 0.05;
          cam(p.clone().add(V(Math.cos(a) * 2.7, -2.7, Math.sin(a) * 2.7)), p.clone().add(V(0, -0.55, 0)), 40);
          const n = Math.min(2, Math.floor(u.st / 4.2));
          if (n !== S.set) {
            S.set = n; ui.clearLabels();
            if (n === 0) { lab('レーザー高度計', '', M.lidar.tx); lab('近距離レーザー距離計', '', M.lrf[0].pos); }
            if (n === 1) { lab('ターゲットマーカ', '', M.tm[0].pos); lab('フラッシュ', '', M.fla); }
            if (n === 2) { lab('ファンビームセンサ', '', M.fbs[0].pos); lab('ファンビームセンサ', '', M.fbs[2].pos); }
          }
        } },
      { at: 2, setup() {
          tdScene({ yaw: 0.5 }); S.b = [place(beam(0x40ff80, 0.045, 0.75))];
        },
        update(u) {
          const h = Math.exp(lerp(Math.log(420), Math.log(60), sm(0, 15, u.st))); setAlt(h); followShadow(V(0, h / 2, 0), Math.max(30, h * 0.6));
          downBeams([{ pos: M.lidar.tx }], S.b); S.b[0].material.opacity = 0.5 + 0.25 * Math.sin(u.t * 22); S.b[0].scale.x = S.b[0].scale.z = 1 + h / 25;
          wideCam(h, 0.25);
          chip('高度', `${Math.round(h)}<small>m</small>`);
        } },
      { at: 3, setup() {
          tdScene({ yaw: 0.5 }); setAlt(40); followShadow(V(0, 20, 0), 30);
          S.tm = null; chip('高度', '約40<small>m</small>');
        },
        update(u) {
          const h = lerp(40, 36, sm(0, 14, u.st)); setAlt(h); followShadow(V(0, h / 2, 0), 30);
          if (u.st > 1.6 && !S.tm) { S.tm = tmDrop(1.0, 'tm2'); S.tm.v = -5.5; ui.label('ターゲットマーカ', '', () => S.tm.tm.position.clone().add(V(0, 0.25, 0))); }
          if (S.tm) {
            S.tm.update(u.dt); const tp = S.tm.tm.position; if (tp.y < 6 && Math.abs(S.tm.v) > 1.2) S.tm.v = -1.2;
            const k = sm(2, 9, u.st);
            camG(tp.clone().add(V(lerp(1.6, 2.2, k), lerp(-0.6, 0.9, k), lerp(2.2, 2.6, k))), tp.clone().add(V(0, 0.1, 0)), 40);
            if (S.tm.done && !S.card) { S.card = true; ui.card('bag', '<div class="panel"><h4>お手玉と同じしくみ</h4><p>中の粒が動いて、はずむ勢いを吸いとる</p></div>', 'top'); }
          } else { const p = wpos(M.tm[0].pos); cam(p.clone().add(V(1.6, -0.6, 2.2)), p, 40); }
        } },
      { at: 4, setup() {
          tdScene({ yaw: 0.5 }); setAlt(9); followShadow(V(0, 5, 0), 12); ui.hideChip();
          const tm = detach('tm2'); tm.position.set(0.6, groundY(0.6, 0.4) + 0.05, 0.4); S.tmP = tm.position;
          S.glow = place(glowSprite(new THREE.Color(3, 3, 3), 0.9)); S.glow.position.copy(tm.position).add(V(0, 0.05, 0));
          S.fl = new THREE.PointLight(0xffffff, 0, 80, 1.0); place(S.fl);
          S.cone = place(beam(0xffffff, 1, 0.05)); S.cone.geometry = new THREE.CylinderGeometry(2.6, 0.02, 1, 24, 1, true);
          ui.card('flash', '<div class="panel"><h4>下向きカメラの写真</h4><canvas id="flcv" width="600" height="190" style="width:100%;height:auto;display:block"></canvas></div>', 'top');
          // 岩の模様は決めておく
          const rr = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7); S.rocks = Array.from({ length: 70 }, () => [rr(), rr(), 2 + rr() * 9, 60 + rr() * 110]);
        },
        update(u) {
          const on = (u.st % 2.4) < 1.2 && u.st > 0.8;
          const fp = wpos(M.fla); S.fl.position.copy(fp); S.fl.intensity = on ? 900 : 0;
          setBeam(S.cone, fp, V(fp.x, groundY(fp.x, fp.z), fp.z)); S.cone.material.opacity = on ? 0.06 : 0;
          S.glow.material.opacity = on ? 1 : 0;
          const cv = document.getElementById('flcv');
          if (cv) {
            const g = cv.getContext('2d'), W = 190, pad = 15;
            g.fillStyle = '#05080c'; g.fillRect(0, 0, 600, 190);
            ['フラッシュあり', 'フラッシュなし', '2枚の差'].forEach((name, i) => {
              const x0 = i * (W + pad); g.save(); g.beginPath(); g.rect(x0, 26, W, 160); g.clip();
              g.fillStyle = i === 2 ? '#000' : (i === 0 ? '#3a3a3a' : '#2c2c2c'); g.fillRect(x0, 26, W, 160);
              if (i < 2) for (const [rx, ry, rs, rc] of S.rocks) { g.fillStyle = `rgb(${rc + (i === 0 ? 14 : 0)},${rc + (i === 0 ? 14 : 0)},${rc + (i === 0 ? 14 : 0)})`; g.beginPath(); g.ellipse(x0 + rx * W, 26 + ry * 160, rs, rs * 0.7, rx * 6, 0, 7); g.fill(); }
              if (i !== 1) { const gr = g.createRadialGradient(x0 + 120, 100, 0, x0 + 120, 100, 13); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x0 + 100, 80, 40, 40); }
              g.restore(); g.fillStyle = '#ddd'; g.font = '700 17px "Noto Sans JP", sans-serif'; g.fillText(name, x0 + 2, 18);
            });
          }
          const tp = S.tmP;
          wideCam(9, 0.2, 50);
        } },
      { at: 5, setup() {
          tdScene({ yaw: 0.5 }); S.q0 = hold.quaternion.clone();
          S.b = M.lrf.map(() => place(beam(0xff4030, 0.014, 0.8)));
          ui.card('sw', '<div class="panel"><h4>高度 約30m</h4><p>レーザー高度計から、4本の近距離レーザー距離計へ交代</p></div>', 'top');
        },
        update(u) {
          const h = lerp(30, 9, sm(0, 16, u.st)); const tilt = 0.14 * (1 - sm(5, 12, u.st));
          hold.quaternion.copy(quat(tilt, 0, tilt * 0.6)).multiply(S.q0); setAlt(h); followShadow(V(0, h / 2, 0), 16);
          downBeams(M.lrf, S.b);
          wideCam(h, 0.5);
          chip('地面との傾き', `${Math.round(tilt / 0.14 * 8)}<small>度</small>`);
        } },
      { at: 6, setup() {
          tdScene({ yaw: 0.9 }); setAlt(9); followShadow(V(0, 5, 0), 12); ui.hideChip();
          S.f = fbsFans(); lab('ファンビームセンサの光', '', [M.fbs[0].pos[0], 1.9, M.fbs[0].pos[2] - 0.1]);
        },
        update(u) {
          const h = lerp(9, 6.5, sm(0, 14, u.st)); setAlt(h); followShadow(V(0, h / 2, 0), 12);
          S.f.forEach((m, i) => { m.material.opacity = 0.14 + 0.07 * Math.sin(u.t * 9 + i * 1.7); });
          const p = hold.position; const a = 0.25 + u.st * 0.03;
          camG(p.clone().add(V(Math.cos(a) * 6.2, -1.5, Math.sin(a) * 6.2)), p.clone().add(V(0, -0.6, 0)), 44);
        } },
    ],
  });

  // ================= 8 ミネルバ =================
  CH.push({
    date: '2005.11.12', title: '探査ロボット「ミネルバ」の放出',
    lines: [
      { t: '本番の前に、3回の練習降下をした。11月12日の3回目は、高度約55mまで降りた。' },
      { t: 'このとき、小型ロボットのミネルバを放す計画だった。重さ591g。車輪はなく、跳びはねてイトカワの上を移動する。' },
      { t: '放す合図は、地上から送る。ところが合図が届いたとき、はやぶさは高度を保つための噴射で、上昇に転じていた。' },
      { t: 'イトカワの重力は、地球の約10万分の1しかない。上向きの速さを持ったまま放たれたミネルバを、引き戻すことはできなかった。' },
      { t: 'ミネルバは離れていきながら、はやぶさの太陽電池パドルを写真に撮って送ってきた。' },
    ],
    shots: [
      { at: 0, setup() {
          tdScene({ yaw: 0.5 });
          ui.card('reh', '<div class="panel"><h4>3回の練習降下</h4><div class="techs" style="grid-template-columns:1fr 1fr 1fr"><div><i>11月4日</i>約700mで中止</div><div><i>11月9日</i>約70mまで</div><div><i>11月12日</i>約55mまで</div></div></div>', 'top');
        },
        update(u) {
          const h = Math.exp(lerp(Math.log(300), Math.log(55), sm(0, 12, u.st))); setAlt(h); followShadow(V(0, h / 2, 0), Math.max(30, h * 0.6));
          wideCam(h, -0.3);
          chip('高度', `${Math.round(h)}<small>m</small>`);
        } },
      { at: 1, setup() {
          tdScene({ yaw: 0.5 }); setAlt(55); followShadow(hold.position, 8); ui.hideChip();
          lab('ミネルバ', 'ok', M.minerva.pos);
        },
        update(u) {
          // 箱の下半分は、まず真下へ抜けてから、回りながら離れていく
          const lid = hb.named.minervaLid; const k = sm(2, 6, u.st), k1 = sm(0, 0.4, k), k2 = sm(0.25, 1, k);
          lid.position.copy(lid.userData.base).add(V(-0.16 * k2, -0.2 * k2, -0.12 * k1 - 0.2 * k2)); lid.rotation.y = -k2 * 1.6;
          const p = wpos(M.minerva.pos); const a = 3.4 + u.st * 0.04;
          cam(p.clone().add(V(Math.cos(a) * 1.25, -0.7, Math.sin(a) * 1.25)), p, 40);
          if (u.st > 6) chip('重さ', '591<small>g</small>');
        } },
      { at: 2, setup() {
          tdScene({ yaw: 0.5 }); setAlt(55); ui.hideChip();
          hb.named.minervaLid.visible = false; S.y0 = hold.position.y; S.vy = -0.25; S.y = 0; S.rv = null;
        },
        update(u) {
          const dt = u.dt; const burn = u.st > 2.5 && u.st < 5.2;
          if (burn) { S.vy += 0.42 * dt; BOTTOM.forEach(i => rcsFire(i, dt, 0.8)); }
          S.y += S.vy * dt; hold.position.y = S.y0 + S.y; hold.updateMatrixWorld(true); followShadow(V(0, hold.position.y - 20, 0), 34);
          if (u.st > 7 && !S.rv) { S.rv = detach('rover'); S.rvV = V(0.35, S.vy - 0.25, 0.42); ui.label('ミネルバ', 'ok', () => S.rv.position.clone().add(V(0, 0.2, 0))); }
          if (S.rv) { S.rv.position.addScaledVector(S.rvV, dt); S.rv.rotation.x += dt * 0.8; S.rv.rotation.z += dt * 0.5; }
          camG(V(6.2, S.y0 + 0.6 + S.y * 0.5, 8.2), V(0, S.y0 + 0.9 + S.y * 0.7, 0), 42);
          if (u.st < 2.5) chip('はやぶさの動き', '下降中'); else if (u.st < 7) chip('はやぶさの動き', '上昇に転じる'); else chip('合図が届く', 'ミネルバを放出');
        } },
      { at: 3, setup() {
          tdScene({ yaw: 0.5 }); setAlt(60); hb.named.minervaLid.visible = false;
          S.rv = detach('rover'); S.rv.position.copy(hold.position).add(V(1.6, -1.0, 1.9)); S.rvV = V(0.14, 0.5, 0.17); S.hv = 0.45;
          ui.label('ミネルバ', 'ok', () => S.rv.position.clone().add(V(0, 0.2, 0)));
          chip('イトカワの重力', '地球の約10万分の1');
        },
        update(u) {
          S.rv.position.addScaledVector(S.rvV, u.dt * 3); S.rv.rotation.x += u.dt * 0.8; S.rv.rotation.z += u.dt * 0.5;
          hold.position.y += S.hv * u.dt * 3; hold.updateMatrixWorld(true); followShadow(V(0, hold.position.y / 2, 0), 60);
          const mid = S.rv.position.clone().lerp(hold.position, 0.5);
          cam(mid.clone().add(V(4.5, 6.5, 6.5)), mid.clone().add(V(0, -2, 0)), 46);
        } },
      { at: 4, setup() {
          tdScene({ yaw: 0.5 }); setAlt(70); hb.named.minervaLid.visible = false; ui.hideChip(); followShadow(hold.position, 8);
          S.rv = detach('rover'); S.rv.position.copy(hold.position).add(V(4.5, 0.2, 3.0)); S.shot = false;
          ui.label('ミネルバ', 'ok', () => S.rv.position.clone().add(V(0, 0.2, 0)));
        },
        update(u) {
          S.rv.position.add(V(0.12, 0.05, 0.1).multiplyScalar(u.dt)); S.rv.rotation.x += u.dt * 0.8;
          const rp = S.rv.position;
          cam(rp.clone().add(V(1.6, 0.7, 1.9)), rp.clone().lerp(hold.position, 0.35), 44);
          if (u.st > 1.2 && !S.shot) { S.shot = true; jaxaPhoto('minerva'); }
        } },
    ],
  });

  // ================= 9 1回目のタッチダウン =================
  const TD1Q = () => quat(0.13, 0, -0.09).multiply(upYaw(0.5));
  CH.push({
    date: '2005.11.20', title: '1回目の着地　予定外の30分',
    lines: [
      { t: '11月20日、1回目の本番。高度約40mで、88万人の名前を刻んだターゲットマーカを落とした。マーカは無事にイトカワに着いた。' },
      { t: 'ところが高度十数mで、障害物を見張るセンサが、何かの光を感じとった。' },
      { t: 'はやぶさは降下を中止しようとした。しかし機体が傾いていたため、上昇の噴射はかえって危ないと判断し、そのままゆっくり降り続けた。' },
      { t: '着地を感じとる仕組みは、中止の判断といっしょに止まっていた。地面に触れても、弾丸は撃たれない。はやぶさは2回はずんで、イトカワの上に座りこんだ。' },
      { t: 'そのころ地上では、受信するアンテナを切り替える時間に当たり、着陸に気づけなかった。約30分後、地上からの指令で、はやぶさは飛び立った。' },
      { t: '太陽に照らされた地面は熱い。長く座っていれば機体が傷む、きわどい30分だった。' },
    ],
    shots: [
      { at: 0, setup() {
          tdScene({ yaw: 0.5 }); setAlt(40); followShadow(V(0, 20, 0), 30); S.tm = null;
        },
        update(u) {
          const h = lerp(40, 30, sm(0, 14, u.st)); setAlt(h); followShadow(V(0, h / 2, 0), 30);
          if (u.st > 1.2 && !S.tm) { S.tm = tmDrop(1.0); S.tm.v = -5; ui.label('ターゲットマーカ', '', () => S.tm.tm.position.clone().add(V(0, 0.25, 0))); }
          if (S.tm) { S.tm.update(u.dt); if (S.tm.tm.position.y < 6 && Math.abs(S.tm.v) > 1.2) S.tm.v = -1.2; }
          wideCam(h, 0.3);
          if (u.st > 5) chip('刻まれた名前', '約88<small>万人</small>');
        } },
      { at: 1, setup() {
          tdScene({ yaw: 0.9 }); ui.hideChip(); S.f = fbsFans();
          const tm = detach('tm0'); tm.position.set(2.2, groundY(2.2, -1.4) + 0.05, -1.4);
        },
        update(u) {
          const h = lerp(24, 15, sm(0, 12, u.st)); setAlt(h); followShadow(V(0, h / 2, 0), 16);
          const hit = u.st > 5;
          S.f.forEach((m, i) => { const red = hit && i === 0; m.material.color.setRGB(red ? 2.2 : 1.0, red ? 0.15 : 0.5, red ? 0.1 : 0.15); m.material.opacity = red ? 0.3 + 0.25 * Math.sin(u.t * 18) : 0.14; });
          if (hit && !S.al) { S.al = true; ui.card('fbs', '<div class="panel alert"><span class="dot"></span><p>障害物を検出<br><span style="font-weight:500">降下の中止を判断</span></p></div>', 'top'); }
          const p = hold.position; const a = 0.2 + u.st * 0.02;
          camG(p.clone().add(V(Math.cos(a) * 7, -1.2, Math.sin(a) * 7)), p.clone().add(V(0, -0.8, 0)), 44);
          chip('高度', `${Math.round(h)}<small>m</small>`);
        } },
      { at: 2, setup() {
          tdScene({ yaw: 0.5 }); hold.quaternion.copy(TD1Q()); ui.hideChip();
          const tm = detach('tm0'); tm.position.set(2.2, groundY(2.2, -1.4) + 0.05, -1.4);
        },
        update(u) {
          const h = lerp(15, 4.5, sm(0, 16, u.st)); setAlt(h); followShadow(V(0, h / 2, 0), 14);
          const p = hold.position; chip('機体の傾き', '大きい');
          const on = u.st < 5 ? 0 : u.st < 10 ? 1 : 2;
          stepCard('abort', 'はやぶさの判断', [['1', '障害物を検出、降下を中止したい'], ['2', '機体の傾きが大きい。上昇の噴射は見送る'], ['3', 'そのまま、ゆっくり降下を続ける']], on);
          camG(V(6.5, p.y + 1.4, 8.5), V(0, p.y + 0.3, 0), 44);
        } },
      { at: 3, setup() {
          tdScene({ yaw: 0.5 }); S.q0 = TD1Q(); hold.quaternion.copy(S.q0);
          const tm = detach('tm0'); tm.position.set(2.2, groundY(2.2, -1.4) + 0.05, -1.4);
          S.h = 3.2; S.v = -0.55; S.n = 0; S.rest = 0;
          lab('弾丸の発射装置', 'bad', M.projectors[0].pos);
        },
        update(u) {
          const dt = u.dt;
          if (S.n < 3) {
            S.v -= 0.5 * dt; S.h += S.v * dt;
            if (S.h <= 0) { S.h = 0; S.n++; dust(tipW(), 50 - S.n * 12, 0.5); S.v = S.n === 1 ? 0.8 : S.n === 2 ? 0.45 : 0; }
          } else S.rest += dt;
          const k = sm(0, 2.5, S.rest);
          hold.quaternion.copy(quat(0.04 * k, 0, -0.03 * k)).multiply(S.q0);
          hb.setHorn(1, S.h <= 0.001 ? 0.05 : 0); setAlt(S.h - (S.n >= 3 ? 0.05 : 0)); followShadow(V(0, 1, 0), 9);
          const tp = tipW();
          camG(V(tp.x + 4.2, 1.5, tp.z + 5.6), V(tp.x * 0.5, 1.3 + S.h * 0.3, tp.z * 0.5), 42);
          if (S.n >= 1) chip('はずんだ回数', `${Math.min(2, S.n)}<small>回</small>`);
          if (S.n >= 3 && !S.c) { S.c = true; ui.card('nofire', '<div class="panel alert"><span class="dot"></span><p>着地の検出が止まっていて、弾丸は出ない</p></div>', 'top'); }
        } },
      { at: 4, setup() {
          tdScene({ yaw: 0.5 }); S.q0 = TD1Q(); hold.quaternion.copy(quat(0.04, 0, -0.03).multiply(S.q0)); hb.setHorn(1, 0.05); setAlt(-0.05);
          const tm = detach('tm0'); tm.position.set(2.2, groundY(2.2, -1.4) + 0.05, -1.4);
          S.y0 = hold.position.y; S.up = 0; S.vy = 0;
          ui.card('gs', '<div class="panel"><h4>そのころ地上では</h4><p>受信するアンテナを切り替える時間で、着陸に気づけなかった</p></div>', 'top');
        },
        update(u) {
          const mins = Math.min(30, Math.floor(sm(0.5, 9, u.st) * 30));
          chip('イトカワの上にいた時間', `${mins}<small>分</small>`);
          if (u.st > 9.5) {
            if (!S.go) { S.go = true; ui.hideCard('gs'); ui.card('cmd', '<div class="panel"><h4>地上からの指令</h4><p>緊急の上昇を指示。はやぶさは飛び立った</p></div>', 'top'); hb.setHorn(1, 0); }
            if (u.st < 12.5) { S.vy += 0.5 * u.dt; BOTTOM.forEach(i => rcsFire(i, u.dt)); if (!S.d) { S.d = true; dust(tipW(), 40, 0.6); } }
            S.up += S.vy * u.dt; hold.position.y = S.y0 + S.up; hold.quaternion.slerp(S.q0, 0.02); hold.updateMatrixWorld(true);
          }
          followShadow(V(0, 1 + S.up / 2, 0), 9 + S.up * 0.5);
          camG(V(6.8, 1.9 + S.up * 0.25, 8.8), V(0, 1.4 + S.up * 0.55, 0), 42);
        } },
    ],
  });

  // ================= 10 サンプラーのしくみ =================
  function samplerStage() {
    const g = get('samCut', () => CUT.makeSamplerCutaway(T)); place(g); g.position.set(0, 0, 0);
    setSun(V(0.45, 0.75, 0.5), V(0, 0.7, 0), 2.2, false, 3.0);
    scene.environment = ctx.envRoom; stars.setOpacity(0.25); hemi.intensity = 0.35; ctx.setBloom(0.5, 0.5, 1.0);
    S.sam = g; g.lrfBeam.material.opacity = 0; g.door.rotation.y = 0;
    return g;
  }
  const samLab = (g, text, key, cls = '') => ui.label(text, cls, () => g.localToWorld(g.anchors[key].clone()));
  CH.push({
    date: '採取の計画', title: '砂をとるしくみ　サンプラー',
    lines: [
      { t: '砂をとる道具が、機体の下にのびる長さ約1mのサンプラーホーンだ。重力がほとんどないイトカワでは、スコップですくうことも、ドリルを押しつけることもできない。' },
      { t: 'そこで、筒の先が地面に触れた瞬間に、重さ5gの金属の弾丸を、秒速300mで撃ちこむ。' },
      { t: '触れたことは、蛇腹の縮みで知る。レーザーがホーンの長さを見張っていて、縮んだらすぐに発射の合図を出す。' },
      { t: '砕けた破片は、重力が弱いので落ちずに舞い上がる。筒の内側をはね返りながら上へ集まり、細い管を通って、機体の中の小さな容器に入る。' },
      { t: '容器は2部屋に分かれていて、着地のたびに回転式のとびらで部屋を切り替える。地面に触れているのは、1秒ほどだ。' },
    ],
    shots: [
      { at: 0, setup() {
          setSun(V(-0.7, 0.35, 0.62), V(0, 0, 0), 4);
          useHB(basisQ(V(0.5, 0, -1), V(0.15, 0.95, 0.3)));
          hb.highlight('horn', 0.22); lab('サンプラーホーン', '', [M.horn.x, 0, -1.0]);
        },
        update(u) {
          hb.setHl(0.16 + 0.1 * Math.sin(u.t * 3));
          const c = wpos([M.horn.x, 0, -0.9]); const a = 2.3 + u.st * 0.03;
          cam(c.clone().add(V(Math.cos(a) * 3.6, -0.5, Math.sin(a) * 3.6)), c, 40);
          if (u.st > 4) chip('ホーンの長さ', '約1<small>m</small>');
        } },
      { at: 1, setup() {
          const g = samplerStage(); ui.hideChip(); g.start('plan'); S.loop = 0;
          samLab(g, '弾丸の発射装置', 'projector'); samLab(g, '布の蛇腹', 'bellows'); samLab(g, '容器', 'catcher');
          ui.card('sam', '<div class="panel"><h4>サンプラーの断面</h4><p style="font-weight:500">計画していた動き。筒を半分に切って中を見せている。</p></div>', 'top');
        },
        update(u) {
          const g = S.sam; S.loop += u.dt; if (S.loop > 7.5) { S.loop = 0; g.start('plan'); }
          g.update(u.dt);
          g.lrfBeam.material.opacity = u.line === 2 ? 0.75 : 0;
          if (u.line === 2 && !S.l2) { S.l2 = true; ui.label('長さを見張るレーザー', '', () => g.localToWorld(V(0.07, 0.72, 0))); chip('弾丸', '5g<small>・秒速300m</small>'); }
          if (u.line === 1) chip('弾丸', '5g<small>・秒速300m</small>');
          if (u.line === 3) chip('容器に入った粒', `${g.caught()}<small>個</small>`);
          const a = 1.05 + Math.sin(u.st * 0.12) * 0.25;
          cam(V(Math.cos(a) * 3.6, 0.9, Math.sin(a) * 3.6), V(0, 0.36, 0), 36);
        } },
      { at: 4, setup() {
          const g = samplerStage(); ui.hideChip(); g.start('plan');
          for (let i = 0; i < 260; i++) g.update(0.02);
          S.lA = ui.label('部屋A', '', () => g.localToWorld(V(0.016, 1.455, 0.0))); S.lB = ui.label('部屋B', '', () => g.localToWorld(V(-0.016, 1.455, 0.0)));
          ui.label('回転式のとびら', '', () => g.localToWorld(V(0, 1.402, 0.02)));
        },
        update(u) {
          const g = S.sam; g.update(u.dt);
          g.door.rotation.y = sm(3, 6, u.st) * PI * 0.67;
          const a = 1.2 + u.st * 0.03;
          cam(V(Math.cos(a) * 0.26, 1.5, Math.sin(a) * 0.26), V(0, 1.4, 0), 36);
          chip('地面に触れる時間', '約1<small>秒</small>');
        } },
    ],
  });

  // ================= 11 2回目のタッチダウン =================
  CH.push({
    date: '2005.11.26', title: '2回目の着地　午前7時7分',
    lines: [
      { t: '11月26日、2回目の本番。前回の反省から、障害物を見張るセンサは使わない設定にして降りた。' },
      { t: '高度約7mで機体を地面と平行にそろえ、秒速数cmでゆっくり降りる。日本時間の午前7時7分、ホーンの先が地面に触れた。' },
      { t: 'ホーンが縮み、着地の合図が出た。約1秒後、はやぶさは秒速50cmで上昇した。計画どおりの動きに見えた。' },
      { t: 'ところが後の調べで、弾丸を撃つ直前に、発射を取り消す命令が出ていた可能性が高いとわかった。安全のための設定が、プログラムの中で思わぬ形で働いたとみられる。' },
      { t: '弾丸は出なかった。それでも、ホーンが地面を突いたときに舞い上がった細かい粒が、筒の中をのぼっていた。' },
      { t: 'このとき容器に入った粒が、5年後に地球へ届くことになる。' },
    ],
    shots: [
      { at: 0, setup() {
          tdScene({ yaw: 0.5 });
          S.b = [place(beam(0x40ff80, 0.04, 0.7))];
        },
        update(u) {
          const h = Math.exp(lerp(Math.log(1000), Math.log(32), sm(0, 15, u.st))); setAlt(h); followShadow(V(0, h / 2, 0), Math.max(30, h * 0.6));
          downBeams([{ pos: M.lidar.tx }], S.b); S.b[0].scale.x = S.b[0].scale.z = 1 + h / 25;
          wideCam(h, 0.3);
          chip('高度', `${h > 100 ? Math.round(h / 10) * 10 : Math.round(h)}<small>m</small>`);
          stepCard('seq', '降下の手順', [['高度40m', 'ブレーキをかけて減速'], ['高度30m', '4本の近距離レーザーに交代'], ['高度7m', '機体を地面と平行にそろえる']], h > 40 ? -1 : h > 33 ? 0 : 1);
        } },
      { at: 1, setup() {
          tdScene({ yaw: 0.5 }); S.q0 = hold.quaternion.clone(); ui.hideChip();
          S.b = M.lrf.map(() => place(beam(0xff4030, 0.012, 0.75)));
          S.b2 = [place(beam(0xff4030, 0.008, 0.7))]; S.touch = false;
        },
        update(u) {
          const td = 9.0; const h = Math.max(0, 7 * (1 - sm(0, td, u.st) * 1.0)); const tilt = 0.1 * (1 - sm(0.5, 4, u.st));
          hold.quaternion.copy(quat(tilt, 0, tilt * 0.5)).multiply(S.q0);
          const press = u.st > td ? 0.06 * sm(td, td + 0.5, u.st) : 0; hb.setHorn(1, press); setAlt(h - press); followShadow(V(0, h / 2 + 1, 0), 9);
          downBeams(M.lrf, S.b);
          // ホーンの長さを見張るレーザー
          const p0 = wpos(M.lrf2.pos), p1 = wpos([M.horn.x, 0.11, -1.36 + press]); setBeam(S.b2[0], p0, p1);
          if (u.st > td && !S.touch) { S.touch = true; dust(tipW(), 90, 0.45); ui.card('td', '<div class="panel"><h4>着地を検出</h4><p>ホーンが縮んだのを、レーザーがとらえた</p></div>', 'top'); }
          const tp = tipW();
          camG(V(tp.x + 3.0, 1.1 + h * 0.35, tp.z + 4.2), V(tp.x * 0.6, 0.9 + h * 0.5, tp.z * 0.6), 42);
          if (u.st > td) chip('2005年11月26日', '午前7時7分'); else if (u.st > 1) chip('高度', `${h.toFixed(1)}<small>m</small>`);
        } },
      { at: 2, setup() {
          tdScene({ yaw: 0.5 }); hb.setHorn(1, 0.06); setAlt(-0.06); S.y0 = hold.position.y; S.up = 0; S.d = false;
        },
        update(u) {
          const go = u.st > 1.0;
          if (go) { hb.setHorn(1, 0.06 * (1 - sm(1, 1.5, u.st))); S.up += 0.5 * u.dt * Math.min(1, (u.st - 1) * 2); if (u.st < 2.6) BOTTOM.forEach(i => rcsFire(i, u.dt)); if (!S.d) { S.d = true; dust(tipW(), 60, 0.7); } }
          hold.position.y = S.y0 + S.up + (go ? 0.06 * sm(1, 1.5, u.st) : 0); hold.updateMatrixWorld(true); followShadow(V(0, 1 + S.up / 2, 0), 10 + S.up * 0.5);
          camG(V(6.5, 1.8 + S.up * 0.3, 8.5), V(0, 1.4 + S.up * 0.6, 0), 42);
          if (go) chip('上昇の速さ', '秒速 50<small>cm</small>');
        } },
      { at: 3, setup() {
          tdScene({ yaw: 0.5 }); setAlt(30); followShadow(hold.position, 8); ui.hideChip();
          lab('弾丸の発射装置', 'bad', M.projectors[0].pos);
        },
        update(u) {
          const p = wpos([M.horn.x, 0, M.horn.top - 0.1]); const a = 1.2 + u.st * 0.04;
          cam(p.clone().add(V(Math.cos(a) * 1.5, -0.75, Math.sin(a) * 1.5)), p, 40);
          const on = u.st < 4 ? 0 : u.st < 8 ? 1 : 2;
          stepCard('fire', '着地の瞬間に起きたこと', [['1', 'ホーンの縮みで、着地を検出'], ['2', '弾丸の発射を指令'], ['3', '発射の直前に、取り消しの命令が出た可能性が高い']], on);
        } },
      { at: 4, setup() {
          const g = samplerStage(); g.start('actual'); S.loop = 0;
          samLab(g, '容器', 'catcher'); samLab(g, '舞い上がった粒', 'cone', 'ok');
          ui.card('act', '<div class="panel"><h4>実際に起きたとみられること</h4><p>弾丸は出ず、着地で舞い上がった細かい粒だけが筒をのぼった</p></div>', 'top');
        },
        update(u) {
          const g = S.sam; S.loop += u.dt; if (S.loop > 9 && u.line < 5) { S.loop = 0; g.start('actual'); }
          g.update(u.dt * 0.8);
          if (u.line < 5) { const a = 1.05 + Math.sin(u.st * 0.12) * 0.25; cam(V(Math.cos(a) * 3.6, 0.9, Math.sin(a) * 3.6), V(0, 0.36, 0), 36); }
          else { const k = sm(0, 4, u.lt); cam(V(lerp(1.4, 0.2, k), lerp(0.95, 1.5, k), lerp(2.5, 0.22, k)), V(0, lerp(0.52, 1.41, k), 0), 36); chip('届いた粒', '約1,500<small>個</small>'); }
        } },
    ],
  });

  // ================= 12 燃料もれ =================
  const LEAK = 1;                                   // B系統のスラスタ（下面の角）
  const pipeColors = (kA, kB, frost = 0) => {
    tweak(hb.mats.pipeA, m => { m.color.setRGB(lerp(0.35, 0.82, frost), lerp(0.6, 0.93, frost), 1.0); m.emissive.setRGB(0.05 + 0.2 * frost, 0.25 + 0.3 * frost, 0.9); m.emissiveIntensity = kA; });
    tweak(hb.mats.pipeB, m => { m.color.setRGB(lerp(1.0, 0.82, frost), lerp(0.55, 0.93, frost), lerp(0.2, 1.0, frost)); m.emissive.setRGB(lerp(1.0, 0.25, frost), lerp(0.4, 0.55, frost), lerp(0.05, 0.9, frost)); m.emissiveIntensity = kB; });
  };
  const nearIto = (d = 5000) => { const it = ito(); place(it); it.position.set(600, -d, -1200); it.quaternion.identity(); it.rotation.set(PI / 2, 0, 0.4); return it; };
  CH.push({
    date: '2005.11.26 – 12.08', title: '燃料もれ　そして通信がとだえる',
    lines: [
      { t: '上昇した直後、化学エンジンの燃料がもれ出した。B系統のスラスタのそばだった。弁を閉めて止めたが、もれた燃料は機体の中に広がった。' },
      { t: '液体の燃料は、蒸発するときにまわりの熱をうばう。機体が冷え、配管の中の燃料がこおった。A系統の配管はB系統と並んで通っていたので、両方とも使えなくなった。' },
      { t: '向きを保てなくなったはやぶさは、太陽電池を太陽に向けられない。電気が足りず、バッテリーは空になり、コンピュータは何度も再起動した。' },
      { t: '化学エンジンには頼れない。チームは、イオンエンジンの中和器から、キセノンガスをそのまま噴くことにした。口が斜めを向いているので、機体を回す力になる。' },
      { t: '押す力は、化学エンジンの約100万分の1しかない。それでも12月4日、この方法で向きを立て直し、通信が戻った。' },
      { t: 'しかし12月8日、機体の中に残っていた燃料が、ふたたびガスになって噴き出した。はやぶさは、こまの首ふりのようにふらつき、アンテナが地球から外れた。通信はとだえた。' },
    ],
    shots: [
      { at: 0, setup() {
          nearIto(); setSun(V(0.25, 0.9, 0.35), V(0, 0, 0), 4);
          useHB(upYaw(0.9)); hb.setXray(1); pipeColors(0.5, 0.5);
          lab('B系統', 'bad', M.branches[LEAK].pts[0]); lab('A系統', '', M.branches[0].pts[0]);
        },
        update(u) {
          const leak = sm(1.5, 3, u.st) * (1 - sm(9, 10.5, u.st));
          const p0 = wpos(M.branches[LEAK].pts[1]);
          if (leak > 0.05) puff(p0, wdir([-0.6, -0.5, 0.6]), 130 * u.dt * leak, { speed: 0.35, spread: 0.9, col: [1.0, 0.85, 0.55], alpha: 0.4, size: 0.035, grow: 0.06, life: 3.5 });
          pipeColors(0.5, 0.5 + 0.5 * Math.sin(u.t * 9) * leak);
          if (u.st > 2 && !S.l1) { S.l1 = true; ui.card('leak', '<div class="panel alert"><span class="dot"></span><p>B系統で燃料もれ</p></div>', 'top'); }
          if (u.st > 9.5 && !S.l2) { S.l2 = true; lab('弁を閉じる', 'ok', M.loops.mf); ui.hideCard('leak'); ui.card('valve', '<div class="panel"><h4>もれは止めた</h4><p>ただし、もれた燃料は機体の中に残った</p></div>', 'top'); }
          const a = 2.0 + u.st * 0.025;
          cam(V(Math.cos(a) * 3.3, -1.0 + u.st * 0.05, Math.sin(a) * 3.3), V(0.1, -0.15, 0), 40);
        } },
      { at: 1, setup() {
          nearIto(); setSun(V(0.25, 0.9, 0.35), V(0, 0, 0), 4);
          useHB(upYaw(0.9)); hb.setXray(1); pipeColors(0.5, 0.5);
        },
        update(u) {
          const f = sm(1.5, 9, u.st); pipeColors(0.5 + 0.5 * f, 0.5 + 0.5 * f, f);
          // 機体の中にただよう燃料のガス
          if (u.dt > 0 && u.st < 12) for (let i = 0; i < 2; i++) { const p = wpos([(R() - .5) * 0.8, (R() - .5) * 1.3, (R() - .5) * 0.9]); puff(p, V(0, 0, 0), 1, { speed: 0.05, spread: 1.5, col: [0.75, 0.88, 1.0], alpha: 0.25, size: 0.03, grow: 0.03, life: 2.5 }); }
          const on = u.st < 4 ? 0 : u.st < 8.5 ? 1 : 2;
          stepCard('frz', '機体の中で起きたこと', [['1', 'もれた燃料が蒸発し、熱をうばう'], ['2', '配管の中の燃料がこおる'], ['3', 'A系統もB系統も、力が出ない']], on);
          if (u.st > 9 && u.st < 11) [0, 3].forEach(i => rcsFire(i, u.dt, 0.08));
          const a = 2.2 + u.st * 0.03;
          cam(V(Math.cos(a) * 3.3, -0.9, Math.sin(a) * 3.3), V(0.1, -0.15, 0), 40);
        } },
      { at: 2, setup() {
          nearIto(); const sd = V(0.25, 0.9, 0.35).normalize(); setSun(sd, V(0, 0, 0), 4);
          useHB(upYaw(0.9)); hb.setXray(1); openBattery(); pipeColors(1, 1, 1); S.q0 = hold.quaternion.clone();
          lab('バッテリー', '', [M.cells[5][0], M.cells[5][1], M.cells[5][2] + 0.1]);
        },
        update(u) {
          const tum = sm(0, 10, u.st);
          hold.quaternion.copy(S.q0).premultiply(quat(tum * 1.5, tum * 0.5, tum * 0.9));
          const lit = Math.max(0, wdir([0, 0, 1]).dot(sunDir));
          tweak(hb.mats.cells, m => m.color.setScalar(0.25 + 0.75 * lit));
          const drain = sm(3, 11, u.st);
          for (let i = 0; i < 11; i++) tweak(hb.mats['cell#c' + i], m => { m.emissive.setRGB(0.2, 0.9, 0.5); m.emissiveIntensity = 1.2 * (1 - drain); m.color.setRGB(lerp(0.38, 0.12, drain), lerp(0.46, 0.12, drain), lerp(0.56, 0.13, drain)); });
          chip('発電', lit > 0.6 ? '足りている' : lit > 0.25 ? '足りない' : 'ほとんどゼロ');
          if (u.st > 11 && !S.c) { S.c = true; ui.card('rst', '<div class="panel alert"><span class="dot"></span><p>バッテリーが空に。コンピュータが再起動をくり返す</p></div>', 'top'); }
          const a = 0.6 + u.st * 0.02;
          cam(V(Math.cos(a) * 4.4, 2.4, Math.sin(a) * 4.4), V(0, 0.1, 0), 40);
        } },
      { at: 3, setup() {
          const sd = V(0.25, 0.9, 0.35).normalize(); setSun(sd, V(0, 0, 0), 4); ui.hideChip();
          useHB(); S.qa = quat(1.4, 0.4, 0.7).multiply(upYaw(0.2)); S.qb = basisQ(V(1, 0, 0.6), sd); hold.quaternion.copy(S.qa);
          lab('中和器', '', hb.thrusters[0].neut.toArray()); lab('中和器', '', hb.thrusters[3].neut.toArray());
        },
        update(u) {
          const on = (u.st % 3.2) < 2.1 && u.st > 1.2;
          if (on) { xenonJet(0, u.dt); xenonJet(3, u.dt); }
          const far = u.line >= 4;
          const k = far ? 1 : eio(c01((u.st - 2) / 16)) * 0.55;
          hold.quaternion.copy(S.qa).slerp(S.qb, k); hold.updateMatrixWorld(true);
          const c = wpos([M.ies.xp, 0, M.ies.zc]);
          const cp = c.clone().add(wdir([1, 0.25, 0.5]).multiplyScalar(1.5));
          cam(cp, c, 40, wdir([0, 0, 1]));
          if (u.st > 6) chip('押す力は化学エンジンの', '約100万分の1');
        } },
      { at: 4, setup() {
          const sd = V(0.25, 0.9, 0.35).normalize(); setSun(sd, V(0, 0, 0), 5);
          S.ed = V(0.45, 0.85, 0.28).normalize(); useHB(basisQ(V(1, 0, 0.6), S.ed));
          S.link = place(beam(0x8fd0ff, 0.035, 0.5)); S.next = 0;
          chip('2005年12月4日', '通信が戻る');
        },
        update(u) {
          const p0 = wpos([0, 0, M.hga.top]);
          setBeam(S.link, p0, p0.clone().addScaledVector(S.ed, 80));
          if (u.st > S.next) { S.next = u.st + 0.7; ring(p0.clone().addScaledVector(S.ed, 0.3), S.ed, 0x8fd0ff, 5, 2.4, 0.35); }
          const a = 2.3 + u.st * 0.03;
          cam(V(Math.cos(a) * 8.5, 1.2, Math.sin(a) * 8.5), V(0, 1.2, 0), 42);
        } },
      { at: 5, setup() {
          const sd = V(0.25, 0.9, 0.35).normalize(); setSun(sd, V(0, 0, 0), 5); ui.hideChip();
          S.ed = V(0.45, 0.85, 0.28).normalize(); S.q0 = basisQ(V(1, 0, 0.6), S.ed); useHB(S.q0);
          S.link = place(beam(0x8fd0ff, 0.035, 0.5)); S.ph = 0; S.lost = false;
          S.vents = [[0.5, 0.3, -0.56], [-0.3, 0.51, -0.2], [0.2, -0.51, -0.45], [-0.81, 0.2, 0.1]];
        },
        update(u) {
          const gas = sm(1, 3, u.st) * (1 - sm(10, 14, u.st));
          if (gas > 0.05) S.vents.forEach((v, i) => { if ((u.t * 0.7 + i * 0.37) % 1 < 0.6) puff(wpos(v), wdir([v[0], v[1], v[2]]).normalize(), 70 * u.dt * gas, { speed: 1.4, spread: 0.35, col: [1.0, 0.9, 0.7], alpha: 0.4, size: 0.04, grow: 0.16, life: 2.2 }); });
          // みそすり運動：回転の軸が円すいを描いてふらつく
          const cone = sm(2, 12, u.st) * 0.85; S.ph += u.dt * (0.6 + cone * 1.6);
          const tiltQ = new THREE.Quaternion().setFromAxisAngle(V(Math.cos(S.ph), 0, Math.sin(S.ph)), cone);
          hold.quaternion.copy(tiltQ).multiply(new THREE.Quaternion().setFromAxisAngle(S.ed, S.ph * 0.7)).multiply(S.q0); hold.updateMatrixWorld(true);
          const p0 = wpos([0, 0, M.hga.top]), ax = wdir([0, 0, 1]); const off = Math.acos(c01(ax.dot(S.ed)));
          setBeam(S.link, p0, p0.clone().addScaledVector(ax, 80));
          const ok = off < 0.12; S.link.material.color.setHex(ok ? 0x8fd0ff : 0xff4e44); S.link.material.opacity = ok ? 0.5 : 0.35 * (1 - sm(9, 13, u.st));
          if (u.st > 11 && !S.lost) { S.lost = true; ui.card('lost', '<div class="stamp">通信途絶</div>', 'mid'); }
          ui.noise(u.st > 10 ? 0.16 : 0);
          chip('アンテナのずれ', `${Math.round(off * 180 / PI)}<small>度</small>`);
          const a = 2.3 + u.st * 0.02;
          cam(V(Math.cos(a) * 9, 1.6, Math.sin(a) * 9), V(0, 0.8, 0), 42);
        } },
    ],
  });

  return CH;
}
