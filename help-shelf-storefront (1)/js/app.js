// Help-Shelf — Storefront logic

const CATEGORY_ICONS = {
  ebook: "📖",
  doc: "📄",
  photo: "🖼️",
  video: "🎬",
  script: "⚙️",
  app: "💻",
  service: "🛠️",
};

let allProducts = [];
let activeCategory = "all";

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("*")
    .order("sort_order");

  if (error) {
    console.error("Failed to load categories", error);
    return;
  }

  const nav = document.getElementById("category-nav");
  const allBtn = document.createElement("button");
  allBtn.className = "cat-btn active";
  allBtn.textContent = "All";
  allBtn.onclick = () => setCategory("all", allBtn);
  nav.appendChild(allBtn);

  data.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "cat-btn";
    btn.textContent = `${CATEGORY_ICONS[cat.id] || ""} ${cat.label}`;
    btn.onclick = () => setCategory(cat.id, btn);
    nav.appendChild(btn);
  });
}

function setCategory(catId, btnEl) {
  activeCategory = catId;
  document.querySelectorAll(".cat-btn").forEach((b) => b.classList.remove("active"));
  btnEl.classList.add("active");
  renderProducts();
}

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*, vendors(name)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load products", error);
    document.getElementById("product-grid").innerHTML =
      '<p class="empty-state">Could not load products. Check console for details.</p>';
    return;
  }

  allProducts = data;
  renderProducts();
}

function renderProducts() {
  const grid = document.getElementById("product-grid");
  const filtered =
    activeCategory === "all"
      ? allProducts
      : allProducts.filter((p) => p.category_id === activeCategory);

  if (filtered.length === 0) {
    grid.innerHTML = '<p class="empty-state">No products here yet.</p>';
    return;
  }

  grid.innerHTML = filtered
    .map((p) => {
      const thumbUrl = p.thumbnail_path
        ? supabaseClient.storage.from("thumbnails").getPublicUrl(p.thumbnail_path).data.publicUrl
        : null;

      const price = p.is_service ? "Request Quote" : `$${(p.price_cents / 100).toFixed(2)}`;

      return `
        <div class="product-card" onclick="openProduct('${p.id}')">
          <div class="product-thumb">
            ${
              thumbUrl
                ? `<img src="${thumbUrl}" alt="${escapeHtml(p.title)}" />`
                : `<div class="thumb-placeholder">${CATEGORY_ICONS[p.category_id] || "📦"}</div>`
            }
          </div>
          <div class="product-info">
            <span class="product-cat">${CATEGORY_ICONS[p.category_id] || ""} ${p.category_id}</span>
            <h3>${escapeHtml(p.title)}</h3>
            <p class="product-price">${price}</p>
          </div>
        </div>
      `;
    })
    .join("");
}

function openProduct(id) {
  const p = allProducts.find((x) => x.id === id);
  if (!p) return;

  const thumbUrl = p.thumbnail_path
    ? supabaseClient.storage.from("thumbnails").getPublicUrl(p.thumbnail_path).data.publicUrl
    : null;

  const price = p.is_service ? "Request Quote" : `$${(p.price_cents / 100).toFixed(2)}`;
  const actionLabel = p.is_service ? "Request This Service" : "Buy Now";

  document.getElementById("modal-body").innerHTML = `
    <div class="modal-thumb">
      ${thumbUrl ? `<img src="${thumbUrl}" alt="${escapeHtml(p.title)}" />` : `<div class="thumb-placeholder large">${CATEGORY_ICONS[p.category_id] || "📦"}</div>`}
    </div>
    <span class="product-cat">${CATEGORY_ICONS[p.category_id] || ""} ${p.category_id}</span>
    <h2>${escapeHtml(p.title)}</h2>
    <p class="vendor-name">by ${escapeHtml(p.vendors?.name || "Help-Shelf")}</p>
    <p class="modal-desc">${escapeHtml(p.description || "")}</p>
    <p class="modal-price">${price}</p>
    ${
      !p.is_service
        ? `<p class="license-note">Includes ${p.download_limit} downloads, valid ${p.license_days} days after purchase.</p>`
        : ""
    }
    <button class="buy-btn" onclick="alert('Checkout coming soon!')">${actionLabel}</button>
  `;

  document.getElementById("product-modal").classList.add("open");
}

function closeModal() {
  document.getElementById("product-modal").classList.remove("open");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

loadCategories();
loadProducts();
