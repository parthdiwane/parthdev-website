const categoryLabels = {
  academic: "academic",
  personal: "personal",
  misc: "misc",
  all: "all writings",
};

const pageRoot = document.getElementById("writing-page");
const writingList = document.getElementById("writing-list");
const writingCount = document.getElementById("writing-count");
const pageTitle = document.getElementById("writing-title");
const pageDescription = document.getElementById("writing-description");

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value.toLowerCase()
    : parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).toLowerCase();
};

const sortValue = (entry) => entry.addedOn || entry.writtenOn || "";

const renderEmptyState = (category) => {
  writingList.innerHTML = `
    <article class="border border-line bg-panel p-6 shadow-panel">
      <p class="text-sm uppercase tracking-[0.16em] text-mist">[coming soon]</p>
    </article>
  `;
};

const renderEntry = (entry, index) => {
  const wrapper = document.createElement("article");
  wrapper.className = "border-y border-line py-6";

  const dateLabel = entry.addedOn
    ? `added ${formatDate(entry.addedOn)}`
    : entry.writtenOn
      ? `written ${formatDate(entry.writtenOn)}`
      : "date tbd";

  const secondaryDate =
    entry.addedOn && entry.writtenOn
      ? `<p class="mt-1 text-sm text-mist">written ${formatDate(entry.writtenOn)}</p>`
      : "";

  const title = entry.href
    ? `<a href="${entry.href}" class="border-b border-transparent pb-1 transition hover:border-ink">${entry.title}</a>`
    : entry.title;

  wrapper.innerHTML = `
    <div class="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)] md:gap-6">
      <div class="text-[0.82rem] uppercase tracking-[0.16em] text-mist">
        <p>${String(index + 1).padStart(2, "0")}</p>
      </div>
      <div>
        <p class="text-sm uppercase tracking-[0.16em] text-mist">${dateLabel}</p>
        ${secondaryDate}
        <h2 class="mt-3 text-2xl tracking-[-0.03em] text-ink">${title}</h2>
        <p class="mt-3 max-w-3xl leading-8 text-mist">${entry.summary || "no summary added yet."}</p>
      </div>
    </div>
  `;

  return wrapper;
};

if (pageRoot && writingList && writingCount && pageTitle && pageDescription) {
  const category = pageRoot.dataset.category || "all";
  const allWritings = Array.isArray(window.writings) ? window.writings.slice() : [];
  const visibleWritings = allWritings
    .filter((entry) => (category === "all" ? true : entry.category === category))
    .sort((left, right) => sortValue(right).localeCompare(sortValue(left)));

  const label = categoryLabels[category] || "writing";
  pageTitle.textContent = label;
  pageDescription.textContent = "";
  pageDescription.classList.add("hidden");
  writingCount.textContent = `${visibleWritings.length} piece${visibleWritings.length === 1 ? "" : "s"}`;

  if (visibleWritings.length === 0) {
    renderEmptyState(category);
  } else {
    const fragment = document.createDocumentFragment();
    visibleWritings.forEach((entry, index) => {
      fragment.appendChild(renderEntry(entry, index));
    });
    writingList.replaceChildren(fragment);
  }
}
