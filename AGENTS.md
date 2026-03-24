# Expense Tracker - AI Assistant Guide

このドキュメント（`AGENTS.md`）は、AIアシスタントがこのプロジェクトの構成や仕様を素早くかつ正確に理解するためのガイドラインです。開発を依頼する際、AIはこのファイルを参照することで前提となる特殊な仕様を理解します。

---

## 🚀 プロジェクト概要
専用のサーバー（バックエンド）やデータベース（DB）を持たない、シンプルな出費管理Webアプリケーション（PWA対応）です。**ブラウザのJavaScriptから直接GitHub APIを叩き、CSVファイルを読み書きする**という特殊なアプローチでデータを管理しています。

## 🛠 コア技術スタック
- **Frontend**: HTML5 / CSS3 / Vanilla JavaScript（React等のフレームワークは不使用）
- **Backend / Database**: GitHub API （Personal Access Tokenを用いたリポジトリ内のファイル直接操作）
- **State / Settings**: `localStorage`

## ⚙️ 主要な仕様と特殊な仕組み

### 1. データの保存先と通信手法
- データは全てCSVフォーマット（`data.csv`, `subscriptions.csv`）でGitHubに直接保存されています。
- **読み込み**: `GET /repos/:owner/:repo/contents/:path`
- **書き込み**: `PUT /repos/:owner/:repo/contents/:path`
- JSONではないため、都度 `app.js` 内の `csvToJson` / `jsonToCsv` を関数を経由してデータの変換を行っています。

### 2. マルチアカウント（プロフィール）機能
`localStorage` の `gh-profile` の値によって、アクセスするCSVファイル名が動的に変化する仕様です。
- プロフィール名が空の場合: `data.csv` と `subscriptions.csv` を使用。
- プロフィール名が「パパ」の場合: `data_パパ.csv` と `subscriptions_パパ.csv` を動的に生成・使用。
これにより、1つのリポジトリの中で家族ごとの出費データを完全に分けて管理できるようになっています。

### 3. テーマ（着せ替え）機能
`localStorage` の `app-theme` にテーマ設定（`standard` または `kids`）を保持させています。
- 画面読み込み時に、`app.js` が `document.documentElement` (`<html>`要素) に対して該当するクラス（例: `.theme-kids`）を付与します。
- `index.css` の末尾で `html.theme-kids ...` といったセレクタを用いて標準CSSを上書きすることで、デザインを変更しています。

### 4. PWA キャッシュ対策（重要）
PWAとしてiOS/Androidのホーム画面に追加されることを前提としています。そのため、ブラウザキャッシュが非常に強力に効きます。
- JS・CSS・HTMLを改修した際は、必ず `index.html` に記述してある読み込み時の**クエリパラメータ（バージョン番号）をインクリメント**してください。
  ```html
  <link rel="stylesheet" href="index.css?v=5"> <!-- ここの数値を上げる -->
  <script src="app.js?v=5"></script> <!-- ここの数値を上げる -->
  ```

### 5. コードのデプロイメント（Webへの反映）
- このアプリケーションはローカル完結ではなく、GitHub Pages等でホスティングされています。
- コードを修正した場合は、必ず実機（スマホなど）で反映させるために `git commit -m "..." && git push` を最後まで実行してください。
