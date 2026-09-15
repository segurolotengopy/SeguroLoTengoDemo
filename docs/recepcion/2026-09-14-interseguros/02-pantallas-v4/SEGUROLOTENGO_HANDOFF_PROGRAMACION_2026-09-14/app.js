(() => {
  "use strict";

  const data = window.SEGUROLOTENGO_HANDOFF;
  if (!data || !Array.isArray(data.screens)) {
    document.body.innerHTML = "<p>No fue posible cargar el inventario de pantallas.</p>";
    return;
  }

  const elements = {
    metrics: document.querySelector("#metrics"),
    status: document.querySelector("#status-filter"),
    group: document.querySelector("#group-filter"),
    search: document.querySelector("#search-filter"),
    list: document.querySelector("#screen-list"),
    count: document.querySelector("#result-count"),
    code: document.querySelector("#screen-code"),
    badge: document.querySelector("#status-badge"),
    title: document.querySelector("#screen-title"),
    groupTitle: document.querySelector("#group-title"),
    image: document.querySelector("#screen-image"),
    caption: document.querySelector("#screen-caption"),
    details: document.querySelector("#technical-details"),
    linkedSpec: document.querySelector("#linked-spec"),
    integrity: document.querySelector("#integrity"),
    openSource: document.querySelector("#open-source"),
    previous: document.querySelector("#previous-screen"),
    next: document.querySelector("#next-screen"),
    pending: document.querySelector("#pending-grid"),
  };

  const groupByCode = new Map(data.screen_groups.map(group => [group.screen_code, group]));
  let visibleScreens = [];
  let selectedId = data.screens.find(screen => screen.approved_for_development)?.id || data.screens[0]?.id;

  function metric(value, label) {
    return `<article class="metric"><strong>${value}</strong><span>${label}</span></article>`;
  }

  function renderMetrics() {
    const counts = data.meta.counts;
    elements.metrics.innerHTML = [
      metric(counts.approved_visual_artifacts, "artefactos APROBADA FINAL"),
      metric(counts.approved_runtime_views, "vistas aprobadas programables"),
      metric(counts.candidate_visual_artifacts, "artefactos candidatos"),
      metric(counts.total_visual_artifacts, "referencias visuales recuperadas"),
    ].join("");
  }

  function renderGroupOptions() {
    for (const group of data.screen_groups) {
      const option = document.createElement("option");
      option.value = group.screen_code;
      option.textContent = `${group.screen_code} · ${group.title}`;
      elements.group.append(option);
    }
  }

  function matchesStatus(screen) {
    switch (elements.status.value) {
      case "development": return screen.approved_for_development;
      case "approved": return screen.approval_status === "APROBADA_FINAL";
      case "candidate": return screen.approval_status === "CANDIDATA";
      default: return true;
    }
  }

  function filteredScreens() {
    const query = elements.search.value.trim().toLocaleLowerCase("es");
    return data.screens.filter(screen => {
      if (!matchesStatus(screen)) return false;
      if (elements.group.value !== "all" && screen.screen_code !== elements.group.value) return false;
      if (!query) return true;
      return [screen.screen_code, screen.state_code, screen.title, screen.group_title, screen.original_filename]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(query);
    });
  }

  function statusLabel(screen) {
    if (screen.approval_status === "APROBADA_FINAL") {
      return screen.artifact_type === "summary_board" ? "APROBADA · RESUMEN" : "APROBADA FINAL";
    }
    return "CANDIDATA";
  }

  function renderList() {
    visibleScreens = filteredScreens();
    elements.count.textContent = `${visibleScreens.length} resultado${visibleScreens.length === 1 ? "" : "s"}`;
    if (!visibleScreens.some(screen => screen.id === selectedId)) {
      selectedId = visibleScreens[0]?.id || null;
    }
    elements.list.innerHTML = "";
    for (const screen of visibleScreens) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `screen-item${screen.id === selectedId ? " is-active" : ""}`;
      button.dataset.screenId = screen.id;
      button.innerHTML = `<strong>${screen.screen_code} · ${screen.title}</strong><span>${screen.state_code} · ${statusLabel(screen)}</span>`;
      button.addEventListener("click", () => selectScreen(screen.id));
      elements.list.append(button);
    }
    renderSelected();
  }

  function addDetail(fragment, term, value) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = value;
    fragment.append(dt, dd);
  }

  function renderSelected() {
    const screen = data.screens.find(item => item.id === selectedId);
    if (!screen) {
      elements.title.textContent = "No hay pantallas para este filtro";
      elements.image.removeAttribute("src");
      elements.openSource.classList.add("is-hidden");
      elements.previous.disabled = true;
      elements.next.disabled = true;
      return;
    }

    const group = groupByCode.get(screen.screen_code) || {};
    elements.code.textContent = `${screen.screen_code} / ${screen.state_code}`;
    elements.badge.textContent = statusLabel(screen);
    elements.badge.classList.toggle("is-candidate", screen.approval_status === "CANDIDATA");
    elements.title.textContent = screen.title;
    elements.groupTitle.textContent = screen.group_title;
    elements.image.src = screen.reference_image;
    elements.image.alt = `Pantalla ${screen.screen_code}, ${screen.title}, ${statusLabel(screen)}`;
    elements.caption.textContent = screen.original_filename;
    elements.openSource.href = screen.reference_image;
    elements.openSource.classList.remove("is-hidden");
    elements.integrity.textContent = `SHA-256: ${screen.image.sha256}`;

    const fragment = document.createDocumentFragment();
    addDetail(fragment, "Etapa", screen.main_stage ? `${screen.main_stage} de 5` : "No definida");
    addDetail(fragment, "Estado", statusLabel(screen));
    addDetail(fragment, "Uso", screen.approved_for_development ? "Apta para desarrollo" : "Solo referencia");
    addDetail(fragment, "Tipo", screen.artifact_type);
    addDetail(fragment, "Objetivo", group.purpose || "Consultar el arte fuente");
    addDetail(fragment, "Acción principal", group.primary_action || "No definida");
    addDetail(fragment, "Dimensiones", `${screen.image.width} × ${screen.image.height} px`);
    elements.details.replaceChildren(fragment);

    if (group.linked_spec) {
      elements.linkedSpec.href = group.linked_spec.replace(/^data\//, "data/");
      elements.linkedSpec.classList.remove("is-hidden");
    } else {
      elements.linkedSpec.classList.add("is-hidden");
    }

    const index = visibleScreens.findIndex(item => item.id === selectedId);
    elements.previous.disabled = index <= 0;
    elements.next.disabled = index < 0 || index >= visibleScreens.length - 1;
    document.querySelectorAll(".screen-item").forEach(button => {
      button.classList.toggle("is-active", button.dataset.screenId === selectedId);
    });
  }

  function selectScreen(id) {
    selectedId = id;
    renderSelected();
  }

  function move(offset) {
    const index = visibleScreens.findIndex(item => item.id === selectedId);
    const target = visibleScreens[index + offset];
    if (!target) return;
    selectScreen(target.id);
    document.querySelector(`[data-screen-id="${target.id}"]`)?.scrollIntoView({block: "nearest"});
  }

  function renderPending() {
    elements.pending.innerHTML = data.pending_gates.map(item => `
      <article class="pending-card">
        <strong>${item.screen_code} · ${item.title || "Pantalla pendiente"}</strong>
        <span>${item.status.replaceAll("_", " ")}</span>
        <p>${item.reason}</p>
      </article>
    `).join("");
  }

  [elements.status, elements.group].forEach(control => control.addEventListener("change", renderList));
  elements.search.addEventListener("input", renderList);
  elements.previous.addEventListener("click", () => move(-1));
  elements.next.addEventListener("click", () => move(1));
  document.addEventListener("keydown", event => {
    if (event.target.matches("input, select, textarea")) return;
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });

  renderMetrics();
  renderGroupOptions();
  renderPending();
  renderList();
})();
