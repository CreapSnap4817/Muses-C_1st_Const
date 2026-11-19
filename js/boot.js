// 読みこみ方の切り替え。
//   ファイルを直接開いたとき（file://）：ブラウザはモジュールと画像の読みこみを止めるので、
//   1本にまとめたスクリプト（offline/app.js）と、埋め込んだ画像（offline/assets.js）を使う。
//   サーバーから開いたとき：モジュールをそのまま読みこむ。
(function () {
  if (location.protocol === 'file:') {
    document.write('<script src="./offline/assets.js"><\/script><script src="./offline/app.js"><\/script>');
  } else {
    var s = document.createElement('script'); s.type = 'module'; s.src = './js/main.js'; document.body.appendChild(s);
  }
})();
