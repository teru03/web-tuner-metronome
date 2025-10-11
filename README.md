1# Web Tuner & Metronome

ブラウザで動作する高機能なチューナー＆メトロノーム。
PWA（Progressive Web App）に対応しており、PCやスマートフォンにインストールしてオフラインでも使用できます。

**デモURL:** [https://teru03.github.io/web-tuner-metronome/](https://teru03.github.io/web-tuner-metronome/)

## 主な機能

### チューナー
- **高精度ピッチ検出**: マイクから入力された音の周波数をリアルタイムで検出し、最も近い音名を表示します。
- **セント単位の表示**: 正確なピッチからのズレをセント単位で視覚的に表示し、細かいチューニングをサポートします。
- **基準ピッチ(A4)調整**: A4の周波数を400Hzから480Hzの範囲で自由に設定できます。設定は自動で保存されます。
- **自動モード**: 演奏中の音を自動で検知します。

### メトロノーム
- **正確なテンポキープ**: Web Workerを使用しているため、ブラウザがバックグラウンド状態でも正確なテンポを刻み続けます。
- **柔軟な設定**:
    - **テンポ**: 30〜160 BPMの範囲で設定可能。
    - **拍子**: 2/4, 3/4, 4/4, 6/8拍子に対応。
    - **譜割り**: 4分音符、8分音符、16分音符を選択できます。
- **サウンドON/OFF**: クリック音の有無を切り替えられます。
- **視覚的インジケーター**: 現在の拍を視覚的に確認できます。

## 使用技術
- [Next.js](https://nextjs.org/) - Reactフレームワーク
- [TypeScript](https://www.typescriptlang.org/)
- [next-pwa](https://github.com/shadowwalker/next-pwa) - PWA対応
- [Aubio.js](https://github.com/qiuxiang/aubiojs) - ピッチ検出ライブラリ
- [Web Audio API](https://developer.mozilla.org/ja/docs/Web/API/Web_Audio_API) - 音声処理
- [Web Worker](https://developer.mozilla.org/ja/docs/Web/API/Web_Workers_API/Using_web_workers) - バックグラウンド処理

## 開発

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 開発サーバーの起動
```bash
npm run dev
```
ブラウザで `http://localhost:3000` を開いてください。

## ビルドとエクスポート

静的なHTML/CSS/JSファイルを生成し、GitHub Pagesなどでホスティングするためのコマンドです。

```bash
npm run build
npm run export
```
`out`ディレクトリにファイルが生成されます。
