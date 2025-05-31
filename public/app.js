const form = document.getElementById("formulario");
const resultado = document.getElementById("resultado");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("fotito");
const btnClear = document.getElementById("btn-clear");

// ⚠️ Validación de archivos antes de enviar
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!fileInput.files.length) {
    Swal.fire({
      icon: "warning",
      title: "No files selected",
      text: "Please upload at least one image before converting.",
    });
    return;
  }

  const formData = new FormData(form);

  try {
    const res = await fetch("/convert", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Conversion failed");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    resultado.innerHTML = `
      <p>Download ZIP with converted images:</p>
      <a href="${url}" download="converted_images.zip" class="descargar">📦 Download ZIP</a>
    `;
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "There was a problem converting the images.",
    });
  }
});

// 🔴 SweetAlert2 para eliminar archivos
btnClear.addEventListener("click", async (e) => {
  e.preventDefault();

  const result = await Swal.fire({
    title: "Are you sure?",
    text: "This will delete all files from 'uploads' and 'outputs'.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Delete",
    cancelButtonText: "Cancel",
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch("/clear-data", { method: "POST" });
    const data = await res.json();

    Swal.fire({
      title: data.deleted > 0 ? "Deleted!" : "Nothing to delete",
      text: data.message,
      icon: data.deleted > 0 ? "success" : "info",
    });
  } catch (err) {
    console.error(err);
    Swal.fire({
      title: "Error",
      text: "The data could not be deleted.",
      icon: "error",
    });
  }
});

// 🟢 Manejadores para Dropzone
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  fileInput.files = e.dataTransfer.files;
  updateDropLabel();
});

// 🟡 Manejador para selección manual de archivos
fileInput.addEventListener("change", updateDropLabel);

// 🔄 Actualiza el texto del dropzone
function updateDropLabel() {
  const label = dropZone.querySelector("label");
  if (fileInput.files.length > 0) {
    label.textContent = `📂 ${fileInput.files.length} file(s) ready`;
  } else {
    label.textContent = "Drop your images here or click to select";
  }
}
