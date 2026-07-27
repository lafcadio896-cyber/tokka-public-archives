(() => {
  const owner = "lafcadio896-cyber";
  const repo = "tokka-public-archives";
  const apiRoot = `https://api.github.com/repos/${owner}/${repo}/contents`;

  const list = document.querySelector("[data-record-list]");
  const count = document.querySelector("[data-record-count]");
  const updated = document.querySelector("[data-last-updated]");
  if (!list) return;

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const request = async (url) => {
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
    return response.json();
  };

  const readJson = async (folder) => {
    const files = await request(`${apiRoot}/archives/${encodeURIComponent(folder)}`);
    const finalJson = files.find((file) => file.name === "final.json");
    if (!finalJson?.download_url) return null;
    const response = await fetch(finalJson.download_url);
    if (!response.ok) return null;
    return response.json();
  };

  const readImages = async (folder) => {
    const files = await request(`${apiRoot}/archives/${encodeURIComponent(folder)}/images`);
    return files
      .filter((file) => file.type === "file" && /\.png$/i.test(file.name) && file.download_url)
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  };

  const formatDate = (folder) => {
    const match = folder.match(/TK-(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : "日付不詳";
  };

  const renderCard = (folder, report) => {
    const title = report?.title || "件名未整理の公開記録";
    const summary = report?.summary || "公開用記録一式。本文および画像は記録フォルダから参照できます。";
    const documentNumber = report?.document_number || folder;
    const unresolved = Array.isArray(report?.unresolved) ? report.unresolved.length : 0;

    return `
      <article class="record-card">
        <div class="record-id">${escapeHtml(documentNumber)}</div>
        <div>
          <h3 class="record-title">${escapeHtml(title)}</h3>
          <p class="record-summary">${escapeHtml(summary)}</p>
          <div class="record-meta">
            <span>公開日：${escapeHtml(formatDate(folder))}</span>
            <span>公開区分：一般</span>
            <span>未整理事項：${unresolved}件</span>
          </div>
        </div>
        <button class="record-link" type="button" data-open-record="${escapeHtml(folder)}" data-record-title="${escapeHtml(title)}">記録を閲覧</button>
      </article>`;
  };

  const viewer = document.createElement("dialog");
  viewer.className = "record-viewer";
  viewer.innerHTML = `
    <div class="viewer-frame">
      <header class="viewer-header">
        <div>
          <p class="viewer-label">公開記録</p>
          <h2 data-viewer-title>記録を読み込んでいます</h2>
        </div>
        <button class="viewer-close" type="button" data-close-viewer aria-label="閲覧画面を閉じる">閉じる</button>
      </header>
      <div class="viewer-status" data-viewer-status>画像を照会しています。</div>
      <div class="viewer-pages" data-viewer-pages></div>
      <footer class="viewer-footer">
        <span data-viewer-count></span>
        <a data-viewer-source target="_blank" rel="noopener noreferrer">記録原本を確認</a>
      </footer>
    </div>`;
  document.body.appendChild(viewer);

  const viewerTitle = viewer.querySelector("[data-viewer-title]");
  const viewerStatus = viewer.querySelector("[data-viewer-status]");
  const viewerPages = viewer.querySelector("[data-viewer-pages]");
  const viewerCount = viewer.querySelector("[data-viewer-count]");
  const viewerSource = viewer.querySelector("[data-viewer-source]");

  const closeViewer = () => {
    if (viewer.open) viewer.close();
  };

  viewer.querySelector("[data-close-viewer]").addEventListener("click", closeViewer);
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) closeViewer();
  });

  const openViewer = async (folder, title) => {
    viewerTitle.textContent = title;
    viewerStatus.textContent = "画像を照会しています。";
    viewerStatus.hidden = false;
    viewerPages.innerHTML = "";
    viewerCount.textContent = "";
    viewerSource.href = `https://github.com/${owner}/${repo}/tree/main/archives/${encodeURIComponent(folder)}`;
    viewer.showModal();

    try {
      const images = await readImages(folder);
      if (!images.length) {
        viewerStatus.textContent = "閲覧可能な画像が登録されていません。";
        return;
      }

      viewerStatus.hidden = true;
      viewerCount.textContent = `${images.length}ページ`;
      viewerPages.innerHTML = images.map((image, index) => `
        <figure class="viewer-page">
          <img src="${image.download_url}" alt="${escapeHtml(title)} ${index + 1}ページ目" loading="${index === 0 ? "eager" : "lazy"}">
          <figcaption>${String(index + 1).padStart(2, "0")} / ${String(images.length).padStart(2, "0")}</figcaption>
        </figure>`).join("");
    } catch (error) {
      viewerStatus.hidden = false;
      viewerStatus.textContent = "画像を取得できませんでした。時間をおいて再度確認してください。";
      console.error(error);
    }
  };

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-record]");
    if (!button) return;
    openViewer(button.dataset.openRecord, button.dataset.recordTitle);
  });

  const load = async () => {
    try {
      const folders = await request(`${apiRoot}/archives`);
      const names = folders
        .filter((entry) => entry.type === "dir" && entry.name.startsWith("TK-"))
        .map((entry) => entry.name)
        .sort()
        .reverse();

      count.textContent = `${names.length}件`;
      updated.textContent = names.length ? formatDate(names[0]) : "未登録";

      if (!names.length) {
        list.innerHTML = '<div class="empty-state">現在、一般公開中の記録はありません。</div>';
        return;
      }

      const records = await Promise.all(names.map(async (name) => ({
        name,
        report: await readJson(name).catch(() => null)
      })));
      list.innerHTML = records.map(({ name, report }) => renderCard(name, report)).join("");
    } catch (error) {
      count.textContent = "確認不能";
      updated.textContent = "確認不能";
      list.innerHTML = '<div class="error-state">公開記録一覧を取得できませんでした。時間をおいて再度確認してください。</div>';
      console.error(error);
    }
  };

  load();
})();