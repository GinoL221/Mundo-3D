document.addEventListener("DOMContentLoaded", function () {
  const carousel = document.getElementById("homepage-carousel");
  if (!carousel) return;

  const container = carousel.querySelector(".carousel-container");
  const slides = carousel.querySelectorAll(".carousel-slide");
  const prevBtn = carousel.querySelector(".carousel-prev");
  const nextBtn = carousel.querySelector(".carousel-next");
  const indicators = carousel.querySelectorAll(".carousel-indicators .indicator");

  const totalSlides = slides.length;
  let currentIndex = 0;
  let autoplayTimer = null;
  const INTERVAL = 4000;

  function goToSlide(index) {
    if (index < 0) {
      currentIndex = totalSlides - 1;
    } else if (index >= totalSlides) {
      currentIndex = 0;
    } else {
      currentIndex = index;
    }

    container.style.transform = "translateX(" + (-currentIndex * 100) + "%)";

    indicators.forEach(function (ind, i) {
      ind.classList.toggle("active", i === currentIndex);
    });
  }

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(function () {
      goToSlide(currentIndex + 1);
    }, INTERVAL);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  // Navigation buttons
  prevBtn.addEventListener("click", function () {
    goToSlide(currentIndex - 1);
    startAutoplay();
  });

  nextBtn.addEventListener("click", function () {
    goToSlide(currentIndex + 1);
    startAutoplay();
  });

  // Indicators
  indicators.forEach(function (indicator) {
    indicator.addEventListener("click", function () {
      goToSlide(parseInt(this.dataset.slide, 10));
      startAutoplay();
    });
  });

  // Pause on hover
  carousel.addEventListener("mouseenter", stopAutoplay);
  carousel.addEventListener("mouseleave", startAutoplay);

  // Initialize
  goToSlide(0);
  startAutoplay();
});
