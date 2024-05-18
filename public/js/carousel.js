document.addEventListener("DOMContentLoaded", function () {
    const container = document.querySelector(".carousel-container");
    const prevBtn = document.querySelector(".carousel-prev");
    const nextBtn = document.querySelector(".carousel-next");
  
    let currentIndex = 0;
  
    function showSlide(index) {
      currentIndex = index;
      const translateValue = -currentIndex * 100 + "%"; // Cambiado a 100%
      container.style.transform = "translateX(" + translateValue + ")";
    }
  
    function showPrev() {
      if (currentIndex > 0) {
        showSlide(currentIndex - 1);
      }
    }
  
    function showNext() {
      if (currentIndex < container.children.length - 1) {
        showSlide(currentIndex + 1);
      }
    }
  
    // Inicializar el ancho de los slides y mostrar el primer slide
    showSlide(currentIndex);
  
    // Agregar eventos a los botones de previo y siguiente
    prevBtn.addEventListener("click", showPrev);
    nextBtn.addEventListener("click", showNext);
  });
  