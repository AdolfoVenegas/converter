document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formulario");
  const resultado = document.getElementById("resultado");
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("fotito");
  const btnClear = document.getElementById("btn-clear");
  const spinner = document.getElementById("spinner");
  const btnReset = document.getElementById("btn-reset");
  const contenedorAcciones = document.getElementById("acciones-secundarias");

  // Dropzone: click para abrir selector
  dropZone.addEventListener("click", () => fileInput.click());

  // Dropzone: arrastrar archivos
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("highlight");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("highlight");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("highlight");
    fileInput.files = e.dataTransfer.files;
    updateDropZoneText(fileInput.files);
  });

  // Al seleccionar archivos manualmente
  fileInput.addEventListener("change", () => {
    updateDropZoneText(fileInput.files);
  });

  function updateDropZoneText(files) {
    const label = dropZone.querySelector("label");
    if (files.length === 0) {
      label.textContent = "Drop your images here or click to select";
    } else {
      label.textContent = `📂 ${files.length} file(s) ready`;
    }
  }

  // Envío del formulario
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

    spinner.classList.add("spin");

    const formData = new FormData();
    for (const file of fileInput.files) {
      formData.append("image", file);
    }

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
        <a href="${url}" download="converted_images.zip" class="descargar">
          <i class="material-icons">inventory_2</i>
          <span>Download ZIP</span>
        </a>
      `;

      Swal.fire({
        icon: "success",
        title: "Conversion complete!",
        text: "Your images were converted successfully. You can download them below.",
      });

      contenedorAcciones.style.display = "flex";
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "There was a problem converting the images.",
      });
    } finally {
      spinner.classList.remove("spin");
      fileInput.value = "";
      form.reset();
      updateDropZoneText([]);
    }
  });

  // Botón para reiniciar el formulario
  btnReset.addEventListener("click", () => {
    resultado.innerHTML = "";
    form.reset();
    updateDropZoneText([]);
    contenedorAcciones.style.display = "none";
  });

  // Eliminar archivos del servidor
  btnClear.addEventListener("click", async () => {
    const confirmed = await Swal.fire({
      icon: "question",
      title: "Clear uploaded files?",
      text: "This will delete temporary files from the server.",
      showCancelButton: true,
      confirmButtonText: "Yes, clear",
    });

    if (!confirmed.isConfirmed) return;

    try {
      const res = await fetch("/clear-data", { method: "POST" });
      const data = await res.json();

      Swal.fire({
        icon: "info",
        title: "Cleanup complete",
        text: data.message,
      });

      resultado.innerHTML = "";
      form.reset();
      updateDropZoneText([]);
      contenedorAcciones.style.display = "none";
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Could not clear server files.",
      });
    }
  });
});
