const CONFIG = globalThis.APP_CONFIG || {};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const phonePattern = /^(?:\+84|0)(?:\d[\s.-]?){8,10}\d$/;

const form = document.querySelector("#wish-form");
const dropZone = document.querySelector("#drop-zone");
const fileInput = document.querySelector("#image-file");
const imageUrlInput = document.querySelector("#image-url");
const uploadPrompt = document.querySelector("#upload-prompt");
const uploadPreview = document.querySelector("#upload-preview");
const previewImage = document.querySelector("#preview-image");
const fileName = document.querySelector("#file-name");
const uploadState = document.querySelector("#upload-state");
const submitButton = document.querySelector("#submit-button");
const formStatus = document.querySelector("#form-status");
const fireworksCanvas = document.querySelector("#fireworks-canvas");
const celebration = document.querySelector("#celebration");
const celebrationContent = document.querySelector("#celebration-content");
const replayFireworksButton = document.querySelector("#replay-fireworks");
const fireworksContext = fireworksCanvas.getContext("2d");

let isUploading = false;
let fireworksFrame = 0;
let fireworksTimeout = 0;
let launchTimeouts = [];
let rockets = [];
let sparks = [];
let lastCelebrationData = null;

const fireworkColors = [
  "#ff6b35",
  "#ffb627",
  "#7ac143",
  "#0e76bc",
  "#ff4f81",
  "#9b5de5",
  "#f8f7ff",
];

replayFireworksButton.addEventListener("click", startFireworks);
window.addEventListener("resize", resizeFireworksCanvas);

dropZone.addEventListener("click", (event) => {
  if (event.target !== fileInput && !isUploading) fileInput.click();
});

dropZone.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && !isUploading) {
    event.preventDefault();
    fileInput.click();
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (!isUploading) dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
});

dropZone.addEventListener("drop", (event) => {
  if (isUploading) return;
  const [file] = event.dataTransfer.files;
  if (file) handleFile(file);
});

fileInput.addEventListener("change", () => {
  const [file] = fileInput.files;
  if (file) handleFile(file);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFieldErrors();

  if (!validateForm()) return;

  setSubmitting(true);
  setFormStatus("Đang gửi lời ước nguyện của bạn...");

  try {
    const submittedCelebrationData = getCelebrationData();
    await submitToGoogleForm();
    lastCelebrationData = submittedCelebrationData;
    form.reset();
    resetUpload();
    setFormStatus("Ước nguyện đã được gửi. Cảm ơn bạn đã chia sẻ.", "success");
    startFireworks();
  } catch (error) {
    setFormStatus(
      error.message || "Chưa thể gửi biểu mẫu. Vui lòng thử lại.",
      "error",
    );
  } finally {
    setSubmitting(false);
  }
});

async function handleFile(file) {
  clearError("image");
  imageUrlInput.value = "";

  if (!file.type.startsWith("image/")) {
    showError("image", "Vui lòng chọn một tệp hình ảnh.");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showError("image", "Hình ảnh cần nhỏ hơn 5 MB.");
    return;
  }

  showPreview(file);
  setUploadState("Đang tải ảnh lên...");
  isUploading = true;
  dropZone.classList.add("is-uploading");

  try {
    imageUrlInput.value = await uploadToSupabase(file);
    setUploadState("Đã tải lên. Nhấn vào vùng ảnh để chọn lại.");
  } catch (error) {
    showError("image", error.message || "Không thể tải ảnh lên.");
    setUploadState("Tải ảnh thất bại. Nhấn để thử lại.");
  } finally {
    isUploading = false;
    dropZone.classList.remove("is-uploading");
  }
}

async function uploadToSupabase(file) {
  ensureSupabaseConfigured();

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeName = `${crypto.randomUUID()}.${extension}`;
  const objectPath = `public/${new Date().toISOString().slice(0, 10)}/${safeName}`;
  const uploadUrl = `${CONFIG.supabase.url}/storage/v1/object/${CONFIG.supabase.bucket}/${objectPath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: CONFIG.supabase.anonKey,
      Authorization: `Bearer ${CONFIG.supabase.anonKey}`,
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: file,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(
      detail.message || "Supabase từ chối tải ảnh. Kiểm tra bucket policy.",
    );
  }

  return `${CONFIG.supabase.url}/storage/v1/object/public/${CONFIG.supabase.bucket}/${objectPath}`;
}

async function submitToGoogleForm() {
  ensureGoogleFormConfigured();

  const data = new URLSearchParams();
  data.append(CONFIG.googleForm.fields.fullName, form.fullName.value.trim());
  data.append(CONFIG.googleForm.fields.phone, form.phone.value.trim());
  data.append(CONFIG.googleForm.fields.wish, form.wish.value.trim());
  data.append(CONFIG.googleForm.fields.imageUrl, imageUrlInput.value);

  await fetch(CONFIG.googleForm.action, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: data,
  });
}

function validateForm() {
  let isValid = true;

  if (!form.fullName.value.trim()) {
    showError("full-name", "Vui lòng nhập họ và tên.");
    isValid = false;
  }

  if (!phonePattern.test(form.phone.value.trim())) {
    showError("phone", "Vui lòng nhập số điện thoại hợp lệ.");
    isValid = false;
  }

  if (!form.wish.value.trim()) {
    showError("wish", "Vui lòng viết một điều ước nguyện.");
    isValid = false;
  }

  if (isUploading) {
    showError("image", "Hình ảnh vẫn đang được tải lên.");
    isValid = false;
  } else if (!imageUrlInput.value) {
    showError("image", "Vui lòng chọn và tải lên một hình ảnh.");
    isValid = false;
  }

  if (!isValid) {
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    firstInvalid?.focus();
    setFormStatus("Vui lòng kiểm tra lại các trường được đánh dấu.", "error");
  }

  return isValid;
}

function showPreview(file) {
  if (previewImage.src) URL.revokeObjectURL(previewImage.src);
  previewImage.src = URL.createObjectURL(file);
  fileName.textContent = file.name;
  uploadPrompt.hidden = true;
  uploadPreview.hidden = false;
}

function resetUpload() {
  imageUrlInput.value = "";
  if (previewImage.src) URL.revokeObjectURL(previewImage.src);
  previewImage.removeAttribute("src");
  uploadPrompt.hidden = false;
  uploadPreview.hidden = true;
  clearError("image");
}

function showError(fieldId, message) {
  const input =
    fieldId === "image" ? dropZone : document.querySelector(`#${fieldId}`);
  const error = document.querySelector(`#${fieldId}-error`);
  input?.setAttribute("aria-invalid", "true");
  if (error) error.textContent = message;
}

function clearError(fieldId) {
  const input =
    fieldId === "image" ? dropZone : document.querySelector(`#${fieldId}`);
  const error = document.querySelector(`#${fieldId}-error`);
  input?.removeAttribute("aria-invalid");
  if (error) error.textContent = "";
}

function clearFieldErrors() {
  ["full-name", "phone", "wish", "image"].forEach(clearError);
}

function setUploadState(message) {
  uploadState.textContent = message;
}

function setSubmitting(value) {
  submitButton.disabled = value;
  submitButton.querySelector("span").textContent = value
    ? "Đang gửi..."
    : "Gửi ước nguyện";
}

function setFormStatus(message, type = "") {
  formStatus.textContent = message;
  formStatus.className = `form-status${type ? ` is-${type}` : ""}`;
}

function getCelebrationData() {
  return [
    { label: "Họ và tên", value: form.fullName.value.trim() },
    { label: "Số điện thoại", value: form.phone.value.trim() },
    { label: "Ước nguyện", value: form.wish.value.trim() },
    {
      label: "Khoảnh khắc của bạn",
      imageUrl: imageUrlInput.value,
      alt: `Ảnh của ${form.fullName.value.trim()}`,
    },
  ];
}

function startFireworks() {
  if (!lastCelebrationData) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    stopFireworks();
    celebration.classList.add("is-active", "is-reduced");
    lastCelebrationData.forEach((item) => showCelebrationCard(item, 50, 50));
    replayFireworksButton.hidden = true;
    fireworksTimeout = window.setTimeout(stopFireworks, 7000);
    return;
  }

  stopFireworks();
  resizeFireworksCanvas();
  celebration.classList.add("is-active");
  replayFireworksButton.hidden = true;

  const isMobile = window.innerWidth < 600;
  const columns = isMobile ? 4 : 8;
  const launchCount = isMobile ? 16 : 30;
  const launchInterval = isMobile ? 330 : 290;
  const featuredLaunches = isMobile ? [0, 6, 9, 15] : [2, 9, 16, 23];

  for (let index = 0; index < launchCount; index += 1) {
    const column = index % columns;
    const xRatio = (column + 0.5 + randomBetween(-0.24, 0.24)) / columns;
    const delay = index * launchInterval + randomBetween(0, 180);
    const heightBand = index % 5;
    const contentIndex = featuredLaunches.indexOf(index);
    launchTimeouts.push(
      window.setTimeout(
        () =>
          launchFirework(
            xRatio,
            heightBand,
            contentIndex >= 0 ? lastCelebrationData[contentIndex] : null,
          ),
        delay,
      ),
    );
  }

  animateFireworks();
  fireworksTimeout = window.setTimeout(() => {
    celebration.classList.remove("is-active");
    replayFireworksButton.hidden = false;
  }, launchCount * launchInterval + 4600);
}

function stopFireworks() {
  cancelAnimationFrame(fireworksFrame);
  clearTimeout(fireworksTimeout);
  celebration.classList.remove("is-active", "is-reduced");
  celebrationContent.replaceChildren();
  launchTimeouts.forEach(clearTimeout);
  launchTimeouts = [];
  rockets = [];
  sparks = [];
  fireworksContext.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
}

function resizeFireworksCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  fireworksCanvas.width = window.innerWidth * pixelRatio;
  fireworksCanvas.height = window.innerHeight * pixelRatio;
  fireworksContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function launchFirework(xRatio, heightBand = 0, celebrationItem = null) {
  const startX = window.innerWidth * xRatio;
  const heightRanges = [
    [0.06, 0.2],
    [0.2, 0.36],
    [0.36, 0.52],
    [0.52, 0.68],
    [0.68, 0.82],
  ];
  const [minimumHeight, maximumHeight] = heightRanges[heightBand];
  const targetY = window.innerHeight * randomBetween(minimumHeight, maximumHeight);
  const color = fireworkColors[Math.floor(Math.random() * fireworkColors.length)];
  const travelDistance = window.innerHeight - targetY;

  rockets.push({
    x: startX,
    y: window.innerHeight + 20,
    previousX: startX,
    previousY: window.innerHeight + 20,
    velocityX: randomBetween(-0.8, 0.8),
    velocityY: -Math.sqrt(2 * 0.075 * travelDistance) * randomBetween(1.08, 1.22),
    targetY,
    color,
    brightness: randomBetween(0.72, 1),
    celebrationItem,
  });
}

function explodeFirework(rocket) {
  const particleCount = window.innerWidth < 600 ? 58 : 82;
  const shapeRoll = Math.random();

  if (rocket.celebrationItem) {
    showCelebrationCard(rocket.celebrationItem, rocket.x, rocket.y);
  }

  for (let index = 0; index < particleCount; index += 1) {
    const angle = (Math.PI * 2 * index) / particleCount + randomBetween(-0.035, 0.035);
    let speed = randomBetween(2.2, 6.7);

    if (shapeRoll > 0.72) {
      speed *= index % 2 ? 0.58 : 1;
    }

    sparks.push({
      x: rocket.x,
      y: rocket.y,
      previousX: rocket.x,
      previousY: rocket.y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      gravity: randomBetween(0.045, 0.085),
      friction: randomBetween(0.965, 0.982),
      alpha: 1,
      decay: randomBetween(0.009, 0.016),
      color:
        Math.random() > 0.8
          ? fireworkColors[Math.floor(Math.random() * fireworkColors.length)]
          : rocket.color,
      size: randomBetween(1.1, 2.2),
      twinkle: Math.random() > 0.62,
    });
  }
}

function showCelebrationCard(item, x, y) {
  const card = document.createElement("article");
  card.className = `celebration-card${item.imageUrl ? " celebration-card--image" : ""}`;

  if (item.imageUrl) {
    const image = document.createElement("img");
    image.src = item.imageUrl;
    image.alt = item.alt;
    card.append(image);
  } else {
    const label = document.createElement("span");
    const value = document.createElement("p");
    label.className = "celebration-card__label";
    value.className = "celebration-card__value";
    label.textContent = item.label;
    value.textContent = item.value;
    card.append(label, value);
  }

  const cardHalfWidth = item.imageUrl ? 105 : 150;
  const safeX = Math.min(
    Math.max(x, cardHalfWidth + 16),
    window.innerWidth - cardHalfWidth - 16,
  );
  const safeY = Math.min(Math.max(y, 100), window.innerHeight - 120);
  card.style.left = `${safeX}px`;
  card.style.top = `${safeY}px`;
  celebrationContent.append(card);

  if (!celebration.classList.contains("is-reduced")) {
    window.setTimeout(() => card.remove(), 4300);
  }
}

function animateFireworks() {
  fireworksContext.globalCompositeOperation = "destination-out";
  fireworksContext.fillStyle = "rgba(0, 0, 0, 0.16)";
  fireworksContext.fillRect(0, 0, window.innerWidth, window.innerHeight);
  fireworksContext.globalCompositeOperation = "lighter";

  rockets = rockets.filter((rocket) => {
    rocket.previousX = rocket.x;
    rocket.previousY = rocket.y;
    rocket.x += rocket.velocityX;
    rocket.y += rocket.velocityY;
    rocket.velocityY += 0.075;

    drawTrail(rocket.previousX, rocket.previousY, rocket.x, rocket.y, rocket.color, 2);

    if (rocket.y <= rocket.targetY || rocket.velocityY >= -1.2) {
      explodeFirework(rocket);
      return false;
    }

    return true;
  });

  sparks = sparks.filter((spark) => {
    spark.previousX = spark.x;
    spark.previousY = spark.y;
    spark.velocityX *= spark.friction;
    spark.velocityY = spark.velocityY * spark.friction + spark.gravity;
    spark.x += spark.velocityX;
    spark.y += spark.velocityY;
    spark.alpha -= spark.decay;

    if (!spark.twinkle || Math.random() > 0.28) {
      drawTrail(
        spark.previousX,
        spark.previousY,
        spark.x,
        spark.y,
        spark.color,
        spark.size,
        spark.alpha,
      );
    }

    return spark.alpha > 0;
  });

  if (rockets.length || sparks.length || replayFireworksButton.hidden) {
    fireworksFrame = requestAnimationFrame(animateFireworks);
  }
}

function drawTrail(fromX, fromY, toX, toY, color, width, alpha = 1) {
  fireworksContext.save();
  fireworksContext.globalAlpha = Math.max(alpha, 0);
  fireworksContext.strokeStyle = color;
  fireworksContext.lineWidth = width;
  fireworksContext.lineCap = "round";
  fireworksContext.beginPath();
  fireworksContext.moveTo(fromX, fromY);
  fireworksContext.lineTo(toX, toY);
  fireworksContext.stroke();
  fireworksContext.restore();
}

function randomBetween(minimum, maximum) {
  return Math.random() * (maximum - minimum) + minimum;
}

function ensureSupabaseConfigured() {
  if (
    !CONFIG.supabase?.url ||
    !CONFIG.supabase?.anonKey ||
    !CONFIG.supabase?.bucket
  ) {
    throw new Error(
      "Cần cấu hình Supabase trong biến môi trường trước khi tải ảnh.",
    );
  }
}

function ensureGoogleFormConfigured() {
  if (
    !CONFIG.googleForm?.action ||
    !CONFIG.googleForm?.fields ||
    Object.values(CONFIG.googleForm.fields).some((value) => !value)
  ) {
    throw new Error(
      "Cần cấu hình Google Form trong biến môi trường trước khi gửi.",
    );
  }
}
