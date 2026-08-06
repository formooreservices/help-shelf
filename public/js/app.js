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

  const price = p.is_service ? "Request Quote" : p.price_cents === 0 ? "Free" : `$${(p.price_cents / 100).toFixed(2)}`;

  let actionHtml;
  if (p.is_service) {
    actionHtml = `
      <form id="service-form" onsubmit="submitServiceRequest(event, '${p.id}')">
        <input type="email" id="sr-email" placeholder="Your email" required style="width:100%; margin-bottom:0.6rem; padding:0.7rem; border-radius:4px; border:1px solid var(--shelf-line); background:var(--card); color:var(--ink); font-family:var(--font-body);" />
        <textarea id="sr-details" placeholder="What do you need?" rows="3" required style="width:100%; margin-bottom:0.6rem; padding:0.7rem; border-radius:4px; border:1px solid var(--shelf-line); background:var(--card); color:var(--ink); font-family:var(--font-body); resize:vertical;"></textarea>
        <button type="submit" class="buy-btn">Send Request</button>
        <p id="sr-status" class="form-status"></p>
      </form>
    `;
  } else if (p.price_cents === 0) {
    actionHtml = `
      <form id="free-form" onsubmit="claimFree(event, '${p.id}')">
        <input type="email" id="free-email" placeholder="Your email" required style="width:100%; margin-bottom:0.6rem; padding:0.7rem; border-radius:4px; border:1px solid var(--shelf-line); background:var(--card); color:var(--ink); font-family:var(--font-body);" />
        <button type="submit" class="buy-btn">Get It Free</button>
        <p id="free-status" class="form-status"></p>
      </form>
    `;
  } else {
    actionHtml = `
      <form id="buy-form" onsubmit="startCheckout(event, '${p.id}')">
        <input type="email" id="buy-email" placeholder="Your email" required style="width:100%; margin-bottom:0.6rem; padding:0.7rem; border-radius:4px; border:1px solid var(--shelf-line); background:var(--card); color:var(--ink); font-family:var(--font-body);" />
        <button type="submit" class="buy-btn">Buy Now</button>
        <p id="buy-status" class="form-status"></p>
      </form>
    `;
  }

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
    ${actionHtml}
  `;

  document.getElementById("product-modal").classList.add("open");
}

async function startCheckout(e, productId) {
  e.preventDefault();
  const status = document.getElementById("buy-status");
  const email = document.getElementById("buy-email").value.trim();
  status.textContent = "Redirecting to checkout…";
  try {
    const res = await fetch("/.netlify/functions/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, buyer_email: email }),
    });
    const data = await res.json();
    if (!res.ok) {
      status.textContent = data.error || "Could not start checkout.";
      return;
    }
    window.location.href = data.url;
  } catch (err) {
    status.textContent = "Something went wrong. Try again.";
  }
}

async function claimFree(e, productId) {
  e.preventDefault();
  const status = document.getElementById("free-status");
  const email = document.getElementById("free-email").value.trim();
  status.textContent = "Getting your download ready…";
  try {
    const res = await fetch("/.netlify/functions/claim-free", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, buyer_email: email }),
    });
    const data = await res.json();
    if (!res.ok) {
      status.textContent = data.error || "Something went wrong.";
      return;
    }
    window.location.href = `download.html?key=${encodeURIComponent(data.license_key)}`;
  } catch (err) {
    status.textContent = "Something went wrong. Try again.";
  }
}

async function submitServiceRequest(e, productId) {
  e.preventDefault();
  const status = document.getElementById("sr-status");
  const email = document.getElementById("sr-email").value.trim();
  const details = document.getElementById("sr-details").value.trim();
  const p = allProducts.find((x) => x.id === productId);
  status.textContent = "Sending…";
  try {
    const { error } = await supabaseClient.from("service_requests").insert({
      product_id: productId,
      vendor_id: p.vendor_id,
      buyer_email: email,
      details,
    });
    if (error) throw error;
    status.textContent = "Request sent! We'll follow up by email.";
    document.getElementById("service-form").reset();
  } catch (err) {
    status.textContent = "Could not send request. Try again.";
  }
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
