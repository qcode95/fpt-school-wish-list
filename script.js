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

let isUploading = false;

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
    await submitToGoogleForm();
    form.reset();
    resetUpload();
    setFormStatus("Ước nguyện đã được gửi. Cảm ơn bạn đã chia sẻ.", "success");
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
