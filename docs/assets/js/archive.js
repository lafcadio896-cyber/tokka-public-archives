(() => {
  const rawRoot = "https://raw.githubusercontent.com/lafcadio896-cyber/tokka-public-archives/main/archives";
  const manifestUrl = new URL("assets/data/records.json", document.baseURI).toString();

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

  const inlineMarkdown = (value = "") => escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");

  const renderMarkdown = (source = "") => {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let listItems = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      html.push(`<p>${paragraph.map(inlineMarkdown).join("<br>")}</p>`);
      paragraph = [];
    };

    const flushList = () => {
      if (!listItems.length) return;
      html.push(`<ul>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      listItems = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      const bullet = line.match(/^[-*]\s+(.+)$/);

      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }
      if (/^---+$/.test(line.trim())) {
        flushParagraph();
        flushList();
        html.push("<hr>");
        continue;
      }
      if (heading) {
        flushParagraph();
        flushList();
        const level = Math.min(4, heading[1].length);
        html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }
      if (bullet) {
        flushParagraph();
        listItems.push(bullet[1]);
        continue;
      }
      flushList();
      paragraph.push(line);
    }

    flushParagraph();
    flushList();
    return html.join("\n");
  };

  const fetchJson = async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return response.json();
  };

  const fetchText = async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return response.text();
  };

  const reportUrl = (folder) => `${rawRoot}/${encodeURIComponent(folder)}/report.md`;

  const formatDate = (entry) => {
    if (entry?.record_date && /^\d{4}-\d{2}-\d{2}$/.test(entry.record_date)) {
      const [year, month, day] = entry.record_date.split("-");
      return `${year}年${Number(month)}月${Number(day)}日`;
    }
    const match = entry?.folder?.match(/TK-(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : "日付不詳";
  };

  const renderCard = (entry) => {
    const title = entry?.title || "件名未整理の公開記録";
    const summary = entry?.summary || "公開記録";
    const documentNumber = entry?.document_number || entry.folder;
    const unresolved = Number(entry?.unresolved_count || 0);
    const type = entry?.document_type || "記録";

    return `
      <article class="record-card">
        <div class="record-id">${escapeHtml(documentNumber)}</div>
        <div>
          <h3 class="record-title">${escapeHtml(title)}</h3>
          <p class="record-summary">${escapeHtml(summary)}</p>
          <div class="record-meta">
            <span>記録日：${escapeHtml(formatDate(entry))}</span>
            <span>種別：${escapeHtml(type)}</span>
            <span>公開区分：${escapeHtml(entry?.public_class || "一般")}</span>
            <span>未整理事項：${unresolved}件</span>
          </div>
        </div>
        <button class="record-link" type="button" data-open-record="${escapeHtml(entry.folder)}">本文を閲覧</button>
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
      <div class="viewer-status" data-viewer-status>本文を照会しています。</div>
      <article class="viewer-document" data-viewer-document></article>
      <footer class="viewer-footer">
        <span data-viewer-meta></span>
      </footer>
    </div>`;
  document.body.appendChild(viewer);

  const viewerTitle = viewer.querySelector("[data-viewer-title]");
  const viewerStatus = viewer.querySelector("[data-viewer-status]");
  const viewerDocument = viewer.querySelector("[data-viewer-document]");
  const viewerMeta = viewer.querySelector("[data-viewer-meta]");
  const recordIndex = new Map();

  const closeViewer = () => {
    if (viewer.open) viewer.close();
  };

  viewer.querySelector("[data-close-viewer]").addEventListener("click", closeViewer);
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) closeViewer();
  });

  const openViewer = async (folder) => {
    const entry = recordIndex.get(folder);
    if (!entry) return;

    viewerTitle.textContent = entry.title || "公開記録";
    viewerStatus.textContent = "本文を照会しています。";
    viewerStatus.hidden = false;
    viewerDocument.hidden = true;
    viewerDocument.innerHTML = "";
    viewerMeta.textContent = `${entry.document_type || "記録"} / ${entry.department || "記録編纂課"}`;
    viewer.showModal();

    try {
      const markdown = await fetchText(reportUrl(folder));
      viewerDocument.innerHTML = renderMarkdown(markdown);
      viewerStatus.hidden = true;
      viewerDocument.hidden = false;
    } catch (error) {
      viewerStatus.textContent = "本文を取得できませんでした。";
      console.error(error);
    }
  };

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-record]");
    if (!button) return;
    openViewer(button.dataset.openRecord);
  });

  const load = async () => {
    try {
      const manifest = await fetchJson(manifestUrl);
      const records = Array.isArray(manifest?.records) ? manifest.records : [];
      records
        .filter((entry) => entry && typeof entry.folder === "string")
        .forEach((entry) => recordIndex.set(entry.folder, entry));

      const entries = [...recordIndex.values()].sort((a, b) => b.folder.localeCompare(a.folder));
      count.textContent = `${entries.length}件`;
      updated.textContent = entries.length ? formatDate(entries[0]) : "未登録";

      if (!entries.length) {
        list.innerHTML = '<div class="empty-state">現在、一般公開中の記録はありません。</div>';
        return;
      }

      list.innerHTML = entries.map(renderCard).join("");
    } catch (error) {
      count.textContent = "確認不能";
      updated.textContent = "確認不能";
      list.innerHTML = '<div class="error-state">公開記録一覧を取得できませんでした。時間をおいて再度確認してください。</div>';
      console.error(error);
    }
  };

  load();
})();
