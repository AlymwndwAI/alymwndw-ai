const chatBox =
  document.getElementById("chat-box");

// =====================
// ADD MESSAGE
// =====================

function addMessage(
  text,
  type = "ai"
) {

  const wrapper =
    document.createElement("div");

  wrapper.className =

    type === "user"

      ? "message user-message"

      : "message ai-message";

  // =====================
  // AVATAR
  // =====================

  const avatar =
    type === "user"

      ? `
<div class="avatar">
  <img src="https://ui-avatars.com/api/?name=U&background=18e0bd&color=000"/>
</div>
`

      : `
<div class="avatar">
  <img src="deer.png"/>
</div>
`;

  // =====================
  // BUBBLE
  // =====================

  wrapper.innerHTML = `

    ${type === "ai" ? avatar : ""}

    <div class="bubble">
      ${text}
    </div>

    ${type === "user" ? avatar : ""}

  `;

  chatBox.appendChild(wrapper);

  chatBox.scrollTop =
    chatBox.scrollHeight;

  return wrapper;

}

// =====================
// TYPING
// =====================

function showTyping() {

  const typing =
    document.createElement("div");

  typing.className =
    "message ai-message";

  typing.id =
    "typing";

  typing.innerHTML = `

    <div class="avatar">
      <img src="deer.png"/>
    </div>

    <div class="bubble">
      <div class="typing">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    </div>

  `;

  chatBox.appendChild(typing);

  chatBox.scrollTop =
    chatBox.scrollHeight;

}

// =====================
// REMOVE TYPING
// =====================

function removeTyping() {

  const typing =
    document.getElementById("typing");

  if (typing) {
    typing.remove();
  }

}

// =====================
// SWITCH VARIANT IMAGE
// =====================

function switchVariantImage(
  imageId,
  newImage,
  button
) {

  const image =
    document.getElementById(imageId);

  if (image && newImage) {
    image.src = newImage;
  }

  // REMOVE ACTIVE

  const card =
    button.closest(".product-card");

  if (card) {

    card
      .querySelectorAll(".variant-btn")
      .forEach((btn) => {
        btn.classList.remove("active-variant");
      });

  }

  // ACTIVE BUTTON

  button.classList.add("active-variant");

}

// =====================
// AI CUSTOMIZE IMAGE
// =====================

async function generateCustomImage(handle, imageId, descId, resultId, btnId) {

  const descInput = document.getElementById(descId);
  const resultDiv = document.getElementById(resultId);
  const btn = document.getElementById(btnId);
  const productImage = document.getElementById(imageId);

  const userDesc = descInput.value.trim();
  if (!userDesc) {
    descInput.placeholder = "✍️ اكتب وصفك أولاً...";
    descInput.focus();
    return;
  }

  // LOADING STATE
  btn.disabled = true;
  btn.innerHTML = `<span class="ai-btn-spinner"></span> جاري التوليد...`;
  resultDiv.innerHTML = `
    <div class="ai-generating">
      <div class="ai-gen-dots">
        <span></span><span></span><span></span>
      </div>
      <p>✨ الذكاء الاصطناعي يرسم قطعتك...</p>
    </div>
  `;
  resultDiv.style.display = "block";

  try {

    const response = await fetch("/customize-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        productHandle: handle,
        productImage: productImage ? productImage.src : "",
        userDescription: userDesc,
      }),
    });

    const data = await response.json();

    if (data.requireEmail) {
      resultDiv.innerHTML = `
        <div class="ai-email-gate">
          <p>📧 أدخل إيميلك للاستمرار</p>
          <input type="email" id="email-gate-${handle}" placeholder="example@email.com" class="ai-email-input"/>
          <button class="ai-gen-btn" onclick="submitEmailAndGenerate('${handle}','${imageId}','${descId}','${resultId}','${btnId}')">
            متابعة
          </button>
        </div>
      `;
      btn.disabled = false;
      btn.innerHTML = `✨ توليد بالذكاء الاصطناعي`;
      return;
    }

    if (data.blocked) {
      resultDiv.innerHTML = `<p class="ai-limit-msg">⚠️ وصلت للحد الأقصى من الصور لهذه الجلسة.</p>`;
      btn.disabled = true;
      btn.innerHTML = `✨ توليد بالذكاء الاصطناعي`;
      return;
    }

    if (data.imageUrl) {
      resultDiv.innerHTML = `
        <div class="ai-result-wrap">
          <p class="ai-result-label">✨ تصميمك بالذكاء الاصطناعي</p>
          <img src="${data.imageUrl}" class="ai-result-img" alt="AI Generated"/>
          <p class="ai-result-remaining">متبقي ${data.remaining} توليد</p>
          <a href="${data.imageUrl}" download="alymwndw-custom.jpg" class="ai-download-btn">⬇️ تحميل الصورة</a>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `<p class="ai-limit-msg">حدث خطأ. حاول مرة أخرى.</p>`;
    }

  } catch (err) {
    resultDiv.innerHTML = `<p class="ai-limit-msg">حدث خطأ في الاتصال.</p>`;
  }

  btn.disabled = false;
  btn.innerHTML = `✨ توليد بالذكاء الاصطناعي`;
  chatBox.scrollTop = chatBox.scrollHeight;

}

// =====================
// EMAIL GATE SUBMIT
// =====================

async function submitEmailAndGenerate(handle, imageId, descId, resultId, btnId) {
  const emailInput = document.getElementById(`email-gate-${handle}`);
  const email = emailInput ? emailInput.value.trim() : "";
  if (!email) return;

  await fetch("/save-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, email }),
  });

  generateCustomImage(handle, imageId, descId, resultId, btnId);
}

// =====================
// PRODUCT CARD
// =====================

function renderProducts(products) {

  products.forEach((product) => {

    const firstVariant =
      product.variants?.[0] || {};

    const image =

      firstVariant.mappedImage ||
      firstVariant.image ||
      product.image ||
      "https://via.placeholder.com/500";

    const price =

      firstVariant.price ||
      product.price ||
      "";

    const rating =
      product.reviewRating || 4.9;

    const reviews =
      product.reviewCount || 120;

    const url =

      product.url ||
      `https://alymwndw.com/products/${product.handle}`;

    // =====================
    // IMAGE ID (SAFE)
    // =====================

    const imageId =
      `product-image-${product.handle}`;

    // =====================
    // AI CUSTOMIZER IDs
    // =====================

    const descId   = `ai-desc-${product.handle}`;
    const resultId = `ai-result-${product.handle}`;
    const btnId    = `ai-btn-${product.handle}`;

    // =====================
    // VARIANT BUTTONS
    // =====================

    const variantButtons =

      product.variants?.map((v, index) => {

        const variantImage =
          v.mappedImage ||
          v.image ||
          image;

        const variantName =
          v.metal ||
          v.stoneColor ||
          v.shape ||
          v.title ||
          "Variant";

        return `

<button

  class="variant-btn ${index === 0 ? "active-variant" : ""}"

  onclick="switchVariantImage(
    '${imageId}',
    '${variantImage}',
    this
  )"

>

  ${variantName}

</button>

        `;

      }).join("") || "";

    // =====================
    // CARD
    // =====================

    const card =
      document.createElement("div");

    card.className =
      "product-card";

    card.innerHTML = `

      <img
        id="${imageId}"
        src="${image}"
        class="product-image"
        onerror="this.src='https://via.placeholder.com/500'"
      />

      <div class="product-title">
        ${product.title}
      </div>

      <div class="product-price">
        ${price}
      </div>

      <div class="product-rating">
        ⭐ ${rating} (${reviews} reviews)
      </div>

      <div class="variant-switcher">
        ${variantButtons}
      </div>

      <div class="product-buttons">

        <a
          href="${url}"
          target="_blank"
          class="view-btn"
        >
          View
        </a>

        <a
          href="${url}"
          target="_blank"
          class="cart-btn"
        >
          Shop
        </a>

      </div>

      <!-- ===================== -->
      <!-- AI CUSTOMIZER SECTION -->
      <!-- ===================== -->

      <div class="ai-customizer">

        <div class="ai-customizer-header">
          <span class="ai-customizer-icon">✨</span>
          <span class="ai-customizer-title">خصّص قطعتك بالذكاء الاصطناعي</span>
        </div>

        <p class="ai-customizer-hint">
          صف التعديل اللي تريده — مثال: "عايز الحجر في النص أحمر والجانبين أصفر مع نقش اسم أحمد"
        </p>

        <textarea
          id="${descId}"
          class="ai-desc-input"
          placeholder="اكتب هنا بالعربي أو الإنجليزي..."
          rows="3"
        ></textarea>

        <button
          id="${btnId}"
          class="ai-gen-btn"
          onclick="generateCustomImage('${product.handle}','${imageId}','${descId}','${resultId}','${btnId}')"
        >
          ✨ توليد بالذكاء الاصطناعي
        </button>

        <div id="${resultId}" class="ai-result" style="display:none;"></div>

      </div>

    `;

    chatBox.appendChild(card);

  });

  chatBox.scrollTop =
    chatBox.scrollHeight;

}

// =====================
// HANDLE ENTER
// =====================

function handleKey(event) {

  if (event.key === "Enter") {
    sendMessage();
  }

}

// =====================
// SESSION ID
// =====================

let sessionId = null;

// =====================
// SEND MESSAGE
// =====================

async function sendMessage() {

  const input =
    document.getElementById("message");

  const message =
    input.value.trim();

  if (!message) return;

  // =====================
  // USER MESSAGE
  // =====================

  addMessage(message, "user");

  input.value = "";

  // =====================
  // SHOW TYPING
  // =====================

  showTyping();

  try {

    // =====================
    // FETCH
    // =====================

    const response = await fetch("/chat", {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        message,
        sessionId,
      }),

    });

    const data = await response.json();

    // =====================
    // SAVE SESSION ID
    // =====================

    if (data.sessionId) {
      sessionId = data.sessionId;
    }

    // =====================
    // REMOVE TYPING
    // =====================

    removeTyping();

    // =====================
    // AI MESSAGE
    // =====================

    addMessage(data.reply, "ai");

    // =====================
    // PRODUCTS
    // =====================

    if (
      data.products &&
      data.products.length
    ) {

      setTimeout(() => {
        renderProducts(data.products);
      }, 300);

    }

  } catch (err) {

    removeTyping();

    addMessage(
      "Something went wrong.",
      "ai"
    );

  }

}
